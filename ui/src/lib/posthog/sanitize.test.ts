import { describe, expect, it } from 'vitest';

import { sanitizeAnalyticsProperties } from './sanitize';

describe('sanitizeAnalyticsProperties', () => {
  it('strips denylisted PII keys', () => {
    const out = sanitizeAnalyticsProperties({
      step_id: 1,
      email: 'a@b.com',
      guest_phone_number: '+63123456789',
      booking_source: 'Airbnb',
    });
    expect(out).toEqual({ step_id: 1, booking_source: 'Airbnb' });
  });

  it('drops very long strings', () => {
    const out = sanitizeAnalyticsProperties({ note: 'x'.repeat(600) });
    expect(out).toEqual({});
  });
});
