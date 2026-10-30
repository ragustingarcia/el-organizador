import type { Change } from './change-plan';
import { findOrCreateFolder, moveBookmark, updateBookmarkTitle } from './modifier';

type Snapshot = { id: string; title: string; url: string; parentId: string; index: number };
type Entry = { before: Snapshot; after: { title: string; parentId: string } };
type Progress = { state: 'prepared' | 'verified' | 'reverted'; index?: number };
export type Recovery = { version: 1; createdAt: number; id?: string; entries: Entry[]; journal?: boolean; folders?: { title: string; parentId: string; id?: string }[] };
const KEY = 'recoverySnapshot';

function checked<T>(operation: (callback: (value: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => operation(value => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message)); else resolve(value);
  }));
}

async function getNode(id: string) {
  const nodes = await checked<chrome.bookmarks.BookmarkTreeNode[]>(cb => chrome.bookmarks.get(id, cb));
  const node = nodes[0];
  if (!node || node.unmodifiable) throw new Error('Marcador no disponible para editar.');
  return node;
}

function snapshot(node: chrome.bookmarks.BookmarkTreeNode): Snapshot {
  if (!node.url || !node.parentId) throw new Error('El elemento ya no es un marcador editable.');
  return { id: node.id, title: node.title, url: node.url, parentId: node.parentId, index: node.index ?? 0 };
}

export async function loadRecovery(): Promise<Recovery | null> {
  const data = await checked<Record<string, unknown>>(cb => chrome.storage.local.get(KEY, cb));
  const value = data[KEY] as Recovery | undefined;
  if (!value) return null;
  if (!Number.isSafeInteger(value.createdAt) || value.createdAt <= 0) throw new Error('Identificador de copia inválido.');
  if (value.version !== 1 || !Array.isArray(value.entries)) throw new Error('Copia de recuperación incompatible.');
  if (value.id !== undefined && (typeof value.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(value.id))) throw new Error('Identificador de trabajo inválido.');
  const identities = new Set<string>();
  for (const entry of value.entries) {
    if (!entry || !entry.before || !entry.after ||
      !['id', 'title', 'url', 'parentId'].every(key => typeof entry.before[key as keyof Snapshot] === 'string') ||
      !Number.isInteger(entry.before.index) || entry.before.index < 0 ||
      typeof entry.after.title !== 'string' || typeof entry.after.parentId !== 'string') {
      throw new Error('Copia de recuperación inválida. No se ejecutará.');
    }
    if (identities.has(entry.before.id)) throw new Error('La copia contiene operaciones duplicadas.');
    identities.add(entry.before.id);
  }
  return value;
}

export async function clearRecovery(): Promise<void> {
  await checked<void>(cb => chrome.storage.local.remove(KEY, cb));
}

async function save(recovery: Recovery) {
  await checked<void>(cb => chrome.storage.local.set({ [KEY]: recovery }, cb));
}

function progressKey(recovery: Recovery, id: string) { return `operation:${recovery.id ?? recovery.createdAt}:${id}`; }
async function readProgress(recovery: Recovery, id: string): Promise<Progress | undefined> {
  const key = progressKey(recovery, id);
  const data = await checked<Record<string, Progress>>(cb => chrome.storage.local.get(key, cb));
  const value = data[key];
  if (value && (!['prepared', 'verified', 'reverted'].includes(value.state) || (value.index !== undefined && (!Number.isInteger(value.index) || value.index < 0)))) throw new Error('Estado de operación inválido.');
  return value;
}
async function writeProgress(recovery: Recovery, id: string, value: Progress) {
  await checked<void>(cb => chrome.storage.local.set({ [progressKey(recovery, id)]: value }, cb));
}

async function execute(recovery: Recovery): Promise<number> {
  let applied = 0;
  for (const { before, after } of recovery.entries) {
    const control = await checked<Record<string, boolean>>(cb => chrome.storage.local.get(`pause:${recovery.id ?? recovery.createdAt}`, cb));
    if (control[`pause:${recovery.id ?? recovery.createdAt}`]) throw new Error('Trabajo pausado. Podés reanudarlo o recuperar los cambios.');
    const progress = await readProgress(recovery, before.id);
    if (progress?.state === 'reverted') continue;
    const current = snapshot(await getNode(before.id));
    if (progress?.state === 'verified') {
      if (current.url !== before.url || current.title !== after.title || current.parentId !== after.parentId || (progress.index !== undefined && current.index !== progress.index)) {
        throw new Error('Un marcador completado cambió. Revisá el conflicto antes de continuar.');
      }
      applied++;
      continue;
    }
    // A prepared operation may already have reached Chrome before shutdown.
    const compatible = current.url === before.url &&
      [before.title, after.title].includes(current.title) &&
      [before.parentId, after.parentId].includes(current.parentId);
    if (!compatible || (!progress && (current.title !== before.title || current.parentId !== before.parentId))) {
      throw new Error('Un marcador cambió durante la aplicación.');
    }
    await writeProgress(recovery, before.id, { state: 'prepared' });
    if (current.parentId !== after.parentId) await moveBookmark(before.id, after.parentId);
    const latest = snapshot(await getNode(before.id));
    if (latest.url !== before.url || ![before.title, after.title].includes(latest.title) || latest.parentId !== after.parentId) {
      throw new Error('El marcador cambió antes de renombrarlo. Se conserva la copia.');
    }
    if (latest.title !== after.title) await updateBookmarkTitle(before.id, after.title);
    const verified = snapshot(await getNode(before.id));
    if (verified.title !== after.title || verified.parentId !== after.parentId || verified.url !== before.url) throw new Error('No se pudo verificar el resultado.');
    await writeProgress(recovery, before.id, { state: 'verified' });
    applied++;
  }
  // Record final positions after all operations have shifted sibling indexes.
  for (const entry of recovery.entries) {
    const progress = await readProgress(recovery, entry.before.id);
    if (progress?.state === 'verified') {
      const node = snapshot(await getNode(entry.before.id));
      if (node.title !== entry.after.title || node.url !== entry.before.url || node.parentId !== entry.after.parentId || (progress.index !== undefined && progress.index !== node.index)) throw new Error('El resultado cambió antes de cerrar el trabajo.');
      await writeProgress(recovery, node.id, { state: 'verified', index: node.index });
    }
  }
  return applied;
}

/** Validate the entire plan and persist its intent before any bookmark mutation. */
async function applyPlan(plan: Change[]): Promise<number> {
  if (!plan.length) return 0;
  if (await loadRecovery()) throw new Error('Conservá o deshacé la copia anterior antes de aplicar otra limpieza.');
  const initial = new Map<string, Snapshot>();
  for (const change of plan) {
    const current = snapshot(await getNode(change.bookmark.id));
    if (current.url !== change.bookmark.originalUrl || current.title !== change.bookmark.originalTitle ||
      current.parentId !== change.bookmark.originalParentId) {
      throw new Error('Un marcador cambió desde el escaneo. Volvé a escanear antes de aplicar.');
    }
    initial.set(current.id, current);
    const destination = await getNode(change.destinationId ?? change.targetParentId);
    if (destination.url) throw new Error('El destino ya no es una carpeta.');
  }
  const recovery: Recovery = { version: 1, createdAt: Date.now(), id: crypto.randomUUID(), entries: [], journal: true, folders: [] };
  await save(recovery); // Storage failure must prevent all bookmark writes.
  const folders = new Map<string, string>();
  const resolvedEntries: Entry[] = [];
  // Resolve each destination once, then persist the complete intent in one
  // write. Rewriting a growing journal after every item would be O(n²).
  for (const change of plan) {
    const before = initial.get(change.bookmark.id)!;
    let parentId = change.destinationId ?? before.parentId;
    if (change.folder) {
      const key = JSON.stringify([change.targetParentId, change.folder]);
      if (!folders.has(key)) {
        recovery.folders!.push({ title: change.folder, parentId: change.targetParentId });
        await save(recovery); // Record creation intent before calling Chrome.
        const resolved = await findOrCreateFolder(change.folder, change.targetParentId);
        recovery.folders![recovery.folders!.length - 1].id = resolved;
        await save(recovery);
        folders.set(key, resolved);
      }
      parentId = folders.get(key)!;
      folders.set(key, parentId);
    }
    resolvedEntries.push({ before, after: { title: change.title, parentId } });
  }
  recovery.entries = resolvedEntries;
  await save(recovery);
  return execute(recovery);
}

/** Restore only compatible nodes; preserve subsequent user edits and the backup on failure. */
async function restore(): Promise<void> {
  const recovery = await loadRecovery();
  if (!recovery) return;
  const entries = [...recovery.entries].sort((a, b) => a.before.parentId.localeCompare(b.before.parentId) || a.before.index - b.before.index);
  const compatible: Entry[] = [];
  const conflicts: string[] = [];
  for (const entry of entries) {
    const { before, after } = entry;
    const progress = await readProgress(recovery, before.id);
    if (progress?.state === 'reverted') continue;
    // New journals have explicit intent. Never undo an operation never started.
    if (recovery.journal && !progress) continue;
    try {
      const current = snapshot(await getNode(before.id));
      const original = current.title === before.title && current.parentId === before.parentId;
      if (current.url !== before.url || ![before.title, after.title].includes(current.title) ||
        ![before.parentId, after.parentId].includes(current.parentId) ||
        (!original && progress?.state === 'verified' && progress.index !== undefined && current.index !== progress.index)) throw new Error('conflict');
      const parent = await getNode(before.parentId);
      if (parent.url) throw new Error('Missing parent');
      compatible.push(entry);
    } catch { conflicts.push(before.id); }
  }
  for (const { before, after } of compatible) {
    try {
      const current = snapshot(await getNode(before.id));
      if (current.url !== before.url || ![before.title, after.title].includes(current.title) ||
        ![before.parentId, after.parentId].includes(current.parentId)) throw new Error('conflict');
      if (current.parentId !== before.parentId) {
        await checked<chrome.bookmarks.BookmarkTreeNode>(cb => chrome.bookmarks.move(before.id, { parentId: before.parentId, index: before.index }, cb));
      }
      const latest = snapshot(await getNode(before.id));
      if (latest.url !== before.url || ![before.title, after.title].includes(latest.title) || latest.parentId !== before.parentId) throw new Error('conflict');
      if (latest.title !== before.title) await updateBookmarkTitle(before.id, before.title);
      await writeProgress(recovery, before.id, { state: 'reverted' });
    } catch { conflicts.push(before.id); }
  }
  if (conflicts.length) throw new Error(`Se recuperaron los favoritos compatibles. Hay cambios posteriores o errores en ${conflicts.length} favoritos: ${conflicts.join(', ')}. Se conserva la copia.`);
  await archiveRecovery(recovery);
}

async function archiveRecovery(recovery: Recovery) {
  // Explicitly retained history; no automatic deletion of unresolved work.
  await checked<void>(cb => chrome.storage.local.set({ [`history:${recovery.id ?? recovery.createdAt}`]: recovery }, cb));
  await clearRecovery();
}

async function exclusive<T>(action: () => Promise<T>): Promise<T> {
  return navigator.locks.request('el-organizador-bookmarks', { ifAvailable: true }, async lock => {
    if (!lock) throw new Error('Hay otra limpieza en curso en un panel abierto.');
    return action();
  });
}

export function applyChangePlan(plan: Change[]): Promise<number> {
  return exclusive(() => applyPlan(plan));
}

export function restoreRecovery(): Promise<void> { return exclusive(restore); }

export function discardRecovery(): Promise<void> {
  return exclusive(async () => { const recovery = await loadRecovery(); if (recovery) await archiveRecovery(recovery); });
}

export function resumeRecovery(): Promise<number> {
  return exclusive(async () => {
    const recovery = await loadRecovery();
    if (!recovery?.journal || !recovery.entries.length) throw new Error('Este trabajo no permite reanudar. Usá la recuperación.');
    await checked<void>(cb => chrome.storage.local.remove(`pause:${recovery.id ?? recovery.createdAt}`, cb));
    return execute(recovery);
  });
}

export async function pauseRecovery(): Promise<void> {
  const recovery = await loadRecovery();
  if (recovery) await checked<void>(cb => chrome.storage.local.set({ [`pause:${recovery.id ?? recovery.createdAt}`]: true }, cb));
}

export async function listHistory(): Promise<{ key: string; createdAt: number; count: number }[]> {
  const data = await checked<Record<string, Recovery>>(cb => chrome.storage.local.get(null, cb));
  return Object.entries(data).filter(([key, value]) => key.startsWith('history:') && value?.version === 1 && Array.isArray(value.entries))
    .map(([key, value]) => ({ key, createdAt: value.createdAt, count: value.entries.length }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function reopenHistory(key: string): Promise<void> {
  return exclusive(async () => {
    if (!/^history:[a-zA-Z0-9-]+$/.test(key) || await loadRecovery()) throw new Error('Primero resolvé el trabajo activo.');
    const data = await checked<Record<string, Recovery>>(cb => chrome.storage.local.get(key, cb));
    if (!data[key]) throw new Error('La copia ya no existe.');
    await save(data[key]);
    try { await loadRecovery(); } catch (error) { await clearRecovery(); throw error; }
  });
}

export function pruneHistory(keep = 20): Promise<void> {
  return exclusive(async () => {
    if (!Number.isInteger(keep) || keep < 0 || keep > 100) throw new Error('Límite inválido.');
    const active = await loadRecovery();
    const history = await listHistory();
    for (const item of history.slice(keep)) {
      const data = await checked<Record<string, Recovery>>(cb => chrome.storage.local.get(item.key, cb));
      const job = data[item.key];
      if (!job || (active && (active.id ?? active.createdAt) === (job.id ?? job.createdAt))) continue;
      await checked<void>(cb => chrome.storage.local.remove(item.key, cb));
      // Delete only keys belonging to this archived job; never current bookmarks.
      for (const entry of job.entries) await checked<void>(cb => chrome.storage.local.remove(progressKey(job, entry.before.id), cb));
      await checked<void>(cb => chrome.storage.local.remove(`pause:${job.id ?? job.createdAt}`, cb));
    }
  });
}
