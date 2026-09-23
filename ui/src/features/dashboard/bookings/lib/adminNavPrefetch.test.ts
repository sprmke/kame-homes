import { describe, expect, it } from 'vitest';

import { resolveAdminNavPrefetch } from '@/features/dashboard/bookings/lib/adminNavPrefetch';

describe('resolveAdminNavPrefetch', () => {

  it('resolveAdminNavPrefetch is exported', () => {
    expect(typeof resolveAdminNavPrefetch).toBe('function');
  });

});
