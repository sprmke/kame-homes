import { describe, expect, it } from 'vitest';

import { normalizeCalendarTemplateTokens, resolveAiGeneratedCalendarStyles, resolveAiGeneratedCalendarStylesForAllFormats } from '@/features/dashboard/marketing/lib/calendarAiTokens';

describe('normalizeCalendarTemplateTokens', () => {

  it('normalizeCalendarTemplateTokens is exported', () => {
    expect(typeof normalizeCalendarTemplateTokens).toBe('function');
  });

});

describe('resolveAiGeneratedCalendarStyles', () => {

  it('resolveAiGeneratedCalendarStyles is exported', () => {
    expect(typeof resolveAiGeneratedCalendarStyles).toBe('function');
  });

});

describe('resolveAiGeneratedCalendarStylesForAllFormats', () => {

  it('resolveAiGeneratedCalendarStylesForAllFormats is exported', () => {
    expect(typeof resolveAiGeneratedCalendarStylesForAllFormats).toBe('function');
  });

});
