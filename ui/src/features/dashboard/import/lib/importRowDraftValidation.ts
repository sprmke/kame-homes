import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { BOOKING_IMPORT_TARGET_FIELDS } from '@/features/dashboard/import/lib/importTargetFields';

dayjs.extend(customParseFormat);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BOOLEAN_VALUES = new Set(['yes', 'y', 'true', '1', 't', 'no', 'n', 'false', '0', 'f']);
const DATE_FORMATS = [
  'MM-DD-YYYY',
  'M-D-YYYY',
  'MM/DD/YYYY',
  'M/D/YYYY',
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'DD-MM-YYYY',
  'D-M-YYYY',
  'DD/MM/YYYY',
  'D/M/YYYY',
  'MMM D, YYYY',
  'MMMM D, YYYY',
  'D MMM YYYY',
  'D MMMM YYYY',
] as const;

export function parseImportDraftDate(value: string): dayjs.Dayjs | null {
  const raw = value.trim();
  if (!raw) return null;

  for (const format of DATE_FORMATS) {
    const parsed = dayjs(raw, format, true);
    if (parsed.isValid()) return parsed;
  }

  const loose = dayjs(raw);
  return loose.isValid() ? loose : null;
}

type ValidateDraftInput = {
  fieldId: string;
  value: string;
  mappedData: Record<string, string | null>;
  drafts: Record<string, string>;
};

/**
 * Client mirror of importPreviewService validation for immediate button state.
 * The server remains authoritative and re-validates the complete row on save.
 */
export function validateImportFieldDraft({
  fieldId,
  value,
  mappedData,
  drafts,
}: ValidateDraftInput): string | null {
  const field = BOOKING_IMPORT_TARGET_FIELDS.find((entry) => entry.id === fieldId);
  if (!field) return 'This field cannot be validated.';

  const trimmed = value.trim();
  if (!trimmed) {
    return field.required ? 'Enter a value.' : null;
  }

  switch (field.type) {
    case 'email':
      if (!EMAIL_RE.test(trimmed)) return 'Enter a valid email address.';
      break;
    case 'phone':
      if (!/\d/.test(trimmed)) return 'Enter a phone number with at least one digit.';
      break;
    case 'date':
      if (!parseImportDraftDate(trimmed)) return 'Use a recognizable date, such as 2026-01-15.';
      break;
    case 'integer':
      if (!Number.isFinite(Number.parseInt(trimmed.replace(/,/g, ''), 10))) {
        return 'Enter a whole number.';
      }
      break;
    case 'decimal':
      if (!Number.isFinite(Number.parseFloat(trimmed.replace(/,/g, '')))) {
        return 'Enter a number.';
      }
      break;
    case 'boolean':
      if (!BOOLEAN_VALUES.has(trimmed.toLowerCase())) return 'Use yes, no, true, or false.';
      break;
    default:
      break;
  }

  if (fieldId === 'check_in_date' || fieldId === 'check_out_date') {
    const checkIn = parseImportDraftDate(drafts.check_in_date ?? mappedData.check_in_date ?? '');
    const checkOut = parseImportDraftDate(drafts.check_out_date ?? mappedData.check_out_date ?? '');

    if (checkIn && checkOut && !checkOut.isAfter(checkIn, 'day')) {
      return fieldId === 'check_out_date'
        ? 'Check-out must be after check-in.'
        : 'Check-in must be before check-out.';
    }
  }

  return null;
}
