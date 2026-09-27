/**
 * Superhost metrics unit tests.
 * Run: deno test --allow-env supabase/functions/_shared/superhostMetrics_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  allSuperhostCriteriaMet,
  computeActivityMetric,
  computeCancellationRateMetric,
  computeRatingMetric,
  computeResponseRateMetric,
  computeSuperhostCriteria,
  isSuperhostAssessmentDayYmd,
  nextSuperhostAssessmentAtIso,
  superhostAssessmentKeyFromYmd,
  SUPERHOST_THRESHOLDS,
} from './superhostMetrics.ts';

Deno.test('assessment calendar helpers', () => {
  assertEquals(superhostAssessmentKeyFromYmd('2026-02-15'), '2026-Q1');
  assertEquals(superhostAssessmentKeyFromYmd('2026-08-31'), '2026-Q3');
  assert(isSuperhostAssessmentDayYmd('2026-04-01'));
  assert(!isSuperhostAssessmentDayYmd('2026-04-02'));
  assertEquals(nextSuperhostAssessmentAtIso('2026-02-10'), '2026-04-01T00:00:00+08:00');
  assertEquals(nextSuperhostAssessmentAtIso('2026-11-01'), '2027-01-01T00:00:00+08:00');
});

Deno.test('rating requires min reviews and 4.8 average', () => {
  const asOf = '2026-08-31T12:00:00+08:00';
  const lowSample = computeRatingMetric(
    [
      { starRating: 5, createdAt: '2026-08-01T00:00:00Z' },
      { starRating: 5, createdAt: '2026-08-02T00:00:00Z' },
    ],
    asOf
  );
  assertEquals(lowSample.met, false);
  assertEquals(lowSample.sampleSize, 2);

  const good = computeRatingMetric(
    [
      { starRating: 5, createdAt: '2026-08-01T00:00:00Z' },
      { starRating: 5, createdAt: '2026-08-02T00:00:00Z' },
      { starRating: 4, createdAt: '2026-08-03T00:00:00Z' },
    ],
    asOf
  );
  assertEquals(good.value, 4.67);
  assertEquals(good.met, false);

  const great = computeRatingMetric(
    [
      { starRating: 5, createdAt: '2026-08-01T00:00:00Z' },
      { starRating: 5, createdAt: '2026-08-02T00:00:00Z' },
      { starRating: 5, createdAt: '2026-08-03T00:00:00Z' },
    ],
    asOf
  );
  assertEquals(great.met, true);
});

Deno.test('response rate excludes pending threads inside 24h', () => {
  const asOf = '2026-08-31T12:00:00+08:00';
  const pending = computeResponseRateMetric(
    [
      {
        firstGuestMessageAt: '2026-08-31T10:00:00+08:00',
        firstHostReplyAt: null,
        respondedWithin24h: null,
      },
    ],
    asOf
  );
  assertEquals(pending.sampleSize, 0);

  const met = computeResponseRateMetric(
    Array.from({ length: 5 }, (_, i) => ({
      firstGuestMessageAt: `2026-08-${String(i + 1).padStart(2, '0')}T08:00:00+08:00`,
      firstHostReplyAt: `2026-08-${String(i + 1).padStart(2, '0')}T09:00:00+08:00`,
      respondedWithin24h: i < 5,
    })),
    asOf
  );
  assertEquals(met.sampleSize, 5);
  assertEquals(met.value, 1);
  assertEquals(met.met, true);
});

Deno.test('cancellation rate excludes OTA calendar feed-drop auto-cancels', () => {
  const asOf = '2026-08-31';
  const bookings = Array.from({ length: 10 }, (_, i) => ({
    status: (i === 0 ? 'CANCELLED' : 'COMPLETED') as 'COMPLETED' | 'CANCELLED',
    checkOutDate: `2026-08-${String(i + 1).padStart(2, '0')}`,
    checkInDate: `2026-08-${String(i + 1).padStart(2, '0')}`,
    numberOfNights: 2,
    otaFeedDropCancel: i === 0,
  }));
  const metric = computeCancellationRateMetric(bookings, asOf);
  assertEquals(metric.sampleSize, 9);
  assertEquals(metric.value, 0);
  assertEquals(metric.met, false);
});

Deno.test('cancellation rate under 1% with min bookings', () => {
  const asOf = '2026-08-31';
  const bookings = Array.from({ length: 10 }, (_, i) => ({
    status: (i === 0 ? 'CANCELLED' : 'COMPLETED') as 'COMPLETED' | 'CANCELLED',
    checkOutDate: `2026-08-${String(i + 1).padStart(2, '0')}`,
    checkInDate: `2026-08-${String(i + 1).padStart(2, '0')}`,
    numberOfNights: 2,
  }));
  const metric = computeCancellationRateMetric(bookings, asOf);
  assertEquals(metric.sampleSize, 10);
  assertEquals(metric.value, 0.1);
  assertEquals(metric.met, false);

  const clean = computeCancellationRateMetric(
    bookings.map((b) => ({ ...b, status: 'COMPLETED' as const })),
    asOf
  );
  assertEquals(clean.met, true);
});

Deno.test('cancellation: exact 1% fails; zero cancels with enough sample passes', () => {
  const asOf = '2026-08-31';
  // 1 of 100 = 1.00% → must fail (< 1% rule)
  const atOnePercent = Array.from({ length: 100 }, (_, i) => ({
    status: (i === 0 ? 'CANCELLED' : 'COMPLETED') as 'COMPLETED' | 'CANCELLED',
    checkOutDate: `2026-06-${String((i % 28) + 1).padStart(2, '0')}`,
    checkInDate: `2026-06-${String((i % 28) + 1).padStart(2, '0')}`,
    numberOfNights: 2,
  }));
  const atCap = computeCancellationRateMetric(atOnePercent, asOf);
  assertEquals(atCap.value, 0.01);
  assertEquals(atCap.met, false);

  const cleanHundred = computeCancellationRateMetric(
    atOnePercent.map((b) => ({ ...b, status: 'COMPLETED' as const })),
    asOf
  );
  assertEquals(cleanHundred.value, 0);
  assertEquals(cleanHundred.met, true);
});

Deno.test('cancellation rate matches cancelled / (completed + cancelled)', () => {
  const asOf = '2026-08-31';
  // 7 cancelled + 17 completed = 24 → 7/24 ≈ 0.2917 → 29.2% display
  const bookings = [
    ...Array.from({ length: 17 }, (_, i) => ({
      status: 'COMPLETED' as const,
      checkOutDate: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
      checkInDate: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
      numberOfNights: 2,
    })),
    ...Array.from({ length: 7 }, (_, i) => ({
      status: 'CANCELLED' as const,
      checkOutDate: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
      checkInDate: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
      numberOfNights: 2,
    })),
  ];
  const metric = computeCancellationRateMetric(bookings, asOf);
  assertEquals(metric.sampleSize, 24);
  assertEquals(metric.value, 0.2917);
  assertEquals(metric.met, false);
  assertEquals((metric.value * 100).toFixed(1), '29.2');
});

Deno.test('rating exact 4.8 with min reviews passes', () => {
  const asOf = '2026-08-31T12:00:00+08:00';
  const exact = computeRatingMetric(
    [
      { starRating: 4.8, createdAt: '2026-08-01T00:00:00Z' },
      { starRating: 4.8, createdAt: '2026-08-02T00:00:00Z' },
      { starRating: 4.8, createdAt: '2026-08-03T00:00:00Z' },
    ],
    asOf
  );
  assertEquals(exact.value, 4.8);
  assertEquals(exact.met, true);
});

Deno.test('activity via ten stays or hundred nights', () => {
  const asOf = '2026-08-31';
  const tenStays = Array.from({ length: 10 }, (_, i) => ({
    status: 'COMPLETED' as const,
    checkOutDate: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
    checkInDate: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
    numberOfNights: 2,
  }));
  const viaStays = computeActivityMetric(tenStays, asOf);
  assertEquals(viaStays.met, true);
  assertEquals(viaStays.metVia, 'ten_stays');

  const threeLong = [
    {
      status: 'COMPLETED' as const,
      checkOutDate: '2026-06-01',
      checkInDate: '2026-03-01',
      numberOfNights: 40,
    },
    {
      status: 'COMPLETED' as const,
      checkOutDate: '2026-07-01',
      checkInDate: '2026-04-01',
      numberOfNights: 40,
    },
    {
      status: 'COMPLETED' as const,
      checkOutDate: '2026-08-01',
      checkInDate: '2026-05-01',
      numberOfNights: 30,
    },
  ];
  const viaNights = computeActivityMetric(threeLong, asOf);
  assertEquals(viaNights.met, true);
  assertEquals(viaNights.metVia, 'hundred_nights');
});

Deno.test('all four criteria required', () => {
  const asOf = '2026-08-31T12:00:00+08:00';
  const criteria = computeSuperhostCriteria({
    asOfIso: asOf,
    reviews: Array.from({ length: 5 }, () => ({
      starRating: 5,
      createdAt: '2026-08-01T00:00:00Z',
    })),
    inboxThreads: Array.from({ length: 6 }, () => ({
      firstGuestMessageAt: '2026-08-01T08:00:00+08:00',
      firstHostReplyAt: '2026-08-01T09:00:00+08:00',
      respondedWithin24h: true,
    })),
    bookings: [
      ...Array.from({ length: 10 }, (_, i) => ({
        status: 'COMPLETED' as const,
        checkOutDate: `2026-08-${String(i + 1).padStart(2, '0')}`,
        checkInDate: `2026-08-${String(i + 1).padStart(2, '0')}`,
        numberOfNights: 2,
      })),
    ],
  });
  assert(allSuperhostCriteriaMet(criteria));
  assertEquals(criteria.rating.required, SUPERHOST_THRESHOLDS.minRating);
});
