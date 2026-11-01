import { describe, expect, it } from 'vitest';

import {
  checkInDateToIso,
  matchesDefaultBookingsListVisibility,
  manilaTodayIso,
  passesListCheckInDateRangeFilter,
  compareBookingsForListSort,
  nextStaySort,
  isStaySort,
} from '@/features/dashboard/bookings/lib/bookingsListSort';

describe('checkInDateToIso', () => {
  it('converts MM-DD-YYYY to ISO', () => {
    expect(checkInDateToIso('03-15-2026')).toBe('2026-03-15');
  });

  it('passes through ISO dates', () => {
    expect(checkInDateToIso('2026-03-15')).toBe('2026-03-15');
  });
});

describe('matchesDefaultBookingsListVisibility', () => {
  it('hides cancelled and completed by default', () => {
    expect(matchesDefaultBookingsListVisibility({ status: 'CANCELLED' })).toBe(false);
    expect(matchesDefaultBookingsListVisibility({ status: 'COMPLETED' })).toBe(false);
    expect(matchesDefaultBookingsListVisibility({ status: 'READY_FOR_CHECKIN' })).toBe(true);
  });

  it('shows completed when showCompletedBookings is on (calendar/kanban)', () => {
    expect(matchesDefaultBookingsListVisibility({ status: 'COMPLETED' }, true)).toBe(true);
    // Cancelled still hidden unless explicitly filtered
    expect(matchesDefaultBookingsListVisibility({ status: 'CANCELLED' }, true)).toBe(false);
  });

  it('shows completed when status filter includes COMPLETED (History / Filters)', () => {
    expect(
      matchesDefaultBookingsListVisibility({ status: 'COMPLETED' }, false, ['COMPLETED'])
    ).toBe(true);
  });

  it('shows cancelled when status filter includes CANCELLED (History / Filters)', () => {
    expect(
      matchesDefaultBookingsListVisibility({ status: 'CANCELLED' }, false, [
        'COMPLETED',
        'CANCELLED',
        'IMPORTED',
      ])
    ).toBe(true);
  });

  it('keeps cancelled hidden when filter asks only for completed', () => {
    expect(
      matchesDefaultBookingsListVisibility({ status: 'CANCELLED' }, false, ['COMPLETED'])
    ).toBe(false);
  });
});

describe('manilaTodayIso', () => {
  it('returns YYYY-MM-DD', () => {
    expect(manilaTodayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('passesListCheckInDateRangeFilter', () => {
  it('passes when no range is set', () => {
    expect(passesListCheckInDateRangeFilter({ check_in_date: '2025-01-01' }, null, null)).toBe(
      true
    );
  });

  it('filters by check-in within from/to', () => {
    expect(
      passesListCheckInDateRangeFilter({ check_in_date: '01-15-2026' }, '2026-01-01', '2026-12-31')
    ).toBe(true);
    expect(
      passesListCheckInDateRangeFilter({ check_in_date: '01-15-2025' }, '2026-01-01', '2026-12-31')
    ).toBe(false);
  });
});

describe('compareBookingsForListSort', () => {
  it('compareBookingsForListSort is exported', () => {
    expect(typeof compareBookingsForListSort).toBe('function');
  });
});

describe('nextStaySort', () => {
  it('nextStaySort is exported', () => {
    expect(typeof nextStaySort).toBe('function');
  });
});

describe('isStaySort', () => {
  it('isStaySort is exported', () => {
    expect(typeof isStaySort).toBe('function');
  });
});
