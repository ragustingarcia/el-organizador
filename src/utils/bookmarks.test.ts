import { afterEach, expect, it, vi } from 'vitest';
import { getBookmarks, getBookmarkFolders } from './bookmarks';

afterEach(() => vi.unstubAllGlobals());
it('preserves actual root identities and omits managed folders', async () => {
  const tree = [{ id: '0', title: '', children: [
    { id: 'bar-account', parentId: '0', title: 'Bar', children: [{ id: 'a', parentId: 'bar-account', title: 'A', url: 'https://example.com', index: 2 }] },
    { id: 'other-local', parentId: '0', title: 'Other', children: [{ id: 'b', parentId: 'other-local', title: 'B', url: 'https://example.com/b', index: 0 }] },
    { id: 'managed', parentId: '0', title: 'Enterprise', unmodifiable: 'managed', children: [{ id: 'c', title: 'C', url: 'https://example.com/c' }] },
  ] }];
  vi.stubGlobal('chrome', { runtime: {}, bookmarks: { getTree: (cb: (value: unknown) => void) => cb(tree) } });
  expect((await getBookmarks('all')).map(b => [b.id, b.rootId, b.originalParentId, b.originalIndex])).toEqual([
    ['a', 'bar-account', 'bar-account', 2], ['b', 'other-local', 'other-local', 0],
  ]);
  expect((await getBookmarkFolders()).map(f => f.id)).toEqual(['bar-account', 'other-local']);
});
it('surfaces read failure instead of reporting an empty, clean library', async () => {
  vi.stubGlobal('chrome', { runtime: { lastError: { message: 'Denied' } }, bookmarks: { getTree: (cb: (value: unknown) => void) => cb([]) } });
  await expect(getBookmarks('all')).rejects.toThrow('Denied');
});
it('rejects a removed folder without throwing outside its promise', async () => {
  vi.stubGlobal('chrome', { runtime: {}, bookmarks: { getSubTree: (_id: string, cb: (value: unknown) => void) => cb([]) } });
  await expect(getBookmarks('gone')).rejects.toThrow('Carpeta no disponible');
});
