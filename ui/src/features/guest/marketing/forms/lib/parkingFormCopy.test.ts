import { describe, expect, it } from 'vitest';

import { PARKING_REGISTRATION_FORM_NAME, PARKING_REGISTRATION_SUCCESS_TITLE, PARKING_REGISTRATION_SUCCESS_MESSAGE } from '@/features/guest/marketing/forms/lib/parkingFormCopy';

describe('PARKING_REGISTRATION_FORM_NAME', () => {
  it('is defined', () => {
    expect(PARKING_REGISTRATION_FORM_NAME).toBeDefined();
  });
});

describe('PARKING_REGISTRATION_SUCCESS_TITLE', () => {
  it('is defined', () => {
    expect(PARKING_REGISTRATION_SUCCESS_TITLE).toBeDefined();
  });
});

describe('PARKING_REGISTRATION_SUCCESS_MESSAGE', () => {
  it('is defined', () => {
    expect(PARKING_REGISTRATION_SUCCESS_MESSAGE).toBeDefined();
  });
});
