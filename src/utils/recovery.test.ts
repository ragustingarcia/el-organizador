import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { applyChangePlan, restoreRecovery, loadRecovery } from './recovery';
import type { Change } from './change-plan';

type Node = chrome.bookmarks.BookmarkTreeNode;
let nodes: Map<string, Node>;
let store: Record<string, unknown>;
let api: { runtime: { lastError?: { message: string } }; bookmarks: Record<string, ReturnType<typeof vi.fn>>; storage: unknown };
let failStorage: boolean;
let failRename: boolean;

function callback<T>(cb: (value: T) => void, value: T, error?: string) {
  api.runtime.lastError = error ? { message: error } : undefined;
  cb(structuredClone(value));
  api.runtime.lastError = undefined;
}
function move(id: string, destination: { parentId: string; index?: number }) {
  const node = nodes.get(id)!;
  const previous = node.parentId;
  const previousIndex = node.index ?? 0;
  nodes.forEach(n => { if (n.id !== id && n.parentId === previous && (n.index ?? 0) > previousIndex) n.index!--; });
  const index = destination.index ?? [...nodes.values()].filter(n => n.id !== id && n.parentId === destination.parentId).length;
  nodes.forEach(n => { if (n.id !== id && n.parentId === destination.parentId && (n.index ?? 0) >= index) n.index!++; });
  node.parentId = destination.parentId; node.index = index;
  return node;
}
const change = (id = 'a'): Change => ({
  bookmark: { id, originalTitle: `${id} - Home`, originalUrl: `https://example.com/${id}`, originalParentId: 'bar', originalPath: ['Bar'], healthStatus: 'alive' },
  title: id, folder: 'Tema', targetParentId: 'bar',
});

beforeEach(() => {
  nodes = new Map([
    ['bar', { syncing: false, id: 'bar', title: 'Bar', parentId: '0' }],
    ['a', { syncing: false, id: 'a', title: 'a - Home', url: 'https://example.com/a', parentId: 'bar', index: 0 }],
    ['b', { syncing: false, id: 'b', title: 'b - Home', url: 'https://example.com/b', parentId: 'bar', index: 1 }],
    ['c', { syncing: false, id: 'c', title: 'c - Home', url: 'https://example.com/c', parentId: 'bar', index: 2 }],
  ]);
  store = {}; failStorage = false; failRename = false;
  api = {
    runtime: {},
    bookmarks: {
      get: vi.fn((id: string, cb: (nodes: Node[]) => void) => callback(cb, nodes.has(id) ? [nodes.get(id)!] : [], nodes.has(id) ? undefined : 'Missing')),
      search: vi.fn((query: { title: string }, cb: (nodes: Node[]) => void) => callback(cb, [...nodes.values()].filter(n => n.title.includes(query.title)))),
      create: vi.fn((input: Node, cb: (node: Node) => void) => {
        const node = { ...input, id: `folder${nodes.size}`, index: 99 }; nodes.set(node.id, node); callback(cb, node);
      }),
      move: vi.fn((id: string, destination: { parentId: string; index?: number }, cb: (node: Node) => void) => callback(cb, move(id, destination))),
      update: vi.fn((id: string, input: { title: string }, cb: (node: Node) => void) => {
        if (failRename) { callback(cb, nodes.get(id)!, 'Write failed'); return; }
        Object.assign(nodes.get(id)!, input); callback(cb, nodes.get(id)!);
      }),
    },
    storage: { local: {
      get: (key: string, cb: (data: Record<string, unknown>) => void) => callback(cb, { [key]: store[key] }),
      set: (data: Record<string, unknown>, cb: () => void) => {
        if (!failStorage) Object.assign(store, structuredClone(data));
        callback(cb, undefined, failStorage ? 'Quota' : undefined);
      },
      remove: (key: string, cb: () => void) => { delete store[key]; callback(cb, undefined); },
    } },
  };
  vi.stubGlobal('chrome', api);
  vi.stubGlobal('navigator', { locks: { request: (_name: string, _opts: unknown, action: (lock: object) => unknown) => action({}) } });
});
afterEach(() => vi.unstubAllGlobals());

describe('safe apply and recovery', () => {
  it('backs up original order, applies a shared destination once and restores title, parent and order', async () => {
    expect(await applyChangePlan([change('a'), change('b')])).toBe(2);
    expect(api.bookmarks.create).toHaveBeenCalledTimes(1);
    expect(api.bookmarks.search).toHaveBeenCalledTimes(1);
    expect(nodes.get('a')!.title).toBe('a');
    const recovery = await loadRecovery();
    expect(recovery!.entries.map(entry => entry.before.index)).toEqual([0, 1]);
    await restoreRecovery();
    expect(nodes.get('a')).toMatchObject({ title: 'a - Home', parentId: 'bar', index: 0 });
    expect(nodes.get('b')).toMatchObject({ title: 'b - Home', parentId: 'bar', index: 1 });
    expect(nodes.get('c')!.index).toBe(2);
    expect(await loadRecovery()).toBeNull();
  });
  it('refuses to mutate if the backup cannot be persisted', async () => {
    failStorage = true;
    await expect(applyChangePlan([change()])).rejects.toThrow('Quota');
    expect(api.bookmarks.create).not.toHaveBeenCalled(); expect(api.bookmarks.move).not.toHaveBeenCalled();
    expect(api.bookmarks.update).not.toHaveBeenCalled();
  });
  it.each(['title', 'url', 'parentId'] as const)('rejects a stale %s before any mutation', async field => {
    nodes.get('a')![field] = 'changed';
    await expect(applyChangePlan([change()])).rejects.toThrow('cambió');
    expect(api.bookmarks.create).not.toHaveBeenCalled(); expect(api.bookmarks.move).not.toHaveBeenCalled();
  });
  it('preflights the entire batch before writing its first bookmark', async () => {
    nodes.delete('b');
    await expect(applyChangePlan([change('a'), change('b')])).rejects.toThrow();
    expect(api.bookmarks.move).not.toHaveBeenCalled(); expect(await loadRecovery()).toBeNull();
  });
  it('recovers a partial operation where move succeeded but rename failed', async () => {
    failRename = true;
    await expect(applyChangePlan([change()])).rejects.toThrow('Write failed');
    expect(nodes.get('a')!.parentId).not.toBe('bar');
    expect((await loadRecovery())!.entries).toHaveLength(1);
    failRename = false; await restoreRecovery();
    expect(nodes.get('a')).toMatchObject({ title: 'a - Home', parentId: 'bar', index: 0 });
  });
  it('does not overwrite subsequent user edits during undo', async () => {
    await applyChangePlan([change()]); nodes.get('a')!.title = 'My manual edit';
    await expect(restoreRecovery()).rejects.toThrow('cambios posteriores');
    expect(nodes.get('a')!.title).toBe('My manual edit'); expect(await loadRecovery()).not.toBeNull();
  });
  it('will not replace a pending recovery with a new cleanup', async () => {
    await applyChangePlan([change()]);
    await expect(applyChangePlan([change('b')])).rejects.toThrow('copia anterior');
    expect(nodes.get('b')!.title).toBe('b - Home');
  });
  it('does not write when another panel owns the mutation lock', async () => {
    vi.stubGlobal('navigator', { locks: { request: (_name: string, _opts: unknown, fn: (lock: null) => unknown) => fn(null) } });
    await expect(applyChangePlan([change()])).rejects.toThrow('otra limpieza');
    expect(api.bookmarks.move).not.toHaveBeenCalled();
  });
  it('requires an exact folder title rather than a partial search match', async () => {
    nodes.set('unrelated', { syncing: false, id: 'unrelated', title: 'Tema antiguo', parentId: 'bar' });
    await applyChangePlan([change()]); expect(nodes.get('a')!.parentId).not.toBe('unrelated');
    expect(api.bookmarks.create).toHaveBeenCalledTimes(1);
  });
});

it('does not overwrite a title edited after the move and before the rename', async () => {
  api.bookmarks.move.mockImplementationOnce((id: string, destination: { parentId: string }, cb: (node: Node) => void) => {
    const node = move(id, destination); node.title = 'Manual edit during move'; callback(cb, node);
  });
  await expect(applyChangePlan([change()])).rejects.toThrow('antes de renombrarlo');
  expect(nodes.get('a')!.title).toBe('Manual edit during move');
  expect(api.bookmarks.update).not.toHaveBeenCalled();
});
