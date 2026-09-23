import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/finance/lib/exportPdf';

describe('exportPdf', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
