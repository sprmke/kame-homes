/**
 * claim-sd-voucher — Public POST that idempotently awards a next-stay voucher.
 *
 * Called when the guest taps "Claim it!" after submitting an in-app review.
 * The handler ignores any client `code` and rolls server-side from the
 * property's `voucher_prizes` (or platform defaults). If a voucher is already
 * on the booking, that one is returned instead of rolling again.
 *
 * D3: decoupled from the review — claimable once the stay reaches check-out,
 * whether or not a review was ever submitted. Status guard: `canClaimStayVoucher`.
 * Disabled when `app_settings.vouchers_enabled` is false (unless already awarded).
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import { loadAppSettingsRow } from '../_shared/appSettings.ts';
import { canClaimStayVoucher } from '../_shared/reviewEligibility.ts';
import { createServiceClient, tryGetAuthenticatedUser } from '../_shared/orgAuth.ts';
import { rollVoucher } from '../_shared/voucher.ts';
import {
  jsonResponse,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { antiSpamGate } from '../_shared/antiSpam.ts';
import { logGuestActivity } from '../_shared/guestActivity.ts';
import {
  authorizeGuestBookingAccess,
  guestBookingAccessTokenFromRequest,
} from '../_shared/guestBookingAccessToken.ts';

servePublic('claim-sd-voucher', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  // Anti-spam: Turnstile + durable rate limit. Heuristics are skipped — the
  // "Claim it!" action is a single tap with no form-fill window to time.
  // Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
  const antiSpamBlocked = await antiSpamGate(req, body as Record<string, unknown>, {
    scope: 'claim-sd-voucher',
    rateLimit: { limit: 10, windowSec: 60 },
    heuristics: false,
  });
  if (antiSpamBlocked) return antiSpamBlocked;

  const bookingId = (typeof body.bookingId === 'string' ? body.bookingId : '').trim();
  if (!bookingId) throw new Error('bookingId is required');

  const guestUser = await tryGetAuthenticatedUser(req);
  const row = await DatabaseService.getBookingById(bookingId);
  const authz = await authorizeGuestBookingAccess({
    bookingIdFromPath: bookingId,
    accessTokenFromQuery: guestBookingAccessTokenFromRequest(req, body),
    bookingCreatedAt: (row?.created_at as string | null | undefined) ?? null,
  });
  if (!authz.ok) {
    return jsonResponse(req, { success: false, error: authz.message }, authz.status);
  }
  if (!row || !canClaimStayVoucher(row)) {
    return jsonResponse(
      req,
      {
        success: false,
        error: 'not_available',
        message: 'This form is no longer available for this booking.',
      },
      409
    );
  }

  let code = (row.next_stay_voucher_code ?? null) as string | null;
  let amount = row.next_stay_voucher_amount != null ? Number(row.next_stay_voucher_amount) : null;
  const alreadyAwarded = !!code;

  if (alreadyAwarded && guestUser?.id && !row.guest_user_id) {
    await createServiceClient()
      .from('guest_submissions')
      .update({ guest_user_id: guestUser.id, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .is('guest_user_id', null);
  }

  if (!code) {
    // D3: decoupled from the review — a stay voucher is never conditioned on
    // leaving a review (FTC Consumer Reviews Rule, 16 CFR 465).
    const settingsRow = await loadAppSettingsRow(
      (row.property_id as string | null | undefined) ?? undefined
    );
    if (settingsRow?.vouchers_enabled === false) {
      return jsonResponse(
        req,
        {
          success: false,
          error: 'not_available',
          message: 'Vouchers are not available for this property.',
        },
        409
      );
    }
    const rolled = rollVoucher(settingsRow?.voucher_prizes);
    code = rolled.code;
    amount = rolled.amount;
    const awardedAt = new Date().toISOString();
    const awardPatch: Record<string, unknown> = {
      next_stay_voucher_code: code,
      next_stay_voucher_amount: amount,
      next_stay_voucher_awarded_at: awardedAt,
      updated_at: awardedAt,
    };
    // Stamp wallet ownership when the guest is signed in at claim time.
    if (guestUser?.id && !row.guest_user_id) {
      awardPatch.guest_user_id = guestUser.id;
    }

    // Conditional write — only first claim wins if two requests race.
    const { data: claimed, error } = await createServiceClient()
      .from('guest_submissions')
      .update(awardPatch)
      .eq('id', bookingId)
      .is('next_stay_voucher_code', null)
      .select('next_stay_voucher_code, next_stay_voucher_amount')
      .maybeSingle();

    if (error) throw new Error(`Failed to award voucher: ${error.message}`);

    if (!claimed) {
      const refreshed = await DatabaseService.getBookingById(bookingId);
      code = (refreshed?.next_stay_voucher_code ?? null) as string | null;
      amount =
        refreshed?.next_stay_voucher_amount != null
          ? Number(refreshed.next_stay_voucher_amount)
          : null;
      if (!code) {
        return jsonResponse(
          req,
          {
            success: false,
            error: 'not_available',
            message: 'Could not award voucher. Please try again.',
          },
          409
        );
      }
      await capturePostHogEvent('sd_voucher_claimed', {
        logPrefix: 'claim-sd-voucher',
        request: req,
        properties: { booking_id: bookingId, won: false, already_awarded: true },
      });
      return jsonSuccess(req, { code, amount, alreadyAwarded: true });
    }

    code = String(claimed.next_stay_voucher_code);
    amount =
      claimed.next_stay_voucher_amount != null ? Number(claimed.next_stay_voucher_amount) : amount;
    await logGuestActivity({
      req,
      action: 'guest.voucher_claimed',
      propertyId: (row.property_id as string | null) ?? null,
      guest: { name: (row.primary_guest_name as string | null) ?? null },
      targetId: bookingId,
      targetLabel: (row.primary_guest_name as string | null) ?? null,
      metadata: { amount },
    });
    await capturePostHogEvent('sd_voucher_claimed', {
      logPrefix: 'claim-sd-voucher',
      request: req,
      properties: { booking_id: bookingId, won: true, already_awarded: false },
    });
    return jsonSuccess(req, { code, amount, alreadyAwarded: false });
  }

  await capturePostHogEvent('sd_voucher_claimed', {
    logPrefix: 'claim-sd-voucher',
    request: req,
    properties: { booking_id: bookingId, won: false, already_awarded: true },
  });
  return jsonSuccess(req, { code, amount, alreadyAwarded });
});
