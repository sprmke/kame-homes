/** Import upload limits — keep in sync with ui/.../import/lib/importUploadLimits.ts */

export const IMPORT_UPLOAD_BUCKET = 'import-uploads';

export const IMPORT_MAX_FILE_BYTES = 15 * 1024 * 1024;

export const IMPORT_MAX_ROW_COUNT = 2000;

/** PostgREST insert batch size for import_batch_rows (wide JSONB payloads). */
export const IMPORT_ROW_INSERT_CHUNK_SIZE = 500;

export type ImportFileKind = 'csv' | 'xlsx' | 'xls';

const CSV_MIME = new Set(['text/csv', 'application/csv', 'text/plain']);

const XLSX_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
]);

const XLS_MIME = new Set([
  'application/vnd.ms-excel',
  'application/msexcel',
  'application/x-msexcel',
  'application/x-ms-excel',
  'application/x-excel',
  'application/xls',
]);

export function extensionOfImportFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim().toLowerCase() ?? '';
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot) : '';
}

export function getImportFileKind(file: File, fileName: string): ImportFileKind | null {
  const ext = extensionOfImportFileName(fileName);
  const mime = (file.type || '').toLowerCase();

  if (ext === '.csv' || CSV_MIME.has(mime)) return 'csv';
  if (ext === '.xlsx' || XLSX_MIME.has(mime)) return 'xlsx';
  if (ext === '.xls' || XLS_MIME.has(mime)) return 'xls';
  return null;
}

export function isAllowedImportFile(file: File, fileName: string): boolean {
  return getImportFileKind(file, fileName) != null;
}

/** @deprecated Use isAllowedImportFile — kept for any leftover imports. */
export function isAllowedImportCsvFile(file: File, fileName: string): boolean {
  return getImportFileKind(file, fileName) === 'csv';
}

export function contentTypeForImportKind(kind: ImportFileKind): string {
  if (kind === 'xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (kind === 'xls') return 'application/vnd.ms-excel';
  return 'text/csv';
}

export function importStoragePath(orgId: string, batchId: string, fileName: string): string {
  const safeName = sanitizeImportFileName(fileName);
  return `${orgId}/${batchId}/${safeName}`;
}

export function sanitizeImportFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || 'import.csv';
  const cleaned = base.replace(/[^\w.\-()+\s]/g, '_').slice(0, 180);
  const lower = cleaned.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return cleaned;
  }
  return `${cleaned}.csv`;
}
