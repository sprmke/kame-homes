import { describe, expect, it } from 'vitest';

import { petDetailsToPdfFormFields } from '@/features/dashboard/bookings/lib/petDefaults';

describe('petDetailsToPdfFormFields', () => {

  it('petDetailsToPdfFormFields is exported', () => {
    expect(typeof petDetailsToPdfFormFields).toBe('function');
  });

});
