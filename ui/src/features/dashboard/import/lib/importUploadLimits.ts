/** Import upload limits — mirror of supabase/functions/_shared/importUploadLimits.ts */

export const IMPORT_MAX_FILE_BYTES = 15 * 1024 * 1024;

export const IMPORT_MAX_ROW_COUNT = 2000;

export const IMPORT_ACCEPT =
  '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

export const IMPORT_LIMITS_HINT = `CSV or Excel · max 15 MB · up to ${IMPORT_MAX_ROW_COUNT.toLocaleString()} rows`;

function extensionOf(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim().toLowerCase() ?? '';
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot) : '';
}

export function validateImportCsvFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();
  const ext = extensionOf(name);

  const csvOk =
    ext === '.csv' ||
    mime === 'text/csv' ||
    mime === 'application/csv' ||
    mime === 'text/plain' ||
    (mime === '' && ext === '.csv');
  const xlsxOk =
    ext === '.xlsx' || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const xlsOk = ext === '.xls' || mime === 'application/vnd.ms-excel';

  if (!csvOk && !xlsxOk && !xlsOk) {
    return 'File must be a CSV (.csv) or Excel (.xlsx, .xls)';
  }
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    return 'File must be 15 MB or smaller';
  }
  return null;
}
