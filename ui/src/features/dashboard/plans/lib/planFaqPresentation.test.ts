import { describe, expect, it } from 'vitest';

import {
  PLAN_CODE_DISPLAY_NAME,
  PLAN_FAQ_ITEMS,
} from '@/features/dashboard/plans/lib/planPresentation';

const ALL_TEXT = PLAN_FAQ_ITEMS.map((item) => `${item.question} ${item.answer}`).join('\n');

describe('plan FAQ copy', () => {
  it('uses host-facing tier names, not internal codes', () => {
    expect(PLAN_CODE_DISPLAY_NAME.growth).toBe('Pro');
    expect(PLAN_CODE_DISPLAY_NAME.pro).toBe('Business');

    expect(ALL_TEXT).not.toMatch(/\bgrowth\b/i);
    expect(ALL_TEXT).not.toMatch(/\bbusiness_plus\b/i);
    expect(ALL_TEXT).not.toMatch(/\bcommission\b/i);
  });

  it('does not mention retired or inactive tiers', () => {
    expect(ALL_TEXT).not.toMatch(/business plus/i);
    expect(ALL_TEXT).not.toMatch(/commission/i);
  });

  it('keeps the human-copy rule (no em dashes)', () => {
    for (const item of PLAN_FAQ_ITEMS) {
      expect(item.question).not.toContain('—');
      expect(item.answer).not.toContain('—');
    }
  });

  it('answers the four support-critical billing questions', () => {
    const questions = PLAN_FAQ_ITEMS.map((item) => item.question.toLowerCase());
    expect(questions.some((question) => question.includes('per property'))).toBe(true);
    expect(questions.some((question) => question.includes('downgrade'))).toBe(true);
    expect(questions.some((question) => question.includes('miss a renewal'))).toBe(true);
    expect(questions.some((question) => question.includes('managed'))).toBe(true);
  });
});
