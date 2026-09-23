import { describe, expect, it } from 'vitest';

import { guestShowcasePath, absoluteGuestShowcaseUrl, guestShowcaseEmbedPath } from '@/features/guest/marketing/showcase/lib/showcasePaths';

describe('guestShowcasePath', () => {

  it('guestShowcasePath is exported', () => {
    expect(typeof guestShowcasePath).toBe('function');
  });

});

describe('absoluteGuestShowcaseUrl', () => {

  it('absoluteGuestShowcaseUrl is exported', () => {
    expect(typeof absoluteGuestShowcaseUrl).toBe('function');
  });

});

describe('guestShowcaseEmbedPath', () => {

  it('guestShowcaseEmbedPath is exported', () => {
    expect(typeof guestShowcaseEmbedPath).toBe('function');
  });

});
