import { describe, expect, it } from 'vitest';

import { resolveShowcaseHeaderChrome } from '@/features/guest/marketing/showcase/lib/showcaseHeaderChrome';

describe('resolveShowcaseHeaderChrome', () => {

  it('resolveShowcaseHeaderChrome is exported', () => {
    expect(typeof resolveShowcaseHeaderChrome).toBe('function');
  });

});
