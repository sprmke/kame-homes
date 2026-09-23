import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/bookings/lib/petPdfSignature';

describe('petPdfSignature', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
