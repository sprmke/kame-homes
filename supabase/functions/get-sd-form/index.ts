/**
 * get-sd-form — Public read-only payload for the guest SD refund stepper (/sd-form).
 *
 * GET ?bookingId=<uuid>
 * Returns minimal fields when status === READY_FOR_CHECKOUT, **or** when status is
 * READY_FOR_CHECKIN and the automated check-out email was already sent (`sd_refund_form_emailed_at`),
 * in which case `awaiting_balance_settlement` is true until staff records final balance and the
 * booking moves to READY_FOR_CHECKOUT.
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import { loadAppSettingsRow, resolveAppSettings } from '../_shared/appSettings.ts';
import { guestReviewExistsForBooking } from '../_shared/guestReviewService.ts';
import { resolveVoucherPrizes } from '../_shared/voucher.ts';
import { normalizeVoucherRevealStyle } from '../_shared/voucherRevealStyle.ts';
import { authorizeGuestBookingAccess } from '../_shared/guestBookingAccessToken.ts';
import { jsonError, jsonResponse, jsonSuccess } from '../_shared/httpResponse.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';

const NOT_FOUND = {
  success: false,
  error: 'not_found',
  message:
    'This form is not available. Please use the link from your email or contact us on Facebook.',
};

servePublic('get-sd-form', async (req) => {
  if (req.method !== 'GET') {
    throw new Error(`Method ${req.method} not allowed`);
  }

  const limited = await publicGetRateLimitGate(req, 'get-sd-form', { maxPerMin: 30 });
  if (limited) return limited;

  const url = new URL(req.url);
  const bookingId = (url.searchParams.get('bookingId') ?? '').trim();
  if (!bookingId) {
    return jsonResponse(req, NOT_FOUND, 404);
  }

  const access = url.searchParams.get('access')?.trim() ?? null;
  const row = await DatabaseService.getBookingById(bookingId);
  const authz = await authorizeGuestBookingAccess({
    bookingIdFromPath: bookingId,
    accessTokenFromQuery: access,
    bookingCreatedAt: (row?.created_at as string | null | undefined) ?? null,
  });
  if (!authz.ok) {
    return jsonError(req, authz.message, authz.status);
  }

  if (!row) {
    return jsonResponse(req, NOT_FOUND, 404);
  }

  const emailedAt =
    typeof row.sd_refund_form_emailed_at === 'string' ? row.sd_refund_form_emailed_at.trim() : '';
  const awaitingBalanceSettlement = row.status === 'READY_FOR_CHECKIN' && emailedAt !== '';

  if (row.status !== 'READY_FOR_CHECKOUT' && !awaitingBalanceSettlement) {
    return jsonResponse(req, NOT_FOUND, 404);
  }

  const settings = await resolveAppSettings(
    (row.property_id as string | null | undefined) ?? undefined
  );
  const settingsRow = await loadAppSettingsRow(
    (row.property_id as string | null | undefined) ?? undefined
  );
  const vouchersEnabled = settingsRow?.vouchers_enabled !== false;
  const voucherPrizes = resolveVoucherPrizes(settingsRow?.voucher_prizes);
  const voucherRevealStyle = normalizeVoucherRevealStyle(settingsRow?.voucher_reveal_style);
  const sd = row.security_deposit != null ? Number(row.security_deposit) : 1500;
  const guestReviewSubmitted = await guestReviewExistsForBooking(bookingId);

  return jsonSuccess(req, {
    bookingId: row.id,
    primary_guest_name: row.primary_guest_name ?? row.guest_facebook_name ?? '',
    guest_phone_number: row.guest_phone_number ?? '',
    security_deposit: sd,
    check_in_date: row.check_in_date,
    check_out_date: row.check_out_date,
    guest_review_submitted: guestReviewSubmitted,
    email_logo_url: settings.emailLogoUrl,
    brand_color: settings.brandColor,
    next_stay_voucher_code: row.next_stay_voucher_code ?? null,
    next_stay_voucher_amount:
      row.next_stay_voucher_amount != null ? Number(row.next_stay_voucher_amount) : null,
    awaiting_balance_settlement: awaitingBalanceSettlement,
    vouchers_enabled: vouchersEnabled,
    voucher_prizes: voucherPrizes,
    voucher_reveal_style: voucherRevealStyle,
  });
});
