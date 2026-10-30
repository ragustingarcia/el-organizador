import { beforeEach, afterEach, it, expect, vi } from 'vitest';
type Handler = (...args: unknown[]) => unknown;
let handlers: Record<string, Handler>;
let data: Record<string, unknown>;
const event = (name: string) => ({ addListener: (listener: Handler) => { handlers[name] = listener; } });
const send = (message: object, id = 'self') => new Promise(resolve => handlers.message(message, { id }, resolve));
const created = (id: string) => handlers.created(id, { title: `Python ${id}`, url: `https://example.com/${id}`, parentId: 'bar' });

beforeEach(async () => {
  vi.resetModules(); handlers = {}; data = { vigiaEnabled: true };
  vi.stubGlobal('chrome', {
    sidePanel: { setPanelBehavior: async () => {} },
    bookmarks: { onCreated: event('created'), onRemoved: event('removed'), onImportBegan: event('importBegan'), onImportEnded: event('importEnded') },
    runtime: { id: 'self', onStartup: event('startup'), onMessage: event('message') },
    storage: { local: {
      setAccessLevel: async () => {},
      get: async () => structuredClone(data),
      set: async (value: object) => { Object.assign(data, structuredClone(value)); },
      remove: async (key: string) => { delete data[key]; },
    } },
  });
  await import('./background');
});
afterEach(() => vi.unstubAllGlobals());

it('keeps suggestions from rapid creation events in order', async () => {
  created('a'); created('b'); created('c');
  await Promise.resolve(); await send({ type: 'GET_VIGIA_STATUS' });
  expect(((await send({ type: 'GET_SUGGESTIONS' })) as { suggestions: { id: string }[] }).suggestions.map(s => s.id)).toEqual(['a', 'b', 'c']);
});
it('clears only the addressed suggestion, preserving later arrivals', async () => {
  created('a'); created('b');
  await send({ type: 'CLEAR_SUGGESTION', id: 'a' });
  expect(((await send({ type: 'GET_SUGGESTIONS' })) as { suggestions: { id: string }[] }).suggestions.map(s => s.id)).toEqual(['b']);
});
it('migrates the legacy suggestion without discarding it', async () => {
  data.pendingSuggestion = { id: 'old' }; created('a');
  await Promise.resolve(); await send({ type: 'GET_VIGIA_STATUS' });
  expect(((await send({ type: 'GET_SUGGESTIONS' })) as { suggestions: { id: string }[] }).suggestions.map(s => s.id)).toEqual(['old', 'a']);
  // Legacy items remain readable until the first queue mutation.
});
it('does not generate individual suggestions during bulk import', async () => {
  handlers.importBegan(); created('imported'); handlers.importEnded(); created('manual');
  await Promise.resolve(); await send({ type: 'GET_VIGIA_STATUS' });
  expect(((await send({ type: 'GET_SUGGESTIONS' })) as { suggestions: { id: string }[] }).suggestions.map(s => s.id)).toEqual(['manual']);
});
it('removes suggestions for deleted bookmarks', async () => {
  created('a'); created('b'); handlers.removed('a');
  await Promise.resolve(); await send({ type: 'GET_VIGIA_STATUS' });
  expect(((await send({ type: 'GET_SUGGESTIONS' })) as { suggestions: { id: string }[] }).suggestions.map(s => s.id)).toEqual(['b']);
});
it('rejects malformed toggle values without enabling the watcher', async () => {
  expect(await send({ type: 'SET_VIGIA_STATUS', enabled: 'yes' })).toHaveProperty('error');
  expect(data.vigiaEnabled).toBe(true);
});
it('ignores messages from other extension identities', () => {
  const callback = vi.fn();
  expect(handlers.message({ type: 'SET_VIGIA_STATUS', enabled: false }, { id: 'other' }, callback)).toBeUndefined();
  expect(callback).not.toHaveBeenCalled();
});
