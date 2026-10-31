/**
 * Canonical distribution bucket orders — keep labels in sync with
 * `supabase/functions/_shared/analyticsService.ts` LOS / LEAD_TIME tables.
 */

export const LEAD_TIME_BUCKET_ORDER = [
  '0-3 days',
  '4-7 days',
  '8-14 days',
  '15-30 days',
  '31-60 days',
  '61+ days',
] as const;

export const LENGTH_OF_STAY_BUCKET_ORDER = [
  '1 night',
  '2-3 nights',
  '4-6 nights',
  '7-13 nights',
  '14+ nights',
] as const;

export const GUEST_AGE_BUCKET_ORDER = [
  'Under 18',
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55-64',
  '65+',
] as const;

export const PARTY_SIZE_BUCKET_ORDER = ['1', '2', '3', '4', '5+'] as const;

type BucketPoint = { bucket: string; count: number };

/**
 * Fill a continuous chart series from the ordered taxonomy.
 * - No signal: full order at 0 (empty chart footprint).
 * - Has signal: from first non-zero bucket through last, zeros in between.
 * - Pads outward when the span is under 3 buckets so a single spike still reads as a range.
 */
export function fillDistributionRange(
  data: BucketPoint[],
  order: readonly string[],
  minSpan = 3
): BucketPoint[] {
  const counts = new Map(data.map((entry) => [entry.bucket, entry.count]));
  const full = order.map((bucket) => ({
    bucket,
    count: counts.get(bucket) ?? 0,
  }));

  const hitIndexes = full
    .map((entry, index) => (entry.count > 0 ? index : -1))
    .filter((index) => index >= 0);

  if (hitIndexes.length === 0) return full;

  let start = hitIndexes[0];
  let end = hitIndexes[hitIndexes.length - 1];
  const targetSpan = Math.min(minSpan, order.length);

  while (end - start + 1 < targetSpan && (start > 0 || end < order.length - 1)) {
    if (start > 0) start -= 1;
    if (end - start + 1 < targetSpan && end < order.length - 1) end += 1;
  }

  return full.slice(start, end + 1);
}
