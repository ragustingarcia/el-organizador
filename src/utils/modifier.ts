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
      const existing = results.find((r) => !r.url && r.parentId === parentId);
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

/**
 * Shortens long page titles by splitting at the FIRST separator found.
 *
 * FIX: The original version cascaded through ALL separators, stripping
 * progressively more of the title. E.g. "AWS | Services - S3" became
 * "AWS" (split on " - " → "AWS | Services", then on " | " → "AWS").
 * Now we only split at the first (leftmost) separator we find, keeping
 * the most meaningful leading segment.
 *
 * Examples:
 *   "React Docs - Getting Started | React" → "React Docs"
 *   "Stack Overflow - Where Developers Learn" → "Stack Overflow"
 *   "Simple Title" → "Simple Title" (unchanged)
 */
export function suggestShortTitle(originalTitle: string): string {
  if (!originalTitle) return 'Sin título';

  const separators = [' - ', ' | ', ' : ', ' • ', ' — '];

  // Find the first separator that appears (leftmost position wins)
  let earliestIndex = Infinity;
  let winningSep = '';

  for (const sep of separators) {
    const idx = originalTitle.indexOf(sep);
    if (idx !== -1 && idx < earliestIndex) {
      earliestIndex = idx;
      winningSep = sep;
    }
  }

  if (winningSep) {
    const cleaned = originalTitle.split(winningSep)[0].trim();
    // Don't return empty or very short fragments
    if (cleaned.length >= 3) return cleaned;
  }

  return originalTitle.trim();
}
