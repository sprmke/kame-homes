import { describe, expect, it } from 'vitest';

import { VIDEO_TRANSITION_FRAMES, VIDEO_FPS, VIDEO_SCENE_DURATION, VIDEO_MUSIC_DEFAULT_VOLUME } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

describe('VIDEO_TRANSITION_FRAMES', () => {
  it('is defined', () => {
    expect(VIDEO_TRANSITION_FRAMES).toBeDefined();
  });
});

describe('VIDEO_FPS', () => {
  it('is defined', () => {
    expect(VIDEO_FPS).toBeDefined();
  });
});

describe('VIDEO_SCENE_DURATION', () => {
  it('is defined', () => {
    expect(VIDEO_SCENE_DURATION).toBeDefined();
  });
});

describe('VIDEO_MUSIC_DEFAULT_VOLUME', () => {
  it('is defined', () => {
    expect(VIDEO_MUSIC_DEFAULT_VOLUME).toBeDefined();
  });
});
