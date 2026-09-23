import { describe, expect, it } from 'vitest';

import {
  buildBookingsListStatusOrFilter,
  passesBookingsListStatusFilter,
} from '@/features/dashboard/bookings/lib/bookingsStatusFilter';

describe('bookingsStatusFilter', () => {
  it('builds imported batch OR filter', () => {
    expect(buildBookingsListStatusOrFilter(['IMPORTED'], true)).toBe(
      'status.eq.IMPORTED,imported_from_batch_id.not.is.null'
    );
    expect(buildBookingsListStatusOrFilter(['PENDING_REVIEW'], true)).toBeNull();
  });

  it('passes rows matching status or imported batch expansion', () => {
    expect(
      passesBookingsListStatusFilter(
        { status: 'PENDING_REVIEW', imported_from_batch_id: null },
        ['PENDING_REVIEW'],
        false
      )
    ).toBe(true);

    expect(
      passesBookingsListStatusFilter(
        { status: 'PENDING_REVIEW', imported_from_batch_id: 'batch-1' },
        ['IMPORTED'],
        true
      )
    ).toBe(true);
  });
});
