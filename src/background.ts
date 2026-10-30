// Service worker: suggestions are serialized to avoid losing rapid bookmark imports.
import { classifyBookmark } from './utils/classifier';
import { suggestShortTitle } from './utils/modifier';
import type { Suggestion } from './components/SuggestionCard';
import { applyChangePlan, resumeRecovery, restoreRecovery, discardRecovery, pauseRecovery, reopenHistory, pruneHistory } from './utils/recovery';
import type { Change } from './utils/change-plan';

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'BOOKMARK_JOB') return;
  const run = async () => {
    switch (message.action) {
      case 'apply':
        if (!Array.isArray(message.plan)) throw new Error('Plan inválido.');
        return applyChangePlan(message.plan as Change[]);
      case 'resume': return resumeRecovery();
      case 'restore': return restoreRecovery();
      case 'archive': return discardRecovery();
      case 'prune': return pruneHistory(20);
      case 'pause': return pauseRecovery();
      case 'reopen': return reopenHistory(message.key);
      default: throw new Error('Acción inválida.');
    }
  };
  void run().then(result => reply({ result }), error => reply({ error: String(error) }));
  return true;
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(err => console.error('[El Organizador] sidePanel:', err));

chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
  .catch(err => console.error('[El Organizador] storage:', err));

let work: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = work.then(task);
  work = result.catch(() => {});
  return result;
}

async function suggestions(): Promise<Suggestion[]> {
  const data = await chrome.storage.local.get(null);
  const legacy = (data.pendingSuggestions ?? (data.pendingSuggestion ? [data.pendingSuggestion] : [])) as Suggestion[];
  const items = new Map<string, Suggestion>(legacy.map(item => [item.id, item]));
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('suggestion:') && value && typeof (value as Suggestion).id === 'string') items.set((value as Suggestion).id, value as Suggestion);
  }
  return [...items.values()].sort((a, b) => a.timestamp - b.timestamp);
}

let importing = false;
chrome.bookmarks.onImportBegan.addListener(() => { importing = true; void chrome.storage.local.set({ bookmarkImportInProgress: true }).catch(console.error); });
chrome.bookmarks.onImportEnded.addListener(() => { importing = false; void chrome.storage.local.set({ bookmarkImportInProgress: false }).catch(console.error); });
chrome.runtime.onStartup.addListener(() => { importing = false; void chrome.storage.local.set({ bookmarkImportInProgress: false }).catch(console.error); });

chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  if (importing || !bookmark.url || bookmark.unmodifiable) return;
  // Start persistence immediately instead of leaving events behind a volatile promise queue.
  void (async () => {
    const { vigiaEnabled, bookmarkImportInProgress } = await chrome.storage.local.get(['vigiaEnabled', 'bookmarkImportInProgress']);
    if (!vigiaEnabled || bookmarkImportInProgress) return;
    const suggestion: Suggestion = {
      id, originalTitle: bookmark.title, originalUrl: bookmark.url!,
      suggestedTitle: suggestShortTitle(bookmark.title),
      suggestedFolder: classifyBookmark(bookmark.title, bookmark.url!, ''),
      parentId: bookmark.parentId ?? '', timestamp: Date.now(),
    };
    await chrome.storage.local.set({ [`suggestion:${id}`]: suggestion });
  })().catch(err => console.error('[Vigía] No se pudo guardar la sugerencia:', err));
});

chrome.bookmarks.onRemoved.addListener((id, info) => {
  void serialize(async () => {
    const removed = new Set([id]);
    const stack = [...(info?.node.children ?? [])];
    while (stack.length) { const node = stack.pop()!; removed.add(node.id); stack.push(...(node.children ?? [])); }
    for (const key of removed) await chrome.storage.local.remove(`suggestion:${key}`);
    const legacy = await chrome.storage.local.get(['pendingSuggestions', 'pendingSuggestion']);
    const pending = (legacy.pendingSuggestions ?? (legacy.pendingSuggestion ? [legacy.pendingSuggestion] : [])) as Suggestion[];
    // Migrate legacy values only on mutation; current entries have independent keys.
    for (const item of pending.filter(item => !removed.has(item.id))) await chrome.storage.local.set({ [`suggestion:${item.id}`]: item });
    await chrome.storage.local.remove('pendingSuggestions'); await chrome.storage.local.remove('pendingSuggestion');
  }).catch(err => console.error('[Vigía]', err));
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg.type !== 'string') return;
  if (!['GET_VIGIA_STATUS', 'SET_VIGIA_STATUS', 'CLEAR_SUGGESTION', 'GET_SUGGESTIONS'].includes(msg.type)) return;
  void serialize(async () => {
    if (msg.type === 'GET_SUGGESTIONS') return { suggestions: await suggestions() };
    if (msg.type === 'GET_VIGIA_STATUS') {
      const data = await chrome.storage.local.get('vigiaEnabled');
      return { enabled: !!data.vigiaEnabled };
    }
    if (msg.type === 'SET_VIGIA_STATUS') {
      if (typeof msg.enabled !== 'boolean') throw new Error('Estado de Vigía inválido.');
      await chrome.storage.local.set({ vigiaEnabled: msg.enabled });
    } else {
      if (typeof msg.id !== 'string') throw new Error('Sugerencia inválida.');
      const legacy = await chrome.storage.local.get(['pendingSuggestions', 'pendingSuggestion']);
      const pending = (legacy.pendingSuggestions ?? (legacy.pendingSuggestion ? [legacy.pendingSuggestion] : [])) as Suggestion[];
      await chrome.storage.local.remove(`suggestion:${msg.id}`);
      for (const item of pending.filter(item => item.id !== msg.id)) await chrome.storage.local.set({ [`suggestion:${item.id}`]: item });
      await chrome.storage.local.remove('pendingSuggestions');
      await chrome.storage.local.remove('pendingSuggestion');
    }
    return { ok: true };
  }).then(sendResponse, err => sendResponse({ error: String(err) }));
  return true;
});
