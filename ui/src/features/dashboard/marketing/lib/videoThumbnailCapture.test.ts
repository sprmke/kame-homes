import { describe, expect, it } from 'vitest';

import { registerVideoThumbnailPlaybackPause } from '@/features/dashboard/marketing/lib/videoThumbnailCapture';

describe('registerVideoThumbnailPlaybackPause', () => {

  it('registerVideoThumbnailPlaybackPause is exported', () => {
    expect(typeof registerVideoThumbnailPlaybackPause).toBe('function');
  });

});
