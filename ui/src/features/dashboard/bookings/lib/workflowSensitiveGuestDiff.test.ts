import { describe, expect, it } from 'vitest';

import type { UpdateBookingPayload } from '@/features/dashboard/bookings/hooks/useUpdateBooking';
import { hasWorkflowSensitiveGuestFieldDiff } from '@/features/dashboard/bookings/lib/workflowSensitiveGuestDiff';

const base = {
  guest_facebook_name: 'Maria',
  primary_guest_name: 'Maria Santos',
  guest_email: 'maria@example.com',
  guest_phone_number: '09171234567',
  check_in_date: '2026-09-01',
  check_out_date: '2026-09-03',
  check_in_time: '14:00',
  check_out_time: '12:00',
  need_parking: false,
  has_pets: false,
  guest_requests_surprise_decor: false,
} satisfies UpdateBookingPayload;

describe('workflowSensitiveGuestDiff', () => {
  it('detects check-in date change', () => {
    expect(
      hasWorkflowSensitiveGuestFieldDiff(base, {
        ...base,
        check_in_date: '2026-09-02',
      })
    ).toBe(true);
  });

  it('ignores identical payloads', () => {
    expect(hasWorkflowSensitiveGuestFieldDiff(base, { ...base })).toBe(false);
  });
});
