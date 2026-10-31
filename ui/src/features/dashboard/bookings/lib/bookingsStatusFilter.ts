/**
 * Client mirror of `supabase/functions/_shared/bookingsStatusFilter.ts`
 */

export function buildBookingsListStatusOrFilter(
  status: readonly string[],
  expandImportedBatch = false
): string | null {
  if (status.length === 0 || !status.includes('IMPORTED') || !expandImportedBatch) return null;
  const unique = [...new Set(status)];
  if (unique.length === 1) {
    return 'status.eq.IMPORTED,imported_from_batch_id.not.is.null';
  }
  return `status.in.(${unique.join(',')}),imported_from_batch_id.not.is.null`;
}

export function passesBookingsListStatusFilter(
  row: { status: string; imported_from_batch_id?: string | null },
  status: readonly string[],
  expandImportedBatch = false
): boolean {
  if (status.length === 0) return true;
  if (status.includes(row.status)) return true;
  if (expandImportedBatch && status.includes('IMPORTED') && row.imported_from_batch_id) {
    return true;
  }
  return false;
}
