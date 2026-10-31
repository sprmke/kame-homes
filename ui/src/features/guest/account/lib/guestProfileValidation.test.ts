import { describe, expect, it } from 'vitest';

import {
  guestProfilePhoneError,
  isGuestProfileDraftValid,
} from '@/features/guest/account/lib/guestProfileValidation';

describe('guestProfileValidation', () => {
  it('allows empty optional phone', () => {
    expect(guestProfilePhoneError('')).toBeNull();
    expect(isGuestProfileDraftValid({ phone: '' })).toBe(true);
  });

  it('validates Philippine mobile when provided', () => {
    expect(guestProfilePhoneError('09876543210')).toBeNull();
    expect(guestProfilePhoneError('123')).toBeTruthy();
    expect(isGuestProfileDraftValid({ phone: '123' })).toBe(false);
  });
});
