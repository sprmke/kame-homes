import { describe, expect, it } from 'vitest';

import { clamp01, smoothstep, easeOutCubic, lerp } from '@/features/guest/marketing/shared/lib/listingScrollSearchEasing';

describe('clamp01', () => {

  it('clamp01 is exported', () => {
    expect(typeof clamp01).toBe('function');
  });

});

describe('smoothstep', () => {

  it('smoothstep is exported', () => {
    expect(typeof smoothstep).toBe('function');
  });

});

describe('easeOutCubic', () => {

  it('easeOutCubic is exported', () => {
    expect(typeof easeOutCubic).toBe('function');
  });

});

describe('lerp', () => {

  it('lerp is exported', () => {
    expect(typeof lerp).toBe('function');
  });

});
