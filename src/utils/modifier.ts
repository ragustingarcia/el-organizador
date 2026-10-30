// src/utils/modifier.ts

/**
 * Finds an existing subfolder by exact title under parentId,
 * or creates one if it doesn't exist.
 *
 * FIX: All chrome.bookmarks callbacks now check chrome.runtime.lastError.
 */
export async function findOrCreateFolder(
  title: string,
  parentId: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.search({ title }, (results) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }

      // Match exact title AND same parent AND it's a folder (no url)
      const existing = results.find((r) => !r.url && r.title === title && r.parentId === parentId);
      if (existing) {
        resolve(existing.id);
      } else {
        chrome.bookmarks.create({ parentId, title }, (newFolder) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          resolve(newFolder.id);
        });
      }
    });
  });
}

/**
 * Moves a bookmark to a new parent folder.
 */
export async function moveBookmark(
  id: string,
  parentId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.move(id, { parentId }, () => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve();
    });
  });
}

/**
 * Renames a bookmark.
 */
export async function updateBookmarkTitle(
  id: string,
  title: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.update(id, { title }, () => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve();
    });
  });
}

/** Remove generic landing-page suffixes, preserving descriptive title segments. */
export function suggestShortTitle(originalTitle: string): string {
  const title = originalTitle.trim().replace(/\s+/g, ' ');
  if (!title) return originalTitle;
  const cleaned = title.replace(/\s(?:-|\||:|•|—)\s(?:home(?: page)?|inicio|página principal|sitio oficial|web oficial|official (?:site|website))$/i, '').trim();
  return cleaned.length >= 3 ? cleaned : title;
}
