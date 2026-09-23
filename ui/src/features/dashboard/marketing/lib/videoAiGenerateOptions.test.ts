import { describe, expect, it } from 'vitest';

import { campaignPaletteFromLookMood, applyVideoAiPreferencesToTokens, VIDEO_AI_SUGGESTIONS_PREVIEW_COUNT, VIDEO_AI_DEFAULT_TARGET_SECONDS } from '@/features/dashboard/marketing/lib/videoAiGenerateOptions';

describe('campaignPaletteFromLookMood', () => {

  it('campaignPaletteFromLookMood is exported', () => {
    expect(typeof campaignPaletteFromLookMood).toBe('function');
  });

});

describe('applyVideoAiPreferencesToTokens', () => {

  it('applyVideoAiPreferencesToTokens is exported', () => {
    expect(typeof applyVideoAiPreferencesToTokens).toBe('function');
  });

});

describe('VIDEO_AI_SUGGESTIONS_PREVIEW_COUNT', () => {
  it('is defined', () => {
    expect(VIDEO_AI_SUGGESTIONS_PREVIEW_COUNT).toBeDefined();
  });
});

describe('VIDEO_AI_DEFAULT_TARGET_SECONDS', () => {
  it('is defined', () => {
    expect(VIDEO_AI_DEFAULT_TARGET_SECONDS).toBeDefined();
  });
});
