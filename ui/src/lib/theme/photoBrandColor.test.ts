import { describe, expect, it } from 'vitest';

import { collectPropertyPhotoUrls } from '@/lib/theme/photoBrandColor';

describe('collectPropertyPhotoUrls', () => {

  it('collectPropertyPhotoUrls is exported', () => {
    expect(typeof collectPropertyPhotoUrls).toBe('function');
  });

});
