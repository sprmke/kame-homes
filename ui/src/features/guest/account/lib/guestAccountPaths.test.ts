import { describe, expect, it } from 'vitest';

import { isGuestAccountPath, GUEST_ACCOUNT_PATH, GUEST_ACCOUNT_PROFILE_PATH, GUEST_ACCOUNT_STAYS_PATH, GUEST_ACCOUNT_TRIPS_PATH, GUEST_ACCOUNT_MESSAGES_PATH, GUEST_ACCOUNT_FAVORITES_PATH, GUEST_ACCOUNT_WISHLIST_PATH, GUEST_ACCOUNT_TICKETS_PATH, GUEST_ACCOUNT_VOUCHERS_PATH, GUEST_ACCOUNT_SETTINGS_PATH } from '@/features/guest/account/lib/guestAccountPaths';

describe('isGuestAccountPath', () => {

  it('isGuestAccountPath is exported', () => {
    expect(typeof isGuestAccountPath).toBe('function');
  });

});

describe('GUEST_ACCOUNT_PATH', () => {
  it('is defined', () => {
    expect(GUEST_ACCOUNT_PATH).toBeDefined();
  });
});

describe('GUEST_ACCOUNT_PROFILE_PATH', () => {
  it('is defined', () => {
    expect(GUEST_ACCOUNT_PROFILE_PATH).toBeDefined();
  });
});

describe('GUEST_ACCOUNT_STAYS_PATH', () => {
  it('is defined', () => {
    expect(GUEST_ACCOUNT_STAYS_PATH).toBeDefined();
  });
});

describe('GUEST_ACCOUNT_TRIPS_PATH', () => {
  it('is defined', () => {
    expect(GUEST_ACCOUNT_TRIPS_PATH).toBeDefined();
  });
});

describe('GUEST_ACCOUNT_MESSAGES_PATH', () => {
  it('is defined', () => {
    expect(GUEST_ACCOUNT_MESSAGES_PATH).toBeDefined();
  });
});

describe('GUEST_ACCOUNT_FAVORITES_PATH', () => {
  it('is defined', () => {
    expect(GUEST_ACCOUNT_FAVORITES_PATH).toBeDefined();
  });
});

describe('GUEST_ACCOUNT_WISHLIST_PATH', () => {
  it('is defined', () => {
    expect(GUEST_ACCOUNT_WISHLIST_PATH).toBeDefined();
  });
});

describe('GUEST_ACCOUNT_TICKETS_PATH', () => {
  it('is defined', () => {
    expect(GUEST_ACCOUNT_TICKETS_PATH).toBeDefined();
  });
});

describe('GUEST_ACCOUNT_VOUCHERS_PATH', () => {
  it('is defined', () => {
    expect(GUEST_ACCOUNT_VOUCHERS_PATH).toBeDefined();
  });
});

describe('GUEST_ACCOUNT_SETTINGS_PATH', () => {
  it('is defined', () => {
    expect(GUEST_ACCOUNT_SETTINGS_PATH).toBeDefined();
  });
});
