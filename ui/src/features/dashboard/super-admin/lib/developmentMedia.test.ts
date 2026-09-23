import { describe, expect, it } from 'vitest';

import { readDevelopmentMedia, developmentMediaToLegacyFields } from '@/features/dashboard/super-admin/lib/developmentMedia';

describe('readDevelopmentMedia', () => {

  it('readDevelopmentMedia is exported', () => {
    expect(typeof readDevelopmentMedia).toBe('function');
  });

});

describe('developmentMediaToLegacyFields', () => {

  it('developmentMediaToLegacyFields is exported', () => {
    expect(typeof developmentMediaToLegacyFields).toBe('function');
  });

});
