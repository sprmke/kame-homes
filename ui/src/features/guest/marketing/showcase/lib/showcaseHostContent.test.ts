import { describe, expect, it } from 'vitest';

import { hasShowcaseHostContent, resolveShowcaseHostContent } from '@/features/guest/marketing/showcase/lib/showcaseHostContent';

describe('hasShowcaseHostContent', () => {

  it('hasShowcaseHostContent is exported', () => {
    expect(typeof hasShowcaseHostContent).toBe('function');
  });

});

describe('resolveShowcaseHostContent', () => {

  it('resolveShowcaseHostContent is exported', () => {
    expect(typeof resolveShowcaseHostContent).toBe('function');
  });

});
