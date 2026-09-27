/**
 * AI Performance Review is only meaningful for the *current* week, month, or year
 * (Asia/Manila calendar). Custom ranges and shifted periods are not applicable.
 *
 * Mirrors `supabase/functions/_shared/analyticsAiReviewPeriod.ts` — keep in sync.
 */

import {
  detectPresetFromRange,
  fromIsoDate,
  getDateRangeFromPreset,
  toIsoDate,
  type DatePreset,
} from '@/lib/date/navigation';

export type AiReviewPeriodKind = Exclude<DatePreset, 'custom'>;

export type AiReviewPeriodApplicability =
  | { applicable: true; kind: AiReviewPeriodKind }
  | { applicable: false; reason: 'custom' | 'not_current' };

function manilaReferenceDate(reference = new Date()): Date {
  return new Date(reference.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
}

/** Manila calendar YYYY-MM-DD for `reference` (or now). */
export function manilaTodayIso(reference = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(reference);
}

/**
 * True when `from`/`to` exactly match the current Manila week (Sun–Sat), month, or year.
 */
export function resolveAiReviewPeriodApplicability(
  from: string,
  to: string,
  reference = new Date()
): AiReviewPeriodApplicability {
  const fromDate = fromIsoDate(from);
  const toDate = fromIsoDate(to);
  if (!fromDate || !toDate) return { applicable: false, reason: 'custom' };

  const preset = detectPresetFromRange(fromDate, toDate);
  if (preset === 'custom') return { applicable: false, reason: 'custom' };

  const manila = manilaReferenceDate(reference);
  const current = getDateRangeFromPreset(preset, manila);
  if (toIsoDate(current.from) === from && toIsoDate(current.to) === to) {
    return { applicable: true, kind: preset };
  }
  return { applicable: false, reason: 'not_current' };
}

/** True when `generatedAt` falls on today's Manila calendar date. */
export function wasAiReviewGeneratedTodayManila(
  generatedAt: string | null | undefined,
  reference = new Date()
): boolean {
  if (!generatedAt) return false;
  const generated = new Date(generatedAt);
  if (Number.isNaN(generated.getTime())) return false;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(generated);
  return day === manilaTodayIso(reference);
}

/** True when the latest review was generated for exactly this from/to range. */
export function aiReviewMatchesPeriod(
  review: { period_start?: string | null; period_end?: string | null } | null | undefined,
  from: string,
  to: string
): boolean {
  if (!review?.period_start || !review?.period_end) return false;
  return review.period_start === from && review.period_end === to;
}

export const AI_REVIEW_PERIOD_LABEL: Record<AiReviewPeriodKind, string> = {
  week: 'this week',
  month: 'this month',
  year: 'this year',
};

export type AiReviewCtaKind = 'analyze' | 'refresh' | 'refreshed' | 'analyzing';

export type AiReviewCta = {
  kind: AiReviewCtaKind;
  label: string;
  ariaLabel: string;
};

/**
 * Header CTA for the selected current period. When the latest review belongs to another
 * range, offer Analyze for the selection instead of Refresh.
 */
export function resolveAiReviewCta(args: {
  periodKind: AiReviewPeriodKind;
  hasMatchingReview: boolean;
  refreshUsedToday: boolean;
  isRefreshing: boolean;
}): AiReviewCta {
  const periodLabel = AI_REVIEW_PERIOD_LABEL[args.periodKind];
  if (args.isRefreshing) {
    return {
      kind: 'analyzing',
      label: 'Analyzing…',
      ariaLabel: `Analyzing ${periodLabel}`,
    };
  }
  if (args.refreshUsedToday) {
    return {
      kind: 'refreshed',
      label: 'Refreshed',
      ariaLabel: `Already analyzed ${periodLabel} today`,
    };
  }
  if (args.hasMatchingReview) {
    return {
      kind: 'refresh',
      label: 'Refresh',
      ariaLabel: `Refresh AI review for ${periodLabel}`,
    };
  }
  return {
    kind: 'analyze',
    label: `Analyze ${periodLabel}`,
    ariaLabel: `Analyze ${periodLabel}`,
  };
}
