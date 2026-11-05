import { describe, expect, it } from 'vitest';

import {
  isCompletionLinkLive,
  isImportedBooking,
  isImportedPendingBooking,
} from '@/features/dashboard/pricing/lib/importedBooking';
import type { PropertyPricingCalendarBooking } from '@/features/dashboard/pricing/lib/propertyPricingApi';

function booking(
  overrides: Partial<PropertyPricingCalendarBooking>
): PropertyPricingCalendarBooking {
  return {
    id: 'b1',
    status: 'PENDING_REVIEW',
    check_in_date: '11-20-2026',
    check_out_date: '11-23-2026',
    primary_guest_name: 'Airbnb HM123',
    guest_facebook_name: '',
    guest_email: '',
    guest_phone_number: null,
    booking_rate: null,
    number_of_nights: 3,
    need_parking: null,
    has_pets: null,
    valid_id_url: null,
    ...overrides,
  };
}

describe('isImportedBooking', () => {
  it('accepts either provenance column', () => {
    expect(isImportedBooking(booking({ external_source: 'airbnb' }))).toBe(true);
    expect(isImportedBooking(booking({ booking_source: 'Airbnb' }))).toBe(true);
  });

  it('rejects direct bookings and missing rows', () => {
    expect(isImportedBooking(booking({ booking_source: 'Direct' }))).toBe(false);
    expect(isImportedBooking(null)).toBe(false);
  });
});

describe('isImportedPendingBooking', () => {
  it('requires pending review', () => {
    expect(
      isImportedPendingBooking(booking({ external_source: 'airbnb', status: 'READY_FOR_CHECKIN' }))
    ).toBe(false);
    expect(isImportedPendingBooking(booking({ external_source: 'airbnb' }))).toBe(true);
  });

  it('rejects direct bookings', () => {
    expect(isImportedPendingBooking(booking({ booking_source: 'Direct' }))).toBe(false);
  });

  it('rejects a missing booking', () => {
    expect(isImportedPendingBooking(null)).toBe(false);
  });
});

describe('isCompletionLinkLive', () => {
  const today = new Date(2026, 10, 5); // Nov 5, 2026

  it('keeps a stay whose checkout is today or later', () => {
    expect(isCompletionLinkLive(booking({ check_out_date: '11-05-2026' }), today)).toBe(true);
    expect(isCompletionLinkLive(booking({ check_out_date: '2026-11-06' }), today)).toBe(true);
  });

  it('hides a stay that already checked out', () => {
    expect(isCompletionLinkLive(booking({ check_out_date: '11-04-2026' }), today)).toBe(false);
  });

  it('hides an unparseable date', () => {
    expect(isCompletionLinkLive(booking({ check_out_date: 'not-a-date' }), today)).toBe(false);
  });
});
