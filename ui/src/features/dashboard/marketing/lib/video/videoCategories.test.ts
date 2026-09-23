import { describe, expect, it } from 'vitest';

import { isVideoCategory, normalizeVideoCategory } from '@/features/dashboard/marketing/lib/video/videoCategories';

describe('isVideoCategory', () => {

  it('isVideoCategory is exported', () => {
    expect(typeof isVideoCategory).toBe('function');
  });

});

describe('normalizeVideoCategory', () => {

  it('normalizeVideoCategory is exported', () => {
    expect(typeof normalizeVideoCategory).toBe('function');
  });

});
