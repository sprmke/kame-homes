import { describe, expect, it } from 'vitest';

import { collectShowcaseMediaUrls } from '@/features/guest/marketing/showcase/lib/showcaseMediaPalette';

describe('collectShowcaseMediaUrls', () => {

  it('collectShowcaseMediaUrls is exported', () => {
    expect(typeof collectShowcaseMediaUrls).toBe('function');
  });

});
