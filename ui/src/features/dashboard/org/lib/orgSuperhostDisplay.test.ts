import { describe, expect, it } from 'vitest';

import type { OrgSuperhostCriterionSnapshot } from '@/features/dashboard/org/lib/orgSuperhost';
import {
  countMetCriteria,
  formatSuperhostCriterionStatus,
  getSuperhostCriterionDisplay,
  getSuperhostCriterionOutcome,
  getSuperhostOverallState,
  SUPERHOST_UI_THRESHOLDS,
} from '@/features/dashboard/org/lib/orgSuperhostDisplay';

function row(
  partial: Partial<OrgSuperhostCriterionSnapshot> & Pick<OrgSuperhostCriterionSnapshot, 'value'>
): OrgSuperhostCriterionSnapshot {
  return {
    required: 0,
    met: false,
    sampleSize: 0,
    ...partial,
  };
}

describe('formatSuperhostCriterionStatus', () => {
  it('rating: empty, building sample, and average', () => {
    expect(formatSuperhostCriterionStatus('rating', row({ value: 0, sampleSize: 0 }))).toBe(
      'No reviews yet'
    );
    expect(formatSuperhostCriterionStatus('rating', row({ value: 5, sampleSize: 2 }))).toBe(
      '2 reviews so far'
    );
    expect(formatSuperhostCriterionStatus('rating', row({ value: 4.75, sampleSize: 8 }))).toBe(
      '4.75 average'
    );
  });

  it('responseRate: empty, building, and percent', () => {
    expect(formatSuperhostCriterionStatus('responseRate', row({ value: 0, sampleSize: 0 }))).toBe(
      'No inbox replies yet'
    );
    expect(formatSuperhostCriterionStatus('responseRate', row({ value: 1, sampleSize: 3 }))).toBe(
      '3 threads so far'
    );
    expect(
      formatSuperhostCriterionStatus('responseRate', row({ value: 0.9, sampleSize: 12 }))
    ).toBe('90% replied in time');
  });

  it('cancellationRate: empty, building, and percent', () => {
    expect(
      formatSuperhostCriterionStatus('cancellationRate', row({ value: 0, sampleSize: 0 }))
    ).toBe('No bookings yet');
    expect(
      formatSuperhostCriterionStatus('cancellationRate', row({ value: 0, sampleSize: 8 }))
    ).toBe('8 bookings so far');
    expect(
      formatSuperhostCriterionStatus('cancellationRate', row({ value: 0.292, sampleSize: 24 }))
    ).toBe('29.2% cancelled');
  });

  it('activity: stays, nights path, empty', () => {
    expect(formatSuperhostCriterionStatus('activity', row({ value: 0, sampleSize: 0 }))).toBe(
      'No completed stays yet'
    );
    expect(formatSuperhostCriterionStatus('activity', row({ value: 1, sampleSize: 1 }))).toBe(
      '1 stay completed'
    );
    expect(formatSuperhostCriterionStatus('activity', row({ value: 17, sampleSize: 17 }))).toBe(
      '17 stays completed'
    );
    expect(
      formatSuperhostCriterionStatus(
        'activity',
        row({ value: 3, sampleSize: 3, metVia: 'hundred_nights', totalNights: 120 })
      )
    ).toBe('120 nights completed');
  });

  it('never uses technical symbols in output', () => {
    const samples = [
      formatSuperhostCriterionStatus('rating', row({ value: 4.75, sampleSize: 8 })),
      formatSuperhostCriterionStatus('responseRate', row({ value: 0.9, sampleSize: 5 })),
      formatSuperhostCriterionStatus('cancellationRate', row({ value: 0.01, sampleSize: 10 })),
      formatSuperhostCriterionStatus('activity', row({ value: 10, sampleSize: 10 })),
    ];
    for (const text of samples) {
      expect(text).not.toMatch(/[≥≤<>]|n=/);
      expect(text).not.toMatch(/\bneed\b/i);
    }
  });
});

describe('getSuperhostCriterionOutcome', () => {
  it('marks met, building, and needs_work correctly', () => {
    expect(
      getSuperhostCriterionOutcome('rating', row({ value: 4.9, sampleSize: 5, met: true }))
    ).toBe('met');
    expect(getSuperhostCriterionOutcome('rating', row({ value: 5, sampleSize: 2 }))).toBe(
      'building'
    );
    expect(getSuperhostCriterionOutcome('rating', row({ value: 4.5, sampleSize: 5 }))).toBe(
      'needs_work'
    );
    expect(
      getSuperhostCriterionOutcome('cancellationRate', row({ value: 0.292, sampleSize: 24 }))
    ).toBe('needs_work');
    expect(getSuperhostCriterionOutcome('cancellationRate', row({ value: 0, sampleSize: 8 }))).toBe(
      'building'
    );
  });

  it('uses sample floors aligned with edge thresholds', () => {
    expect(SUPERHOST_UI_THRESHOLDS.minReviews).toBe(3);
    expect(SUPERHOST_UI_THRESHOLDS.minResponseThreads).toBe(5);
    expect(SUPERHOST_UI_THRESHOLDS.minBookingsForCancellation).toBe(10);
    expect(SUPERHOST_UI_THRESHOLDS.maxCancellationPercent).toBe(1);
    expect(SUPERHOST_UI_THRESHOLDS.minRating).toBe(4.8);
  });
});

describe('getSuperhostCriterionDisplay', () => {
  it('returns outcome labels for hosts', () => {
    expect(
      getSuperhostCriterionDisplay('activity', row({ value: 17, sampleSize: 17, met: true }))
        .outcomeLabel
    ).toBe('Met');
    expect(
      getSuperhostCriterionDisplay('cancellationRate', row({ value: 0.292, sampleSize: 24 }))
        .outcomeLabel
    ).toBe('Needs work');
    expect(
      getSuperhostCriterionDisplay('responseRate', row({ value: 0, sampleSize: 0 })).outcomeLabel
    ).toBe('Keep going');
  });
});

describe('getSuperhostOverallState', () => {
  it('prefers earned, then ready, then in progress', () => {
    expect(getSuperhostOverallState({ earned: true, allCriteriaMet: true })).toBe('earned');
    expect(getSuperhostOverallState({ earned: false, allCriteriaMet: true })).toBe('ready');
    expect(getSuperhostOverallState({ earned: false, allCriteriaMet: false })).toBe('in_progress');
  });
});

describe('countMetCriteria', () => {
  it('counts met goals', () => {
    expect(
      countMetCriteria({
        rating: row({ value: 4.9, sampleSize: 5, met: true }),
        responseRate: row({ value: 0, sampleSize: 0 }),
        cancellationRate: row({ value: 0.292, sampleSize: 24 }),
        activity: row({ value: 17, sampleSize: 17, met: true }),
      })
    ).toBe(2);
  });
});
