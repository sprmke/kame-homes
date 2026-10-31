/**
 * Client-side CSV template for booking imports.
 *
 * The downloaded file has to upload without edits: one header row, one example
 * row, nothing else. A second table or a note line makes every column count
 * disagree and the upload fails before the host sees the wizard.
 */

/** Canonical booking columns offered for host spreadsheets (snake_case). */
export const IMPORT_CSV_TEMPLATE_HEADERS = [
  'guest_display_name',
  'primary_guest_name',
  'guest_email',
  'guest_phone_number',
  'guest_address',
  'check_in_date',
  'check_out_date',
  'check_in_time',
  'check_out_time',
  'number_of_adults',
  'number_of_children',
  'number_of_nights',
  'booking_source',
  'booking_rate',
  'down_payment',
  'security_deposit',
  'need_parking',
  'has_pets',
  'guest2_name',
  'guest3_name',
  'guest_special_requests',
] as const;

type ImportCsvTemplateHeader = (typeof IMPORT_CSV_TEMPLATE_HEADERS)[number];

type ImportCsvRow = Record<ImportCsvTemplateHeader, string>;

/**
 * One filled row so the expected shapes (dates, times, yes/no) are visible
 * without reading a guide. It lands in Preview like any other row, where it can
 * be switched off. Keyed by header so a new column cannot ship without a sample.
 */
const IMPORT_CSV_TEMPLATE_EXAMPLE: ImportCsvRow = {
  guest_display_name: 'Juan Dela Cruz',
  primary_guest_name: 'Juan Dela Cruz',
  guest_email: 'juan.delacruz@example.com',
  guest_phone_number: '09171234567',
  guest_address: 'San Fernando, Pampanga',
  check_in_date: '2026-01-15',
  check_out_date: '2026-01-18',
  check_in_time: '14:00',
  check_out_time: '11:00',
  number_of_adults: '2',
  number_of_children: '1',
  number_of_nights: '3',
  booking_source: 'Airbnb',
  booking_rate: '7500',
  down_payment: '3750',
  security_deposit: '2000',
  need_parking: 'yes',
  has_pets: 'no',
  guest2_name: 'Maria Dela Cruz',
  guest3_name: '',
  guest_special_requests: 'Late check-in, high floor if possible',
};

function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(lines: string[][]): string {
  return `${lines.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
}

function rowToLine(row: ImportCsvRow): string[] {
  return IMPORT_CSV_TEMPLATE_HEADERS.map((header) => row[header]);
}

export function buildImportCsvTemplate(): string {
  return rowsToCsv([[...IMPORT_CSV_TEMPLATE_HEADERS], rowToLine(IMPORT_CSV_TEMPLATE_EXAMPLE)]);
}

function downloadCsv(body: string, fileName: string): void {
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadImportCsvTemplate(fileName = 'booking-import-template.csv'): void {
  downloadCsv(buildImportCsvTemplate(), fileName);
}
