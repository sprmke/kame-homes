import { describe, expect, it } from 'vitest';

import { applyCalendarAiPreferencesToTokens, applyCalendarAiElementsToStyles, CALENDAR_AI_SUGGESTIONS_PREVIEW_COUNT } from '@/features/dashboard/marketing/lib/calendarAiGenerateOptions';

describe('applyCalendarAiPreferencesToTokens', () => {

  it('applyCalendarAiPreferencesToTokens is exported', () => {
    expect(typeof applyCalendarAiPreferencesToTokens).toBe('function');
  });

});

describe('applyCalendarAiElementsToStyles', () => {

  it('applyCalendarAiElementsToStyles is exported', () => {
    expect(typeof applyCalendarAiElementsToStyles).toBe('function');
  });

});

describe('CALENDAR_AI_SUGGESTIONS_PREVIEW_COUNT', () => {
  it('is defined', () => {
    expect(CALENDAR_AI_SUGGESTIONS_PREVIEW_COUNT).toBeDefined();
  });
});
