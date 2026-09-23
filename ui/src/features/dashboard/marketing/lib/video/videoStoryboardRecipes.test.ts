import { describe, expect, it } from 'vitest';

import { getVideoStoryboardRecipe, fallbackVideoStoryboardRecipe, resolveVideoStoryboardRecipe } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';

describe('getVideoStoryboardRecipe', () => {

  it('getVideoStoryboardRecipe is exported', () => {
    expect(typeof getVideoStoryboardRecipe).toBe('function');
  });

});

describe('fallbackVideoStoryboardRecipe', () => {

  it('fallbackVideoStoryboardRecipe is exported', () => {
    expect(typeof fallbackVideoStoryboardRecipe).toBe('function');
  });

});

describe('resolveVideoStoryboardRecipe', () => {

  it('resolveVideoStoryboardRecipe is exported', () => {
    expect(typeof resolveVideoStoryboardRecipe).toBe('function');
  });

});
