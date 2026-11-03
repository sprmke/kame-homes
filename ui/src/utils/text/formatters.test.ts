import { describe, expect, it } from 'vitest';

import { toCapitalCase, transformFieldValues } from '@/utils/text/formatters';

describe('toCapitalCase', () => {
  it('is defined', () => {
    expect(toCapitalCase).toBeDefined();
  });
});

describe('transformFieldValues', () => {
  it('is defined', () => {
    expect(transformFieldValues).toBeDefined();
  });
});

describe('transformFieldValues — nights for a same-day stay', () => {
  it('reports one night for a day-use stay instead of zero', () => {
    const values = {
      checkInDate: '2026-01-15',
      checkOutDate: '2026-01-15',
      needParking: false,
      primaryGuestName: 'Jane Guest',
      primaryGuestAge: 30,
    } as unknown as Parameters<typeof transformFieldValues>[0];

    expect(transformFieldValues(values).numberOfNights).toBe(1);
  });

  it('counts real nights normally', () => {
    const values = {
      checkInDate: '2026-01-15',
      checkOutDate: '2026-01-18',
      needParking: false,
      primaryGuestName: 'Jane Guest',
      primaryGuestAge: 30,
    } as unknown as Parameters<typeof transformFieldValues>[0];

    expect(transformFieldValues(values).numberOfNights).toBe(3);
  });
});
