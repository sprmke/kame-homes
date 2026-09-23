import { describe, expect, it } from 'vitest';

import { normalizeVideoTemplateTokens, fitVideoAiSceneDurations, VIDEO_AI_SCENE_COUNT_MIN, VIDEO_AI_SCENE_COUNT_MAX } from '@/features/dashboard/marketing/lib/videoAiTokens';

describe('normalizeVideoTemplateTokens', () => {

  it('normalizeVideoTemplateTokens is exported', () => {
    expect(typeof normalizeVideoTemplateTokens).toBe('function');
  });

});

describe('fitVideoAiSceneDurations', () => {

  it('fitVideoAiSceneDurations is exported', () => {
    expect(typeof fitVideoAiSceneDurations).toBe('function');
  });

});

describe('VIDEO_AI_SCENE_COUNT_MIN', () => {
  it('is defined', () => {
    expect(VIDEO_AI_SCENE_COUNT_MIN).toBeDefined();
  });
});

describe('VIDEO_AI_SCENE_COUNT_MAX', () => {
  it('is defined', () => {
    expect(VIDEO_AI_SCENE_COUNT_MAX).toBeDefined();
  });
});
