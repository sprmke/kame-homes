import { describe, expect, it } from 'vitest';

import {
  AI_LIMIT_KEYS,
  draftToLimits,
  emptyDraft,
  formatLimitValue,
  limitsToDraft,
  ORG_OVERRIDE_KEYS,
  PROPERTY_OVERRIDE_KEYS,
} from './aiLimits';

describe('draftToLimits', () => {
  it('maps blank to null and numbers to numbers', () => {
    const draft = { ...emptyDraft(), dailyCallLimit: '25', dailyCostUsdLimit: '1.5' };
    const result = draftToLimits(draft, [
      'dailyCallLimit',
      'dailyCostUsdLimit',
      'monthlyCallLimit',
    ]);
    expect(result).toEqual({
      ok: true,
      limits: { dailyCallLimit: 25, dailyCostUsdLimit: 1.5, monthlyCallLimit: null },
    });
  });

  it('rejects decimals on whole-number fields and non-numbers', () => {
    expect(draftToLimits({ ...emptyDraft(), dailyCallLimit: '1.5' }, ['dailyCallLimit']).ok).toBe(
      false
    );
    expect(draftToLimits({ ...emptyDraft(), dailyCallLimit: 'abc' }, ['dailyCallLimit']).ok).toBe(
      false
    );
    expect(draftToLimits({ ...emptyDraft(), dailyCallLimit: '-1' }, ['dailyCallLimit']).ok).toBe(
      false
    );
  });

  it('only reads the requested keys', () => {
    const draft = { ...emptyDraft(), voiceMaxSessionSeconds: 'nope' };
    expect(draftToLimits(draft, ['dailyCallLimit'])).toEqual({
      ok: true,
      limits: { dailyCallLimit: null },
    });
  });
});

describe('limitsToDraft', () => {
  it('round-trips values and blanks', () => {
    expect(limitsToDraft({ dailyCallLimit: 5, monthlyCallLimit: null }).dailyCallLimit).toBe('5');
    expect(limitsToDraft({ dailyCallLimit: 5, monthlyCallLimit: null }).monthlyCallLimit).toBe('');
  });
});

describe('formatLimitValue', () => {
  it('formats cost, credits and the 60% auto case', () => {
    expect(formatLimitValue('dailyCostUsdLimit', 10)).toBe('$10');
    expect(formatLimitValue('monthlyCreditLimit', 1000000)).toBe('1,000,000');
    expect(formatLimitValue('imageMonthlyCreditCap', null)).toBe('Auto');
    expect(formatLimitValue('dailyCallLimit', null)).toBe('-');
  });
});

describe('override key sets', () => {
  it('stay subsets of all keys and never overlap incorrectly', () => {
    for (const key of [...ORG_OVERRIDE_KEYS, ...PROPERTY_OVERRIDE_KEYS]) {
      expect(AI_LIMIT_KEYS).toContain(key);
    }
    expect(ORG_OVERRIDE_KEYS).not.toContain('voiceMaxSessionSeconds');
    expect(PROPERTY_OVERRIDE_KEYS).not.toContain('assistantDailyMessageLimit');
  });
});
