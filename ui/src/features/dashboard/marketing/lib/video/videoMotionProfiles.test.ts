import { describe, expect, it } from 'vitest';

import { resolveVideoMotionProfile, resolveSceneMotionProfile, isVideoMotionOverride, backgroundMotionTransform } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';

describe('resolveVideoMotionProfile', () => {

  it('resolveVideoMotionProfile is exported', () => {
    expect(typeof resolveVideoMotionProfile).toBe('function');
  });

});

describe('resolveSceneMotionProfile', () => {

  it('resolveSceneMotionProfile is exported', () => {
    expect(typeof resolveSceneMotionProfile).toBe('function');
  });

});

describe('isVideoMotionOverride', () => {

  it('isVideoMotionOverride is exported', () => {
    expect(typeof isVideoMotionOverride).toBe('function');
  });

});

describe('backgroundMotionTransform', () => {

  it('backgroundMotionTransform is exported', () => {
    expect(typeof backgroundMotionTransform).toBe('function');
  });

});
