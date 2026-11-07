/**
 * Cancellation domain service — snapshot capture, refund computation, request
 * lifecycle, and the single cancel path used by every handler.
 *
 * Plan: docs/workflow/in-progress/cancellation-policy-and-process.md
 */

import {
  buildCancellationPolicySnapshot,
  cancellationPolicyHash,
  readCancellationPolicyFromSettings,
  readCancellationPolicyVersionId,
  isCancellationPolicyNonRefundable,
  resolveCancellationPolicyDisplay,
  type CancellationPolicy,
  type CancellationPolicySnapshot,
} from './cancellationPolicy.ts';
import {
  cancellationMoneyInputFromBooking,
  computeCancellationOutcome,
  manilaCheckInInstant,
  type CancellationInitiator,
  type CancellationOutcome,
} from './cancellationRefund.ts';
import { DatabaseService } from './databaseService.ts';
import { createServiceClient } from './orgAuth.ts';
import { createNotification } from './notificationService.ts';
import { buildActorContext, logActivity, type ActorContext } from './activityLog.ts';
import { WorkflowOrchestrator } from './workflowOrchestrator.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';
import { GUEST_CANCELLABLE_STATUSES, HOST_CANCELLABLE_STATUSES } from './statusMachine.ts';


/** Explicit column lists so a `select('*')` guard stays green and payloads stay intentional. */
export const BOOKING_REFUND_COLUMNS =
  'id, booking_id, property_id, organization_id, kind, amount_due_php, amount_paid_php, breakdown, status, method, bank, account_name, account_number, phone, proof_url, sent_at, created_by, notes, created_at, updated_at' as const;

export const CANCELLATION_REQUEST_COLUMNS =
  'id, booking_id, property_id, status, reason_code, reason_note, host_message, requested_at, resolved_at, resolved_by, created_at, updated_at' as const;


export const CANCELLATION_REASON_CODES = [
  'change_of_plans',
  'found_another_place',
  'travel_issue',
  'emergency',
  'no_show',
  'no_payment',
  'duplicate_or_test',
  'host_unavailable',
  'other',
] as const;

export type CancellationReasonCode = (typeof CANCELLATION_REASON_CODES)[number];

export function isCancellationReasonCode(value: unknown): value is CancellationReasonCode {
  return (
    typeof value === 'string' &&
    (CANCELLATION_REASON_CODES as readonly string[]).includes(value)
  );
}

export class PolicyChangedError extends Error {
  status = 409;
  code = 'policy_changed';
  constructor() {
    super('The cancellation policy changed while you were booking. Review it and try again.');
  }
}

export class CancellationNotAllowedError extends Error {
  status: number;
  code: string;
  constructor(message: string, code = 'not_cancellable', status = 409) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type BookingRow = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isGuestCancellable(
  status: string | null | undefined,
  checkInDate: string,
  checkInTime: string | null | undefined,
  now = new Date()
): boolean {
  if (!GUEST_CANCELLABLE_STATUSES.has(String(status ?? '').trim() as never)) return false;
  const checkIn = manilaCheckInInstant(checkInDate, checkInTime);
  if (!checkIn) return false;
  return now.getTime() < checkIn.getTime();
}

export function isHostCancellable(status: string | null | undefined): boolean {
  return HOST_CANCELLABLE_STATUSES.has(String(status ?? '').trim() as never);
}

/**
 * Once the guest has settled the balance, a cancellation moves real money, so
 * it always goes through host approval even when the policy is "instant".
 * Instant self-cancel is for down-payment-only bookings.
 */
export function guestMustRequestCancellation(booking: BookingRow): boolean {
  return Number(booking.guest_balance_paid_amount ?? 0) > 0;
}

export async function loadPropertyCancellationContext(propertyId: string): Promise<{
  policy: CancellationPolicy | null;
  versionId: string | null;
  checkInTime: string;
  settings: Record<string, unknown>;
}> {
  const { data, error } = await createServiceClient()
    .from('properties')
    .select('settings')
    .eq('id', propertyId)
    .maybeSingle();
  if (error) throw new Error(`Could not load property settings: ${error.message}`);
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  return {
    policy: readCancellationPolicyFromSettings(settings),
    versionId: readCancellationPolicyVersionId(settings),
    checkInTime: str(settings.checkInTime) || '14:00',
    settings,
  };
}

/**
 * Capture the snapshot for a new booking. `clientVersionId` is what the booking
 * form displayed; a mismatch means the host edited the policy mid-checkout.
 */
export async function captureSnapshotForBooking(input: {
  propertyId: string;
  capturedFrom: CancellationPolicySnapshot['capturedFrom'];
  clientVersionId?: string | null;
  clientHash?: string | null;
  externalSource?: string | null;
  capturedAt?: string;
}): Promise<CancellationPolicySnapshot> {
  const context = await loadPropertyCancellationContext(input.propertyId);
  // Content hash wins: copy-to-properties can change the policy without minting
  // a new version id, and a stale version id alone would miss that.
  if (
    input.clientHash !== undefined &&
    input.clientHash !== null &&
    input.clientHash !== '' &&
    input.clientHash !== cancellationPolicyHash(context.policy)
  ) {
    throw new PolicyChangedError();
  }
  if (
    input.clientVersionId !== undefined &&
    input.clientVersionId !== null &&
    input.clientVersionId !== context.versionId
  ) {
    throw new PolicyChangedError();
  }
  return buildCancellationPolicySnapshot({
    policy: context.policy,
    capturedFrom: input.capturedFrom,
    propertyPolicyVersionId: context.versionId,
    externalSource: input.externalSource ?? null,
    capturedAt: input.capturedAt,
  });
}

/** Backfill/self-heal: every booking that reaches a cancel screen has a snapshot. */
export async function ensureBookingSnapshot(
  booking: BookingRow,
  capturedFrom: CancellationPolicySnapshot['capturedFrom'] = 'backfill'
): Promise<CancellationPolicySnapshot | null> {
  const existing = booking.cancellation_policy_snapshot;
  if (existing && typeof existing === 'object') {
    return existing as CancellationPolicySnapshot;
  }
  const propertyId = str(booking.property_id);
  if (!propertyId) return null;
  const snapshot = await captureSnapshotForBooking({
    propertyId,
    capturedFrom,
    externalSource: str(booking.external_source) || null,
  });
  try {
    await createServiceClient()
      .from('guest_submissions')
      .update({ cancellation_policy_snapshot: snapshot })
      .eq('id', String(booking.id))
      .is('cancellation_policy_snapshot', null);
  } catch (err) {
    console.error('[cancellation] snapshot backfill failed (non-fatal):', err);
  }
  return snapshot;
}

export function computeOutcomeForBooking(input: {
  booking: BookingRow;
  policy: CancellationPolicy | null;
  checkInTime: string;
  initiator: CancellationInitiator;
  cancelledAt?: string;
  overrideRefundPhp?: number | null;
}): CancellationOutcome {
  return computeCancellationOutcome({
    policy: input.policy,
    booking: cancellationMoneyInputFromBooking(input.booking),
    cancelledAt: input.cancelledAt ?? new Date().toISOString(),
    checkInTime: input.checkInTime,
    initiator: input.initiator,
    overrideRefundPhp: input.overrideRefundPhp,
  });
}

export type CancelBookingResult = {
  booking: BookingRow;
  outcome: CancellationOutcome;
  refund: BookingRefundRow | null;
  alreadyCancelled: boolean;
};

export type BookingRefundRow = {
  id: string;
  booking_id: string;
  property_id: string;
  organization_id: string | null;
  kind: 'cancellation' | 'goodwill';
  amount_due_php: number;
  amount_paid_php: number | null;
  breakdown: Record<string, unknown>;
  status: 'not_due' | 'awaiting_guest_details' | 'pending' | 'sent' | 'cancelled';
  method: string | null;
  bank: string | null;
  account_name: string | null;
  account_number: string | null;
  phone: string | null;
  proof_url: string | null;
  sent_at: string | null;
  notes: string | null;
};

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function upsertCancellationRefund(input: {
  booking: BookingRow;
  outcome: CancellationOutcome;
  initiator: CancellationInitiator;
  reasonCode: string;
  overrideNote?: string | null;
  createdBy?: string | null;
}): Promise<BookingRefundRow | null> {
  const propertyId = str(input.booking.property_id);
  const bookingId = str(input.booking.id);
  if (!propertyId || !bookingId) return null;

  const amountDue = input.outcome.refundDuePhp;
  const hostDecides = input.outcome.mode === 'host_decides';
  const status: BookingRefundRow['status'] =
    amountDue > 0
      ? str(input.booking.guest_email)
        ? 'awaiting_guest_details'
        : 'pending'
      : hostDecides && input.outcome.amountPaidPhp > 0
        ? 'pending'
        : 'not_due';

  const organizationId = await resolveOrganizationIdForProperty(propertyId).catch(() => null);

  const payload = {
    booking_id: bookingId,
    property_id: propertyId,
    organization_id: organizationId,
    kind: 'cancellation' as const,
    amount_due_php: amountDue,
    breakdown: {
      ...input.outcome,
      reasonCode: input.reasonCode,
      initiator: input.initiator,
      overrideNote: input.overrideNote ?? null,
    },
    status,
    created_by: input.createdBy ?? null,
  };

  const sb = createServiceClient();
  const { data: existing } = await sb
    .from('booking_refunds')
    .select('id, status')
    .eq('booking_id', bookingId)
    .eq('kind', 'cancellation')
    .maybeSingle();

  if (existing?.id) {
    // A sent refund is final; never rewrite the amount after the host paid.
    if (existing.status === 'sent') {
      const { data: current } = await sb
        .from('booking_refunds')
        .select(BOOKING_REFUND_COLUMNS)
        .eq('id', existing.id)
        .maybeSingle();
      return (current as BookingRefundRow | null) ?? null;
    }
    const { data: updated, error: updateError } = await sb
      .from('booking_refunds')
      .update(payload)
      .eq('id', existing.id)
      .select(BOOKING_REFUND_COLUMNS)
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    return (updated as BookingRefundRow | null) ?? null;
  }

  const { data: inserted, error: insertError } = await sb
    .from('booking_refunds')
    .insert(payload)
    .select(BOOKING_REFUND_COLUMNS)
    .maybeSingle();
  if (insertError) throw new Error(insertError.message);
  return (inserted as BookingRefundRow | null) ?? null;
}

export async function loadBookingRefund(bookingId: string): Promise<BookingRefundRow | null> {
  const { data, error } = await createServiceClient()
    .from('booking_refunds')
    .select(BOOKING_REFUND_COLUMNS)
    .eq('booking_id', bookingId)
    .eq('kind', 'cancellation')
    .maybeSingle();
  if (error) return null;
  return (data as BookingRefundRow | null) ?? null;
}

/**
 * Self-heal: a cancelled booking should always have its refund row. If the
 * original write crashed between the status change and the refund insert, the
 * next read recreates it from the snapshot and the recorded payments.
 */
export async function ensureCancellationRefund(input: {
  booking: BookingRow;
  outcome: CancellationOutcome;
}): Promise<BookingRefundRow | null> {
  const bookingId = str(input.booking.id);
  if (!bookingId) return null;
  const existing = await loadBookingRefund(bookingId);
  if (existing) return existing;
  const initiator = (str(input.booking.cancelled_by) || 'guest') as CancellationInitiator;
  const reasonCode = str(input.booking.cancellation_reason_code) || 'other';
  try {
    return await upsertCancellationRefund({
      booking: input.booking,
      outcome: input.outcome,
      initiator,
      reasonCode,
    });
  } catch (err) {
    console.error('[cancellation] refund self-heal failed:', err);
    return null;
  }
}

export async function loadOpenCancellationRequest(bookingId: string) {
  const { data, error } = await createServiceClient()
    .from('booking_cancellation_requests')
    .select(CANCELLATION_REQUEST_COLUMNS)
    .eq('booking_id', bookingId)
    .eq('status', 'open')
    .maybeSingle();
  if (error) return null;
  return data as Record<string, unknown> | null;
}

async function resolveOpenRequest(
  bookingId: string,
  status: 'approved' | 'declined' | 'withdrawn' | 'expired',
  resolvedBy: string | null,
  hostMessage?: string | null
) {
  const sb = createServiceClient();
  const { data } = await sb
    .from('booking_cancellation_requests')
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
      ...(hostMessage !== undefined ? { host_message: hostMessage } : {}),
    })
    .eq('booking_id', bookingId)
    .eq('status', 'open')
    .select('id')
    .maybeSingle();
  if (data?.id) {
    await sb
      .from('guest_submissions')
      .update({ cancellation_requested_at: null })
      .eq('id', bookingId);
  }
  return data?.id ? String(data.id) : null;
}

export async function cancelBooking(input: {
  booking: BookingRow;
  initiator: CancellationInitiator;
  reasonCode: CancellationReasonCode;
  reasonNote?: string | null;
  overrideRefundPhp?: number | null;
  overrideNote?: string | null;
  notifyGuest?: boolean;
  actor: ActorContext;
  devControls?: Record<string, boolean>;
}): Promise<CancelBookingResult> {
  const booking = input.booking;
  const bookingId = str(booking.id);
  const propertyId = str(booking.property_id);
  const status = str(booking.status);

  if (!bookingId || !propertyId) {
    throw new CancellationNotAllowedError('Booking not found', 'not_found', 404);
  }
  if (status === 'CANCELLED') {
    const refund = await loadBookingRefund(bookingId);
    const context = await loadPropertyCancellationContext(propertyId);
    const snapshot = await ensureBookingSnapshot(booking);
    return {
      booking,
      outcome: computeOutcomeForBooking({
        booking,
        policy: snapshot?.policy ?? context.policy,
        checkInTime: context.checkInTime,
        initiator: input.initiator,
      }),
      refund,
      alreadyCancelled: true,
    };
  }

  if (input.initiator === 'guest') {
    const context = await loadPropertyCancellationContext(propertyId);
    if (!isGuestCancellable(status, str(booking.check_in_date), context.checkInTime)) {
      throw new CancellationNotAllowedError(
        'This booking can no longer be cancelled from your account.',
        'not_cancellable'
      );
    }
  } else if (!isHostCancellable(status)) {
    throw new CancellationNotAllowedError('This booking cannot be cancelled.', 'not_cancellable');
  }

  const context = await loadPropertyCancellationContext(propertyId);
  const snapshot = await ensureBookingSnapshot(booking);
  const policy = snapshot?.policy ?? context.policy;
  const display = resolveCancellationPolicyDisplay(policy);
  const outcome = computeOutcomeForBooking({
    booking,
    policy,
    checkInTime: context.checkInTime,
    initiator: input.initiator,
    overrideRefundPhp: input.overrideRefundPhp,
  });

  const result = await WorkflowOrchestrator.transition(
    bookingId,
    'CANCELLED',
    {
      cancellation: {
        initiator: input.initiator,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote ?? null,
        refundDuePhp: outcome.refundDuePhp,
        refundPercent: outcome.refundPercent,
        notifyGuest: input.notifyGuest !== false,
        policyTitle: snapshot?.rendered.title ?? display.title,
      },
    },
    { ...(input.devControls ?? {}) },
    true,
    input.actor
  );

  const refreshed = (await DatabaseService.getBookingById(bookingId)) ?? result.booking ?? booking;

  let refund: BookingRefundRow | null = null;
  try {
    refund = await upsertCancellationRefund({
      booking: refreshed,
      outcome,
      initiator: input.initiator,
      reasonCode: input.reasonCode,
      overrideNote: input.overrideNote ?? null,
      createdBy: input.actor.userId ?? null,
    });
  } catch (refundErr) {
    // The cancellation already committed. Never fail the request here; the next
    // trip/booking read self-heals the refund row via `ensureCancellationRefund`.
    console.error('[cancellation] refund row create failed (non-fatal):', refundErr);
  }

  const resolvedRequestId = await resolveOpenRequest(
    bookingId,
    'approved',
    input.actor.userId ?? null
  );

  if (resolvedRequestId) {
    await logActivity({
      action: 'booking.cancellation_request_approved',
      organizationId: await resolveOrganizationIdForProperty(propertyId).catch(() => ''),
      propertyId,
      actor: input.actor,
      targetType: 'booking',
      targetId: bookingId,
      targetLabel: str(refreshed.primary_guest_name) || null,
      metadata: { request_id: resolvedRequestId, initiator: input.initiator },
    });
  }

  return { booking: refreshed, outcome, refund, alreadyCancelled: false };
}

// ─── Cancellation requests ───────────────────────────────────────────────────

export type CancellationRequestRow = {
  id: string;
  booking_id: string;
  property_id: string;
  status: 'open' | 'approved' | 'declined' | 'withdrawn' | 'expired';
  reason_code: string;
  reason_note: string | null;
  host_message: string | null;
  requested_at: string;
  resolved_at: string | null;
};

export async function createCancellationRequest(input: {
  booking: BookingRow;
  reasonCode: CancellationReasonCode;
  reasonNote?: string | null;
  actor: ActorContext;
}): Promise<CancellationRequestRow> {
  const booking = input.booking;
  const bookingId = str(booking.id);
  const propertyId = str(booking.property_id);
  const status = str(booking.status);
  const context = await loadPropertyCancellationContext(propertyId);
  if (!isGuestCancellable(status, str(booking.check_in_date), context.checkInTime)) {
    throw new CancellationNotAllowedError(
      'This booking can no longer be cancelled from your account.',
      'not_cancellable'
    );
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('booking_cancellation_requests')
    .insert({
      booking_id: bookingId,
      property_id: propertyId,
      status: 'open',
      reason_code: input.reasonCode,
      reason_note: input.reasonNote?.trim() || null,
    })
    .select(CANCELLATION_REQUEST_COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      throw new CancellationNotAllowedError(
        'A cancellation request is already open for this booking.',
        'request_already_open'
      );
    }
    throw new Error(error.message);
  }

  await sb
    .from('guest_submissions')
    .update({ cancellation_requested_at: new Date().toISOString() })
    .eq('id', bookingId);

  const organizationId = await resolveOrganizationIdForProperty(propertyId).catch(() => null);
  if (organizationId) {
    const guestName = str(booking.primary_guest_name) || 'A guest';
    await createNotification({
      organizationId,
      propertyId,
      type: 'booking_cancellation_requested',
      title: 'Cancellation requested',
      body: `${guestName} asked to cancel their booking.`,
      bookingId,
      metadata: { reason_code: input.reasonCode },
      dedupeKey: `${bookingId}:cancellation_requested`,
    });
  }

  await logActivity({
    action: 'booking.cancellation_requested',
    organizationId: organizationId ?? '',
    propertyId,
    actor: input.actor,
    targetType: 'booking',
    targetId: bookingId,
    targetLabel: str(booking.primary_guest_name) || null,
    metadata: { reason_code: input.reasonCode },
  });

  return data as CancellationRequestRow;
}

export async function withdrawCancellationRequest(input: {
  bookingId: string;
  actor: ActorContext;
}): Promise<boolean> {
  const resolved = await resolveOpenRequest(input.bookingId, 'withdrawn', input.actor.userId ?? null);
  if (!resolved) return false;
  const { data } = await createServiceClient()
    .from('guest_submissions')
    .select('property_id, primary_guest_name')
    .eq('id', input.bookingId)
    .maybeSingle();
  const propertyId = str(data?.property_id);
  const organizationId = propertyId
    ? await resolveOrganizationIdForProperty(propertyId).catch(() => null)
    : null;
  if (organizationId) {
    await logActivity({
      action: 'booking.cancellation_request_withdrawn',
      organizationId,
      propertyId,
      actor: input.actor,
      targetType: 'booking',
      targetId: input.bookingId,
      targetLabel: str(data?.primary_guest_name) || null,
      metadata: { request_id: resolved },
    });
  }
  return true;
}

export async function declineCancellationRequest(input: {
  bookingId: string;
  requestId: string;
  hostMessage?: string | null;
  actor: ActorContext;
}): Promise<boolean> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('booking_cancellation_requests')
    .update({
      status: 'declined',
      resolved_at: new Date().toISOString(),
      resolved_by: input.actor.userId ?? null,
      host_message: input.hostMessage?.trim() || null,
    })
    .eq('id', input.requestId)
    .eq('booking_id', input.bookingId)
    .eq('status', 'open')
    .select('id, property_id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) return false;

  await sb
    .from('guest_submissions')
    .update({ cancellation_requested_at: null })
    .eq('id', input.bookingId);

  const propertyId = str(data.property_id);
  const organizationId = await resolveOrganizationIdForProperty(propertyId).catch(() => null);
  if (organizationId) {
    await logActivity({
      action: 'booking.cancellation_request_declined',
      organizationId,
      propertyId,
      actor: input.actor,
      targetType: 'booking',
      targetId: input.bookingId,
      targetLabel: null,
      metadata: { request_id: input.requestId },
    });
  }
  return true;
}

/** Requests expire at check-in. Called by the refund reminder cron and read paths. */
export async function expireStaleCancellationRequests(): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('booking_cancellation_requests')
    .select('id, booking_id, property_id, guest_submissions!inner(check_in_date, check_in_time, status)')
    .eq('status', 'open')
    .limit(500);

  let expired = 0;
  const now = new Date();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const booking = row.guest_submissions as Record<string, unknown> | undefined;
    if (!booking) continue;
    if (str(booking.status) === 'CANCELLED') {
      await resolveOpenRequest(String(row.booking_id), 'approved', null);
      continue;
    }
    const checkIn = manilaCheckInInstant(str(booking.check_in_date), str(booking.check_in_time));
    if (checkIn && now.getTime() >= checkIn.getTime()) {
      await resolveOpenRequest(String(row.booking_id), 'expired', null);
      expired += 1;
    }
  }
  return expired;
}

export function buildGuestCancellationPayload(input: {
  booking: BookingRow;
  snapshot: CancellationPolicySnapshot | null;
  outcome: CancellationOutcome;
  openRequest: Record<string, unknown> | null;
  refund: BookingRefundRow | null;
  checkInTime: string;
}) {
  const booking = input.booking;
  const policy = input.snapshot?.policy ?? null;
  const display = resolveCancellationPolicyDisplay(policy);
  const now = new Date();
  const guestCancellable = isGuestCancellable(
    str(booking.status),
    str(booking.check_in_date),
    input.checkInTime,
    now
  );
  const mustRequest = guestMustRequestCancellation(booking);
  const policyBlocked = policy === null || policy.needsReview;
  const canCancel =
    guestCancellable &&
    !input.openRequest &&
    !mustRequest &&
    !policyBlocked &&
    str(booking.status) !== 'CANCELLED' &&
    !str(booking.external_source);

  return {
    policy: {
      title: input.snapshot?.rendered.title || display.title,
      description: input.snapshot?.rendered.description || display.description,
      shortLabel: input.snapshot?.rendered.shortLabel || display.shortLabel,
      timeline: display.timeline,
      fallbackRefundPercent: display.fallbackRefundPercent,
      needsReview: display.needsReview,
      unset: display.unset,
      capturedFrom: input.snapshot?.capturedFrom ?? null,
    },
    outcome: input.outcome,
    nonRefundable: isCancellationPolicyNonRefundable(display),
    canCancel,
    canRequest:
      guestCancellable &&
      !input.openRequest &&
      str(booking.status) !== 'CANCELLED' &&
      !str(booking.external_source) &&
      (mustRequest || policyBlocked),
    canWithdraw: Boolean(input.openRequest),
    request: input.openRequest
      ? {
          id: String(input.openRequest.id),
          status: String(input.openRequest.status),
          reasonCode: String(input.openRequest.reason_code),
          requestedAt: String(input.openRequest.requested_at),
          hostMessage: str(input.openRequest.host_message) || null,
        }
      : null,
    refund: input.refund
      ? {
          amountPhp: Number(input.refund.amount_due_php) || 0,
          status: input.refund.status,
          sentAt: input.refund.sent_at,
          method: input.refund.method,
          proofUrl: input.refund.proof_url,
        }
      : null,
  };
}

export { buildActorContext };