/**
 * submit-pay-parking — Public POST to save pay-parking vehicle details on a property booking.
 *
 * Legacy guest pay-parking URLs redirect into the marketplace; this endpoint remains for
 * backward-compatible vehicle-field updates only — it does not send parking owner emails.
 *
 * Body: { bookingId, carPlateNumber, carBrandModel, carColor }
 * Parking rate is read from the database only (set by admin before sharing the link).
 * Does not change booking workflow status.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { isBookingStatus, isPostPendingDocumentsStatus } from '../_shared/statusMachine.ts';
import { antiSpamGate } from '../_shared/antiSpam.ts';
import { logGuestActivity } from '../_shared/guestActivity.ts';
import { authorizeGuestBookingAccess, guestBookingAccessTokenFromRequest } from '../_shared/guestBookingAccessToken.ts';
import { captureFaultIfServerError } from '../_shared/httpResponse.ts';

type SubmitBody = {
  bookingId?: string;
  carPlateNumber?: string;
  carBrandModel?: string;
  carColor?: string;
};

function resolveParkingRateGuest(row: Record<string, unknown>): number {
  const raw = row.parking_rate_guest;
  if (raw != null && raw !== '') {
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 400;
}

function validateBody(body: SubmitBody): string | null {
  const plate = (body.carPlateNumber ?? '').trim();
  const brand = (body.carBrandModel ?? '').trim();
  const color = (body.carColor ?? '').trim();
  if (!plate) return 'Car plate number is required';
  if (!brand) return 'Car brand and model is required';
  if (!color) return 'Car color is required';
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error(`Method ${req.method} not allowed`);
    }

    const body = (await req.json().catch(() => null)) as SubmitBody | null;

    // Anti-spam: bot heuristics → Turnstile → durable rate limit.
    // Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
    const antiSpamBlocked = await antiSpamGate(req, (body ?? {}) as Record<string, unknown>, {
      scope: 'submit-pay-parking',
      rateLimit: { limit: 15, windowSec: 60 },
    });
    if (antiSpamBlocked) return antiSpamBlocked;

    const bookingId = (body?.bookingId ?? '').trim();
    if (!bookingId) throw new Error('bookingId is required');

    const validationError = body ? validateBody(body) : 'Invalid body';
    if (validationError) throw new Error(validationError);

    const existing = await DatabaseService.getBookingById(bookingId);
    if (!existing) throw new Error('Booking not found');
    if (existing.status === 'CANCELLED') {
      throw new Error('This booking was cancelled — parking cannot be added');
    }

    const accessToken = guestBookingAccessTokenFromRequest(req, body);
    const accessCheck = await authorizeGuestBookingAccess({
      bookingIdFromPath: bookingId,
      accessTokenFromQuery: accessToken,
      bookingCreatedAt: (existing as Record<string, unknown>).created_at as string | null,
    });
    if (!accessCheck.ok) {
      return new Response(
        JSON.stringify({ success: false, error: accessCheck.message }),
        { status: accessCheck.status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const parkingRateGuest = resolveParkingRateGuest(existing as Record<string, unknown>);

    const patch: Record<string, unknown> = {
      need_parking: true,
      car_plate_number: (body!.carPlateNumber ?? '').trim().toUpperCase(),
      car_brand_model: (body!.carBrandModel ?? '').trim(),
      car_color: (body!.carColor ?? '').trim(),
      parking_rate_guest: parkingRateGuest,
    };

    const rawStatus = existing.status as string;
    if (
      existing.parking_completed_at ||
      (isBookingStatus(rawStatus) && isPostPendingDocumentsStatus(rawStatus))
    ) {
      patch.parking_completed_at = null;
    }

    await DatabaseService.setWorkflowFields(bookingId, patch);

    await logGuestActivity({
      req,
      action: 'guest.pay_parking_submitted',
      propertyId: (existing.property_id as string | null) ?? null,
      guest: { name: (existing.primary_guest_name as string | null) ?? null },
      targetId: bookingId,
      targetLabel: (existing.primary_guest_name as string | null) ?? null,
      metadata: { car_plate: patch.car_plate_number },
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          bookingId,
          broadcastSent: false,
          sentToOwnerEmail: null,
          broadcastResult: null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[submit-pay-parking]', error);
    await captureFaultIfServerError(req, error, 'submit-pay-parking');
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
