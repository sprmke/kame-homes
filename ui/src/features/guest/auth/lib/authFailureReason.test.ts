import { describe, expect, it } from 'vitest';

import { classifyAuthFailure } from './authFailureReason';

describe('classifyAuthFailure', () => {
  it('maps an expired code', () => {
    expect(classifyAuthFailure('Token has expired or is invalid')).toBe('otp_expired');
  });

  it('maps a wrong code', () => {
    expect(classifyAuthFailure('Invalid OTP')).toBe('otp_invalid');
    expect(classifyAuthFailure('Code is incorrect')).toBe('otp_invalid');
  });

  it('maps a rejected identity', () => {
    expect(classifyAuthFailure('Email not allowed for this workspace')).toBe('not_allowed');
  });

  it('maps a cancelled provider flow', () => {
    expect(classifyAuthFailure('User cancelled the popup')).toBe('cancelled');
  });

  it('falls back to provider_error, including for empty input', () => {
    expect(classifyAuthFailure('something exploded')).toBe('provider_error');
    expect(classifyAuthFailure(null)).toBe('provider_error');
    expect(classifyAuthFailure(undefined)).toBe('provider_error');
  });
});
