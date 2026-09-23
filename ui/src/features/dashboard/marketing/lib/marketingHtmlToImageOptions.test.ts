import { describe, expect, it } from 'vitest';

import { marketingHtmlToImageOptions } from '@/features/dashboard/marketing/lib/marketingHtmlToImageOptions';

describe('marketingHtmlToImageOptions', () => {

  it('marketingHtmlToImageOptions is exported', () => {
    expect(typeof marketingHtmlToImageOptions).toBe('function');
  });

});
