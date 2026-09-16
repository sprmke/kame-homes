/**
 * Single-property calendar helpers (Asia/Manila calendar days).
 * A booking blocks each overnight night from check_in (inclusive) to check_out (exclusive).
 */

const MANILA_TZ = 'Asia/Manila';

/** Today as YYYY-MM-DD in Manila. */
export function manilaTodayYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: MANILA_TZ });
}

/** Stable ISO timestamp on today's Manila calendar date (noon +08:00). Use for Superhost rolling windows. */
export function manilaNowIso(): string {
  return `${manilaTodayYmd()}T12:00:00+08:00`;
}

/** Normalize DB date string (MM-DD-YYYY or YYYY-MM-DD) to YYYY-MM-DD. */
export function normalizeBookingDateToYmd(dateStr: string): string | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [m, d, y] = dateStr.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

export function addDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/** Calendar days from `fromYmd` to `toYmd` (exclusive of end), floored at 0. */
export function calendarDaysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(fromYmd + 'T12:00:00.000Z').getTime();
  const b = new Date(toYmd + 'T12:00:00.000Z').getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function collectBlockedNights(
  ranges: { checkInYmd: string; checkOutYmd: string }[]
): Set<string> {
  const blocked = new Set<string>();
  for (const { checkInYmd, checkOutYmd } of ranges) {
    if (!checkInYmd || !checkOutYmd || checkInYmd >= checkOutYmd) continue;
    let cur = checkInYmd;
    while (cur < checkOutYmd) {
      blocked.add(cur);
      cur = addDaysYmd(cur, 1);
    }
  }
  return blocked;
}

/** True when `dayYmd` is an occupied overnight night (check-in inclusive, check-out exclusive). */
export function bookingOccupiesNight(
  checkInYmd: string,
  checkOutYmd: string,
  dayYmd: string
): boolean {
  if (!checkInYmd || !checkOutYmd || checkInYmd >= checkOutYmd) return false;
  return checkInYmd <= dayYmd && checkOutYmd > dayYmd;
}

/** First YYYY-MM-DD >= startYmd where that night is not blocked; null if none within maxSteps. */
export function earliestAvailableCheckInYmd(
  blocked: Set<string>,
  startYmd: string,
  maxSteps = 450
): string | null {
  let cur = startYmd;
  for (let i = 0; i < maxSteps; i++) {
    if (!blocked.has(cur)) return cur;
    cur = addDaysYmd(cur, 1);
  }
  return null;
}

/** Next available check-in YMDs starting at startYmd (inclusive), in order, capped. */
export function listAvailableCheckIns(
  blocked: Set<string>,
  startYmd: string,
  limit: number,
  maxScan = 500
): string[] {
  const out: string[] = [];
  let cur = startYmd;
  for (let i = 0; i < maxScan && out.length < limit; i++) {
    if (!blocked.has(cur)) out.push(cur);
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

/** YYYY-MM-DD -> { y, m0, d } for Manila-named month via UTC parts trick on noon UTC from ymd. */
function ymdParts(ymd: string): { year: number; monthIndex: number; day: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return { year: y, monthIndex: m - 1, day: d };
}

/** "May 17, 18, 20" when all same month/year; otherwise "May 17, Jun 1". */
export function formatAvailableDatesHuman(ymds: string[]): string {
  if (ymds.length === 0) return '';
  const first = ymdParts(ymds[0]);
  const sameMonth = ymds.every((x) => {
    const p = ymdParts(x);
    return p.year === first.year && p.monthIndex === first.monthIndex;
  });
  const monthFmt = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
  const monthLabel = monthFmt.format(new Date(Date.UTC(first.year, first.monthIndex, 15)));
  if (sameMonth) {
    const days = ymds.map((x) => String(ymdParts(x).day));
    return `${monthLabel} ${days.join(', ')}`;
  }
  const fullFmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return ymds
    .map((x) => {
      const p = ymdParts(x);
      return fullFmt.format(new Date(Date.UTC(p.year, p.monthIndex, p.day)));
    })
    .join(', ');
}

/** Month name for a YMD in that calendar month (e.g. "May"). */
export function formatMonthName(ymd: string): string {
  const p = ymdParts(ymd);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(p.year, p.monthIndex, 15)));
}

/** "16, 18, 19" for same-month list; otherwise short dates joined. */
export function formatDatesListForMonth(ymds: string[], monthYmd: string): string {
  if (ymds.length === 0) return '';
  const anchor = ymdParts(monthYmd);
  const sameMonth = ymds.every((x) => {
    const p = ymdParts(x);
    return p.year === anchor.year && p.monthIndex === anchor.monthIndex;
  });
  if (sameMonth) {
    return ymds.map((x) => String(ymdParts(x).day)).join(', ');
  }
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return ymds
    .map((x) => {
      const p = ymdParts(x);
      return fmt.format(new Date(Date.UTC(p.year, p.monthIndex, p.day)));
    })
    .join(', ');
}

/**
 * Cancellation window: first blocked night through last blocked night (checkout exclusive),
 * formatted "May 14" or "May 14–16".
 */
export function formatCancellationDatesHuman(checkInYmd: string, checkOutYmd: string): string {
  const lastNight = addDaysYmd(checkOutYmd, -1);
  if (lastNight < checkInYmd) return formatAvailableDatesHuman([checkInYmd]);
  if (checkInYmd === lastNight) {
    return formatAvailableDatesHuman([checkInYmd]);
  }
  const a = ymdParts(checkInYmd);
  const b = ymdParts(lastNight);
  const sameMonth = a.year === b.year && a.monthIndex === b.monthIndex;
  const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
  if (sameMonth) {
    const m = monthFmt.format(new Date(Date.UTC(a.year, a.monthIndex, 15)));
    return `${m} ${a.day}–${b.day}`;
  }
  const short = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${short.format(new Date(Date.UTC(a.year, a.monthIndex, a.day)))}–${short.format(
    new Date(Date.UTC(b.year, b.monthIndex, b.day))
  )}`;
}
