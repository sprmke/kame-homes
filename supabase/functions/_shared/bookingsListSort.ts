/**
 * Shared list sort for admin `list-bookings`.
 * Keep in sync with `ui/src/features/dashboard/bookings/lib/bookingsListSort.ts`.
 */

export type BookingsListSort =
  | 'status_priority:asc'
  | 'check_in_date:asc'
  | 'check_in_date:desc'
  | 'created_at:asc'
  | 'created_at:desc';

/** Workflow-first status order for the default admin list sort. */
const STATUS_PRIORITY: Record<string, number> = {
  PENDING_SD_REFUND: 0,
  PENDING_REVIEW: 1,
  PENDING_DOCUMENTS: 2,
  PENDING_GAF: 3,
  PENDING_PARKING_REQUEST: 4,
  PENDING_PET_REQUEST: 5,
  READY_FOR_CHECKOUT: 6,
  READY_FOR_CHECKIN: 7,
  COMPLETED: 8,
  IMPORTED: 10,
  CANCELLED: 9,
};

const PROXIMITY_SORT_STATUSES = new Set(['PENDING_REVIEW', 'PENDING_DOCUMENTS']);

export function checkInDateToIso(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [m, d, y] = dateStr.split('-');
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

const CANCELLED_STATUSES = new Set(['CANCELLED']);

/** Default `/bookings` list visibility when **Show completed bookings** is off. */
export function matchesDefaultBookingsListVisibility(
  row: { status: string },
  showCompletedBookings = false
): boolean {
  if (CANCELLED_STATUSES.has(row.status)) return false;
  if (!showCompletedBookings && row.status === 'COMPLETED') return false;
  return true;
}

export function manilaTodayIso(): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    .toISOString()
    .slice(0, 10);
}

/** Check-in range filter for `/bookings` — applies to every status. */
export function passesListCheckInDateRangeFilter(
  row: { check_in_date: string },
  from: string | null,
  to: string | null
): boolean {
  if (!from && !to) return true;
  const iso = checkInDateToIso(row.check_in_date);
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

function statusPriority(status: string): number {
  return STATUS_PRIORITY[status] ?? 50;
}

/** Smaller = closer check-in to today (Manila calendar day). */
function checkInProximityToToday(iso: string, today: string): number {
  if (!iso) return Number.MAX_SAFE_INTEGER;
  const t0 = new Date(`${today}T12:00:00`).getTime();
  const t1 = new Date(`${iso}T12:00:00`).getTime();
  return Math.abs(t1 - t0);
}

export function compareBookingsForListSort(
  a: { status: string; check_in_date: string; created_at: string },
  b: { status: string; check_in_date: string; created_at: string },
  sort: BookingsListSort,
  todayManila: string
): number {
  if (sort === 'status_priority:asc') {
    const pa = statusPriority(a.status);
    const pb = statusPriority(b.status);
    if (pa !== pb) return pa - pb;

    if (PROXIMITY_SORT_STATUSES.has(a.status) && a.status === b.status) {
      const proxA = checkInProximityToToday(checkInDateToIso(a.check_in_date), todayManila);
      const proxB = checkInProximityToToday(checkInDateToIso(b.check_in_date), todayManila);
      if (proxA !== proxB) return proxA - proxB;
    }

    const aIso = checkInDateToIso(a.check_in_date);
    const bIso = checkInDateToIso(b.check_in_date);
    if (aIso !== bIso) return aIso < bIso ? -1 : 1;
    return 0;
  }

  const [sortCol, sortDir] = sort.split(':') as [string, 'asc' | 'desc'];
  const aVal = sortCol === 'check_in_date' ? checkInDateToIso(a.check_in_date) : a.created_at;
  const bVal = sortCol === 'check_in_date' ? checkInDateToIso(b.check_in_date) : b.created_at;
  const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  return sortDir === 'asc' ? cmp : -cmp;
}
