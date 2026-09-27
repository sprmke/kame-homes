/** Plain labels for org portfolio outlook and attention reasons. */

import type { ForwardOccupancyState } from '@/features/dashboard/analytics/lib/types';

/** Outlook is always one of these four, based on how much of the next 30 nights is booked. */
export const ORG_OUTLOOK_LABEL: Record<ForwardOccupancyState, string> = {
  underbooked: 'Underbooked',
  building: 'Building',
  strong: 'Strong',
  fully_booked: 'Fully booked',
};

/** Period occupancy below this % counts as soft demand (booking-focused attention). */
export const ORG_SOFT_OCCUPANCY_PCT = 40;

export function listingNeedsAttention(row: {
  locked?: boolean;
  forwardOccupancyState30d?: ForwardOccupancyState;
  reservations?: number;
  occupancyRate?: number;
}): boolean {
  if (row.locked) return false;
  if (row.forwardOccupancyState30d === 'underbooked') return true;
  if (row.reservations === 0) return true;
  if (
    row.occupancyRate !== undefined &&
    row.occupancyRate < ORG_SOFT_OCCUPANCY_PCT &&
    (row.reservations ?? 0) > 0
  ) {
    return true;
  }
  return false;
}
