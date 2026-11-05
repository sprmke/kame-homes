/**
 * Cancellation refund calculator — money + deadline fixture table.
 * Run: deno test --allow-env --allow-net supabase/functions/_shared/cancellationRefund_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildCancellationPreset } from './cancellationPolicy.ts';
import {
  computeCancellationOutcome,
  manilaCheckInInstant,
  manilaYmdFromDate,
  type CancellationMoneyInput,
} from './cancellationRefund.ts';

const CHECK_IN_DATE = '2026-12-20';
const CHECK_IN_TIME = '14:00';
const BOOKED_30_DAYS_EARLY = '2026-11-20T00:00:00.000Z';

function booking(overrides: Partial<CancellationMoneyInput> = {}): CancellationMoneyInput {
  return {
    bookingRate: 10000,
    downPayment: 2000,
    guestBalancePaid: 0,
    securityDeposit: 1500,
    petFee: 500,
    hasPets: true,
    additionalFee: 0,
    voucherDiscount: 0,
    bookingSource: 'Direct',
    externalSource: null,
    checkInDate: CHECK_IN_DATE,
    ...overrides,
  };
}

function outcome(input: {
  policy?: ReturnType<typeof buildCancellationPreset> | null;
  cancelledAt: string;
  bookedAt?: string;
  initiator?: 'guest' | 'host' | 'ota' | 'system';
  booking?: Partial<CancellationMoneyInput>;
  overrideRefundPhp?: number | null;
}) {
  return computeCancellationOutcome({
    policy: input.policy === undefined ? buildCancellationPreset('moderate') : input.policy,
    booking: booking(input.booking),
    bookedAt: input.bookedAt ?? BOOKED_30_DAYS_EARLY,
    cancelledAt: input.cancelledAt,
    checkInTime: CHECK_IN_TIME,
    initiator: input.initiator ?? 'guest',
    overrideRefundPhp: input.overrideRefundPhp ?? null,
  });
}

Deno.test('check-in instant is 14:00 Asia/Manila (06:00Z)', () => {
  const instant = manilaCheckInInstant(CHECK_IN_DATE, CHECK_IN_TIME);
  assertEquals(instant?.toISOString(), '2026-12-20T06:00:00.000Z');
  assertEquals(manilaYmdFromDate(new Date('2026-12-20T06:00:00.000Z')), '2026-12-20');
});

Deno.test('grace window refunds 100% of cash paid', () => {
  const result = outcome({ cancelledAt: '2026-11-20T12:00:00.000Z' });
  assertEquals(result.mode, 'computed');
  assertEquals(result.refundPercent, 100);
  assertEquals(result.appliedRule?.kind, 'grace');
  assertEquals(result.amountPaidPhp, 2000);
  assertEquals(result.refundDuePhp, 2000);
  assertEquals(result.retainedPhp, 0);
});

Deno.test('moderate tier still refunds 100% inside 5 days', () => {
  const result = outcome({ cancelledAt: '2026-12-10T06:00:00.000Z' });
  assertEquals(result.appliedRule?.kind, 'tier');
  assertEquals(result.refundPercent, 100);
  assertEquals(result.refundDuePhp, 2000);
});

Deno.test('after the last deadline the fallback is 0 and nothing is owed', () => {
  const result = outcome({ cancelledAt: '2026-12-16T06:00:00.000Z' });
  assertEquals(result.refundPercent, 0);
  assertEquals(result.refundDuePhp, 0);
  assertEquals(result.retainedPhp, 2000);
});

Deno.test('firm 50% retains half the stay, capped at cash paid', () => {
  const result = outcome({
    policy: buildCancellationPreset('firm'),
    cancelledAt: '2026-12-10T06:00:00.000Z',
    booking: { downPayment: 8000 },
  });
  assertEquals(result.refundPercent, 50);
  // Policy base = 10,000 stay + 500 pet. Retained = 5,250.
  assertEquals(result.policyBasePhp, 10500);
  assertEquals(result.retainedPhp, 5250);
  assertEquals(result.refundDuePhp, 2750);
});

Deno.test('guest who paid less than the retained amount gets 0, never a debt', () => {
  const result = outcome({
    policy: buildCancellationPreset('firm'),
    cancelledAt: '2026-12-10T06:00:00.000Z',
    booking: { downPayment: 2000 },
  });
  assertEquals(result.refundDuePhp, 0);
  assertEquals(result.retainedPhp, 2000);
});

Deno.test('nothing paid means nothing owed', () => {
  const result = outcome({
    cancelledAt: '2026-11-20T12:00:00.000Z',
    booking: { downPayment: 0 },
  });
  assertEquals(result.amountPaidPhp, 0);
  assertEquals(result.refundDuePhp, 0);
});

Deno.test('host cancellation always refunds 100% of cash paid', () => {
  const result = outcome({
    policy: buildCancellationPreset('non_refundable'),
    cancelledAt: '2026-12-16T06:00:00.000Z',
    initiator: 'host',
    booking: { downPayment: 4000 },
  });
  assertEquals(result.appliedRule?.kind, 'host');
  assertEquals(result.refundPercent, 100);
  assertEquals(result.refundDuePhp, 4000);
});

Deno.test('after check-in defaults to 0% and is flagged', () => {
  const result = outcome({ cancelledAt: '2026-12-20T07:00:00.000Z' });
  assertEquals(result.mode, 'after_checkin');
  assertEquals(result.refundPercent, 0);
  assertEquals(result.refundDuePhp, 0);
});

Deno.test('last-minute booking gets no grace window', () => {
  const result = outcome({
    bookedAt: '2026-12-17T00:00:00.000Z',
    cancelledAt: '2026-12-17T01:00:00.000Z',
  });
  assertEquals(result.appliedRule?.kind, 'fallback');
  assertEquals(result.refundPercent, 0);
});

Deno.test('grace is capped at check-in', () => {
  const result = outcome({
    bookedAt: '2026-12-19T00:00:00.000Z',
    cancelledAt: '2026-12-19T23:00:00.000Z',
    booking: { downPayment: 3000 },
  });
  // Booked < 7 days ahead → no grace; 5-day deadline already passed.
  assertEquals(result.refundPercent, 0);
});

Deno.test('override above cash paid is clamped and warned', () => {
  const result = outcome({
    cancelledAt: '2026-12-16T06:00:00.000Z',
    overrideRefundPhp: 5000,
  });
  assertEquals(result.refundDuePhp, 2000);
  assertEquals(result.overrideApplied, true);
  assertEquals(result.warnings.length, 1);
});

Deno.test('override below policy is allowed and warned', () => {
  const result = outcome({
    policy: buildCancellationPreset('firm'),
    cancelledAt: '2026-12-10T06:00:00.000Z',
    booking: { downPayment: 8000 },
    overrideRefundPhp: 1000,
  });
  assertEquals(result.refundDuePhp, 1000);
  assertEquals(result.overrideApplied, true);
  assertEquals(result.warnings.length, 1);
});

Deno.test('voucher discount reduces the refundable stay base', () => {
  const result = outcome({
    cancelledAt: '2026-12-16T06:00:00.000Z',
    booking: { voucherDiscount: 2000 },
  });
  assertEquals(result.policyBasePhp, 8500);
});

Deno.test('pet fee never_refund is retained outside the policy base', () => {
  const policy = buildCancellationPreset('custom', {
    tiers: [{ daysBefore: 7, refundPercent: 100 }],
    feeRules: { petFee: 'never_refund', additionalFees: 'follow_policy' },
  });
  const result = outcome({
    policy,
    cancelledAt: '2026-12-10T06:00:00.000Z',
    booking: { downPayment: 8000 },
  });
  assertEquals(result.policyBasePhp, 10000);
});

Deno.test('unset policy is host-decides, not a silent 0%', () => {
  const result = outcome({ policy: null, cancelledAt: '2026-12-10T06:00:00.000Z' });
  assertEquals(result.mode, 'host_decides');
  assertEquals(result.refundDuePhp, 0);
});

Deno.test('external channel booking is handled on the channel', () => {
  const result = outcome({
    cancelledAt: '2026-12-10T06:00:00.000Z',
    booking: { externalSource: 'Airbnb' },
  });
  assertEquals(result.mode, 'external');
});

Deno.test('deadlines are sorted and the next deadline is the nearest upcoming', () => {
  const result = outcome({
    policy: buildCancellationPreset('firm'),
    cancelledAt: '2026-12-10T06:00:00.000Z',
  });
  assertEquals(result.deadlines.map((deadline) => deadline.daysBefore), [30, 7]);
  assertEquals(result.nextDeadline?.daysBefore, 7);
});

Deno.test('line items always sum to cash paid', () => {
  const result = outcome({
    policy: buildCancellationPreset('firm'),
    cancelledAt: '2026-12-10T06:00:00.000Z',
    booking: { downPayment: 8000 },
  });
  const retained = result.lines.find((line) => line.kind === 'retained')?.amountPhp ?? 0;
  const refund = result.lines.find((line) => line.kind === 'refund')?.amountPhp ?? 0;
  assertEquals(Math.round((retained + refund) * 100) / 100, result.amountPaidPhp);
});
