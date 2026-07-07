// src/background.ts — El Organizador service worker
// Handles: side panel open + Vigía Mágico (new bookmark watcher)
//
// Bundled standalone (IIFE, see vite.background.config.ts) into
// dist/background.js. Reuses the same classifier/modifier rules as the
// side panel instead of duplicating them, so the two can no longer drift.

import { classifyBookmark } from './utils/classifier';
import { suggestShortTitle } from './utils/modifier';
import type { Suggestion } from './components/SuggestionCard';

// ---- Side panel ----
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[El Organizador] sidePanel:', err));

// ---- Vigía Mágico: New bookmark watcher ----

chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  const url = bookmark.url;
  if (!url) return; // Only act on actual URLs, not folders

  chrome.storage.local.get(['vigiaEnabled'], (data) => {
    if (chrome.runtime.lastError || !data.vigiaEnabled) return;

    const suggestedTitle = suggestShortTitle(bookmark.title);
    // No page metadata available at bookmark-creation time (no fetch here),
    // same rules as a manual scan otherwise.
    const suggestedFolder = classifyBookmark(bookmark.title, url, '');

    const suggestion: Suggestion = {
      id,
      originalTitle: bookmark.title,
      originalUrl: url,
      suggestedTitle,
      suggestedFolder,
      parentId: bookmark.parentId ?? '',
      timestamp: Date.now(),
    };

    // Store the suggestion for the side panel to pick up
    chrome.storage.local.set({ pendingSuggestion: suggestion }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Vigía]', chrome.runtime.lastError.message);
        return;
      }
      // Try to open the side panel so the user sees the suggestion.
      // sidePanel.open() requires a concrete windowId — the service worker
      // has no window of its own, so resolve the active one first (falls
      // back to the last-focused window, which is what we want here).
      chrome.windows.getCurrent((win) => {
        if (chrome.runtime.lastError || win.id === undefined) return;
        chrome.sidePanel.open({ windowId: win.id }).catch(() => {
          // Side panel might already be open, that's fine
        });
      });
    });
  });
});

// Respond to messages from the side panel
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_VIGIA_STATUS') {
    chrome.storage.local.get(['vigiaEnabled'], (data) => {
      sendResponse({ enabled: !!data.vigiaEnabled });
    });
    return true; // async response
  }

  if (msg.type === 'SET_VIGIA_STATUS') {
    chrome.storage.local.set({ vigiaEnabled: msg.enabled }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'CLEAR_SUGGESTION') {
    chrome.storage.local.remove('pendingSuggestion', () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});
