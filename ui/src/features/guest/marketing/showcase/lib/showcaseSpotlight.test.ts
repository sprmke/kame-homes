import { describe, expect, it } from 'vitest';

import { resolveShowcaseSpotlightEnabled, spotlightPositionFromClientRect, MONOLITH_SPOTLIGHT_REST } from '@/features/guest/marketing/showcase/lib/showcaseSpotlight';

describe('resolveShowcaseSpotlightEnabled', () => {

  it('resolveShowcaseSpotlightEnabled is exported', () => {
    expect(typeof resolveShowcaseSpotlightEnabled).toBe('function');
  });

});

describe('spotlightPositionFromClientRect', () => {

  it('spotlightPositionFromClientRect is exported', () => {
    expect(typeof spotlightPositionFromClientRect).toBe('function');
  });

});

describe('MONOLITH_SPOTLIGHT_REST', () => {
  it('is defined', () => {
    expect(MONOLITH_SPOTLIGHT_REST).toBeDefined();
  });
});
