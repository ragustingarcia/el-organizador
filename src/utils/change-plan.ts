import type { AnalyzedBookmark, BookmarkFolder } from './bookmarks';
import { suggestShortTitle } from './modifier';

export type Change = {
  bookmark: AnalyzedBookmark;
  title: string;
  folder?: string;
  destinationId?: string;
  targetParentId: string;
};

/** Exact URL duplicates only: query parameters and fragments retain their meaning. */
export function markDuplicates(bookmarks: AnalyzedBookmark[]): AnalyzedBookmark[] {
  const first = new Map<string, string>();
  return bookmarks.map(bookmark => {
    let key = bookmark.originalUrl;
    try { key = new URL(key).href; } catch { /* Keep malformed values exact. */ }
    const duplicateOf = first.get(key);
    if (!duplicateOf) first.set(key, bookmark.id);
    return { ...bookmark, duplicateOf };
  });
}

export function buildChangePlan(
  bookmarks: AnalyzedBookmark[], review: Set<string>, move: Set<string>, rename: boolean, scope: string, folders: BookmarkFolder[] = [],
): Change[] {
  return bookmarks.flatMap<Change>(bookmark => {
    const isReview = review.has(bookmark.id);
    const title = rename && !isReview ? suggestShortTitle(bookmark.originalTitle) : bookmark.originalTitle;
    const existingDestination = !isReview && move.has(bookmark.id) ? folders.find(folder => folder.id === bookmark.suggestedFolderId) : undefined;
    const folder = existingDestination ? undefined : isReview ? '📥 Revisión Manual' : move.has(bookmark.id) ? bookmark.suggestedFolder?.trim() : undefined;
    const targetParentId = scope === 'all' ? bookmark.rootId ?? bookmark.originalParentId ?? '' : scope;
    if (!targetParentId) throw new Error('No se pudo determinar la carpeta de destino. Volvé a escanear.');
    if (existingDestination) {
      if (bookmark.originalParentId === existingDestination.id && title === bookmark.originalTitle) return [];
      return [{ bookmark, title, destinationId: existingDestination.id, targetParentId: existingDestination.id }];
    }
    const alreadyThere = bookmark.originalParentId === targetParentId && !folder;
    // Avoid recreating category subfolders on repeated scans of a category.
    const sameFolder = folder && folders.some(candidate => candidate.id === bookmark.originalParentId && (candidate.parentId === targetParentId || candidate.id === targetParentId) && candidate.title === folder);
    if ((alreadyThere || !folder || sameFolder) && title === bookmark.originalTitle) return [];
    return [{ bookmark, title, folder: sameFolder ? undefined : folder, targetParentId }];
  });
}
