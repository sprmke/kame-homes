import { describe, expect, it } from 'vitest';

import { inferBackgroundMediaType, resolveDesignBindingMedia, pickBindingMediaAt, primaryBindingPhoto } from '@/features/dashboard/marketing/lib/propertyBindingMedia';

describe('inferBackgroundMediaType', () => {

  it('inferBackgroundMediaType is exported', () => {
    expect(typeof inferBackgroundMediaType).toBe('function');
  });

});

describe('resolveDesignBindingMedia', () => {

  it('resolveDesignBindingMedia is exported', () => {
    expect(typeof resolveDesignBindingMedia).toBe('function');
  });

});

describe('pickBindingMediaAt', () => {

  it('pickBindingMediaAt is exported', () => {
    expect(typeof pickBindingMediaAt).toBe('function');
  });

});

describe('primaryBindingPhoto', () => {

  it('primaryBindingPhoto is exported', () => {
    expect(typeof primaryBindingPhoto).toBe('function');
  });

});
