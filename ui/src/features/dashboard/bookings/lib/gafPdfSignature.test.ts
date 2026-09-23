import { describe, expect, it } from 'vitest';

import { formatGafUnitOwnerPrintedName, setGafPdfTextField } from '@/features/dashboard/bookings/lib/gafPdfSignature';

describe('formatGafUnitOwnerPrintedName', () => {

  it('formatGafUnitOwnerPrintedName is exported', () => {
    expect(typeof formatGafUnitOwnerPrintedName).toBe('function');
  });

});

describe('setGafPdfTextField', () => {

  it('setGafPdfTextField is exported', () => {
    expect(typeof setGafPdfTextField).toBe('function');
  });

});
