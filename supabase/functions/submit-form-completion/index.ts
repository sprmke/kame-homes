/**
 * submit-form-completion — the Airbnb/OTA guest completes the normal guest form against an
 * already-ingested booking via `<origin>/form?complete=<token>` (calendar sync Phase 2, §6.5).
 *
 * POST multipart/form-data (same shape as `submit-form`) + `complete=<token>` field or query.
 *
 * Guarantees:
 *  - UPDATEs the existing row, never inserts.
 *  - check_in/out date + time + number_of_nights + booking_source + external_* are taken
 *    from the stored row — dates in the payload are ignored (tamper-proof).
 *  - status stays PENDING_REVIEW; no workflow transition fires.
 *  - overlap scan excludes this row and skips its own `ical_import` block.
 *  - guarded on status = 'PENDING_REVIEW' — a booking the host already advanced returns 409.
 *  - stamps guest_form_completed_at + emits `booking_guest_form_completed`.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { corsHeaders } from '../_shared/cors.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import {
  checkCompletionEligibility,
  markGuestFormCompleted,
  resolveGuestFormCompletion,
} from '../_shared/guestFormCompletion.ts';
import { createNotification } from '../_shared/notificationService.ts';
import { bookingNotificationMetadata } from '../_shared/notificationEnrichment.ts';
import { tryGetAuthenticatedUser } from '../_shared/orgAuth.ts';
import { resolveOrganizationIdForProperty } from '../_shared/propertyScope.ts';
import type { GuestSubmission } from '../_shared/types.ts';
import { capturePostHogEvent, capturePostHogException } from '../_shared/posthog.ts';
import { antiSpamGate } from '../_shared/antiSpam.ts';
import { validateGuestFormFormatFields } from '../_shared/guestFormSubmitValidation.ts';
import { maintenanceModeResponse } from '../_shared/platformSettingsCache.ts';
import { syncReviewIdentityKey } from '../_shared/hostGuestReviewService.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });

  try {
    if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

    const maintenance = await maintenanceModeResponse(req);
    if (maintenance) return maintenance;

    const url = new URL(req.url);
    const formData = await req.formData();

    // Anti-spam: bot heuristics → Turnstile → durable rate limit.
    // Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
    const antiSpamBlocked = await antiSpamGate(req, formData, {
      scope: 'submit-form-completion',
      rateLimit: { limit: 15, windowSec: 60 },
    });
    if (antiSpamBlocked) return antiSpamBlocked;

    const token =
      (formData.get('complete') as string | null)?.trim() || url.searchParams.get('complete') || '';

    if (!token) return json({ success: false, error: 'Missing completion token' }, 400);

    const resolved = await resolveGuestFormCompletion(token);
    if (!resolved.ok) {
      return json(
        {
          success: false,
          error:
            resolved.status === 410
              ? 'This guest-form link has expired'
              : 'This guest-form link is not valid',
        },
        resolved.status
      );
    }

    const booking = resolved.booking;
    const bookingId = String(booking.id);
    const propertyId = String(booking.property_id ?? '').trim();

    // Guard: only completable while still pending review. Once the host advances it, the
    // guest sees a "being processed" message instead of silently overwriting workflow state.
    const eligibility = checkCompletionEligibility(booking);
    if (!eligibility.ok) {
      const gone = eligibility.reason === 'link_expired';
      return json(
        {
          success: false,
          error: gone
            ? 'This stay has already ended'
            : 'This booking is already being processed — please contact your host',
        },
        gone ? 410 : 409
      );
    }

    const formatValidation = validateGuestFormFormatFields(formData);
    if (!formatValidation.ok) {
      return json({ success: false, error: formatValidation.message }, 400);
    }

    // ── Lock server-controlled fields to the stored reservation ──────────────
    formData.set('bookingId', bookingId);
    formData.set('checkInDate', String(booking.check_in_date ?? ''));
    formData.set('checkOutDate', String(booking.check_out_date ?? ''));
    formData.set('checkInTime', String(booking.check_in_time ?? ''));
    formData.set('checkOutTime', String(booking.check_out_time ?? ''));
    formData.set('bookingSource', String(booking.booking_source ?? 'Airbnb'));
    if (booking.number_of_nights != null) {
      formData.set('numberOfNights', String(booking.number_of_nights));
    }

    // ── Overlap check — exclude this row + skip its own OTA block ────────────
    const { hasOverlap, blockedByOwner } = await DatabaseService.checkOverlappingBookings(
      String(booking.check_in_date ?? ''),
      String(booking.check_out_date ?? ''),
      bookingId,
      propertyId || undefined,
      { skipOwnerBlockCheck: true }
    );
    if (blockedByOwner || hasOverlap) {
      return json(
        {
          success: false,
          error:
            'These dates are no longer available. Please screenshot this message and contact your host.',
        },
        409
      );
    }

    const guestUser = await tryGetAuthenticatedUser(req);

    // UPDATE-only: existingBooking is found by bookingId, revert flag false → status
    // untouched, external_* / guest_form_token not in the patch → preserved.
    const { submissionData } = await DatabaseService.processFormData(
      formData,
      true,
      true,
      false,
      propertyId || undefined,
      guestUser?.id,
      []
    );

    // Guarded stamp — no-ops if a concurrent submit already completed it.
    await markGuestFormCompleted(bookingId);

    const completedEmail =
      (submissionData as GuestSubmission | undefined)?.guest_email ??
      (formData.get('guestEmail') as string | null);
    await syncReviewIdentityKey(bookingId, completedEmail);

    // Host notification — the ingested stub now has real guest details to review.
    try {
      const organizationId = propertyId ? await resolveOrganizationIdForProperty(propertyId) : null;
      if (organizationId) {
        const full =
          (submissionData as GuestSubmission) ??
          ((await DatabaseService.getBookingById(bookingId)) as GuestSubmission);
        await createNotification({
          organizationId,
          propertyId,
          type: 'booking_guest_form_completed',
          title: 'Guest form completed',
          body: `${String(full?.primary_guest_name ?? 'The guest').trim() || 'The guest'} finished the check-in form for their imported booking.`,
          bookingId,
          metadata: bookingNotificationMetadata(full),
          dedupeKey: `${bookingId}:guest_form_completed`,
        });
      }
    } catch (notifyErr) {
      console.error('[submit-form-completion] notification failed (non-fatal):', notifyErr);
    }

    await capturePostHogEvent('guest_form_completion_submitted', {
      logPrefix: 'submit-form-completion',
      request: req,
      properties: {
        property_id: propertyId || undefined,
        booking_id: bookingId,
      },
    });

    return json({ success: true, data: { id: bookingId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[submit-form-completion] error:', message);
    await capturePostHogException(error, { logPrefix: 'submit-form-completion', request: req });
    return json({ success: false, error: message }, 400);
  }
});
