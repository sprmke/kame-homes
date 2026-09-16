import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  computeSdRefundLeadEligibleAtMs,
  evaluateSdRefundLeadWindow,
  normalizeSdRefundLeadMinutes,
  parseCheckoutManila,
} from './sdRefundCronLead.ts';

Deno.test('parseCheckoutManila — MM-DD-YYYY + 12h time', () => {
  const dt = parseCheckoutManila('09-15-2026', '11:00 AM');
  assert(dt);
  assertEquals(dt.toISOString(), '2026-09-15T03:00:00.000Z');
});

Deno.test('parseCheckoutManila — YYYY-MM-DD + 24h time', () => {
  const dt = parseCheckoutManila('2026-09-15', '14:30');
  assert(dt);
  assertEquals(dt.toISOString(), '2026-09-15T06:30:00.000Z');
});

Deno.test('normalizeSdRefundLeadMinutes — invalid falls back to 180', () => {
  assertEquals(normalizeSdRefundLeadMinutes(Number.NaN), 180);
  assertEquals(normalizeSdRefundLeadMinutes(-5), 180);
  assertEquals(normalizeSdRefundLeadMinutes(120), 120);
});

Deno.test('evaluateSdRefundLeadWindow — not due before lead opens', () => {
  const checkoutDt = parseCheckoutManila('09-15-2026', '11:00 AM')!;
  const eligibleAtMs = computeSdRefundLeadEligibleAtMs(checkoutDt, 120);
  const result = evaluateSdRefundLeadWindow({
    checkOutDate: '09-15-2026',
    checkOutTime: '11:00 AM',
    leadMinutes: 120,
    nowMs: eligibleAtMs - 60_000,
  });
  assertEquals(result.due, false);
  if (!result.due && result.checkoutDt) {
    assert(result.minutesRemaining >= 1);
  }
});

Deno.test('evaluateSdRefundLeadWindow — due on or after eligible time', () => {
  const checkoutDt = parseCheckoutManila('09-15-2026', '11:00 AM')!;
  const eligibleAtMs = computeSdRefundLeadEligibleAtMs(checkoutDt, 120);
  const result = evaluateSdRefundLeadWindow({
    checkOutDate: '09-15-2026',
    checkOutTime: '11:00 AM',
    leadMinutes: 120,
    nowMs: eligibleAtMs,
  });
  assertEquals(result.due, true);
  if (result.due) {
    assertEquals(result.minutesRemaining, 0);
  }
});

Deno.test('evaluateSdRefundLeadWindow — unparseable checkout', () => {
  const result = evaluateSdRefundLeadWindow({
    checkOutDate: 'not-a-date',
    checkOutTime: '11:00 AM',
    leadMinutes: 120,
    nowMs: Date.now(),
  });
  assertEquals(result.due, false);
  assertEquals(result.checkoutDt, null);
  if (result.due || result.checkoutDt !== null) {
    throw new Error('expected unparseable checkout');
  }
  assertEquals(result.reason, 'unparseable_checkout_datetime');
});
