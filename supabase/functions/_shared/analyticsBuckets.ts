/**
 * Coarse buckets for analytics properties.
 *
 * Exact amounts and exact recipient counts are person-linked data at the edges of the range,
 * and a funnel never needs them. Buckets keep the property useful and cheap. Edge copy of
 * `ui/src/lib/posthog/buckets.ts` — the thresholds are identical on purpose.
 */

export type AmountBucket = '<1k' | '1k-5k' | '5k-20k' | '20k+';

/** PHP amount, bucketed at 1k / 5k / 20k. Negative and non-finite read as the lowest bucket. */
export function amountBucketPhp(amount: number): AmountBucket {
  if (!Number.isFinite(amount) || amount < 1000) return '<1k';
  if (amount < 5000) return '1k-5k';
  if (amount < 20000) return '5k-20k';
  return '20k+';
}

export type RecipientCountBucket = '1-5' | '6-20' | '21+';

export function recipientCountBucket(count: number): RecipientCountBucket {
  if (!Number.isFinite(count) || count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  return '21+';
}
