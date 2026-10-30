import { expect, it, vi } from 'vitest';
import { createBookmarkScanner } from './scanner';
import { markDuplicates, buildChangePlan } from './change-plan';
import { poolMap } from './pool';

it('handles 50000 local bookmarks without network, preserving duplicate identities', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  try {
    const items = Array.from({ length: 50000 }, (_, index) => ({
      id: String(index), originalTitle: 'Python Docker', originalUrl: `https://example.com/${index % 1000}`,
      originalPath: ['Bar'], originalParentId: 'bar', rootId: 'bar', healthStatus: 'pending' as const,
    }));
    const start = performance.now();
    const scan = createBookmarkScanner({ validateLinks: false, organize: true });
    const results = markDuplicates(await poolMap(items, async item => ({ ...item, ...await scan(item) }), 4));
    const selected = new Set(results.filter(item => !item.duplicateOf).map(item => item.id));
    const plan = buildChangePlan(results, new Set(), selected, false, 'all');
    expect(results.filter(item => item.duplicateOf)).toHaveLength(49000);
    expect(plan).toHaveLength(1000); expect(fetch).not.toHaveBeenCalled();
    console.info(JSON.stringify({ benchmark: 'local core only; not Chrome writes or UI', bookmarks: 50000, distinctUrls: 1000, milliseconds: performance.now() - start }));
  } finally { vi.unstubAllGlobals(); }
}, 30000);
