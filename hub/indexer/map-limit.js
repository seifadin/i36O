// Runs fn over items, at most `limit` at a time, in order of start; resolves to the results in the
// items' order. onDone(done, total), when given, is called after each one (a progress line).
// Used by every indexer step that fetches or writes many things (inventory, build-index, quran-data).
export async function mapLimit(items, limit, fn, onDone) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
      if (onDone) onDone(++done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
