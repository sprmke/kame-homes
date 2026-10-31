import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const MANILA = 'Asia/Manila';

/** ISO timestamp → calendar date for the shared DatePicker (Asia/Manila day). */
export function announcementScheduleToDate(iso: string | null | undefined): Date | undefined {
  if (!iso?.trim()) return undefined;
  const trimmed = iso.trim();
  const ymd = trimmed.slice(0, 10);
  const fromYmd = dayjs.tz(ymd, 'YYYY-MM-DD', MANILA);
  if (fromYmd.isValid()) return fromYmd.toDate();
  const parsed = dayjs(trimmed);
  if (!parsed.isValid()) return undefined;
  return parsed.tz(MANILA).startOf('day').toDate();
}

/** Start of the selected calendar day in Asia/Manila. */
export function announcementScheduleStartFromDate(date: Date): string {
  return dayjs(date).tz(MANILA).startOf('day').toISOString();
}

/** End of the selected calendar day in Asia/Manila. */
export function announcementScheduleEndFromDate(date: Date): string {
  return dayjs(date).tz(MANILA).endOf('day').toISOString();
}

/** Compact "Starts …" / "Ends …" / range label for admin list rows; null when unscheduled. */
export function announcementScheduleSummary(
  startsAt: string | null,
  endsAt: string | null
): string | null {
  if (!startsAt && !endsAt) return null;
  const format = (iso: string) => dayjs(iso).tz(MANILA).format('MMM D, YYYY');
  if (startsAt && endsAt) return `${format(startsAt)} – ${format(endsAt)}`;
  if (startsAt) return `From ${format(startsAt)}`;
  return `Until ${format(endsAt as string)}`;
}
