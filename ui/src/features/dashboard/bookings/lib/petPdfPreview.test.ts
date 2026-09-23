import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/bookings/lib/petPdfPreview';

describe('petPdfPreview', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
