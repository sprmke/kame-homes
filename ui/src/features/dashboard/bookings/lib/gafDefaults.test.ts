import { describe, expect, it } from 'vitest';

import { gafDetailsToFormSubmitFields, gafDetailsToPdfFormFields } from '@/features/dashboard/bookings/lib/gafDefaults';

describe('gafDetailsToFormSubmitFields', () => {

  it('gafDetailsToFormSubmitFields is exported', () => {
    expect(typeof gafDetailsToFormSubmitFields).toBe('function');
  });

});

describe('gafDetailsToPdfFormFields', () => {

  it('gafDetailsToPdfFormFields is exported', () => {
    expect(typeof gafDetailsToPdfFormFields).toBe('function');
  });

});
