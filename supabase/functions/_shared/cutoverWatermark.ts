/**
 * Cutover watermark guard (legacy → mt-prod plan §5.6):
 * bookings whose stay ended before `platform_settings.migration_cutover_at` are
 * settled history — no review windows, request emails or auto-reviews; their
 * guests were already handled by the legacy stack.
 *
 * Null cutover (no cutover yet) keeps the guard inactive — correct for mt-dev
 * and for a legacy-era DB operating as itself.
 */

import { normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';

export function shouldSkipForCutoverWatermark(
  checkOutDate: string | null | undefined,
  migrationCutoverAt: string | null | undefined
): boolean {
  if (!migrationCutoverAt || !checkOutDate) return false;
  const ymd = normalizeBookingDateToYmd(checkOutDate);
  if (!ymd) return false;
  const checkOutMs = Date.parse(ymd);
  if (Number.isNaN(checkOutMs)) return false;
  // +1 day grace: a stay checking out on cutover day is still a live guest.
  return checkOutMs + 86_400_000 <= Date.parse(migrationCutoverAt);
}
