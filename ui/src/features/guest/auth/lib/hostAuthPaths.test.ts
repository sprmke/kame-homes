import { describe, expect, it } from 'vitest';

import { hostLoginPath, hostGoogleOAuthRedirectTo, HOST_LOGIN_PATH, HOST_REGISTER_PATH } from '@/features/guest/auth/lib/hostAuthPaths';

describe('hostLoginPath', () => {

  it('hostLoginPath is exported', () => {
    expect(typeof hostLoginPath).toBe('function');
  });

});

describe('hostGoogleOAuthRedirectTo', () => {

  it('hostGoogleOAuthRedirectTo is exported', () => {
    expect(typeof hostGoogleOAuthRedirectTo).toBe('function');
  });

});

describe('HOST_LOGIN_PATH', () => {
  it('is defined', () => {
    expect(HOST_LOGIN_PATH).toBeDefined();
  });
});

describe('HOST_REGISTER_PATH', () => {
  it('is defined', () => {
    expect(HOST_REGISTER_PATH).toBeDefined();
  });
});
