// Service worker: suggestions are serialized to avoid losing rapid bookmark imports.
import { classifyBookmark } from './utils/classifier';
import { suggestShortTitle } from './utils/modifier';
import type { Suggestion } from './components/SuggestionCard';

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
  const data = await chrome.storage.local.get<{ pendingSuggestions?: Suggestion[]; pendingSuggestion?: Suggestion }>(['pendingSuggestions', 'pendingSuggestion']);
  return data.pendingSuggestions ?? (data.pendingSuggestion ? [data.pendingSuggestion] : []);
}

let importing = false;
chrome.bookmarks.onImportBegan.addListener(() => { importing = true; });
chrome.bookmarks.onImportEnded.addListener(() => { importing = false; });

chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  if (importing || !bookmark.url || bookmark.unmodifiable) return;
  void serialize(async () => {
    const { vigiaEnabled } = await chrome.storage.local.get('vigiaEnabled');
    if (!vigiaEnabled) return;
    const pending = await suggestions();
    pending.push({
      id, originalTitle: bookmark.title, originalUrl: bookmark.url!,
      suggestedTitle: suggestShortTitle(bookmark.title),
      suggestedFolder: classifyBookmark(bookmark.title, bookmark.url!, ''),
      parentId: bookmark.parentId ?? '', timestamp: Date.now(),
    });
    await chrome.storage.local.set({ pendingSuggestions: pending });
    await chrome.storage.local.remove('pendingSuggestion');
    // Opening automatically requires a user gesture; the action opens the panel.
  }).catch(err => console.error('[Vigía] No se pudo guardar la sugerencia:', err));
});

chrome.bookmarks.onRemoved.addListener(id => {
  void serialize(async () => {
    const pending = await suggestions();
    await chrome.storage.local.set({ pendingSuggestions: pending.filter(item => item.id !== id) });
    await chrome.storage.local.remove('pendingSuggestion');
  }).catch(err => console.error('[Vigía]', err));
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg.type !== 'string') return;
  if (!['GET_VIGIA_STATUS', 'SET_VIGIA_STATUS', 'CLEAR_SUGGESTION'].includes(msg.type)) return;
  void serialize(async () => {
    if (msg.type === 'GET_VIGIA_STATUS') {
      const data = await chrome.storage.local.get('vigiaEnabled');
      return { enabled: !!data.vigiaEnabled };
    }
    if (msg.type === 'SET_VIGIA_STATUS') {
      if (typeof msg.enabled !== 'boolean') throw new Error('Estado de Vigía inválido.');
      await chrome.storage.local.set({ vigiaEnabled: msg.enabled });
    } else {
      if (typeof msg.id !== 'string') throw new Error('Sugerencia inválida.');
      const pending = await suggestions();
      await chrome.storage.local.set({ pendingSuggestions: pending.filter(item => item.id !== msg.id) });
      await chrome.storage.local.remove('pendingSuggestion');
    }
    return { ok: true };
  }).then(sendResponse, err => sendResponse({ error: String(err) }));
  return true;
});
