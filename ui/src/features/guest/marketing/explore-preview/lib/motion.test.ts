import { describe, expect, it } from 'vitest';

import { inViewOnce } from '@/features/guest/marketing/explore-preview/lib/motion';

describe('inViewOnce', () => {
  it('is defined', () => {
    expect(inViewOnce).toBeDefined();
  });
});
