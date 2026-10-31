import { describe, expect, it } from 'vitest';

import { resolveBookingViewTab } from '@/features/dashboard/bookings/lib/resolveBookingViewTab';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

const baseBooking = {
  need_parking: false,
  has_pets: false,
  status: 'READY_FOR_CHECKIN',
} as BookingRow;

describe('resolveBookingViewTab', () => {
  it('falls back from ai_summary when no run', () => {
    expect(resolveBookingViewTab('ai_summary', baseBooking, { hasAiSummaryRun: false })).toBe(
      'overview'
    );
  });

  it('falls back from parking when not needed', () => {
    expect(resolveBookingViewTab('parking', baseBooking)).toBe('overview');
  });

  it('falls back from pricing during pending review', () => {
    expect(
      resolveBookingViewTab('pricing', { ...baseBooking, status: 'PENDING_REVIEW' } as BookingRow)
    ).toBe('overview');
  });

  it('keeps tab when section applies', () => {
    expect(resolveBookingViewTab('pets', { ...baseBooking, has_pets: true } as BookingRow)).toBe(
      'pets'
    );
  });
});
