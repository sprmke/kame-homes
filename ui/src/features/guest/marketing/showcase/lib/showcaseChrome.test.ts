import { describe, expect, it } from 'vitest';

import { useShowcaseContainedChrome, useShowcaseConfigControlled } from '@/features/guest/marketing/showcase/lib/showcaseChrome';

describe('useShowcaseContainedChrome', () => {

  it('useShowcaseContainedChrome is exported', () => {
    expect(typeof useShowcaseContainedChrome).toBe('function');
  });

});

describe('useShowcaseConfigControlled', () => {

  it('useShowcaseConfigControlled is exported', () => {
    expect(typeof useShowcaseConfigControlled).toBe('function');
  });

});
