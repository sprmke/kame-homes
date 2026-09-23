import { describe, expect, it } from 'vitest';

import {
  optionalNonNegativeMoney,
  requiredNonNegativeMoney,
  requiredPositiveMoney,
} from '@/features/dashboard/bookings/lib/moneyFieldSchema';

describe('moneyFieldSchema', () => {
  it('requiredNonNegativeMoney rejects empty', () => {
    const schema = requiredNonNegativeMoney({ requiredError: 'Required' });
    expect(() => schema.parse('')).toThrow();
    expect(schema.parse(0)).toBe(0);
    expect(schema.parse('1500')).toBe(1500);
  });

  it('requiredPositiveMoney rejects zero', () => {
    const schema = requiredPositiveMoney({ requiredError: 'Required' });
    expect(() => schema.parse(0)).toThrow();
    expect(schema.parse(1)).toBe(1);
  });

  it('optionalNonNegativeMoney treats empty as zero', () => {
    const schema = optionalNonNegativeMoney();
    expect(schema.parse('')).toBe(0);
    expect(schema.parse(undefined)).toBe(0);
  });
});
