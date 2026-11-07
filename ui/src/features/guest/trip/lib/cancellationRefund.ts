/**
 * Cancellation refund calculator — client mirror of
 * `supabase/functions/_shared/cancellationRefund.ts`.
 *
 * Keep this file byte-for-byte aligned with the server copy (the import path and
 * this header differ only). `cancellationRefundParity.test.ts` fails on drift.
 *
 * Plan: docs/workflow/in-progress/cancellation-policy-and-process.md §4.4
 */

import type { CancellationPolicy } from '@/features/dashboard/org/lib/cancellationPolicy';

export type CancellationInitiator = 'guest' | 'host' | 'ota' | 'system';

export type CancellationOutcomeMode =
  | 'computed'
  | 'host_decides'
  | 'external'
  | 'after_checkin'
  | 'not_cancellable';

export type CancellationMoneyInput = {
  bookingRate: number | null;
  downPayment: number | null;
  guestBalancePaid: number | null;
  securityDeposit: number | null;
  petFee: number | null;
  hasPets: boolean;
  additionalFee: number | null;
  voucherDiscount: number | null;
  bookingSource: string | null;
  externalSource: string | null;
  /** `YYYY-MM-DD` (also accepts legacy `MM-DD-YYYY`). */
  checkInDate: string;
};

export type CancellationOutcomeInput = {
  policy: CancellationPolicy | null;
  booking: CancellationMoneyInput;
  cancelledAt: string;
  /** Property check-in time `HH:MM`, default `14:00`. */
  checkInTime: string;
  initiator: CancellationInitiator;
  overrideRefundPhp?: number | null;
};

export type CancellationDeadline = {
  daysBefore: number;
  refundPercent: number;
  deadlineIso: string;
  label: string;
};

export type CancellationAppliedRule = {
  kind: 'tier' | 'fallback' | 'host' | 'override' | 'after_checkin' | 'unset' | 'external';
  label: string;
  deadlineIso?: string;
};

export type CancellationMoneyLine = {
  kind: 'paid_for_stay' | 'security_deposit' | 'paid' | 'retained' | 'refund';
  label: string;
  amountPhp: number;
};

export type CancellationOutcome = {
  mode: CancellationOutcomeMode;
  initiator: CancellationInitiator;
  refundPercent: number | null;
  appliedRule: CancellationAppliedRule | null;
  checkInInstantIso: string;
  cancellableUntilIso: string;
  deadlines: CancellationDeadline[];
  nextDeadline: CancellationDeadline | null;
  /** Everything the guest has paid (down payment + settled balance). */
  amountPaidPhp: number;
  /** The paid amount the percentage applies to (total paid minus the security deposit). */
  refundablePaidPhp: number;
  retainedPhp: number;
  refundDuePhp: number;
  securityDepositHeldPhp: number;
  overrideApplied: boolean;
  warnings: string[];
  lines: CancellationMoneyLine[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MANILA_OFFSET_HOURS = 8;
const DEFAULT_CHECK_IN_TIME = '14:00';

function toCents(value: number | null | undefined): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

function clampCents(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Whole peso, half up. Refunds are paid in cash by the host. */
function roundPeso(cents: number): number {
  return Math.round(cents / 100);
}

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const trimmed = String(value ?? '').trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (match) {
    return { year: Number(match[3]), month: Number(match[1]), day: Number(match[2]) };
  }
  return null;
}

function parseHm(value: string | null | undefined): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim());
  if (!match) return { hours: 14, minutes: 0 };
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return { hours, minutes };
}

/**
 * Check-in instant in Asia/Manila. Manila has no DST, so a fixed +08:00 offset
 * is exact. `Date.UTC` normalizes negative hours (e.g. 02:00 → previous day).
 */
export function manilaCheckInInstant(checkInDate: string, checkInTime?: string | null): Date | null {
  const ymd = parseYmd(checkInDate);
  if (!ymd) return null;
  const hm = parseHm(checkInTime ?? DEFAULT_CHECK_IN_TIME);
  return new Date(
    Date.UTC(ymd.year, ymd.month - 1, ymd.day, hm.hours - MANILA_OFFSET_HOURS, hm.minutes, 0, 0)
  );
}

export function manilaYmdFromDate(date: Date): string {
  const shifted = new Date(date.getTime() + MANILA_OFFSET_HOURS * HOUR_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysLabel(days: number): string {
  if (days === 0) return 'on check-in day';
  return days === 1 ? '1 day' : `${days} days`;
}

export function buildCancellationDeadlines(
  policy: CancellationPolicy,
  checkInInstant: Date
): CancellationDeadline[] {
  return policy.tiers
    .map((tier) => ({
      daysBefore: tier.daysBefore,
      refundPercent: tier.refundPercent,
      deadlineIso: new Date(checkInInstant.getTime() - tier.daysBefore * DAY_MS).toISOString(),
      label: `${daysLabel(tier.daysBefore)} before check-in`,
    }))
    .sort((a, b) => b.daysBefore - a.daysBefore);
}

/**
 * Split what the guest actually paid into the security deposit and everything
 * else. The SD is only "paid" once the balance is settled (the DP is credited
 * against the stay).
 */
function paidAmounts(input: {
  downPayment: number | null;
  guestBalancePaid: number | null;
  securityDeposit: number | null;
}): {
  cashPaidCents: number;
  securityDepositCents: number;
  paidForStayCents: number;
} {
  const cashPaidCents = Math.max(0, toCents(input.downPayment) + toCents(input.guestBalancePaid));
  const balancePaidCents = Math.max(0, toCents(input.guestBalancePaid));
  const securityDepositCents =
    balancePaidCents > 0
      ? Math.min(Math.max(0, toCents(input.securityDeposit)), cashPaidCents)
      : 0;
  return {
    cashPaidCents,
    securityDepositCents,
    paidForStayCents: Math.max(0, cashPaidCents - securityDepositCents),
  };
}

function moneyLines(input: {
  paid: { cashPaidCents: number; securityDepositCents: number; paidForStayCents: number };
  retainedCents: number;
  refundCents: number;
}): CancellationMoneyLine[] {
  const lines: CancellationMoneyLine[] = [
    {
      kind: 'paid_for_stay',
      label: 'Paid for stay',
      amountPhp: fromCents(input.paid.paidForStayCents),
    },
  ];
  if (input.paid.securityDepositCents > 0) {
    lines.push({
      kind: 'security_deposit',
      label: 'Security deposit',
      amountPhp: fromCents(input.paid.securityDepositCents),
    });
  }
  lines.push({
    kind: 'paid',
    label: 'Total paid',
    amountPhp: fromCents(input.paid.cashPaidCents),
  });
  if (input.retainedCents > 0) {
    lines.push({
      kind: 'retained',
      label: 'Non-refundable',
      amountPhp: fromCents(input.retainedCents),
    });
  }
  lines.push({ kind: 'refund', label: 'Refund', amountPhp: fromCents(input.refundCents) });
  return lines;
}

/**
 * The single source of truth for "how much comes back".
 *
 * The percentage applies to the amount actually paid for the stay, never to the
 * full booking value. The security deposit is always refunded when it was paid.
 * A host cancellation refunds everything paid, regardless of the policy.
 */
export function computeCancellationOutcome(input: CancellationOutcomeInput): CancellationOutcome {
  const warnings: string[] = [];
  const cancelledAt = new Date(input.cancelledAt);
  const cancelledMs = Number.isNaN(cancelledAt.getTime()) ? Date.now() : cancelledAt.getTime();

  const checkInInstant = manilaCheckInInstant(input.booking.checkInDate, input.checkInTime);
  const checkInMs = checkInInstant?.getTime() ?? Number.NaN;
  const checkInInstantIso = checkInInstant?.toISOString() ?? '';

  const paid = paidAmounts({
    downPayment: input.booking.downPayment,
    guestBalancePaid: input.booking.guestBalancePaid,
    securityDeposit: input.booking.securityDeposit,
  });

  const baseOutcome = {
    initiator: input.initiator,
    checkInInstantIso,
    cancellableUntilIso: checkInInstantIso,
    deadlines: [] as CancellationDeadline[],
    nextDeadline: null as CancellationDeadline | null,
    amountPaidPhp: fromCents(paid.cashPaidCents),
    refundablePaidPhp: 0,
    retainedPhp: 0,
    refundDuePhp: 0,
    securityDepositHeldPhp: fromCents(paid.securityDepositCents),
    overrideApplied: false,
    warnings,
    lines: moneyLines({
      paid,
      retainedCents: 0,
      refundCents: 0,
    }),
  };

  // Only channel-synced rows are external. A manual `?source=airbnb` booking is
  // still managed in-app (the guest form just skips the payment step).
  const isExternal = Boolean(input.booking.externalSource?.trim());

  if (isExternal) {
    return {
      ...baseOutcome,
      mode: 'external',
      refundPercent: null,
      appliedRule: { kind: 'external', label: 'Cancellation is handled on the channel' },
      retainedPhp: 0,
      refundDuePhp: 0,
    };
  }

  const policy = input.policy;

  if (!policy || policy.needsReview || (policy.presetId === 'custom' && policy.tiers.length === 0)) {
    return {
      ...baseOutcome,
      mode: 'host_decides',
      refundPercent: null,
      appliedRule: { kind: 'unset', label: 'Your host will confirm the refund' },
      retainedPhp: 0,
      refundDuePhp: 0,
    };
  }

  const deadlines = checkInInstant ? buildCancellationDeadlines(policy, checkInInstant) : [];
  const afterCheckIn = Number.isFinite(checkInMs) && cancelledMs >= checkInMs;

  let refundPercent = 0;
  let appliedRule: CancellationAppliedRule = {
    kind: 'fallback',
    label: 'No refund at this time',
  };

  if (afterCheckIn) {
    refundPercent = 0;
    appliedRule = { kind: 'after_checkin', label: 'The stay has already started' };
  } else {
    const matched = deadlines.find(
      (deadline) => cancelledMs <= new Date(deadline.deadlineIso).getTime()
    );
    if (matched) {
      refundPercent = matched.refundPercent;
      appliedRule = {
        kind: 'tier',
        label: `${matched.refundPercent}% of what you paid, at least ${matched.label}`,
        deadlineIso: matched.deadlineIso,
      };
    } else {
      refundPercent = policy.fallbackRefundPercent;
      appliedRule = {
        kind: 'fallback',
        label:
          policy.fallbackRefundPercent > 0
            ? `${policy.fallbackRefundPercent}% of what you paid`
            : 'No refund at this time',
      };
    }
  }

  let policyRefundCents = 0;
  if (input.initiator === 'host') {
    refundPercent = 100;
    appliedRule = { kind: 'host', label: 'Host cancelled, full refund' };
    policyRefundCents = paid.cashPaidCents;
  } else {
    policyRefundCents =
      Math.round((paid.paidForStayCents * refundPercent) / 100) + paid.securityDepositCents;
  }

  let refundCents = clampCents(policyRefundCents, 0, paid.cashPaidCents);
  let overrideApplied = false;
  if (input.overrideRefundPhp != null && Number.isFinite(Number(input.overrideRefundPhp))) {
    const overrideCents = Math.max(0, toCents(input.overrideRefundPhp));
    refundCents = clampCents(overrideCents, 0, paid.cashPaidCents);
    overrideApplied = true;
    appliedRule = { kind: 'override', label: 'Refund set by the host' };
    if (overrideCents > paid.cashPaidCents) {
      warnings.push('Refund cannot be more than the amount already paid.');
    }
    if (overrideCents < clampCents(policyRefundCents, 0, paid.cashPaidCents)) {
      warnings.push('This refund is lower than the policy.');
    }
  }

  const nextDeadline =
    deadlines
      .filter((deadline) => new Date(deadline.deadlineIso).getTime() >= cancelledMs)
      .sort((a, b) => new Date(a.deadlineIso).getTime() - new Date(b.deadlineIso).getTime())[0] ??
    null;

  const refundDuePhp = roundPeso(refundCents);
  const refundCentsRounded = refundDuePhp * 100;
  const retainedCentsRounded = Math.max(0, paid.cashPaidCents - refundCentsRounded);

  return {
    mode: afterCheckIn ? 'after_checkin' : 'computed',
    initiator: input.initiator,
    refundPercent,
    appliedRule,
    checkInInstantIso,
    cancellableUntilIso: checkInInstantIso,
    deadlines,
    nextDeadline,
    amountPaidPhp: fromCents(paid.cashPaidCents),
    refundablePaidPhp: fromCents(paid.paidForStayCents),
    retainedPhp: fromCents(retainedCentsRounded),
    refundDuePhp,
    securityDepositHeldPhp: fromCents(paid.securityDepositCents),
    overrideApplied,
    warnings,
    lines: moneyLines({
      paid,
      retainedCents: retainedCentsRounded,
      refundCents: refundCentsRounded,
    }),
  };
}

/** Map a `guest_submissions` row to the calculator's money input. */
export function cancellationMoneyInputFromBooking(
  row: Record<string, unknown>
): CancellationMoneyInput {
  const num = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    bookingRate: num(row.booking_rate),
    downPayment: num(row.down_payment),
    guestBalancePaid: num(row.guest_balance_paid_amount),
    securityDeposit: num(row.security_deposit),
    petFee: num(row.pet_fee),
    hasPets: row.has_pets === true || row.has_pets === 'true',
    additionalFee: num(row.guest_additional_fee),
    voucherDiscount: num(row.applied_voucher_discount_php),
    bookingSource: typeof row.booking_source === 'string' ? row.booking_source : null,
    externalSource: typeof row.external_source === 'string' ? row.external_source : null,
    checkInDate: typeof row.check_in_date === 'string' ? row.check_in_date : '',
  };
}
