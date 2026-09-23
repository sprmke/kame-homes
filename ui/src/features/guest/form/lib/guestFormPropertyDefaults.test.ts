import { describe, expect, it } from 'vitest';

import { GUEST_FORM_DEFAULT_CHECK_IN_TIME, GUEST_FORM_DEFAULT_CHECK_OUT_TIME } from '@/features/guest/form/lib/guestFormPropertyDefaults';

describe('GUEST_FORM_DEFAULT_CHECK_IN_TIME', () => {
  it('is defined', () => {
    expect(GUEST_FORM_DEFAULT_CHECK_IN_TIME).toBeDefined();
  });
});

describe('GUEST_FORM_DEFAULT_CHECK_OUT_TIME', () => {
  it('is defined', () => {
    expect(GUEST_FORM_DEFAULT_CHECK_OUT_TIME).toBeDefined();
  });
});
