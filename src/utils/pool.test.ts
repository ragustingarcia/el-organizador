import { describe, it, expect } from 'vitest';
import { poolMap } from './pool';

describe('poolMap', () => {
  it('returns results in the original item order regardless of completion order', async () => {
    // Item 0 resolves slowest, item 1 fastest — completion order is scrambled
    // on purpose to prove the result array is indexed by input position.
    const delays = [15, 5, 10];
    const results = await poolMap(
      [3, 1, 2],
      async (item, i) => {
        await new Promise((r) => setTimeout(r, delays[i]));
        return item * 10;
      },
      3,
    );
    expect(results).toEqual([30, 10, 20]);
  });

  it('never runs more than `concurrency` workers at once', async () => {
    let active = 0;
    let maxActive = 0;

    await poolMap(
      Array.from({ length: 8 }, (_, i) => i),
      async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 10));
        active--;
      },
      3,
    );

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1); // sanity check: it did run concurrently
  });

  it('reports progress incrementally up to the total', async () => {
    const progress: Array<[number, number]> = [];
    await poolMap(
      [1, 2, 3],
      async (item) => item,
      2,
      (done, total) => progress.push([done, total]),
    );
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  it('propagates cancellation via AbortSignal', async () => {
    const controller = new AbortController();
    let calls = 0;

    const promise = poolMap(
      [1, 2, 3, 4, 5],
      async (item) => {
        calls++;
        if (calls === 2) controller.abort();
        await new Promise((r) => setTimeout(r, 5));
        return item;
      },
      1,
      undefined,
      controller.signal,
    );

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
