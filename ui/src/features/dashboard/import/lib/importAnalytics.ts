/**
 * Import analytics properties.
 *
 * Kept out of the wizard so the bucketing is testable and so the edge and the browser agree
 * on what `source` means. Analytics only: a wrong value here must never affect the import.
 */

/** File kind, derived from the upload name. There is no OTA provenance in the CSV itself. */
export function importSourceForFile(fileName: string): 'csv' | 'xlsx' | 'xls' {
  const extension = fileName.trim().toLowerCase().split('.').pop() ?? '';
  if (extension === 'xlsx') return 'xlsx';
  if (extension === 'xls') return 'xls';
  return 'csv';
}

/** Coarse size, so a funnel can be sliced without sending exact row counts. */
export function rowCountBucket(rowCount: number): '1-10' | '11-50' | '51-200' | '200+' {
  if (rowCount <= 10) return '1-10';
  if (rowCount <= 50) return '11-50';
  if (rowCount <= 200) return '51-200';
  return '200+';
}
