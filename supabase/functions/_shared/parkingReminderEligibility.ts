/**
 * Pure eligibility rule for the pre-arrival parking reminder (no DB imports, so it is
 * unit-testable without a Supabase client).
 *
 * `calendarDaysBetween` clamps negative differences to 0, so a past check-in looks like
 * "today". That sent reminders to three 2025 bookings on 2026-11-02; the explicit
 * `checkInYmd < todayYmd` guard prevents it.
 */

import { calendarDaysBetween, normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';
import { isParkingLinkableStatus } from './parkingPropertyLink.ts';

export const PARKING_REMINDER_LEAD_DAYS = 3;

export function isParkingReminderDue(
  checkInDate: string,
  todayYmd: string,
  status: string,
  linked: boolean
): boolean {
  if (linked) return false;
  if (!isParkingLinkableStatus(status)) return false;
  const checkInYmd = normalizeBookingDateToYmd(checkInDate);
  if (!checkInYmd || checkInYmd < todayYmd) return false;
  const daysUntil = calendarDaysBetween(todayYmd, checkInYmd);
  return daysUntil >= 0 && daysUntil <= PARKING_REMINDER_LEAD_DAYS;
}
