import { describe, expect, it } from 'vitest';

import { applyDesignAiPreferencesToTokens, DESIGN_AI_SUGGESTIONS_PREVIEW_COUNT } from '@/features/dashboard/marketing/lib/designAiGenerateOptions';

describe('applyDesignAiPreferencesToTokens', () => {

  it('applyDesignAiPreferencesToTokens is exported', () => {
    expect(typeof applyDesignAiPreferencesToTokens).toBe('function');
  });

});

describe('DESIGN_AI_SUGGESTIONS_PREVIEW_COUNT', () => {
  it('is defined', () => {
    expect(DESIGN_AI_SUGGESTIONS_PREVIEW_COUNT).toBeDefined();
  });
});
