// src/utils/scanner.ts

import type { AnalyzedBookmark, HealthStatus } from './bookmarks';
import { isUrlSafe } from './url-guard';
import { extractMetadata, classifyBookmark } from './classifier';

export type ScanOptions = {
  validateLinks: boolean;
  organize: boolean;
};

export type ScanResult = {
  healthStatus: HealthStatus;
  suggestedFolder?: string;
};

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 60_000; // Read at most ~60KB for metadata extraction

/**
 * Performs a single network request that serves both URL health
 * validation and page classification. This avoids the original bug
 * of making 2 separate fetches per bookmark.
 *
 * Fixes applied:
 * - No `mode: 'no-cors'` (opaque responses hide real status → false positives)
 * - Redirect detection via `response.url !== originalUrl` (fetch follows
 *   redirects automatically, so status 3xx is never seen)
 * - URL safety check before any fetch (blocks private IPs, chrome://, etc.)
 * - Proper cancellation propagation via AbortSignal
 */
async function fetchUrl(
  url: string,
  needsBody: boolean,
  signal?: AbortSignal,
): Promise<{ health: HealthStatus; body: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  // Link the external cancellation signal to our local controller
  const onCancel = () => controller.abort();
  signal?.addEventListener('abort', onCancel);

  const cleanup = () => {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onCancel);
  };

  try {
    // If we need the body (for classification), go straight to GET.
    // Otherwise, try HEAD first (lighter).
    const method = needsBody ? 'GET' : 'HEAD';

    let response = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
    });

    // HEAD returned an error that isn't an auth wall → retry with GET
    if (
      !needsBody &&
      !response.ok &&
      response.status !== 401 &&
      response.status !== 403
    ) {
      response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
      });
    }

    cleanup();

    // Redirect detection: fetch() follows redirects transparently,
    // so we compare the final URL to the original.
    const wasRedirected = response.url !== url;

    // Extract metadata from body if needed
    let body = '';
    if (needsBody && response.ok) {
      try {
        const text = await response.text();
        body = text.slice(0, MAX_BODY_BYTES);
      } catch {
        // Body read failure — not critical
      }
    }

    // Classify the HTTP response
    if (response.ok || response.status === 401 || response.status === 403) {
      return {
        health: wasRedirected ? 'redirected' : 'alive',
        body,
      };
    }

    if (response.status === 404 || response.status === 410) {
      return { health: 'dead', body: '' };
    }

    // Any other 4xx/5xx — we're unsure, don't mark as dead
    return { health: 'unverified', body: '' };
  } catch (err: unknown) {
    cleanup();

    if (err instanceof DOMException && err.name === 'AbortError') {
      // Was it the user who cancelled, or our timeout?
      if (signal?.aborted) throw err; // User cancelled → propagate
      return { health: 'timeout', body: '' };
    }

    // Network error (DNS failure, refused connection, etc.)
    // Don't mark as dead — could be a transient issue
    return { health: 'unverified', body: '' };
  }
}

/**
 * Scans a single bookmark: validates health and optionally classifies it.
 * A single fetch call is shared between both tasks.
 */
export async function scanBookmark(
  bookmark: AnalyzedBookmark,
  options: ScanOptions,
  signal?: AbortSignal,
): Promise<ScanResult> {
  // Block unsafe URLs before any network request
  if (!isUrlSafe(bookmark.originalUrl)) {
    return { healthStatus: 'blocked' };
  }

  // If neither validation nor organization is needed, nothing to do
  if (!options.validateLinks && !options.organize) {
    return { healthStatus: 'unverified' };
  }

  // We need the body if organization is enabled (for metadata extraction)
  const needsBody = options.organize;

  const { health, body } = await fetchUrl(bookmark.originalUrl, needsBody, signal);

  const healthStatus = options.validateLinks ? health : 'unverified';

  // Only classify healthy bookmarks
  let suggestedFolder: string | undefined;
  if (
    options.organize &&
    (health === 'alive' || health === 'redirected')
  ) {
    const metadata = body ? extractMetadata(body) : '';
    suggestedFolder = classifyBookmark(
      bookmark.originalTitle,
      bookmark.originalUrl,
      metadata,
    );
  }

  return { healthStatus, suggestedFolder };
}
