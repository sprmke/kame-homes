import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

const AMOUNT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parsePdfAmount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;

  const cleaned = String(value)
    .replace(/₱/g, '')
    .replace(/\bPHP\b/gi, '')
    .replace(/,/g, '')
    .trim();
  if (!cleaned) return null;

  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

/** Plain amount for jsPDF tables and KPIs — e.g. `2,999.00` (no `PHP` / `₱`). */
export function pdfMoney(value: number | string | null | undefined): string {
  const n = parsePdfAmount(value);
  if (n === null) return '-';
  const prefix = n < 0 ? '-' : '';
  return `${prefix}${AMOUNT.format(Math.abs(n))}`;
}

/** Compact date for table cells (`May 30`). */
export function pdfBookingDate(mmddyyyy: string | null | undefined): string {
  if (!mmddyyyy) return '-';
  const d = dayjs(mmddyyyy, 'MM-DD-YYYY');
  if (!d.isValid()) return mmddyyyy;
  return d.format('MMM D');
}

export function pdfIsoDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = dayjs(iso.slice(0, 10));
  if (!d.isValid()) return iso;
  return d.format('MMM D, YYYY');
}
