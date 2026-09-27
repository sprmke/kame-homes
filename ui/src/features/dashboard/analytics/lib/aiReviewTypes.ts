/** Mirrors supabase/functions/_shared/analyticsAiReview.ts — keep in sync. */

export type AnalyticsAiReviewItem = {
  title: string;
  why?: string;
  evidence?: string;
  action?: string;
  expectedImpact?: string;
  deepLink: string | null;
  /** Improvement Playbook article slugs this item cites (allow-listed server-side). */
  articleSlugs?: string[];
};

export type AnalyticsAiReviewPayload = {
  strengths: Array<{ title: string; evidence: string }>;
  improvements: AnalyticsAiReviewItem[];
  avoid: AnalyticsAiReviewItem[];
  metricsSnapshot: Record<string, unknown>;
};

export type AnalyticsAiReviewRecord = {
  id: string;
  generated_at: string;
  model: string;
  headline: string;
  score: number;
  score_delta: number | null;
  /** Inclusive YYYY-MM-DD of the range this review was generated for. */
  period_start: string;
  period_end: string;
  payload: AnalyticsAiReviewPayload;
};
