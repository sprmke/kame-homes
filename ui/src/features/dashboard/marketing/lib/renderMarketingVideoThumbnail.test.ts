import { describe, expect, it } from 'vitest';

import { thumbnailFrameForScene, videoSceneThumbFingerprint } from '@/features/dashboard/marketing/lib/renderMarketingVideoThumbnail';

describe('thumbnailFrameForScene', () => {

  it('thumbnailFrameForScene is exported', () => {
    expect(typeof thumbnailFrameForScene).toBe('function');
  });

});

describe('videoSceneThumbFingerprint', () => {

  it('videoSceneThumbFingerprint is exported', () => {
    expect(typeof videoSceneThumbFingerprint).toBe('function');
  });

});
