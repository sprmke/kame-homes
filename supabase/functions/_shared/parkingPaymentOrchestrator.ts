/**
 * Parking payment — PayMongo checkout creation, webhook fulfillment, and claim release.
 * Mirrors `subscriptionOrchestrator.ts`'s shape for the `parkings` vertical (Phase 3).
 *
 * `releaseParkingClaim` is a low-level primitive only (un-claims the slot, reverts to
 * PENDING_HOST_ACCEPTANCE) — it never decides what happens next. Callers choose: the payment
 * TTL cron resumes the search (`advanceOrTerminateParkingBatch`); a guest cancel terminates to
 * CANCELLED instead. Never skip this split — see `.cursor/rules/parking-workflow.mdc`.
 */

import { createServiceClient, type ParkingRow } from './orgAuth.ts';
import { createNotification } from './notificationService.ts';
import { createPaymongoPaymentLink, phpToCentavos } from './paymongoClient.ts';
import { loadParkingPricing } from './parkingPricing.ts';
import { resolveParkingPlatformSettings } from './parkingPlatformSettings.ts';
import type { ParkingBookingChannel } from './parkingDirectLink.ts';
import { sendParkingConfirmedEmail } from './parkingBroadcastEmail.ts';
import { sendParkingEndorsementEmail } from './parkingEndorsementEmail.ts';
import {
  assertParkingGuestOwnership,
  ParkingGuestOwnershipError,
} from './parkingGuestOwnership.ts';
import { parkingAutomationEnabled } from './parkingAutomationToggles.ts';
import { isSameOrgOwnerOwnedPin, readComplimentaryOwnerParking } from './ownerDefaultParking.ts';
import { isBookingStatus, type BookingStatus } from './statusMachine.ts';
import { extractWebhookInner, readMetadataString } from './paymongoWebhookMetadata.ts';
import { WorkflowOrchestrator } from './workflowOrchestrator.ts';
import { buildActorContext } from './activityLog.ts';
import { logParkingStatusChange } from './parkingActivity.ts';

export class ParkingPaymentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function parseMmDdYyyyUtc(value: string): Date {
  const [mm, dd, yyyy] = value.split('-');
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
}

/** Each occupied night [checkIn, checkOut) as a UTC midnight Date — mirrors parkingBroadcastRanking.ts. */
function nightsInRange(checkInMmDdYyyy: string, checkOutMmDdYyyy: string): Date[] {
  const start = parseMmDdYyyyUtc(checkInMmDdYyyy);
  const end = parseMmDdYyyyUtc(checkOutMmDdYyyy);
  const nights: Date[] = [];
  const cursor = new Date(start);
  while (cursor < end) {
    nights.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

function isWeekendRateDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 5 || day === 6;
}

function toIsoDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export type ParkingPaymentAmounts = {
  nights: number;
  guestChargeTotal: number;
  hostGrossTotal: number;
  commissionPct: number;
  commissionAmount: number;
  hostNetTotal: number;
};

/**
 * Per-night proration for both guest charge and host payout (Phase 4 — replaces Phase 3's
 * averaged-rate × nights approach, since a stay spanning both weekday and weekend nights was
 * previously smoothed into a single blended rate instead of billed per actual night). Resolves
 * live platform settings + host pricing once and snapshots the result onto the transaction row
 * at creation time — a later admin config or pricing change never affects an already-created
 * transaction (decision #4).
 */
export async function computeParkingPaymentAmounts(
  parkingId: string,
  checkInDate: string,
  checkOutDate: string,
  bookingChannel: ParkingBookingChannel = 'standard'
): Promise<ParkingPaymentAmounts> {
  const nightDates = nightsInRange(checkInDate, checkOutDate);
  const nights = Math.max(1, nightDates.length);
  const effectiveNights = nightDates.length > 0 ? nightDates : [parseMmDdYyyyUtc(checkInDate)];

  const [pricing, platformSettings] = await Promise.all([
    loadParkingPricing(parkingId),
    resolveParkingPlatformSettings(),
  ]);

  let guestChargeTotal = 0;
  let hostGrossTotal = 0;
  for (const night of effectiveNights) {
    const weekend = isWeekendRateDay(night);
    guestChargeTotal += weekend
      ? platformSettings.guestRateWeekend
      : platformSettings.guestRateWeekday;

    const override = pricing.dateOverrides[toIsoDateKey(night)];
    hostGrossTotal +=
      override !== undefined
        ? override
        : weekend
          ? pricing.weekendNightlyRate
          : pricing.weekdayNightlyRate;
  }

  guestChargeTotal = round2(guestChargeTotal);
  hostGrossTotal = round2(hostGrossTotal);
  const commissionPct =
    bookingChannel === 'direct_link'
      ? platformSettings.directCommissionPct
      : platformSettings.commissionPct;
  const commissionAmount = round2(hostGrossTotal * commissionPct);
  const hostNetTotal = round2(hostGrossTotal - commissionAmount);

  return {
    nights,
    guestChargeTotal,
    hostGrossTotal,
    commissionPct,
    commissionAmount,
    hostNetTotal,
  };
}

/**
 * Guest-initiated "Pay now" — reuses an existing pending transaction/link if one already
 * exists for this booking (idempotent across repeated clicks), else computes amounts and
 * creates a fresh PayMongo Payment Link.
 */
export async function createParkingPaymentTransaction(
  bookingId: string,
  userId: string,
  userEmail?: string | null
): Promise<{ checkoutUrl: string }> {
  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from('guest_submissions')
    .select(
      'id, status, guest_auth_user_id, guest_email, parking_id, parking_check_in_date, parking_check_out_date, check_in_date, check_out_date, parking_booking_channel'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) throw new ParkingPaymentError('Booking not found', 404);
  try {
    await assertParkingGuestOwnership(supabase, booking, { id: userId, email: userEmail });
  } catch (err) {
    if (err instanceof ParkingGuestOwnershipError) {
      throw new ParkingPaymentError(err.message, err.status);
    }
    throw err;
  }
  if (booking.status !== 'PENDING_PAYMENT') {
    throw new ParkingPaymentError('This request is not awaiting payment', 409);
  }
  const parkingId = String(booking.parking_id ?? '');
  if (!parkingId) throw new ParkingPaymentError('No claimed parking slot', 409);

  const { data: existing } = await supabase
    .from('parking_payment_transactions')
    .select('id, checkout_url')
    .eq('booking_id', bookingId)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing?.checkout_url) {
    return { checkoutUrl: String(existing.checkout_url) };
  }

  const checkInDate = String(booking.parking_check_in_date ?? booking.check_in_date ?? '');
  const checkOutDate = String(booking.parking_check_out_date ?? booking.check_out_date ?? '');
  const bookingChannel =
    (booking.parking_booking_channel as 'standard' | 'direct_link' | null) ?? 'standard';
  const amounts = await computeParkingPaymentAmounts(
    parkingId,
    checkInDate,
    checkOutDate,
    bookingChannel
  );

  const { data: parking } = await supabase
    .from('parkings')
    .select('organization_id, name')
    .eq('id', parkingId)
    .maybeSingle();
  if (!parking) throw new ParkingPaymentError('Parking slot not found', 404);

  const { data: inserted, error: insertError } = await supabase
    .from('parking_payment_transactions')
    .insert({
      booking_id: bookingId,
      parking_id: parkingId,
      organization_id: parking.organization_id,
      guest_charge_total: amounts.guestChargeTotal,
      host_gross_total: amounts.hostGrossTotal,
      commission_pct: amounts.commissionPct,
      host_net_total: amounts.hostNetTotal,
      nights: amounts.nights,
      booking_channel: bookingChannel,
      status: 'pending',
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    throw new ParkingPaymentError('Failed to start payment', 500);
  }

  try {
    const link = await createPaymongoPaymentLink({
      amountCentavos: phpToCentavos(amounts.guestChargeTotal),
      description: `Parking reservation — ${String(parking.name)}`,
      metadata: {
        kind: 'parking_booking',
        transaction_id: String(inserted.id),
        booking_id: bookingId,
      },
    });
    await supabase
      .from('parking_payment_transactions')
      .update({ provider_reference: link.id, checkout_url: link.checkoutUrl })
      .eq('id', inserted.id);
    return { checkoutUrl: link.checkoutUrl };
  } catch (err) {
    await supabase
      .from('parking_payment_transactions')
      .update({
        status: 'failed',
        failure_reason: `Link creation failed: ${(err as Error).message}`.slice(0, 500),
      })
      .eq('id', inserted.id);
    throw new ParkingPaymentError('Failed to create payment link', 500);
  }
}

/**
 * Same-org owner-owned pin with property `complimentaryOwnerParking`: insert a ₱0 paid
 * ledger row and run the normal fulfill path (confirm booking, endorsement, property gate).
 * No PayMongo. Idempotent if already past PENDING_PAYMENT.
 */
export async function fulfillComplimentaryOwnerParking(bookingId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from('guest_submissions')
    .select(
      'id, status, parking_id, linked_property_booking_id, parking_booking_channel, parking_check_in_date, parking_check_out_date, check_in_date, check_out_date'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) throw new ParkingPaymentError('Booking not found', 404);
  if (booking.status !== 'PENDING_PAYMENT') return;

  const parkingId = String(booking.parking_id ?? '');
  const linkedId = String(booking.linked_property_booking_id ?? '').trim();
  if (!parkingId || !linkedId) {
    throw new ParkingPaymentError(
      'Complimentary parking requires a claimed same-org linked stay',
      409
    );
  }

  if (
    !(await isSameOrgOwnerOwnedPin({
      pinnedParkingId: parkingId,
      linkedPropertyBookingId: linkedId,
    }))
  ) {
    throw new ParkingPaymentError('Complimentary parking is only for own-org stays', 403);
  }

  const { data: propertyBooking } = await supabase
    .from('guest_submissions')
    .select('property_id')
    .eq('id', linkedId)
    .maybeSingle();
  if (!propertyBooking?.property_id) {
    throw new ParkingPaymentError('Linked property booking not found', 404);
  }
  const { data: property } = await supabase
    .from('properties')
    .select('settings')
    .eq('id', propertyBooking.property_id)
    .maybeSingle();
  if (!readComplimentaryOwnerParking(property?.settings)) {
    throw new ParkingPaymentError('Complimentary parking is not enabled for this property', 409);
  }

  const { data: parking } = await supabase
    .from('parkings')
    .select('organization_id')
    .eq('id', parkingId)
    .maybeSingle();
  if (!parking?.organization_id) throw new ParkingPaymentError('Parking slot not found', 404);

  const bookingChannel =
    (booking.parking_booking_channel as 'standard' | 'direct_link' | null) ?? 'standard';
  const checkInDate = String(booking.parking_check_in_date ?? booking.check_in_date ?? '');
  const checkOutDate = String(booking.parking_check_out_date ?? booking.check_out_date ?? '');
  const amounts = await computeParkingPaymentAmounts(
    parkingId,
    checkInDate,
    checkOutDate,
    bookingChannel
  );

  const { data: existingPaid } = await supabase
    .from('parking_payment_transactions')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('status', 'paid')
    .maybeSingle();
  if (existingPaid) {
    await fulfillParkingPayment({
      transactionId: String(existingPaid.id),
      paymentMethodType: 'complimentary',
    });
    return;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('parking_payment_transactions')
    .insert({
      booking_id: bookingId,
      parking_id: parkingId,
      organization_id: parking.organization_id,
      guest_charge_total: 0,
      host_gross_total: 0,
      commission_pct: amounts.commissionPct,
      host_net_total: 0,
      nights: amounts.nights,
      booking_channel: bookingChannel,
      provider: 'complimentary',
      status: 'pending',
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    throw new ParkingPaymentError('Failed to record complimentary payment', 500);
  }

  await fulfillParkingPayment({
    transactionId: String(inserted.id),
    paymentMethodType: 'complimentary',
    providerReference: `complimentary:${bookingId}`,
  });
}

type ParkingPaymentTransactionRow = {
  id: string;
  booking_id: string;
  parking_id: string;
  organization_id: string;
  provider_reference: string | null;
  status: string;
};

export async function resolveParkingTransactionFromWebhookPayload(
  payload: Record<string, unknown>
): Promise<ParkingPaymentTransactionRow | null> {
  const supabase = createServiceClient();
  const { inner, metadata } = extractWebhookInner(payload);

  const transactionId = readMetadataString(metadata, 'transaction_id');
  if (transactionId) {
    const { data } = await supabase
      .from('parking_payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .maybeSingle();
    return (data as ParkingPaymentTransactionRow | null) ?? null;
  }

  const linkId =
    (inner?.type === 'link' ? String(inner.id ?? '') : '') ||
    readMetadataString(metadata, 'link_id');
  const providerRef =
    linkId || (inner?.type === 'payment' && typeof inner.id === 'string' ? inner.id : null) || null;
  if (!providerRef) return null;

  const { data } = await supabase
    .from('parking_payment_transactions')
    .select('*')
    .eq('provider_reference', providerRef)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ParkingPaymentTransactionRow | null) ?? null;
}

export async function markParkingPaymentFailed(
  transactionId: string,
  reason: string,
  rawPayload?: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('parking_payment_transactions')
    .update({
      status: 'failed',
      failure_reason: reason.slice(0, 500),
      raw_webhook_payload: rawPayload ?? null,
    })
    .eq('id', transactionId)
    .eq('status', 'pending');
}

/**
 * Fulfills a paid parking payment — marks the transaction paid, confirms the booking
 * (`PENDING_PAYMENT` → `PENDING_REVIEW`), and sends the guest confirmation email (moved here
 * from claim-time — see the Phase 3 plan's decision on gating confirmation on payment).
 * Idempotent (early-returns if already `paid`). PayMongo has already collected payment by the
 * time this runs — a thrown error here must not leave the transaction stuck `pending` forever;
 * mark it `failed` with the real reason so it surfaces for manual reconciliation instead.
 */
export async function fulfillParkingPayment(input: {
  transactionId: string;
  providerReference?: string | null;
  paymentMethodType?: string | null;
  paidAt?: string | null;
  rawPayload?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createServiceClient();

  const { data: txn, error: txnError } = await supabase
    .from('parking_payment_transactions')
    .select('*')
    .eq('id', input.transactionId)
    .maybeSingle();
  if (txnError) throw new Error(txnError.message);
  if (!txn) throw new Error('Parking payment transaction not found');
  if (txn.status === 'paid') return;

  const bookingId = String(txn.booking_id);
  const paidAt = input.paidAt ?? new Date().toISOString();

  try {
    const { data: confirmed, error: confirmError } = await supabase
      .from('guest_submissions')
      .update({ status: 'PENDING_REVIEW', status_updated_at: paidAt, updated_at: paidAt })
      .eq('id', bookingId)
      .eq('status', 'PENDING_PAYMENT')
      .select('*')
      .maybeSingle();
    if (confirmError) throw new Error(confirmError.message);

    if (confirmed) {
      await logParkingStatusChange({
        booking: confirmed,
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'PENDING_REVIEW',
        actor: buildActorContext('webhook', { webhook: 'parking_payment' }),
        metadata: { paid_at: paidAt },
      });
    }

    if (!confirmed) {
      // Booking already moved on (payment-TTL release raced ahead of this webhook, or it was
      // already confirmed by an earlier duplicate delivery) — payment still succeeded
      // server-side, so record it as paid for the audit trail and manual reconciliation
      // instead of forcing a status flip that would fight whatever else wrote to this row.
      // See overview edge case: never create two paid reservations for one guest request.
      await supabase
        .from('parking_payment_transactions')
        .update({
          status: 'paid',
          provider_reference: input.providerReference ?? txn.provider_reference,
          payment_method_type: input.paymentMethodType ?? null,
          paid_at: paidAt,
          raw_webhook_payload: input.rawPayload ?? null,
          failure_reason:
            'Payment succeeded but booking was no longer PENDING_PAYMENT (already released or confirmed) — needs manual review',
        })
        .eq('id', input.transactionId);
      return;
    }

    await supabase
      .from('parking_payment_transactions')
      .update({
        status: 'paid',
        provider_reference: input.providerReference ?? txn.provider_reference,
        payment_method_type: input.paymentMethodType ?? null,
        paid_at: paidAt,
        raw_webhook_payload: input.rawPayload ?? null,
      })
      .eq('id', input.transactionId);

    const guestEmail = String(confirmed.guest_email ?? '').trim();
    const parkingId = String(confirmed.parking_id ?? '');
    if (guestEmail && parkingId) {
      const { data: parkingRow } = await supabase
        .from('parkings')
        .select('*')
        .eq('id', parkingId)
        .maybeSingle();
      if (parkingRow) {
        try {
          const emailEnabled = await parkingAutomationEnabled(
            parkingId,
            'emailParkingGuestConfirmed'
          );
          if (emailEnabled) {
            await sendParkingConfirmedEmail({
              to: guestEmail,
              parking: parkingRow as ParkingRow,
              checkInDate: String(confirmed.parking_check_in_date ?? confirmed.check_in_date ?? ''),
              checkOutDate: String(
                confirmed.parking_check_out_date ?? confirmed.check_out_date ?? ''
              ),
              endorsementNote: confirmed.parking_endorsement_note ?? null,
            });
          }
        } catch (err) {
          console.error(
            '[parkingPaymentOrchestrator] confirmation email failed:',
            err instanceof Error ? err.message : err
          );
        }

        // Isolated from the confirmation email above (and from this outer try) — a Resend
        // outage or missing PMO config must never fail payment fulfillment or leave the
        // transaction stuck. Failure is persisted to endorsement_send_error; the guest sees a
        // "Request Endorsement" retry CTA (see request-parking-endorsement/index.ts).
        try {
          await sendParkingEndorsementEmail({
            bookingId,
            guestName: String(confirmed.primary_guest_name ?? ''),
            guestEmail,
            checkInDate: String(confirmed.parking_check_in_date ?? confirmed.check_in_date ?? ''),
            checkOutDate: String(
              confirmed.parking_check_out_date ?? confirmed.check_out_date ?? ''
            ),
            parking: parkingRow as ParkingRow,
          });
        } catch (err) {
          console.error(
            '[parkingPaymentOrchestrator] endorsement email failed:',
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    // Phase 7 — self-serve marketplace booking, linked back to the property stay it's for
    // (submit-parking-booking-request stamps this). Auto-clear that property booking's
    // PENDING_PARKING_REQUEST gate via the same same-status transition-booking call
    // ParkingRequestForm.tsx's manual "Mark as Complete" already makes — never a raw column
    // write — so every existing side effect/invariant stays intact. Isolated: a failure here
    // must never fail the parking payment itself, same as the email sends above.
    const linkedPropertyBookingId = String(confirmed.linked_property_booking_id ?? '').trim();
    if (linkedPropertyBookingId) {
      try {
        await autoCompletePendingParkingRequest(linkedPropertyBookingId);
      } catch (err) {
        console.error(
          '[parkingPaymentOrchestrator] linked property booking auto-complete failed:',
          err instanceof Error ? err.message : err
        );
      }
    }
  } catch (err) {
    await markParkingPaymentFailed(
      input.transactionId,
      `Fulfillment error (payment was collected — needs manual review): ${(err as Error).message}`,
      input.rawPayload
    );
    throw err;
  }
}

/**
 * Same-status `transition-booking` call, matching what `ParkingRequestForm.tsx`'s manual "Mark
 * as Complete — Pending Parking Request" button already does — never a raw column write.
 * Deliberately omits `parking_fee_included_in_downpayment` so the orchestrator's payment-receipt
 * guard (`assertParkingPaymentReceiptIfRequired`) stays skipped: the fee was paid through the
 * marketplace, not a downpayment receipt upload, so there is no receipt URL to require here.
 */
async function autoCompletePendingParkingRequest(propertyBookingId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: propertyBooking, error } = await supabase
    .from('guest_submissions')
    .select('status, property_id')
    .eq('id', propertyBookingId)
    .maybeSingle();
  if (error || !propertyBooking) {
    throw new Error(`Linked property booking ${propertyBookingId} not found`);
  }

  const currentStatus = String(propertyBooking.status ?? '');
  if (!isBookingStatus(currentStatus)) {
    throw new Error(`Linked property booking has an unrecognized status: ${currentStatus}`);
  }

  await WorkflowOrchestrator.transition(
    propertyBookingId,
    currentStatus as BookingStatus,
    { document_completion_target: 'PENDING_PARKING_REQUEST' },
    {},
    true,
    buildActorContext('webhook', { webhook: 'parking_payment' })
  );

  if (propertyBooking.property_id) {
    const { data: property } = await supabase
      .from('properties')
      .select('organization_id')
      .eq('id', propertyBooking.property_id)
      .maybeSingle();
    if (property?.organization_id) {
      await createNotification({
        organizationId: property.organization_id,
        propertyId: propertyBooking.property_id,
        type: 'booking_parking_matched',
        title: 'Parking matched and paid',
        body: 'A guest self-served parking for this stay through the marketplace — no action needed.',
        bookingId: propertyBookingId,
        dedupeKey: `parking-matched:${propertyBookingId}`,
      });
    }
  }
}

export async function handleParkingPaymentWebhookEvent(
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ handled: boolean; action?: string }> {
  const normalized = eventType.toLowerCase();

  if (normalized === 'payment.failed') {
    const txn = await resolveParkingTransactionFromWebhookPayload(payload);
    if (!txn || txn.status !== 'pending') return { handled: false };
    await markParkingPaymentFailed(txn.id, 'Payment failed', payload);
    return { handled: true, action: 'marked_parking_payment_failed' };
  }

  if (
    normalized === 'payment.paid' ||
    normalized === 'link.payment.paid' ||
    normalized === 'checkout_session.payment.paid'
  ) {
    const { innerAttrs } = extractWebhookInner(payload);
    const source = innerAttrs?.source as Record<string, unknown> | undefined;
    const paymentMethodType = typeof source?.type === 'string' ? source.type : null;
    const paidAtEpoch = innerAttrs?.paid_at;
    const paidAt =
      typeof paidAtEpoch === 'number'
        ? new Date(paidAtEpoch * 1000).toISOString()
        : new Date().toISOString();

    const txn = await resolveParkingTransactionFromWebhookPayload(payload);
    if (!txn || txn.status === 'paid') return { handled: false };

    await fulfillParkingPayment({
      transactionId: txn.id,
      providerReference: txn.provider_reference,
      paymentMethodType,
      paidAt,
      rawPayload: payload,
    });
    return { handled: true, action: 'fulfilled_parking_payment' };
  }

  return { handled: false };
}

/**
 * Un-claims a PENDING_PAYMENT booking back to PENDING_HOST_ACCEPTANCE — the shared low-level
 * primitive for both a payment-TTL timeout and a guest cancel while awaiting payment. Never
 * decides what happens next: the caller advances the search (timeout) or terminates to
 * CANCELLED (guest cancel). See this file's top comment.
 */
export async function releaseParkingClaim(
  bookingId: string
): Promise<{ released: boolean; batchNumber: number | null }> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: released, error } = await supabase
    .from('guest_submissions')
    .update({
      status: 'PENDING_HOST_ACCEPTANCE',
      parking_id: null,
      parking_claimed_at: null,
      parking_endorsement_note: null,
      parking_payment_expires_at: null,
      status_updated_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', bookingId)
    .eq('status', 'PENDING_PAYMENT')
    .select('parking_broadcast_batch_number')
    .maybeSingle();

  if (error) {
    console.error('[parkingPaymentOrchestrator] releaseParkingClaim:', error.message);
    return { released: false, batchNumber: null };
  }
  if (!released) return { released: false, batchNumber: null };

  // Audit trail — a claimed-then-payment-lapsed row is indistinguishable from a plain expiry
  // for reporting purposes, not worth a migration to add a new enum value for.
  await supabase
    .from('parking_booking_broadcasts')
    .update({ response: 'expired', responded_at: nowIso })
    .eq('booking_id', bookingId)
    .eq('response', 'claimed');

  return { released: true, batchNumber: Number(released.parking_broadcast_batch_number ?? 1) };
}
