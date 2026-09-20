import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { minutesBetweenTimes } from '../_shared/cleaningBuffer.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { sendNewBookingRequestNotify } from '../_shared/emailService.ts';
import { resolveGuestFormSettings } from '../_shared/guestFormSettings.ts';
import { propertyAutomationEnabled } from '../_shared/propertyAutomationToggles.ts';
import { notifyTelegramNewBookingRequest } from '../_shared/telegramMarketing.ts';
import { notifyTelegramAdminNewBooking } from '../_shared/telegramAdmin.ts';
import { notifyTelegramStaffSameDayCheckIn } from '../_shared/telegramStaff.ts';
import { compareFormData, shouldRevertReadyForCheckinToPendingReview } from '../_shared/utils.ts';
import {
  shouldRevertGuestFieldEditsToPendingReview,
  canGuestPublicUpdateForm,
} from '../_shared/statusMachine.ts';
import { refreshGuestStayGuideAccessWindow } from '../_shared/guestStayGuide.ts';
import type { GuestSubmission } from '../_shared/types.ts';
import { createNotification } from '../_shared/notificationService.ts';
import { bookingNotificationMetadata } from '../_shared/notificationEnrichment.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  resolvePublicPropertyId,
  resolveOrganizationIdForProperty,
} from '../_shared/propertyScope.ts';
import { createServiceClient, tryGetAuthenticatedUser } from '../_shared/orgAuth.ts';
import { applyVoucherToBooking, assertVoucherEligible } from '../_shared/voucherRedemption.ts';
import { linkGuestBookingsByEmail } from '../_shared/guestProfileService.ts';
import { checkIpRateLimit, clientIpFromRequest } from '../_shared/publicRateLimit.ts';
import { capturePostHogEvent, capturePostHogException } from '../_shared/posthog.ts';
import { antiSpamGate } from '../_shared/antiSpam.ts';
import {
  validateGuestFormCheckOutAfterCheckIn,
  validateGuestFormFormatFields,
} from '../_shared/guestFormSubmitValidation.ts';
import {
  authorizeGuestBookingAccess,
  guestBookingAccessTokenFromRequest,
  mintGuestBookingAccessToken,
} from '../_shared/guestBookingAccessToken.ts';
import { maintenanceModeResponse } from '../_shared/platformSettingsCache.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    console.log('Starting form submission process...');

    // Only allow POST requests
    if (req.method !== 'POST') {
      throw new Error(`Method ${req.method} not allowed`);
    }

    const maintenance = await maintenanceModeResponse(req);
    if (maintenance) return maintenance;

    // Generous per-IP throttle — real guests submit/edit a handful of times at most;
    // this only blunts scripted spam/abuse of the unauthenticated public endpoint.
    const ip = clientIpFromRequest(req);
    const rate = checkIpRateLimit('submit-form', ip, 20, 60_000);
    if (!rate.allowed) {
      await capturePostHogEvent('guest_form_rejected', {
        logPrefix: 'submit-form',
        request: req,
        system: true,
        properties: { reason: 'rate_limited' },
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Too many requests. Please wait a moment.' }),
        { status: 429, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Get URL parameters
    const url = new URL(req.url);
    const propertyId = await resolvePublicPropertyId(url);

    // Check if we're in production (Supabase Edge Functions have DENO_DEPLOYMENT_ID)
    const isProduction = Deno.env.get('DENO_DEPLOYMENT_ID') !== undefined;

    // Get and process form data
    const formData = await req.formData();

    // Layer 2/3 anti-spam: bot heuristics → Turnstile → durable rate limit.
    // Returns a ready-to-send Response (with CORS + captchaFailed/rateLimited
    // flags) when the caller should be blocked; null when they pass. The L1
    // in-memory `checkIpRateLimit` above stays as a cheap burst dampener.
    // Plan: docs/workflow/for-testing/captcha-anti-spam-hardening.md
    const antiSpamBlocked = await antiSpamGate(req, formData, {
      scope: 'submit-form',
      rateLimit: { limit: 20, windowSec: 60 },
    });
    if (antiSpamBlocked) return antiSpamBlocked;

    /**
     * Side-effect flags: production always runs the full happy path (ignore client).
     * Non-production reads FormData first, then legacy URL query (backward compat).
     */
    const readSubmitFlag = (name: string, defaultWhenOmitted: boolean): boolean => {
      if (isProduction) return true;
      const fromBody = formData.get(name);
      if (fromBody === 'true' || fromBody === 'false') return fromBody === 'true';
      const fromUrl = url.searchParams.get(name);
      if (fromUrl === 'true' || fromUrl === 'false') return fromUrl === 'true';
      return defaultWhenOmitted;
    };

    const isSaveToDatabaseEnabled = readSubmitFlag('saveToDatabase', true);
    const isSaveImagesToStorageEnabled = readSubmitFlag('saveImagesToStorage', true);
    /** New Booking Request → `EMAIL_REPLY_TO`; guest form dev panel sends explicit `sendEmail=false` when unchecked. */
    const isSendEmailEnabled = readSubmitFlag('sendEmail', true);

    // Log enabled features for debugging
    console.log('🎛️ API Action Flags:');
    console.log(`  Environment: ${isProduction ? '🌐 PRODUCTION' : '💻 DEVELOPMENT'}`);
    console.log(`  Save to Database: ${isSaveToDatabaseEnabled ? '✅' : '❌'}`);
    console.log(`  Save Images to Storage: ${isSaveImagesToStorageEnabled ? '✅' : '❌'}`);
    console.log(
      '  Generate PDF: ❌ (filled GAF/pet PDFs run on admin PENDING_REVIEW → documents transition)'
    );
    console.log('  Send workflow emails: ❌ (GAF / ack / pet / parking only on admin transitions)');
    console.log(
      `  New Booking Request email (EMAIL_REPLY_TO): ${isSendEmailEnabled ? '✅' : '❌'} (FormData/sendEmail, default on — only sent after a DB save with an id; not this flag alone)`
    );
    console.log('---');

    // Extract check-in and check-out dates and booking ID to check for overlaps
    const checkInDate = formData.get('checkInDate') as string;
    const checkOutDate = formData.get('checkOutDate') as string;
    let bookingId = formData.get('bookingId') as string;

    // Sanitize bookingId to remove any query parameters or extra characters
    // This prevents UUID validation errors if the bookingId was contaminated
    if (bookingId) {
      bookingId = bookingId.split('?')[0].split('&')[0].trim();
    }

    console.log('📅 Received dates for overlap check:');
    console.log('  Check-in:', checkInDate);
    console.log('  Check-out:', checkOutDate);
    console.log('  Booking ID:', bookingId);

    const dateOrder = validateGuestFormCheckOutAfterCheckIn(checkInDate, checkOutDate);
    if (!dateOrder.ok) throw new Error(dateOrder.message);

    const formatValidation = validateGuestFormFormatFields(formData);
    if (!formatValidation.ok) throw new Error(formatValidation.message);

    // Check for overlapping bookings (only if saving to database)
    if (isSaveToDatabaseEnabled) {
      console.log('🔍 Starting overlap check...');
      const { hasOverlap, overlappingBookings, blockedByOwner } =
        await DatabaseService.checkOverlappingBookings(
          checkInDate,
          checkOutDate,
          bookingId,
          propertyId
        );

      if (blockedByOwner) {
        console.error('❌ OWNER-BLOCKED DATES SELECTED!');
        throw new Error('DATES_BLOCKED: Selected dates are unavailable.');
      }

      if (hasOverlap) {
        console.error('❌ BOOKING OVERLAP DETECTED!');
        console.error(
          'Overlapping booking ids:',
          (overlappingBookings ?? []).map((b: { id: string }) => b.id)
        );
        throw new Error(
          'BOOKING_OVERLAP: The selected dates are already booked. Please screenshot this message and contact your host to further assist you.'
        );
      }

      console.log('✅ No overlaps found, proceeding with submission...');

      // Enforce the property's cleaning buffer on same-day turnovers — mirrors the
      // guest form's client-side check (guestFormSchema.ts) as the source of truth.
      const checkInTime = (formData.get('checkInTime') as string) || '';
      const checkOutTime = (formData.get('checkOutTime') as string) || '';
      const { cleaningBufferMinutes } = await resolveGuestFormSettings(propertyId ?? '');

      if (cleaningBufferMinutes && checkInTime && checkOutTime) {
        const adjacent = await DatabaseService.getAdjacentBookings(
          checkInDate,
          checkOutDate,
          bookingId,
          propertyId
        );

        for (const ab of adjacent) {
          if (ab.check_out_date === checkInDate && ab.check_out_time) {
            const gapMinutes = minutesBetweenTimes(ab.check_out_time, checkInTime);
            if (gapMinutes < cleaningBufferMinutes) {
              throw new Error(
                `CLEANING_BUFFER: Check-in must be at least ${cleaningBufferMinutes} minutes after the previous guest's checkout. Please pick a later check-in time.`
              );
            }
          }
          if (ab.check_in_date === checkOutDate && ab.check_in_time) {
            const gapMinutes = minutesBetweenTimes(checkOutTime, ab.check_in_time);
            if (gapMinutes < cleaningBufferMinutes) {
              throw new Error(
                `CLEANING_BUFFER: Check-out must be at least ${cleaningBufferMinutes} minutes before the next guest's check-in. Please pick an earlier check-out time.`
              );
            }
          }
        }
      }
    } else {
      console.log('⚠️ Skipping overlap check (saveToDatabase=false)');
    }

    // Check if this is an update and compare data for changes (only if saving to database)
    let hasDataChanges = true;
    let existingData = null;
    let revertReadyForCheckinToPendingReview = false;
    let guestFormChangedFields: string[] = [];

    if (isSaveToDatabaseEnabled && bookingId) {
      console.log('🔍 Checking for data changes...');

      existingData = await DatabaseService.getRawData(bookingId);

      if (existingData) {
        const authz = await authorizeGuestBookingAccess({
          bookingIdFromPath: bookingId,
          accessTokenFromQuery: guestBookingAccessTokenFromRequest(req, formData),
          bookingCreatedAt: (existingData.created_at as string | null | undefined) ?? null,
        });
        if (!authz.ok) {
          return new Response(JSON.stringify({ success: false, error: authz.message }), {
            status: authz.status,
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
          });
        }

        if (!canGuestPublicUpdateForm(existingData.status)) {
          throw new Error(
            'GUEST_FORM_LOCKED: This booking has already been reviewed. Contact your host on Facebook or Airbnb to request changes.'
          );
        }

        const comparison = compareFormData(formData, existingData);
        hasDataChanges = comparison.hasChanges;
        guestFormChangedFields = comparison.changedFields;

        if (!hasDataChanges) {
          console.log(
            'ℹ️ No changes detected, skipping processing and redirecting to success page'
          );
          if (isSendEmailEnabled) {
            console.log(
              '[submit-form] New booking request notify skipped: no data changes (same booking update)'
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: 'No changes detected',
              data: { id: bookingId },
              skipped: true,
            }),
            {
              headers: {
                ...corsHeaders(req),
                'Content-Type': 'application/json',
              },
            }
          );
        }

        revertReadyForCheckinToPendingReview =
          shouldRevertGuestFieldEditsToPendingReview(existingData.status) &&
          shouldRevertReadyForCheckinToPendingReview(comparison.changedFields);

        console.log(
          `✅ Changes detected (${comparison.changedFields.length} fields), proceeding with update...`
        );
        console.log('Changed fields:', comparison.changedFields);
        if (revertReadyForCheckinToPendingReview) {
          console.log(
            `↩️ ${existingData.status} + workflow-sensitive edits → status will revert to PENDING_REVIEW`
          );
        }
      }
    } else if (!isSaveToDatabaseEnabled) {
      console.log('⚠️ Skipping change detection check (saveToDatabase=false)');
    }

    const isNewGuestSubmission = isSaveToDatabaseEnabled && !!bookingId && !existingData;

    const guestUser = await tryGetAuthenticatedUser(req);

    const appliedVoucherSourceBookingId = (
      typeof formData.get('appliedVoucherSourceBookingId') === 'string'
        ? (formData.get('appliedVoucherSourceBookingId') as string)
        : ''
    ).trim();

    const guestEmailForVoucher =
      (typeof formData.get('guestEmail') === 'string'
        ? (formData.get('guestEmail') as string)
        : '') ||
      guestUser?.email ||
      '';

    // Fail closed before DB write so a bad voucher never leaves an orphan booking.
    if (isSaveToDatabaseEnabled && appliedVoucherSourceBookingId && propertyId && bookingId) {
      if (!guestUser?.id) {
        throw new Error('VOUCHER_AUTH: Sign in to apply a voucher.');
      }
      const supabase = createServiceClient();
      await linkGuestBookingsByEmail(supabase, guestUser);
      await assertVoucherEligible(supabase, {
        redeemingBookingId: bookingId,
        propertyId,
        guestUserId: guestUser.id,
        guestEmail: guestEmailForVoucher,
        sourceBookingId: appliedVoucherSourceBookingId,
      });
    }

    const { data, submissionData, validIdUrl, paymentReceiptUrl, petVaccinationUrl, petImageUrl } =
      await DatabaseService.processFormData(
        formData,
        isSaveToDatabaseEnabled,
        isSaveImagesToStorageEnabled,
        revertReadyForCheckinToPendingReview,
        propertyId,
        guestUser?.id,
        revertReadyForCheckinToPendingReview ? guestFormChangedFields : []
      );

    let voucherApplied = false;
    let voucherWarning: string | null = null;

    if (
      isSaveToDatabaseEnabled &&
      appliedVoucherSourceBookingId &&
      submissionData?.id &&
      propertyId &&
      guestUser?.id
    ) {
      const supabase = createServiceClient();
      try {
        await applyVoucherToBooking(supabase, {
          redeemingBookingId: String(submissionData.id),
          propertyId,
          guestUserId: guestUser.id,
          guestEmail: guestEmailForVoucher,
          sourceBookingId: appliedVoucherSourceBookingId,
        });
        voucherApplied = true;
      } catch (voucherErr) {
        const msg = voucherErr instanceof Error ? voucherErr.message : String(voucherErr);
        // Rare race after pre-check: keep the booking; guest can rebook without voucher.
        if (msg.startsWith('VOUCHER_')) {
          console.error('[submit-form] voucher apply after save failed:', msg);
          voucherWarning = msg;
        } else {
          throw voucherErr;
        }
      }
    }

    let notifyBooking = submissionData as GuestSubmission;

    const stayDatesChanged = guestFormChangedFields.some(
      (f) => f === 'check_in_date' || f === 'check_out_date'
    );
    if (
      isSaveToDatabaseEnabled &&
      notifyBooking?.id &&
      stayDatesChanged &&
      !revertReadyForCheckinToPendingReview
    ) {
      try {
        await refreshGuestStayGuideAccessWindow(notifyBooking);
      } catch (stayGuideErr) {
        console.error('[submit-form] Stay guide window refresh failed (non-fatal):', stayGuideErr);
      }
    }

    // Workflow emails (GAF, acknowledgement, pet, parking) are only sent by
    // WorkflowOrchestrator on admin transitions. Optional **New Booking Request**
    // notify (`sendEmail` query; default on) — non-fatal if it fails.

    if (isSendEmailEnabled && isSaveToDatabaseEnabled && submissionData?.id) {
      const emailAllowed = await propertyAutomationEnabled(propertyId, 'emailNewBookingRequest');
      if (emailAllowed) {
        try {
          notifyBooking = {
            ...notifyBooking,
            property_id: notifyBooking.property_id ?? propertyId,
          };
          const notifyResult = await sendNewBookingRequestNotify(notifyBooking);
          console.log(
            '[submit-form] New booking request notify ok, Resend id:',
            (notifyResult as { id?: string })?.id ?? JSON.stringify(notifyResult)
          );
        } catch (notifyErr) {
          console.error('[submit-form] New booking request notify failed (non-fatal):', notifyErr);
        }
      } else {
        console.log('[submit-form] New booking request notify skipped (org automation off)');
      }
    } else if (isSendEmailEnabled) {
      const reasons: string[] = [];
      if (!isSaveToDatabaseEnabled) reasons.push('saveToDatabase=false');
      if (!submissionData?.id) reasons.push('no submission id after save');
      console.log(`[submit-form] New booking request notify skipped: ${reasons.join(', ')}`);
    }

    if (isNewGuestSubmission && isSaveToDatabaseEnabled && submissionData?.id) {
      try {
        await notifyTelegramNewBookingRequest({ propertyId });
      } catch (tgErr) {
        console.error('[submit-form] Telegram new-booking notify failed (non-fatal):', tgErr);
      }
      try {
        const adminTg = await notifyTelegramAdminNewBooking(
          notifyBooking as Record<string, unknown>
        );
        console.log('[submit-form] Telegram admin new-booking:', JSON.stringify(adminTg));
      } catch (adminTgErr) {
        console.error(
          '[submit-form] Telegram admin new-booking notify failed (non-fatal):',
          adminTgErr
        );
      }
      try {
        await notifyTelegramStaffSameDayCheckIn(submissionData as Record<string, unknown>);
      } catch (staffTgErr) {
        console.error(
          '[submit-form] Telegram staff same-day check-in notify failed (non-fatal):',
          staffTgErr
        );
      }
      try {
        const organizationId = await resolveOrganizationIdForProperty(propertyId);
        const guestName = String(notifyBooking.primary_guest_name ?? '').trim() || 'A guest';
        await createNotification({
          organizationId,
          propertyId,
          type: 'booking_pending_review',
          title: 'New booking submitted',
          body: `${guestName} submitted a new booking request.`,
          bookingId: submissionData.id,
          metadata: bookingNotificationMetadata(notifyBooking),
          dedupeKey: `${submissionData.id}:booking_pending_review`,
        });
      } catch (notifErr) {
        console.error('[submit-form] Could not create notification (non-fatal):', notifErr);
      }
      try {
        const organizationId = await resolveOrganizationIdForProperty(propertyId);
        const guestName = String(notifyBooking.primary_guest_name ?? '').trim() || null;
        await logActivity({
          action: 'booking.created',
          organizationId,
          propertyId,
          actor: buildActorContext(
            'public_form',
            {
              guest: { name: guestName, email: String(notifyBooking.guest_email ?? '') || null },
            },
            req
          ),
          targetType: 'booking',
          targetId: String(submissionData.id),
          targetLabel: guestName
            ? `${guestName}${notifyBooking.check_in_date ? ` · ${notifyBooking.check_in_date}` : ''}`
            : null,
          metadata: { channel: 'guest_form' },
        });
      } catch (activityErr) {
        console.error('[submit-form] Could not log activity (non-fatal):', activityErr);
      }
    }

    console.log('Form submission process completed successfully');

    if (isSaveToDatabaseEnabled && submissionData?.id) {
      const nightsRaw = Number(submissionData.number_of_nights);
      await capturePostHogEvent('guest_form_submitted', {
        logPrefix: 'submit-form',
        request: req,
        system: true,
        properties: {
          property_id: propertyId,
          booking_source: String(submissionData.booking_source ?? 'unknown'),
          is_update: !isNewGuestSubmission,
          has_pets: submissionData.has_pets === true,
          need_parking: submissionData.need_parking === true,
          nights: Number.isFinite(nightsRaw) ? nightsRaw : undefined,
          reverted_to_pending_review:
            revertReadyForCheckinToPendingReview ||
            (existingData != null &&
              shouldRevertGuestFieldEditsToPendingReview(String(existingData.status)) &&
              guestFormChangedFields.length > 0),
        },
      });
    }

    let guestAccessToken: string | undefined;
    const savedId = submissionData?.id as string | undefined;
    if (isSaveToDatabaseEnabled && savedId) {
      try {
        guestAccessToken = await mintGuestBookingAccessToken(savedId);
      } catch (tokenErr) {
        console.error('[submit-form] guest access token mint failed (non-fatal):', tokenErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: submissionData,
        voucherApplied,
        ...(voucherWarning ? { voucherWarning } : {}),
        ...(guestAccessToken ? { guestAccessToken } : {}),
      }),
      {
        headers: {
          ...corsHeaders(req),
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing form submission:', error);
    await capturePostHogEvent('guest_form_rejected', {
      logPrefix: 'submit-form',
      request: req,
      system: true,
      properties: { reason: 'validation' },
    });
    await capturePostHogException(error, { logPrefix: 'submit-form', request: req });

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders(req),
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
