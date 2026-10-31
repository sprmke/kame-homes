/**
 * Host-facing Superhost copy, outcomes, and progress labels.
 * Threshold numbers mirror `supabase/functions/_shared/superhostMetrics.ts`.
 */

import type {
  OrgSuperhostCriteriaSnapshot,
  OrgSuperhostCriterionSnapshot,
} from '@/features/dashboard/org/lib/orgSuperhost';

export type OrgSuperhostCriterionKey = keyof OrgSuperhostCriteriaSnapshot;

/** Sample floors + targets — keep in sync with edge `SUPERHOST_THRESHOLDS`. */
export const SUPERHOST_UI_THRESHOLDS = {
  minRating: 4.8,
  minReviews: 3,
  minResponseRatePercent: 90,
  minResponseThreads: 5,
  maxCancellationPercent: 1,
  minBookingsForCancellation: 10,
  minCompletedStays: 10,
  minStaysForNightPath: 3,
  minNightsForNightPath: 100,
} as const;

export const SUPERHOST_SECTION_HELP =
  'Superhost is an earned badge for strong hosting across your organization. We review your last year of activity each quarter (Jan 1, Apr 1, Jul 1, Oct 1). Meet all four goals below to earn it. Guests see the badge on your listings.';

export const SUPERHOST_CRITERION_HELP: Record<OrgSuperhostCriterionKey, string> = {
  rating:
    'Average guest star rating on Kame over the last year. You need at least 3 reviews and an average of 4.8 or higher.',
  responseRate:
    'Share of guest inbox threads you reply to within 24 hours. You need at least 5 threads with a reply rate of 90% or higher.',
  cancellationRate:
    'Share of bookings you cancel over the last year. Keep it under 1% once you have at least 10 bookings in that window.',
  activity:
    'Completed stays on Kame over the last year. You need 10 completed stays, or at least 3 stays that add up to 100 nights.',
};

export const SUPERHOST_CRITERION_LABELS: Record<OrgSuperhostCriterionKey, string> = {
  rating: 'Overall rating',
  responseRate: 'Inbox response (24h)',
  cancellationRate: 'Cancellation rate',
  activity: 'Completed stays',
};

export type SuperhostCriterionOutcome = 'met' | 'needs_work' | 'building';

export type SuperhostCriterionDisplay = {
  outcome: SuperhostCriterionOutcome;
  outcomeLabel: 'Met' | 'Needs work' | 'Keep going';
  summary: string;
};

function hasEnoughSample(
  key: OrgSuperhostCriterionKey,
  row: OrgSuperhostCriterionSnapshot
): boolean {
  if (key === 'rating') return row.sampleSize >= SUPERHOST_UI_THRESHOLDS.minReviews;
  if (key === 'responseRate') return row.sampleSize >= SUPERHOST_UI_THRESHOLDS.minResponseThreads;
  if (key === 'cancellationRate') {
    return row.sampleSize >= SUPERHOST_UI_THRESHOLDS.minBookingsForCancellation;
  }
  // Activity: any completed stay starts progress; nights path needs 3+.
  return row.sampleSize > 0;
}

export function getSuperhostCriterionOutcome(
  key: OrgSuperhostCriterionKey,
  row: OrgSuperhostCriterionSnapshot
): SuperhostCriterionOutcome {
  if (row.met) return 'met';
  if (!hasEnoughSample(key, row)) return 'building';
  return 'needs_work';
}

function outcomeLabel(
  outcome: SuperhostCriterionOutcome
): SuperhostCriterionDisplay['outcomeLabel'] {
  if (outcome === 'met') return 'Met';
  if (outcome === 'needs_work') return 'Needs work';
  return 'Keep going';
}

/** Plain-language current value (no thresholds, sample counts, or ≥ / n=). */
export function formatSuperhostCriterionStatus(
  key: OrgSuperhostCriterionKey,
  row: OrgSuperhostCriterionSnapshot
): string {
  if (key === 'rating') {
    if (row.sampleSize <= 0) return 'No reviews yet';
    if (row.sampleSize < SUPERHOST_UI_THRESHOLDS.minReviews) {
      return row.sampleSize === 1 ? '1 review so far' : `${row.sampleSize} reviews so far`;
    }
    return `${row.value.toFixed(2)} average`;
  }

  if (key === 'responseRate') {
    if (row.sampleSize <= 0) return 'No inbox replies yet';
    if (row.sampleSize < SUPERHOST_UI_THRESHOLDS.minResponseThreads) {
      return row.sampleSize === 1 ? '1 thread so far' : `${row.sampleSize} threads so far`;
    }
    return `${Math.round(row.value * 100)}% replied in time`;
  }

  if (key === 'cancellationRate') {
    if (row.sampleSize <= 0) return 'No bookings yet';
    if (row.sampleSize < SUPERHOST_UI_THRESHOLDS.minBookingsForCancellation) {
      return row.sampleSize === 1 ? '1 booking so far' : `${row.sampleSize} bookings so far`;
    }
    return `${(row.value * 100).toFixed(1)}% cancelled`;
  }

  if (key === 'activity') {
    if (row.metVia === 'hundred_nights') {
      const nights = row.totalNights ?? row.value;
      return `${nights} nights completed`;
    }
    if (row.sampleSize <= 0 && row.value <= 0) return 'No completed stays yet';
    const stays = row.sampleSize > 0 ? row.sampleSize : row.value;
    if (stays <= 0) return 'No completed stays yet';
    return stays === 1 ? '1 stay completed' : `${stays} stays completed`;
  }

  return String(row.value);
}

export function getSuperhostCriterionDisplay(
  key: OrgSuperhostCriterionKey,
  row: OrgSuperhostCriterionSnapshot
): SuperhostCriterionDisplay {
  const outcome = getSuperhostCriterionOutcome(key, row);
  return {
    outcome,
    outcomeLabel: outcomeLabel(outcome),
    summary: formatSuperhostCriterionStatus(key, row),
  };
}

export type SuperhostOverallState = 'earned' | 'ready' | 'in_progress';

export function getSuperhostOverallState(input: {
  earned: boolean;
  allCriteriaMet: boolean;
}): SuperhostOverallState {
  if (input.earned) return 'earned';
  if (input.allCriteriaMet) return 'ready';
  return 'in_progress';
}

export function countMetCriteria(criteria: OrgSuperhostCriteriaSnapshot): number {
  return (Object.keys(SUPERHOST_CRITERION_LABELS) as OrgSuperhostCriterionKey[]).filter(
    (key) => criteria[key].met
  ).length;
}

export function formatSuperhostAssessmentDate(iso: string | null | undefined): string {
  if (!iso) return 'Date TBD';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date TBD';
  return d.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
