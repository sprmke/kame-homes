/**
 * Bounded list results the model can reason about.
 *
 * A list tool that silently returns the first N rows makes the model conclude that an item it
 * cannot see does not exist. When rows are cut off, a trailing marker row says how many exist and
 * how to narrow the search, so the assistant can search by name or filter instead of giving up.
 */

export type ListingTruncationMarker = {
  truncated: true;
  total: number;
  shown: number;
  hint: string;
};

const DEFAULT_LIST_LIMIT = 10;
export const MAX_LIST_LIMIT = 25;

/** Clamp a model-supplied limit to 1..MAX_LIST_LIMIT, falling back to the default. */
export function clampListLimit(raw: unknown, fallback = DEFAULT_LIST_LIMIT): number {
  const n = typeof raw === 'string' && raw.trim() ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(n)));
}

export function limitWithMarker<T>(
  rows: readonly T[],
  limit: number,
  hint: string
): Array<T | ListingTruncationMarker> {
  if (rows.length <= limit) return [...rows];
  return [...rows.slice(0, limit), { truncated: true, total: rows.length, shown: limit, hint }];
}
