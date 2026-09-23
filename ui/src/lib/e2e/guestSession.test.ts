import { describe, expect, it } from 'vitest';

import { readE2EGuestSessionPayload, readE2EGuestSession, clearE2EGuestSession, E2E_GUEST_SESSION_STORAGE_KEY } from '@/lib/e2e/guestSession';

describe('readE2EGuestSessionPayload', () => {

  it('readE2EGuestSessionPayload is exported', () => {
    expect(typeof readE2EGuestSessionPayload).toBe('function');
  });

});

describe('readE2EGuestSession', () => {

  it('readE2EGuestSession is exported', () => {
    expect(typeof readE2EGuestSession).toBe('function');
  });

});

describe('clearE2EGuestSession', () => {

  it('clearE2EGuestSession is exported', () => {
    expect(typeof clearE2EGuestSession).toBe('function');
  });

});

describe('E2E_GUEST_SESSION_STORAGE_KEY', () => {
  it('is defined', () => {
    expect(E2E_GUEST_SESSION_STORAGE_KEY).toBeDefined();
  });
});
