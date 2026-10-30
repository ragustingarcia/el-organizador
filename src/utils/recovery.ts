import type { Change } from './change-plan';
import { findOrCreateFolder, moveBookmark, updateBookmarkTitle } from './modifier';

type Snapshot = { id: string; title: string; url: string; parentId: string; index: number };
type Entry = { before: Snapshot; after: { title: string; parentId: string } };
export type Recovery = { version: 1; createdAt: number; entries: Entry[] };
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
  if (value.version !== 1 || !Array.isArray(value.entries)) throw new Error('Copia de recuperación incompatible.');
  return value;
}

export async function clearRecovery(): Promise<void> {
  await checked<void>(cb => chrome.storage.local.remove(KEY, cb));
}

async function save(recovery: Recovery) {
  await checked<void>(cb => chrome.storage.local.set({ [KEY]: recovery }, cb));
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
    const destination = await getNode(change.targetParentId);
    if (destination.url) throw new Error('El destino ya no es una carpeta.');
  }
  const recovery: Recovery = { version: 1, createdAt: Date.now(), entries: [] };
  await save(recovery); // Storage failure must prevent all bookmark writes.
  const folders = new Map<string, string>();
  // Resolve each destination once, then persist the complete intent in one
  // write. Rewriting a growing journal after every item would be O(n²).
  for (const change of plan) {
    const before = initial.get(change.bookmark.id)!;
    let parentId = before.parentId;
    if (change.folder) {
      const key = JSON.stringify([change.targetParentId, change.folder]);
      parentId = folders.get(key) ?? await findOrCreateFolder(change.folder, change.targetParentId);
      folders.set(key, parentId);
    }
    recovery.entries.push({ before, after: { title: change.title, parentId } });
  }
  await save(recovery);
  let applied = 0;
  for (const { before, after } of recovery.entries) {
    const current = snapshot(await getNode(before.id));
    if (current.url !== before.url || current.title !== before.title || current.parentId !== before.parentId) {
      throw new Error('Un marcador cambió durante la aplicación.');
    }
    if (after.parentId !== before.parentId) await moveBookmark(before.id, after.parentId);
    if (after.title !== before.title) {
      const latest = snapshot(await getNode(before.id));
      if (latest.title !== before.title || latest.url !== before.url || latest.parentId !== after.parentId) {
        throw new Error('El marcador cambió antes de renombrarlo. Se conserva la copia.');
      }
      await updateBookmarkTitle(before.id, after.title);
    }
    applied++;
  }
  return applied;
}

/** Restore only compatible nodes; preserve subsequent user edits and the backup on failure. */
async function restore(): Promise<void> {
  const recovery = await loadRecovery();
  if (!recovery) return;
  // Parents and siblings must be restored in original index order.
  const entries = [...recovery.entries].sort((a, b) => a.before.parentId.localeCompare(b.before.parentId) || a.before.index - b.before.index);
  for (const { before, after } of entries) {
    const current = snapshot(await getNode(before.id));
    if (current.url !== before.url || ![before.title, after.title].includes(current.title) ||
      ![before.parentId, after.parentId].includes(current.parentId)) {
      throw new Error('Hay cambios posteriores: se conserva la copia y no se sobrescribe ese marcador.');
    }
    const parent = await getNode(before.parentId);
    if (parent.url) throw new Error('La carpeta original ya no está disponible.');
  }
  for (const { before, after } of entries) {
    const current = snapshot(await getNode(before.id));
    if (current.url !== before.url || ![before.title, after.title].includes(current.title) ||
      ![before.parentId, after.parentId].includes(current.parentId)) throw new Error('El marcador cambió durante la recuperación.');
    if (after.parentId !== before.parentId) {
      await checked<chrome.bookmarks.BookmarkTreeNode>(cb => chrome.bookmarks.move(before.id, { parentId: before.parentId, index: before.index }, cb));
    }
    if (current.title !== before.title) {
      const latest = snapshot(await getNode(before.id));
      if (latest.url !== before.url || ![before.title, after.title].includes(latest.title) || latest.parentId !== before.parentId) {
        throw new Error('El marcador cambió durante la recuperación.');
      }
      await updateBookmarkTitle(before.id, before.title);
    }
  }
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

export function discardRecovery(): Promise<void> { return exclusive(clearRecovery); }
