import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/bookings/lib/gafPdfPreview';

describe('gafPdfPreview', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
