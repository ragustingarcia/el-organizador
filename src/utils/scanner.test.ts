import { describe, it, expect, vi, afterEach } from 'vitest';
import { scanBookmark } from './scanner';
import type { AnalyzedBookmark } from './bookmarks';

function makeBookmark(overrides: Partial<AnalyzedBookmark> = {}): AnalyzedBookmark {
  return {
    id: '1',
    originalTitle: 'Example',
    originalUrl: 'https://example.com',
    originalPath: [],
    healthStatus: 'pending',
    ...overrides,
  };
}

// scanBookmark only ever touches .ok/.status/.url/.text() on the fetch
// response, so a plain object stand-in is enough — no need for a real
// Response (whose `url` can't be set through the constructor anyway).
function mockResponse(overrides: Partial<{ ok: boolean; status: number; url: string; text: () => Promise<string> }>) {
  return {
    ok: true,
    status: 200,
    url: 'https://example.com',
    text: async () => '',
    ...overrides,
  } as Response;
}

describe('scanBookmark', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('blocks unsafe URLs before any fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const bm = makeBookmark({ originalUrl: 'http://localhost:3000' });
    const result = await scanBookmark(bm, { validateLinks: true, organize: false });

    expect(result.healthStatus).toBe('blocked');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch at all when neither validating nor organizing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await scanBookmark(makeBookmark(), { validateLinks: false, organize: false });

    expect(result.healthStatus).toBe('unverified');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Regression test for the bug found during the 2026-07 cleanup: healthStatus
  // used to be forced to 'unverified' whenever validateLinks was off, even if
  // organize had already triggered a real fetch — which made App.tsx and
  // ResultsPanel treat perfectly healthy, classified bookmarks as "needs
  // review" instead of "ready to organize".
  it('REGRESSION: reports the real health status even when validateLinks is off but organize needed a fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse({
          ok: true,
          status: 200,
          url: 'https://example.com',
          text: async () => '<html><title>Example Site</title></html>',
        }),
      ),
    );

    const result = await scanBookmark(makeBookmark(), { validateLinks: false, organize: true });

    expect(result.healthStatus).toBe('alive');
    expect(result.suggestedFolder).toBe('📁 Example');
  });

  it('marks a 404 as dead', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({ ok: false, status: 404, url: 'https://example.com/gone' })),
    );

    const bm = makeBookmark({ originalUrl: 'https://example.com/gone' });
    const result = await scanBookmark(bm, { validateLinks: true, organize: false });

    expect(result.healthStatus).toBe('dead');
  });

  it('detects a redirect by comparing the final response URL to the original', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({ ok: true, status: 200, url: 'https://example.com/final' })),
    );

    const bm = makeBookmark({ originalUrl: 'https://example.com/original' });
    const result = await scanBookmark(bm, { validateLinks: true, organize: false });

    expect(result.healthStatus).toBe('redirected');
  });

  it('does not classify a dead link even when organize is on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({ ok: false, status: 404, url: 'https://example.com/gone' })),
    );

    const bm = makeBookmark({ originalUrl: 'https://example.com/gone' });
    const result = await scanBookmark(bm, { validateLinks: true, organize: true });

    expect(result.healthStatus).toBe('dead');
    expect(result.suggestedFolder).toBeUndefined();
  });
});
