import { describe, expect, it } from 'vitest';

import { shouldShowAdminGuestViewSlot } from '@/features/dashboard/bookings/lib/adminGuestSlots';

describe('shouldShowAdminGuestViewSlot', () => {

  it('shouldShowAdminGuestViewSlot is exported', () => {
    expect(typeof shouldShowAdminGuestViewSlot).toBe('function');
  });

});
