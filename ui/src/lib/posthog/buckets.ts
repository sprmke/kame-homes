/**
 * Coarse buckets for analytics properties. Edge copy: `_shared/analyticsBuckets.ts`.
 * Same thresholds on both sides so a funnel reads the same regardless of where the event
 * was emitted.
 */

export type AmountBucket = '<1k' | '1k-5k' | '5k-20k' | '20k+';

/** PHP amount, bucketed at 1k / 5k / 20k. Negative and non-finite read as the lowest bucket. */
export function amountBucketPhp(amount: number): AmountBucket {
  if (!Number.isFinite(amount) || amount < 1000) return '<1k';
  if (amount < 5000) return '1k-5k';
  if (amount < 20000) return '5k-20k';
  return '20k+';
}
