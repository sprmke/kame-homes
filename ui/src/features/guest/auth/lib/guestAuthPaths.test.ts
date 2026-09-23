import { describe, expect, it } from 'vitest';

import { guestLoginPath, guestOAuthRedirectTo, GUEST_LOGIN_PATH, GUEST_REGISTER_PATH } from '@/features/guest/auth/lib/guestAuthPaths';

describe('guestLoginPath', () => {

  it('guestLoginPath is exported', () => {
    expect(typeof guestLoginPath).toBe('function');
  });

});

describe('guestOAuthRedirectTo', () => {

  it('guestOAuthRedirectTo is exported', () => {
    expect(typeof guestOAuthRedirectTo).toBe('function');
  });

});

describe('GUEST_LOGIN_PATH', () => {
  it('is defined', () => {
    expect(GUEST_LOGIN_PATH).toBeDefined();
  });
});

describe('GUEST_REGISTER_PATH', () => {
  it('is defined', () => {
    expect(GUEST_REGISTER_PATH).toBeDefined();
  });
});
