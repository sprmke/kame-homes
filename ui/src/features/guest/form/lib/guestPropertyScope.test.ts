import { describe, expect, it } from 'vitest';

import { readGuestPropertySlug, guestBookedDatesUrl, appendGuestPropertyToParams } from '@/features/guest/form/lib/guestPropertyScope';

describe('readGuestPropertySlug', () => {

  it('readGuestPropertySlug is exported', () => {
    expect(typeof readGuestPropertySlug).toBe('function');
  });

});

describe('guestBookedDatesUrl', () => {

  it('guestBookedDatesUrl is exported', () => {
    expect(typeof guestBookedDatesUrl).toBe('function');
  });

});

describe('appendGuestPropertyToParams', () => {

  it('appendGuestPropertyToParams is exported', () => {
    expect(typeof appendGuestPropertyToParams).toBe('function');
  });

});
