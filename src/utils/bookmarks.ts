// src/utils/bookmarks.ts

export type HealthStatus =
  | 'alive'
  | 'dead'
  | 'redirected'
  | 'timeout'
  | 'unverified'
  | 'blocked'
  | 'pending';

export type AnalyzedBookmark = {
  id: string;
  originalTitle: string;
  originalUrl: string;
  originalPath: string[];
  originalParentId?: string;
  originalIndex?: number;
  rootId?: string;
  duplicateOf?: string;
  healthStatus: HealthStatus;
  suggestedFolder?: string;
  suggestedFolderId?: string;
  classificationReason?: string;
  classificationConfidence?: 'high' | 'medium' | 'low';
};

export type BookmarkFolder = {
  id: string;
  title: string;
  fullPath: string;
  parentId?: string;
};

/**
 * Returns all bookmark URLs under a specific folder (by ID) or
 * the entire tree when folderId is 'all'.
 *
 * FIX: Uses chrome.bookmarks.getSubTree for accurate ID-based
 * filtering instead of string matching on folder titles.
 */
export async function getBookmarks(folderId: string): Promise<AnalyzedBookmark[]> {
  return new Promise((resolve, reject) => {
    const handler = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      if (chrome.runtime.lastError) {
        console.error('[bookmarks] getTree/getSubTree error:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const flatList: AnalyzedBookmark[] = [];

      const traverse = (children: chrome.bookmarks.BookmarkTreeNode[], path: string[], rootId?: string) => {
        for (const node of children) {
          if (node.unmodifiable) continue;
          if (node.url) {
            flatList.push({
              id: node.id,
              originalTitle: node.title,
              originalUrl: node.url,
              originalPath: path,
              originalParentId: node.parentId,
              originalIndex: node.index,
              rootId,
              healthStatus: 'pending',
            });
          } else if (node.children) {
            const nextPath = node.title ? [...path, node.title] : path;
            if (!node.unmodifiable) traverse(node.children, nextPath, rootId ?? (node.parentId === '0' ? node.id : undefined));
          }
        }
      };

      if (folderId === 'all') {
        traverse(nodes, []);
      } else {
        // getSubTree returns the folder node itself; iterate its children
        const root = nodes[0];
        if (!root || root.unmodifiable) { reject(new Error('Carpeta no disponible para editar.')); return; }
        const rootPath = root.title ? [root.title] : [];
        traverse(root.children ?? [], rootPath, root.id);
      }

      resolve(flatList);
    };

    if (folderId === 'all') {
      chrome.bookmarks.getTree(handler);
    } else {
      chrome.bookmarks.getSubTree(folderId, handler);
    }
  });
}

/**
 * Returns every folder in the bookmark tree for the folder picker.
 */
export async function getBookmarkFolders(): Promise<BookmarkFolder[]> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      if (chrome.runtime.lastError) {
        console.error('[bookmarks] getTree error:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const folders: BookmarkFolder[] = [];

      const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[]) => {
        for (const node of nodes) {
          if (!node.unmodifiable && !node.url && node.children) {
            const name = node.title || 'Raíz';
            const newPath = node.title ? [...path, node.title] : path;

            // Skip the synthetic root (id '0')
            if (node.id !== '0') {
              folders.push({
                id: node.id,
                title: name,
                parentId: node.parentId,
                fullPath: newPath.join(' > '),
              });
            }

            traverse(node.children, newPath);
          }
        }
      };

      traverse(tree, []);
      resolve(folders);
    });
  });
}
