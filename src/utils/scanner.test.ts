import { describe, it, expect, vi, afterEach } from 'vitest';
import { scanBookmark, createBookmarkScanner, MAX_BODY_BYTES } from './scanner';
import type { AnalyzedBookmark } from './bookmarks';
const bm = (url = 'https://example.com', title = 'Example'): AnalyzedBookmark => ({
  id: 'a', originalTitle: title, originalUrl: url, originalPath: [], healthStatus: 'pending',
});
const options = { validateLinks: true, organize: false };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('scanBookmark security and efficiency', () => {
  it('blocks unsafe URLs without contacting them', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect((await scanBookmark(bm('http://localhost'), options)).healthStatus).toBe('blocked');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('classifies locally without network and without claiming link health', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const result = await scanBookmark(bm('https://github.com/test'), { validateLinks: false, organize: true });
    expect(result).toEqual({ healthStatus: 'pending', suggestedFolder: '💻 Desarrollo' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does nothing when all actions are off', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(await scanBookmark(bm(), { validateLinks: false, organize: false })).toEqual({ healthStatus: 'pending', suggestedFolder: undefined });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses explicit cookie-free, referrer-free requests and never follows redirects', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } }));
    vi.stubGlobal('fetch', fetch);
    expect((await scanBookmark(bm(), options)).healthStatus).toBe('redirected');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://example.com/', expect.objectContaining({ redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer', method: 'HEAD' }));
  });
  it('recognizes opaque redirects without treating them as healthy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ type: 'opaqueredirect', status: 0 }));
    const result = await scanBookmark(bm(), { ...options, organize: true });
    expect(result.healthStatus).toBe('redirected'); expect(result.suggestedFolder).toBeUndefined();
  });
  it.each([404, 410])('does not retry definitive missing status %s', async status => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status })); vi.stubGlobal('fetch', fetch);
    expect((await scanBookmark(bm(), options)).healthStatus).toBe('dead'); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403])('recognizes auth wall %s without retrying', async status => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status })); vi.stubGlobal('fetch', fetch);
    expect((await scanBookmark(bm(), options)).healthStatus).toBe('alive'); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('uses GET fallback only for an unsupported HEAD', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 405 })).mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetch); expect((await scanBookmark(bm(), options)).healthStatus).toBe('alive');
    expect(fetch.mock.calls.map(call => call[1].method)).toEqual(['HEAD', 'GET']);
  });
  it('shares one in-flight request but classifies different bookmark titles independently', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response('ok')); vi.stubGlobal('fetch', fetch);
    const scan = createBookmarkScanner({ ...options, organize: true });
    const [a, b] = await Promise.all([scan(bm('https://example.com/#a', 'Python')), scan(bm('https://example.com/#b', 'Canva'))]);
    expect(fetch).toHaveBeenCalledTimes(1); expect(a.suggestedFolder).toBe('💻 Desarrollo'); expect(b.suggestedFolder).toBe('🎨 Diseño');
  });
  it('keeps query variants as separate requests', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response(null)); vi.stubGlobal('fetch', fetch);
    const scan = createBookmarkScanner(options);
    await Promise.all([scan(bm('https://example.com/?id=1')), scan(bm('https://example.com/?id=2'))]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('reads bounded HTML bytes and cancels the body, without calling response.text', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(MAX_BODY_BYTES) + '<title>Python</title>')); }, cancel });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'text/html' } })));
    const result = await scanBookmark(bm(), { ...options, organize: true, enrichMetadata: true });
    expect(result.suggestedFolder).toBe('📁 Varios'); expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('extracts HTML metadata only after explicit opt-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<title>Python</title></head>', { headers: { 'content-type': 'text/html' } })));
    const result = await scanBookmark(bm(), { validateLinks: false, organize: true, enrichMetadata: true });
    expect(result).toEqual({ healthStatus: 'alive', suggestedFolder: '💻 Desarrollo' });
  });
  it('does not parse non-HTML content as metadata', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('<title>Python</title>')); }, cancel });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'application/octet-stream' } })));
    expect((await scanBookmark(bm(), { ...options, organize: true, enrichMetadata: true })).suggestedFolder).toBe('📁 Varios');
    expect(cancel).toHaveBeenCalled();
  });
  it('propagates already-aborted cancellation without a request', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const controller = new AbortController(); controller.abort();
    await expect(scanBookmark(bm(), options, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('covers a stalled HTML body with the same deadline as the headers', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockImplementation((_url, init) => {
      const stream = new ReadableStream({ start(controller) { init.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError'))); } });
      return Promise.resolve(new Response(stream, { headers: { 'content-type': 'text/html' } }));
    });
    vi.stubGlobal('fetch', fetch);
    const pending = scanBookmark(bm(), { ...options, organize: true, enrichMetadata: true });
    await vi.advanceTimersByTimeAsync(8001);
    expect((await pending).healthStatus).toBe('timeout');
  });
  it('propagates cancellation during body reads', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) => Promise.resolve(new Response(new ReadableStream({ start(c) {
      init.signal.addEventListener('abort', () => c.error(new DOMException('Aborted', 'AbortError')));
      queueMicrotask(() => controller.abort());
    } }), { headers: { 'content-type': 'text/html' } }))));
    await expect(scanBookmark(bm(), { ...options, organize: true, enrichMetadata: true }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
