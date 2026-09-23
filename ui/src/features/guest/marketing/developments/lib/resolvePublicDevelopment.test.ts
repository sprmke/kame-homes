import { describe, expect, it } from 'vitest';

import { resolvePublicDevelopment, developmentDetailPath } from '@/features/guest/marketing/developments/lib/resolvePublicDevelopment';

describe('resolvePublicDevelopment', () => {

  it('resolvePublicDevelopment is exported', () => {
    expect(typeof resolvePublicDevelopment).toBe('function');
  });

});

describe('developmentDetailPath', () => {

  it('developmentDetailPath is exported', () => {
    expect(typeof developmentDetailPath).toBe('function');
  });

});
