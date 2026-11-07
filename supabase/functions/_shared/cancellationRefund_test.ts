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
  initiator?: 'guest' | 'host' | 'ota' | 'system';
  booking?: Partial<CancellationMoneyInput>;
  overrideRefundPhp?: number | null;
}) {
  return computeCancellationOutcome({
    policy: input.policy === undefined ? buildCancellationPreset('moderate') : input.policy,
    booking: booking(input.booking),
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

Deno.test('100% tier refunds everything the guest paid', () => {
  const result = outcome({ cancelledAt: '2026-12-17T06:00:00.000Z' });
  assertEquals(result.mode, 'computed');
  assertEquals(result.refundPercent, 100);
  assertEquals(result.appliedRule?.kind, 'tier');
  assertEquals(result.amountPaidPhp, 2000);
  assertEquals(result.refundDuePhp, 2000);
  assertEquals(result.retainedPhp, 0);
});

Deno.test('after the last deadline the fallback is 0 and nothing is owed', () => {
  const result = outcome({ cancelledAt: '2026-12-18T06:00:00.000Z' });
  assertEquals(result.refundPercent, 0);
  assertEquals(result.refundDuePhp, 0);
  assertEquals(result.retainedPhp, 2000);
});

Deno.test('firm 50% refunds half of what the guest paid', () => {
  const result = outcome({
    policy: buildCancellationPreset('firm'),
    cancelledAt: '2026-12-10T06:00:00.000Z',
    booking: { downPayment: 8000 },
  });
  assertEquals(result.refundPercent, 50);
  assertEquals(result.refundablePaidPhp, 8000);
  assertEquals(result.retainedPhp, 4000);
  assertEquals(result.refundDuePhp, 4000);
});

Deno.test('guest who paid only the down payment still gets a partial refund', () => {
  const result = outcome({
    policy: buildCancellationPreset('firm'),
    cancelledAt: '2026-12-10T06:00:00.000Z',
    booking: { downPayment: 2000 },
  });
  // 50% of the 2,000 paid. A 50% policy must not wipe out a down payment.
  assertEquals(result.refundDuePhp, 1000);
  assertEquals(result.retainedPhp, 1000);
});

Deno.test('fully paid booking refunds 50% of the stay plus the deposit', () => {
  const result = outcome({
    policy: buildCancellationPreset('firm'),
    cancelledAt: '2026-12-10T06:00:00.000Z',
    booking: { downPayment: 2000, guestBalancePaid: 10000 },
  });
  // Cash paid 12,000: 1,500 SD + 10,500 stay and fees.
  // 50% of 10,500 + the full 1,500 SD = 6,750.
  assertEquals(result.amountPaidPhp, 12000);
  assertEquals(result.securityDepositHeldPhp, 1500);
  assertEquals(result.refundablePaidPhp, 10500);
  assertEquals(result.refundDuePhp, 6750);
  assertEquals(result.retainedPhp, 5250);
});

Deno.test('nothing paid means nothing owed', () => {
  const result = outcome({
    cancelledAt: '2026-12-10T06:00:00.000Z',
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

Deno.test('non-refundable keeps the down payment', () => {
  const result = outcome({
    policy: buildCancellationPreset('non_refundable'),
    cancelledAt: '2026-12-10T06:00:00.000Z',
    booking: { downPayment: 2000 },
  });
  assertEquals(result.refundDuePhp, 0);
  assertEquals(result.retainedPhp, 2000);
});

Deno.test('security deposit comes back even under a non-refundable policy', () => {
  const result = outcome({
    policy: buildCancellationPreset('non_refundable'),
    cancelledAt: '2026-12-10T06:00:00.000Z',
    booking: { downPayment: 2000, guestBalancePaid: 10000 },
  });
  assertEquals(result.securityDepositHeldPhp, 1500);
  assertEquals(result.refundDuePhp, 1500);
  assertEquals(result.retainedPhp, 10500);
});

Deno.test('last-minute booking inside the deadline gets the fallback', () => {
  const result = outcome({
    cancelledAt: '2026-12-18T01:00:00.000Z',
  });
  assertEquals(result.appliedRule?.kind, 'fallback');
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

Deno.test('voucher discount does not reduce the refund of cash paid', () => {
  const result = outcome({
    cancelledAt: '2026-12-17T06:00:00.000Z',
    booking: { voucherDiscount: 2000 },
  });
  assertEquals(result.amountPaidPhp, 2000);
  assertEquals(result.refundablePaidPhp, 2000);
  assertEquals(result.refundDuePhp, 2000);
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
  assertEquals(result.deadlines.map((deadline) => deadline.daysBefore), [14, 7]);
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
