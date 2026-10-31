import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  guestFormFetchUrl,
  readGuestBookingAccessToken,
  storeGuestBookingAccessToken,
} from './guestBookingAccess';

const BOOKING_ID = '11111111-1111-1111-1111-111111111111';

describe('guestBookingAccess', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
  });

  it('stores and reads access token for a booking', () => {
    storeGuestBookingAccessToken(BOOKING_ID, 'tok-abc');
    expect(readGuestBookingAccessToken(BOOKING_ID)).toBe('tok-abc');
  });

  it('builds get-form URL with access query when stored', () => {
    storeGuestBookingAccessToken(BOOKING_ID, 'tok/with+special');
    const url = guestFormFetchUrl('https://api.test/functions/v1', BOOKING_ID);
    expect(url).toBe(
      `https://api.test/functions/v1/get-form/${BOOKING_ID}?access=${encodeURIComponent('tok/with+special')}`
    );
  });

  it('omits access query when no token stored', () => {
    const url = guestFormFetchUrl('https://api.test/functions/v1', BOOKING_ID);
    expect(url).toBe(`https://api.test/functions/v1/get-form/${BOOKING_ID}`);
  });
});
