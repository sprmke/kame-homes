import { describe, expect, it } from 'vitest';

import {
  aiReviewMatchesPeriod,
  manilaTodayIso,
  resolveAiReviewCta,
  resolveAiReviewPeriodApplicability,
  wasAiReviewGeneratedTodayManila,
} from '@/features/dashboard/analytics/lib/aiReviewPeriod';
import { getDateRangeFromPreset, toIsoDate } from '@/lib/date/navigation';

describe('resolveAiReviewPeriodApplicability', () => {
  it('accepts the current Manila month', () => {
    const reference = new Date('2026-09-27T10:00:00+08:00');
    const manila = new Date(reference.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const range = getDateRangeFromPreset('month', manila);
    const result = resolveAiReviewPeriodApplicability(
      toIsoDate(range.from),
      toIsoDate(range.to),
      reference
    );
    expect(result).toEqual({ applicable: true, kind: 'month' });
  });

  it('rejects a prior month and a custom range', () => {
    const reference = new Date('2026-09-27T10:00:00+08:00');
    expect(resolveAiReviewPeriodApplicability('2026-08-01', '2026-08-31', reference)).toEqual({
      applicable: false,
      reason: 'not_current',
    });
    expect(resolveAiReviewPeriodApplicability('2026-09-01', '2026-09-15', reference)).toEqual({
      applicable: false,
      reason: 'custom',
    });
  });

  it('accepts the current week and year', () => {
    const reference = new Date('2026-09-27T10:00:00+08:00');
    const manila = new Date(reference.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    for (const kind of ['week', 'year'] as const) {
      const range = getDateRangeFromPreset(kind, manila);
      expect(
        resolveAiReviewPeriodApplicability(toIsoDate(range.from), toIsoDate(range.to), reference)
      ).toEqual({ applicable: true, kind });
    }
  });
});

describe('wasAiReviewGeneratedTodayManila', () => {
  it('matches Manila calendar day', () => {
    const reference = new Date('2026-09-27T22:00:00+08:00');
    expect(wasAiReviewGeneratedTodayManila('2026-09-27T02:00:00.000Z', reference)).toBe(true);
    expect(wasAiReviewGeneratedTodayManila('2026-09-26T02:00:00.000Z', reference)).toBe(false);
    expect(wasAiReviewGeneratedTodayManila(null, reference)).toBe(false);
  });
});

describe('manilaTodayIso', () => {
  it('returns YYYY-MM-DD', () => {
    expect(manilaTodayIso(new Date('2026-09-27T10:00:00+08:00'))).toBe('2026-09-27');
  });
});

describe('aiReviewMatchesPeriod', () => {
  it('requires an exact from/to match', () => {
    expect(
      aiReviewMatchesPeriod(
        { period_start: '2026-09-01', period_end: '2026-09-30' },
        '2026-09-01',
        '2026-09-30'
      )
    ).toBe(true);
    expect(
      aiReviewMatchesPeriod(
        { period_start: '2026-09-01', period_end: '2026-09-30' },
        '2026-09-21',
        '2026-09-27'
      )
    ).toBe(false);
    expect(aiReviewMatchesPeriod(null, '2026-09-01', '2026-09-30')).toBe(false);
  });
});

describe('resolveAiReviewCta', () => {
  it('offers Analyze when the latest review is for another range', () => {
    expect(
      resolveAiReviewCta({
        periodKind: 'week',
        hasMatchingReview: false,
        refreshUsedToday: false,
        isRefreshing: false,
      })
    ).toEqual({
      kind: 'analyze',
      label: 'Analyze this week',
      ariaLabel: 'Analyze this week',
    });
  });

  it('shows Refresh / Refreshed / Analyzing for a matching review', () => {
    expect(
      resolveAiReviewCta({
        periodKind: 'month',
        hasMatchingReview: true,
        refreshUsedToday: false,
        isRefreshing: false,
      }).label
    ).toBe('Refresh');
    expect(
      resolveAiReviewCta({
        periodKind: 'year',
        hasMatchingReview: true,
        refreshUsedToday: true,
        isRefreshing: false,
      }).kind
    ).toBe('refreshed');
    expect(
      resolveAiReviewCta({
        periodKind: 'month',
        hasMatchingReview: false,
        refreshUsedToday: false,
        isRefreshing: true,
      })
    ).toMatchObject({ kind: 'analyzing', label: 'Analyzing…' });
  });
});
