import { describe, expect, it } from 'vitest';

import { defaultPropertyLandingSectionConfig, resolvePropertyLandingSections } from '@/features/guest/marketing/properties/lib/propertyLandingSections';

describe('defaultPropertyLandingSectionConfig', () => {

  it('defaultPropertyLandingSectionConfig is exported', () => {
    expect(typeof defaultPropertyLandingSectionConfig).toBe('function');
  });

});

describe('resolvePropertyLandingSections', () => {

  it('resolvePropertyLandingSections is exported', () => {
    expect(typeof resolvePropertyLandingSections).toBe('function');
  });

});
