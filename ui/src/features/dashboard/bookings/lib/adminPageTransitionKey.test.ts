import { describe, expect, it } from 'vitest';

import { adminPageTransitionKey } from '@/features/dashboard/bookings/lib/adminPageTransitionKey';

describe('adminPageTransitionKey', () => {

  it('adminPageTransitionKey is exported', () => {
    expect(typeof adminPageTransitionKey).toBe('function');
  });

});
