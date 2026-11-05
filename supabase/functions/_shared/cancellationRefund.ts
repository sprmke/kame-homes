/**
 * Cancellation refund calculator — pure, deterministic, shared.
 *
 * Reads the **booking snapshot** only. Never reads the property's live policy.
 * All deadlines are Asia/Manila (UTC+8, no DST) at the property check-in time.
 *
 * Mirror: ui/src/features/guest/trip/lib/cancellationRefund.ts
 * Plan:   docs/workflow/in-progress/cancellation-policy-and-process.md §4.4
 */

import type { CancellationPolicy } from './cancellationPolicy.ts';

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
  bookedAt: string;
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
  kind: 'grace' | 'tier' | 'fallback' | 'host' | 'override' | 'after_checkin' | 'unset' | 'external';
  label: string;
  deadlineIso?: string;
};

export type CancellationMoneyLine = {
  kind: 'stay' | 'pet_fee' | 'additional_fee' | 'paid' | 'retained' | 'refund';
  label: string;
  amountPhp: number;
  note?: string;
};

export type CancellationOutcome = {
  mode: CancellationOutcomeMode;
  initiator: CancellationInitiator;
  refundPercent: number | null;
  appliedRule: CancellationAppliedRule | null;
  checkInInstantIso: string;
  graceUntilIso: string | null;
  cancellableUntilIso: string;
  deadlines: CancellationDeadline[];
  nextDeadline: CancellationDeadline | null;
  amountPaidPhp: number;
  policyBasePhp: number;
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

function moneyLines(input: {
  stayBaseCents: number;
  petCents: number;
  additionalCents: number;
  petRule: string;
  additionalRule: string;
  paidCents: number;
  retainedCents: number;
  refundCents: number;
}): CancellationMoneyLine[] {
  const lines: CancellationMoneyLine[] = [
    { kind: 'stay', label: 'Stay', amountPhp: fromCents(input.stayBaseCents) },
  ];
  if (input.petCents > 0) {
    lines.push({
      kind: 'pet_fee',
      label: 'Pet fee',
      amountPhp: fromCents(input.petCents),
      note: input.petRule,
    });
  }
  if (input.additionalCents > 0) {
    lines.push({
      kind: 'additional_fee',
      label: 'Additional fee',
      amountPhp: fromCents(input.additionalCents),
      note: input.additionalRule,
    });
  }
  lines.push({ kind: 'paid', label: 'Total paid', amountPhp: fromCents(input.paidCents) });
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
 * Percent is applied to the full stay amount (market standard), then capped at
 * cash actually paid. A guest who paid less than the retained amount gets ₱0
 * and is never billed the difference.
 */
export function computeCancellationOutcome(input: CancellationOutcomeInput): CancellationOutcome {
  const warnings: string[] = [];
  const cancelledAt = new Date(input.cancelledAt);
  const cancelledMs = Number.isNaN(cancelledAt.getTime()) ? Date.now() : cancelledAt.getTime();
  const bookedAt = new Date(input.bookedAt);
  const bookedMs = Number.isNaN(bookedAt.getTime())
    ? new Date(input.cancelledAt).getTime()
    : bookedAt.getTime();

  const checkInInstant = manilaCheckInInstant(input.booking.checkInDate, input.checkInTime);
  const checkInMs = checkInInstant?.getTime() ?? Number.NaN;
  const checkInInstantIso = checkInInstant?.toISOString() ?? '';

  const rateCents = Math.max(0, toCents(input.booking.bookingRate) - toCents(input.booking.voucherDiscount));
  const petCents = input.booking.hasPets ? Math.max(0, toCents(input.booking.petFee)) : 0;
  const additionalCents = Math.max(0, toCents(input.booking.additionalFee));
  const paidCents = Math.max(
    0,
    toCents(input.booking.downPayment) + toCents(input.booking.guestBalancePaid)
  );
  const sdCents = Math.max(0, toCents(input.booking.securityDeposit));
  const securityDepositHeldPhp = fromCents(toCents(input.booking.guestBalancePaid) > 0 ? sdCents : 0);

  const baseOutcome = {
    initiator: input.initiator,
    checkInInstantIso,
    cancellableUntilIso: checkInInstantIso,
    deadlines: [] as CancellationDeadline[],
    nextDeadline: null as CancellationDeadline | null,
    amountPaidPhp: fromCents(paidCents),
    policyBasePhp: 0,
    retainedPhp: 0,
    refundDuePhp: 0,
    securityDepositHeldPhp,
    overrideApplied: false,
    warnings,
    lines: moneyLines({
      stayBaseCents: rateCents,
      petCents,
      additionalCents,
      petRule: 'follow_policy',
      additionalRule: 'follow_policy',
      paidCents,
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
      graceUntilIso: null,
      retainedPhp: 0,
      refundDuePhp: 0,
    };
  }

  const policy = input.policy;

  if (!policy || policy.needsReview || (policy.presetId === 'custom' && policy.tiers.length === 0 && !policy.grace?.enabled)) {
    return {
      ...baseOutcome,
      mode: 'host_decides',
      refundPercent: null,
      appliedRule: { kind: 'unset', label: 'Your host will confirm the refund' },
      graceUntilIso: null,
      retainedPhp: 0,
      refundDuePhp: 0,
    };
  }

  const deadlines = checkInInstant ? buildCancellationDeadlines(policy, checkInInstant) : [];
  const graceEligible =
    Boolean(policy.grace?.enabled) &&
    checkInInstant !== null &&
    bookedMs <= checkInMs - (policy.grace?.minLeadDays ?? 0) * DAY_MS;
  const graceUntilMs = graceEligible ? bookedMs + (policy.grace?.hours ?? 0) * HOUR_MS : Number.NaN;
  const graceUntilCappedMs = Math.min(graceUntilMs, checkInMs);
  const graceUntilIso = Number.isFinite(graceUntilCappedMs)
    ? new Date(graceUntilCappedMs).toISOString()
    : null;

  const petFollows = policy.feeRules.petFee === 'follow_policy';
  const additionalFollows = policy.feeRules.additionalFees === 'follow_policy';
  const policyBaseCents = rateCents + (petFollows ? petCents : 0) + (additionalFollows ? additionalCents : 0);

  const afterCheckIn = Number.isFinite(checkInMs) && cancelledMs >= checkInMs;

  let refundPercent = 0;
  let appliedRule: CancellationAppliedRule = { kind: 'fallback', label: 'No refund at this time' };

  if (afterCheckIn) {
    refundPercent = 0;
    appliedRule = { kind: 'after_checkin', label: 'The stay has already started' };
  } else if (Number.isFinite(graceUntilCappedMs) && cancelledMs <= graceUntilCappedMs) {
    refundPercent = 100;
    appliedRule = { kind: 'grace', label: 'Free cancellation window' };
  } else {
    const matched = deadlines.find((deadline) => cancelledMs <= new Date(deadline.deadlineIso).getTime());
    if (matched) {
      refundPercent = matched.refundPercent;
      appliedRule = {
        kind: 'tier',
        label: `${matched.refundPercent}% refund at least ${matched.label}`,
        deadlineIso: matched.deadlineIso,
      };
    } else {
      refundPercent = policy.fallbackRefundPercent;
      appliedRule = {
        kind: 'fallback',
        label:
          policy.fallbackRefundPercent > 0
            ? `${policy.fallbackRefundPercent}% refund`
            : 'No refund at this time',
      };
    }
  }

  if (input.initiator === 'host') {
    refundPercent = 100;
    appliedRule = { kind: 'host', label: 'Host cancelled, full refund' };
  }

  const retainedFromPolicyCents = Math.round(((100 - refundPercent) / 100) * policyBaseCents);
  let refundCents = clampCents(paidCents - retainedFromPolicyCents, 0, paidCents);

  let overrideApplied = false;
  if (input.overrideRefundPhp != null && Number.isFinite(Number(input.overrideRefundPhp))) {
    const overrideCents = Math.max(0, toCents(input.overrideRefundPhp));
    refundCents = clampCents(overrideCents, 0, paidCents);
    overrideApplied = true;
    appliedRule = { kind: 'override', label: 'Refund set by the host' };
    if (overrideCents > paidCents) {
      warnings.push('Refund cannot be more than the amount already paid.');
    }
    if (overrideCents < paidCents - retainedFromPolicyCents) {
      warnings.push('This refund is lower than the policy.');
    }
  }

  const nextDeadline =
    deadlines
      .filter((deadline) => new Date(deadline.deadlineIso).getTime() >= cancelledMs)
      .sort(
        (a, b) => new Date(a.deadlineIso).getTime() - new Date(b.deadlineIso).getTime()
      )[0] ?? null;

  const refundDuePhp = roundPeso(refundCents);
  const refundCentsRounded = refundDuePhp * 100;
  const retainedCentsRounded = Math.max(0, paidCents - refundCentsRounded);

  return {
    mode: afterCheckIn ? 'after_checkin' : 'computed',
    initiator: input.initiator,
    refundPercent,
    appliedRule,
    checkInInstantIso,
    graceUntilIso,
    cancellableUntilIso: checkInInstantIso,
    deadlines,
    nextDeadline,
    amountPaidPhp: fromCents(paidCents),
    policyBasePhp: fromCents(policyBaseCents),
    retainedPhp: fromCents(retainedCentsRounded),
    refundDuePhp,
    securityDepositHeldPhp,
    overrideApplied,
    warnings,
    lines: moneyLines({
      stayBaseCents: rateCents,
      petCents,
      additionalCents,
      petRule: policy.feeRules.petFee,
      additionalRule: policy.feeRules.additionalFees,
      paidCents,
      retainedCents: retainedCentsRounded,
      refundCents: refundCentsRounded,
    }),
  };
}

/** Map a `guest_submissions` row to the calculator's money input. */
export function cancellationMoneyInputFromBooking(row: Record<string, unknown>): CancellationMoneyInput {
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
