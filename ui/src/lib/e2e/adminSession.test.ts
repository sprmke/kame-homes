import { describe, expect, it } from 'vitest';

import { readE2EAdminSessionPayload, readE2EAdminSession, readE2EAdminAccessToken, clearE2EAdminSession, E2E_ADMIN_SESSION_STORAGE_KEY } from '@/lib/e2e/adminSession';

describe('readE2EAdminSessionPayload', () => {

  it('readE2EAdminSessionPayload is exported', () => {
    expect(typeof readE2EAdminSessionPayload).toBe('function');
  });

});

describe('readE2EAdminSession', () => {

  it('readE2EAdminSession is exported', () => {
    expect(typeof readE2EAdminSession).toBe('function');
  });

});

describe('readE2EAdminAccessToken', () => {

  it('readE2EAdminAccessToken is exported', () => {
    expect(typeof readE2EAdminAccessToken).toBe('function');
  });

});

describe('clearE2EAdminSession', () => {

  it('clearE2EAdminSession is exported', () => {
    expect(typeof clearE2EAdminSession).toBe('function');
  });

});

describe('E2E_ADMIN_SESSION_STORAGE_KEY', () => {
  it('is defined', () => {
    expect(E2E_ADMIN_SESSION_STORAGE_KEY).toBeDefined();
  });
});
