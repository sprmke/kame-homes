import { describe, expect, it } from 'vitest';

import { requestGuestGeolocation } from '@/features/guest/search/lib/geolocation';

describe('requestGuestGeolocation', () => {

  it('requestGuestGeolocation is exported', () => {
    expect(typeof requestGuestGeolocation).toBe('function');
  });

});
