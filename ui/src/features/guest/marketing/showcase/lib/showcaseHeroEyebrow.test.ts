import { describe, expect, it } from 'vitest';

import { showcasePropertyHasDevelopment, normalizeShowcaseTextSource, defaultShowcaseTextSource, resolveShowcaseTextSource, resolveShowcaseHeroEyebrow, resolveShowcaseLocationLead, normalizeShowcaseHeroEyebrow } from '@/features/guest/marketing/showcase/lib/showcaseHeroEyebrow';

describe('showcasePropertyHasDevelopment', () => {

  it('showcasePropertyHasDevelopment is exported', () => {
    expect(typeof showcasePropertyHasDevelopment).toBe('function');
  });

});

describe('normalizeShowcaseTextSource', () => {

  it('normalizeShowcaseTextSource is exported', () => {
    expect(typeof normalizeShowcaseTextSource).toBe('function');
  });

});

describe('defaultShowcaseTextSource', () => {

  it('defaultShowcaseTextSource is exported', () => {
    expect(typeof defaultShowcaseTextSource).toBe('function');
  });

});

describe('resolveShowcaseTextSource', () => {

  it('resolveShowcaseTextSource is exported', () => {
    expect(typeof resolveShowcaseTextSource).toBe('function');
  });

});

describe('resolveShowcaseHeroEyebrow', () => {

  it('resolveShowcaseHeroEyebrow is exported', () => {
    expect(typeof resolveShowcaseHeroEyebrow).toBe('function');
  });

});

describe('resolveShowcaseLocationLead', () => {

  it('resolveShowcaseLocationLead is exported', () => {
    expect(typeof resolveShowcaseLocationLead).toBe('function');
  });

});

describe('normalizeShowcaseHeroEyebrow', () => {
  it('is defined', () => {
    expect(normalizeShowcaseHeroEyebrow).toBeDefined();
  });
});
