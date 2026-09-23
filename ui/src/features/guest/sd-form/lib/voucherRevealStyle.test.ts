import { describe, expect, it } from 'vitest';

import { normalizeVoucherRevealStyle } from '@/features/guest/sd-form/lib/voucherRevealStyle';

describe('normalizeVoucherRevealStyle', () => {

  it('normalizeVoucherRevealStyle is exported', () => {
    expect(typeof normalizeVoucherRevealStyle).toBe('function');
  });

});
