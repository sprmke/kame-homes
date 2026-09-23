import { describe, expect, it } from 'vitest';

import { SD_BANKS, refundBodySchema, sdFormSubmitSchema } from '@/features/guest/sd-form/lib/sdFormSchema';

describe('SD_BANKS', () => {
  it('is defined', () => {
    expect(SD_BANKS).toBeDefined();
  });
});

describe('refundBodySchema', () => {
  it('is defined', () => {
    expect(refundBodySchema).toBeDefined();
  });
});

describe('sdFormSubmitSchema', () => {
  it('is defined', () => {
    expect(sdFormSubmitSchema).toBeDefined();
  });
});
