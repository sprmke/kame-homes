import { describe, expect, it } from 'vitest';

import {
  formatPhilippineMobileDisplay,
  normalizePhoneDigits,
  requiredPhilippineMobilePhoneZodSchema,
  validateEmailAddress,
  validateFullPersonName,
  validatePhilippineMobilePhone,
  validatePropertyContactField,
} from '@/lib/validation/fieldValidation';

describe('validateEmailAddress', () => {
  it('allows empty (optional field)', () => {
    expect(validateEmailAddress('')).toBeNull();
  });

  it('rejects invalid email', () => {
    expect(validateEmailAddress('not-an-email')).toBeTruthy();
  });

  it('accepts valid email', () => {
    expect(validateEmailAddress('host@example.com')).toBeNull();
  });
});

describe('validatePhilippineMobilePhone', () => {
  it('requires 11 digits starting with 09', () => {
    expect(validatePhilippineMobilePhone('09876543210')).toBeNull();
    expect(validatePhilippineMobilePhone('18876543210')).toBeTruthy();
    expect(validatePhilippineMobilePhone('098765432')).toBeTruthy();
  });
});

describe('validateFullPersonName', () => {
  it('requires at least two words with 2+ chars each', () => {
    expect(validateFullPersonName('Maria Santos')).toBeNull();
    expect(validateFullPersonName('Maria')).toBeTruthy();
    expect(validateFullPersonName('M S')).toBeTruthy();
  });
});

describe('validatePropertyContactField', () => {
  it('routes to field-specific validators', () => {
    expect(validatePropertyContactField('contactEmail', 'bad')).toBeTruthy();
    expect(validatePropertyContactField('contactPhone', '09876543210')).toBeNull();
  });
});

describe('normalizePhoneDigits', () => {
  it('strips spaces', () => {
    expect(normalizePhoneDigits('09 8765 43210')).toBe('09876543210');
  });
});

describe('formatPhilippineMobileDisplay', () => {
  it('formats 11-digit mobile with spaces', () => {
    expect(formatPhilippineMobileDisplay('09876543210')).toBe('0987 654 3210');
  });
});

describe('requiredPhilippineMobilePhoneZodSchema', () => {
  it('parses valid mobile', () => {
    const schema = requiredPhilippineMobilePhoneZodSchema();
    expect(schema.parse('0987 654 3210')).toBe('09876543210');
  });

  it('rejects invalid mobile', () => {
    const schema = requiredPhilippineMobilePhoneZodSchema();
    expect(() => schema.parse('123')).toThrow();
  });
});
