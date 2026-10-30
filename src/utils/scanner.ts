import type { AnalyzedBookmark, HealthStatus } from './bookmarks';
import { isUrlSafe } from './url-guard';
import { extractMetadata, classifyBookmark } from './classifier';

export type ScanOptions = { validateLinks: boolean; organize: boolean; enrichMetadata?: boolean };
export type ScanResult = { healthStatus: HealthStatus; suggestedFolder?: string };
type PageResult = { health: HealthStatus; metadata: string };
const FETCH_TIMEOUT_MS = 8_000;
export const MAX_BODY_BYTES = 60_000;

async function readMetadata(response: Response): Promise<string> {
  if (!response.body || !/^(text\/html|application\/xhtml\+xml)\b/i.test(response.headers.get('content-type') ?? '')) {
    await response.body?.cancel();
    return '';
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let remaining = MAX_BODY_BYTES;
  let html = '';
  try {
    while (remaining > 0) {
      const { done, value } = await reader.read();
      if (done) break;
      const part = value.subarray(0, remaining);
      remaining -= part.byteLength;
      html += decoder.decode(part, { stream: true });
      if (/<\/head\s*>/i.test(html)) break;
    }
    html += decoder.decode();
    return extractMetadata(html);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function fetchPage(url: string, needsBody: boolean, signal?: AbortSignal): Promise<PageResult> {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onCancel = () => controller.abort();
  signal?.addEventListener('abort', onCancel, { once: true });
  try {
    const request = (method: string) => fetch(url, {
      method, signal: controller.signal,
      // Location is hidden on browser manual redirects. Never follow an unchecked destination.
      redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    let response = await request(needsBody ? 'GET' : 'HEAD');
    if (!needsBody && [405, 501].includes(response.status)) {
      await response.body?.cancel();
      response = await request('GET');
    }
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      await response.body?.cancel();
      return { health: 'redirected', metadata: '' };
    }
    const health: HealthStatus = response.ok || [401, 403].includes(response.status)
      ? 'alive' : [404, 410].includes(response.status) ? 'dead' : 'unverified';
    const metadata = needsBody && response.ok ? await readMetadata(response) : '';
    if (!needsBody || !response.ok) await response.body?.cancel();
    signal?.throwIfAborted();
    return { health, metadata };
  } catch {
    signal?.throwIfAborted();
    return { health: controller.signal.aborted ? 'timeout' : 'unverified', metadata: '' };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onCancel);
  }
}

/** One cache per scan, sharing requests, never bookmark-specific titles. */
export function createBookmarkScanner(options: ScanOptions, signal?: AbortSignal) {
  const requests = new Map<string, Promise<PageResult>>();
  return async (bookmark: AnalyzedBookmark): Promise<ScanResult> => {
    signal?.throwIfAborted();
    if (!isUrlSafe(bookmark.originalUrl)) return { healthStatus: 'blocked' };
    let page: PageResult = { health: 'pending', metadata: '' };
    if (options.validateLinks || (options.organize && options.enrichMetadata)) {
      const url = new URL(bookmark.originalUrl);
      url.hash = '';
      let pending = requests.get(url.href);
      if (!pending) {
        pending = fetchPage(url.href, !!(options.organize && options.enrichMetadata), signal);
        requests.set(url.href, pending);
      }
      page = await pending;
    }
    const suggestedFolder = options.organize && !['dead', 'timeout', 'unverified', 'redirected'].includes(page.health)
      ? classifyBookmark(bookmark.originalTitle, bookmark.originalUrl, page.metadata) : undefined;
    return { healthStatus: page.health, suggestedFolder };
  };
}

export async function scanBookmark(bookmark: AnalyzedBookmark, options: ScanOptions, signal?: AbortSignal): Promise<ScanResult> {
  return createBookmarkScanner(options, signal)(bookmark);
}
