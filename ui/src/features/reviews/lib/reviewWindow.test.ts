import { describe, expect, it } from 'vitest';

import { daysLeftInReviewWindow, REVIEW_WINDOW_DAYS } from './reviewWindow';

describe('reviewWindow', () => {
  it('mirrors the 14-day window', () => {
    expect(REVIEW_WINDOW_DAYS).toBe(14);
  });

  it('returns null when closesAt is missing', () => {
    expect(daysLeftInReviewWindow(null)).toBeNull();
    expect(daysLeftInReviewWindow(undefined)).toBeNull();
  });

  it('returns 0 once the window has closed', () => {
    expect(daysLeftInReviewWindow('2020-01-01T00:00:00.000Z', new Date('2026-01-01'))).toBe(0);
  });

  it('rounds remaining time up to whole days', () => {
    const now = new Date('2026-01-10T12:00:00.000Z');
    expect(daysLeftInReviewWindow('2026-01-11T00:00:00.000Z', now)).toBe(1);
  });
});
