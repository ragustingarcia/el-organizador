// src/utils/pool.ts

/**
 * Processes items with a bounded number of concurrent workers.
 * Supports cancellation via AbortSignal and progress reporting.
 */
export async function poolMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let doneCount = 0;

  async function worker() {
    while (nextIndex < items.length) {
      if (signal?.aborted) {
        throw new DOMException('Scan cancelled', 'AbortError');
      }

      const i = nextIndex++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        // If the user cancelled, propagate immediately
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        // Otherwise, the individual item's fn should have handled the error
        // and returned a safe default. Re-throw only if it didn't.
        throw err;
      }
      doneCount++;
      onProgress?.(doneCount, items.length);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());

  await Promise.all(workers);
  return results;
}
