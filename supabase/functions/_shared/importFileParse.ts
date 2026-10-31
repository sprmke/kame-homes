/**
 * Parse host-uploaded booking import files (CSV + Excel) into header/row maps.
 */

import Papa from 'papaparse';
// SheetJS Community — official Deno CDN (see https://docs.sheetjs.com/docs/getting-started/installation/deno/)
// @deno-types="https://cdn.sheetjs.com/xlsx-0.20.3/package/types/index.d.ts"
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';

import { getImportFileKind, type ImportFileKind } from './importUploadLimits.ts';

export type ParsedImportTable = {
  headers: string[];
  rows: Record<string, string>[];
};

function cellToString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) {
    // Prefer ISO date when SheetJS gives a Date (time-only rare for booking imports).
    if (
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0
    ) {
      return value.toISOString().slice(0, 10);
    }
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return String(value).trim();
}

export function parseImportCsvText(text: string): ParsedImportTable {
  // Excel exports often prepend a UTF-8 BOM, which would otherwise ride
  // along on the first header and break column matching.
  const result = Papa.parse(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header: string) => header.trim(),
  });

  // Host spreadsheets routinely carry a note line or a short trailing row, which
  // Papa reports as FieldMismatch while still returning usable data. Those rows
  // surface as fixable rows in preview; only unparseable input aborts the upload.
  const fatal = result.errors.find((error: { type: string }) => error.type !== 'FieldMismatch');
  if (fatal) {
    throw new Error(
      `CSV parse error${fatal.row != null ? ` on row ${fatal.row + 1}` : ''}: ${fatal.message}`
    );
  }

  const headers = (result.meta.fields ?? [])
    .map((field: string) => field.trim())
    .filter(Boolean);
  if (headers.length === 0) {
    throw new Error('File must include a header row');
  }

  // Building each row from `headers` also drops Papa's `__parsed_extra` bucket,
  // so an over-wide row cannot invent a phantom column downstream.
  const rows: Record<string, string>[] = [];
  for (const row of result.data ?? []) {
    const cells: Record<string, string> = {};
    for (const header of headers) {
      cells[header] = String(row[header] ?? '').trim();
    }
    if (Object.values(cells).some((value) => value.length > 0)) rows.push(cells);
  }

  return { headers, rows };
}

export function parseImportSpreadsheetBytes(bytes: Uint8Array): ParsedImportTable {
  const workbook = XLSX.read(bytes, {
    type: 'array',
    cellDates: true,
    dense: false,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel file has no sheets');
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error('Excel file has no sheets');
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });

  if (!matrix.length) {
    throw new Error('File must include a header row');
  }

  const headerRow = matrix[0] ?? [];
  const headers: string[] = [];
  const seen = new Map<string, number>();

  for (let index = 0; index < headerRow.length; index++) {
    let header = cellToString(headerRow[index]);
    if (!header) header = `Column ${index + 1}`;
    const count = (seen.get(header) ?? 0) + 1;
    seen.set(header, count);
    headers.push(count > 1 ? `${header} (${count})` : header);
  }

  if (!headers.some((header) => header && !/^Column \d+$/.test(header))) {
    throw new Error('File must include a header row');
  }

  const rows: Record<string, string>[] = [];
  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex++) {
    const raw = matrix[rowIndex] ?? [];
    const cells: Record<string, string> = {};
    for (let col = 0; col < headers.length; col++) {
      cells[headers[col]!] = cellToString(raw[col]);
    }
    if (Object.values(cells).some((value) => value.length > 0)) rows.push(cells);
  }

  return { headers, rows };
}

export async function parseImportFile(
  file: File,
  fileName: string
): Promise<{ kind: ImportFileKind; table: ParsedImportTable }> {
  const kind = getImportFileKind(file, fileName);
  if (!kind) {
    throw new Error('File must be a CSV (.csv) or Excel (.xlsx, .xls)');
  }

  if (kind === 'csv') {
    const text = await file.text();
    return { kind, table: parseImportCsvText(text) };
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  return { kind, table: parseImportSpreadsheetBytes(buffer) };
}
