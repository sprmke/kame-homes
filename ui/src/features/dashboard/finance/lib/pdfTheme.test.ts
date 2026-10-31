import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/finance/lib/pdfTheme';

describe('pdfTheme', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
