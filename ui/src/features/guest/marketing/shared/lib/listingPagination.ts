/** Total pages for a listing result set; always at least 1. */
export function listingTotalPages(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0) return 1;
  const size = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 1;
  return Math.max(1, Math.ceil(total / size));
}
