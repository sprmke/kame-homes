/**
 * Client mirror of `supabase/functions/_shared/importCommitStatus.ts`
 * (preview/display helpers only — commit runs on the edge).
 */

import {
  checkInDateToIso,
  manilaTodayIso,
} from '@/features/dashboard/bookings/lib/bookingsListSort';

export function importCommitStatusForCheckIn(
  checkInRaw: string | null | undefined
): 'IMPORTED' | 'PENDING_REVIEW' {
  const iso = checkInDateToIso(checkInRaw ?? '');
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return 'IMPORTED';
  }
  const today = manilaTodayIso();
  if (iso < today) return 'IMPORTED';
  return 'PENDING_REVIEW';
}
