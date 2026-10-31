import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

export type BookingViewTab =
  'ai_summary' | 'overview' | 'guests' | 'parking' | 'pets' | 'pricing' | 'files';

type ResolveOpts = {
  /** Tab only exists after a finished AI Summary run. */
  hasAiSummaryRun?: boolean;
};

/** Clamp tab when conditional sections disappear (e.g. parking cleared, AI tab gone). */
export function resolveBookingViewTab(
  tab: BookingViewTab,
  booking: BookingRow,
  opts: ResolveOpts = {}
): BookingViewTab {
  if (tab === 'ai_summary' && !opts.hasAiSummaryRun) return 'overview';
  if (tab === 'parking' && !booking.need_parking) return 'overview';
  if (tab === 'pets' && !booking.has_pets) return 'overview';
  if (tab === 'pricing' && booking.status === 'PENDING_REVIEW') return 'overview';
  return tab;
}
