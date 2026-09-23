import { describe, expect, it } from 'vitest';

import { appendAntiSpamToFormData, HONEYPOT_FIELD, FORM_LOADED_AT_FIELD } from '@/lib/security/antiSpamRequest';

describe('appendAntiSpamToFormData', () => {

  it('appendAntiSpamToFormData is exported', () => {
    expect(typeof appendAntiSpamToFormData).toBe('function');
  });

});

describe('HONEYPOT_FIELD', () => {
  it('is defined', () => {
    expect(HONEYPOT_FIELD).toBeDefined();
  });
});

describe('FORM_LOADED_AT_FIELD', () => {
  it('is defined', () => {
    expect(FORM_LOADED_AT_FIELD).toBeDefined();
  });
});
