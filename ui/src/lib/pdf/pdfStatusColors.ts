import { statusTone, type StatusTone } from '@/features/dashboard/bookings/lib/bookingStatus';

import type { PdfRgb } from '@/lib/pdf/pdfTheme';
import { PDF_COLORS } from '@/lib/pdf/pdfTheme';
import { STATUS_TONE_HEX } from '@/lib/statusToneColors';
import { parseHexRgb } from '@/lib/theme/colorConvert';

/** Darken a 500-level tone hex for readable body text on white (matches badge -800 intent). */
function darkenToneRgb(hex: string, factor = 0.62): PdfRgb {
  const parsed = parseHexRgb(hex);
  if (!parsed) return [...PDF_COLORS.foreground];
  return [
    Math.round(parsed.r * factor),
    Math.round(parsed.g * factor),
    Math.round(parsed.b * factor),
  ];
}

/** Status-tone text RGB aligned with `STATUS_TONE_HEX` / `StatusBadge` dots. */
export function pdfToneTextColor(tone: StatusTone): PdfRgb {
  return darkenToneRgb(STATUS_TONE_HEX[tone]);
}

export function pdfStatusTextColor(status: string): PdfRgb {
  return pdfToneTextColor(statusTone(status));
}

/** Income / positive money — same green tone as ledger income. */
export function pdfIncomeTextColor(): PdfRgb {
  return pdfToneTextColor('green');
}

/** Expense / negative money — same red tone as ledger expenses. */
export function pdfExpenseTextColor(): PdfRgb {
  return pdfToneTextColor('red');
}

/** Pipeline / estimate figures — amber tone (in-progress stays). */
export function pdfEstimateTextColor(): PdfRgb {
  return pdfToneTextColor('amber');
}

/** Maintenance reminder row status labels from exportPdf. */
export function pdfMaintenanceStatusColor(label: string): PdfRgb {
  if (label === 'Done') return pdfToneTextColor('green');
  if (label === 'Pending') return pdfToneTextColor('amber');
  return [...PDF_COLORS.foreground];
}
