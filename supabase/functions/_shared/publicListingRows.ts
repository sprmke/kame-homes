/**
 * Paged `.in(...)` reads for public listing endpoints.
 *
 * PostgREST caps a single response at `max_rows` (1,000 here) even when callers ask
 * for more, silently truncating large key lists. `loadRowsByKeyChunks` pages every key
 * chunk with `.range()` and fails closed on errors.
 */

const POSTGREST_PAGE_SIZE = 1_000;

type FetchPageResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

const ID_CHUNK_SIZE = 200;

type FetchChunkPage<K, T> = (
  chunk: K[],
  from: number,
  to: number
) => PromiseLike<FetchPageResult<T>>;

/**
 * Loads every row matching a large key list (`.in(...)` reads) without PostgREST
 * `max_rows` truncation: keys are chunked to keep URLs short, and each chunk is
 * paged with `.range()` until a short page. Callers must `.order()` by a unique
 * column so pages are deterministic. Fails closed on any error.
 */
export async function loadRowsByKeyChunks<K, T>(
  label: string,
  keys: K[],
  fetchPage: FetchChunkPage<K, T>
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < keys.length; i += ID_CHUNK_SIZE) {
    const chunk = keys.slice(i, i + ID_CHUNK_SIZE);
    for (let from = 0; ; from += POSTGREST_PAGE_SIZE) {
      const to = from + POSTGREST_PAGE_SIZE - 1;
      const { data, error } = await fetchPage(chunk, from, to);
      if (error) {
        throw new Error(`${label} query failed: ${error.message ?? 'unknown error'}`);
      }
      const page = data ?? [];
      rows.push(...page);
      if (page.length < POSTGREST_PAGE_SIZE) break;
    }
  }
  return rows;
}
