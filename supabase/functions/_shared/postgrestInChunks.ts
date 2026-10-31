/**
 * PostgREST puts `.in()` filter values in the request URI. Large UUID lists
 * (hundreds of properties) exceed typical proxy/server URI limits (~8KB) and
 * fail with "URI too long". Chunk every large `.in()` call.
 */

/** ~100 UUIDs ≈ 3.7KB of filter text — safe under common 8KB URI limits. */
export const POSTGREST_IN_CHUNK_SIZE = 100;

export function chunkIds<T>(ids: T[], size = POSTGREST_IN_CHUNK_SIZE): T[][] {
  if (ids.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

type PostgrestErrorLike = { message: string } | null;

/** Run a select `.in(column, ids)` query in URI-safe chunks and concatenate rows. */
export async function selectInIdChunks<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: PostgrestErrorLike }>
): Promise<T[]> {
  const out: T[] = [];
  for (const chunk of chunkIds(ids)) {
    const { data, error } = await fetchChunk(chunk);
    if (error) throw new Error(error.message);
    if (data?.length) out.push(...data);
  }
  return out;
}

/** Run a `count: 'exact', head: true` `.in(column, ids)` query in chunks and sum. */
export async function countInIdChunks(
  ids: string[],
  fetchChunk: (chunk: string[]) => PromiseLike<{ count: number | null; error: PostgrestErrorLike }>
): Promise<number> {
  let total = 0;
  for (const chunk of chunkIds(ids)) {
    const { count, error } = await fetchChunk(chunk);
    if (error) throw new Error(error.message);
    total += count ?? 0;
  }
  return total;
}
