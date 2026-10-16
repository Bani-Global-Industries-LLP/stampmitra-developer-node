import type { Page } from '../types/usage.js';

/** Follows `nextCursor` until it is empty, yielding each item. */
export async function* paginate<T, P extends { cursor?: string }>(
  fetchPage: (params: P) => PromiseLike<Page<T>>,
  params: P,
): AsyncGenerator<T, void, void> {
  let cursor = params.cursor;
  const seen = new Set<string>();
  for (;;) {
    const page = await fetchPage({ ...params, cursor });
    for (const item of page.items ?? []) yield item;
    const next = page.nextCursor;
    if (!next || seen.has(next)) return; // guard against a server that echoes the same cursor
    seen.add(next);
    cursor = next;
  }
}
