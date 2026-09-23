import { describe, expect, it } from 'vitest';

import { resolveGuestDisplayName, resolveGuestAvatarUrl, guestInitials } from '@/features/guest/account/lib/guestAccountIdentity';

describe('resolveGuestDisplayName', () => {

  it('resolveGuestDisplayName is exported', () => {
    expect(typeof resolveGuestDisplayName).toBe('function');
  });

});

describe('resolveGuestAvatarUrl', () => {

  it('resolveGuestAvatarUrl is exported', () => {
    expect(typeof resolveGuestAvatarUrl).toBe('function');
  });

});

describe('guestInitials', () => {

  it('guestInitials is exported', () => {
    expect(typeof guestInitials).toBe('function');
  });

});
