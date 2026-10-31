/**
 * app-settings — Admin GET/PATCH/POST for operator config (app_settings table).
 * Auth: verifyAdminJwt. Secrets remain in Edge env only.
 * POST action: verify_ai (alias verify_gemini) — ping configured AI providers.
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import {
  invalidateAppSettingsCache,
  loadAppSettingsRow,
  serializeAppSettingsForAdmin,
  validateEmailList,
  validateGafContactNumber,
  validateGafTextField,
  validateOptionalEmail,
  validateOptionalUrl,
  validateRequiredUrl,
} from '../_shared/appSettings.ts';
import { validateOrgBrandColor } from '../_shared/orgSettingsValidation.ts';
import {
  mergePropertyAutomationToggles,
  parsePropertyAutomationTogglesPatch,
} from '../_shared/propertyAutomationToggles.ts';
import {
  formatPaymentAccountNumberDisplay,
  normalizePaymentProvider,
  validatePaymentAccountName,
  validatePaymentAccountNumber,
  validatePaymentProvider,
} from '../_shared/paymentProviders.ts';
import { DEFAULT_GCASH_QR_RELATIVE_PATH } from '../_shared/appSettings.ts';
import {
  legacyColumnsFromPrimaryMethod,
  serializePaymentMethodsForDb,
  type PropertyPaymentMethod,
} from '../_shared/paymentMethods.ts';
import { verifyAiProviders } from '../_shared/receiptValidationService.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  parseAction,
  telegramUnknownAction,
  telegramVerifyResponse,
} from '../_shared/telegramSettingsHttp.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { resolvePublicGuestAppOrigin } from '../_shared/publicAppOrigin.ts';
import { ensurePropertySettings } from '../_shared/propertySettingsSeed.ts';
import {
  normalizeExternalReviewsDraft,
  serializeExternalReviewsForOwnerPatch,
} from '../_shared/propertyExternalReviews.ts';
import { normalizeVoucherPrizes } from '../_shared/voucher.ts';
import { isVoucherRevealStyle } from '../_shared/voucherRevealStyle.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { createServiceClient, verifyPropertyAccess } from '../_shared/orgAuth.ts';
import { appSettingsPatchPermissions } from '../_shared/settingsPatchPermissions.ts';
import {
  computePaymentSettingsFingerprint,
  extractPaymentMethodsFromPatchBody,
  patchBodyTouchesPaymentSettings,
  requireSettingsVerificationToken,
} from '../_shared/settingsVerification.ts';
import { notifyPropertyPaymentSettingsChanged } from '../_shared/settingsChangeNotifyEmail.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';

function appSettingsArea(fields: string[]): string {
  if (fields.some((f) => f.startsWith('payment_') || f.startsWith('gcash_'))) return 'payment';
  if (fields.some((f) => f.startsWith('gaf_'))) return 'guest_form';
  if (fields.includes('automation_toggles')) return 'automation_toggles';
  if (fields.some((f) => f.startsWith('voucher') || f === 'vouchers_enabled')) return 'vouchers';
  if (fields.includes('external_reviews')) return 'external_reviews';
  if (
    fields.some(
      (f) =>
        f === 'brand_color' ||
        f === 'facebook_reviews_url' ||
        f === 'airbnb_url' ||
        f === 'instagram_url' ||
        f === 'tiktok_url'
    )
  ) {
    return 'branding';
  }
  return 'general';
}

serveAuthenticated('app-settings', async (req, user) => {
  if (req.method === 'GET') {
    const { property } = await resolveScopedPropertyAccess(req, 'settings:view');
    const propertyId = property.id;
    await ensurePropertySettings(propertyId);
    const data = await serializeAppSettingsForAdmin(propertyId);
    return jsonSuccess(req, data);
  }

  if (req.method === 'POST') {
    const { property } = await resolveScopedPropertyAccess(req, 'settings.integrations:view');
    void property;
    const body = await readJsonBody(req);
    const action = parseAction(body).trim();

    if (action === 'verify_ai' || action === 'verify_gemini') {
      return telegramVerifyResponse(req, await verifyAiProviders());
    }

    return telegramUnknownAction(req, action, 'Use verify_ai');
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const needed = appSettingsPatchPermissions(body);
    if (needed.length === 0) {
      return jsonError(req, 'No valid fields to update');
    }
    const access = await resolveScopedPropertyAccess(req, needed[0]!);
    const { property, org } = access;
    for (const perm of needed.slice(1)) {
      await verifyPropertyAccess(req, property.id, perm);
    }
    if (body.publicPagesAutosaveGate === true) {
      try {
        await requirePropertyFeature(property.id, 'publicPagesAutosave');
      } catch (err) {
        const planErr = catchPlanFeatureError(req, err);
        if (planErr) return planErr;
        throw err;
      }
    }
    const propertyId = property.id;
    let paymentSettingsChanged = false;

    if (patchBodyTouchesPaymentSettings(body)) {
      const methods = extractPaymentMethodsFromPatchBody(body);
      if (!methods) {
        return jsonError(req, 'paymentMethods is required when updating payment settings');
      }
      const patchFingerprint = await computePaymentSettingsFingerprint(methods);
      const token =
        typeof body.settingsVerificationToken === 'string' ? body.settingsVerificationToken : '';
      try {
        await requireSettingsVerificationToken({
          token,
          organizationId: org.id,
          propertyId: property.id,
          patchFingerprint,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Verification required';
        return jsonError(req, msg, 403);
      }
      paymentSettingsChanged = true;
    }

    const patch: Record<string, unknown> = {};
    const currentRow = await loadAppSettingsRow(propertyId);
    let paymentProvider = normalizePaymentProvider(currentRow?.payment_provider);

    if (Array.isArray(body.paymentMethods)) {
      const originBase = resolvePublicGuestAppOrigin(null);
      const defaultQr = `${originBase}/${DEFAULT_GCASH_QR_RELATIVE_PATH}`;
      try {
        const methods = serializePaymentMethodsForDb(
          body.paymentMethods as PropertyPaymentMethod[]
        );
        patch.payment_methods = methods;
        const legacy = legacyColumnsFromPrimaryMethod(methods, defaultQr);
        patch.payment_provider = legacy.payment_provider;
        patch.gcash_name = legacy.gcash_name;
        patch.gcash_number = legacy.gcash_number;
        if (legacy.gcash_qr_image_url) {
          patch.gcash_qr_image_url = legacy.gcash_qr_image_url;
        }
        paymentProvider = legacy.payment_provider;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid payment methods';
        return jsonError(req, msg);
      }
    }

    if (typeof body.paymentProvider === 'string') {
      const trimmed = body.paymentProvider.trim();
      if (trimmed) {
        const err = validatePaymentProvider(trimmed);
        if (err) return jsonError(req, err);
        paymentProvider = trimmed;
        patch.payment_provider = trimmed;
      } else {
        patch.payment_provider = null;
        paymentProvider = normalizePaymentProvider(null);
      }
    }

    if (typeof body.gcashName === 'string') {
      const trimmed = body.gcashName.trim();
      if (trimmed) {
        const err = validatePaymentAccountName(trimmed);
        if (err) return jsonError(req, err);
        patch.gcash_name = trimmed;
      } else {
        patch.gcash_name = null;
      }
    }
    if (typeof body.gcashNumber === 'string') {
      const trimmed = body.gcashNumber.trim();
      if (trimmed) {
        const err = validatePaymentAccountNumber(paymentProvider, trimmed);
        if (err) return jsonError(req, err);
        patch.gcash_number = formatPaymentAccountNumberDisplay(paymentProvider, trimmed);
      } else {
        patch.gcash_number = null;
      }
    }
    if (typeof body.gcashQrImageUrl === 'string') {
      const trimmed = body.gcashQrImageUrl.trim();
      if (trimmed) {
        return jsonError(req, 'Payment QR image can only be updated via upload-app-settings-asset');
      }
      patch.gcash_qr_image_url = null;
    }
    if (typeof body.gafUnitOwner === 'string') {
      const trimmed = body.gafUnitOwner.trim();
      if (trimmed) {
        const err = validateGafTextField(trimmed, 'Unit owner');
        if (err) return jsonError(req, err);
        patch.gaf_unit_owner = trimmed;
      } else {
        patch.gaf_unit_owner = null;
      }
    }
    if (typeof body.gafTowerAndUnitNumber === 'string') {
      const trimmed = body.gafTowerAndUnitNumber.trim();
      if (trimmed) {
        const err = validateGafTextField(trimmed, 'Tower and unit number');
        if (err) return jsonError(req, err);
        patch.gaf_tower_and_unit_number = trimmed;
      } else {
        patch.gaf_tower_and_unit_number = null;
      }
    }
    if (typeof body.gafGuestsOnsiteContactPerson === 'string') {
      const trimmed = body.gafGuestsOnsiteContactPerson.trim();
      if (trimmed) {
        const err = validateGafTextField(trimmed, "Guests' on-site contact person");
        if (err) return jsonError(req, err);
        patch.gaf_guests_onsite_contact_person = trimmed;
      } else {
        patch.gaf_guests_onsite_contact_person = null;
      }
    }
    if (typeof body.gafOwnerContactNumber === 'string') {
      const trimmed = body.gafOwnerContactNumber.trim();
      if (trimmed) {
        const err = validateGafContactNumber(trimmed);
        if (err) return jsonError(req, err);
        patch.gaf_owner_contact_number = trimmed;
      } else {
        patch.gaf_owner_contact_number = null;
      }
    }
    if (typeof body.gafUnitOwnerSignatureUrl === 'string') {
      const trimmed = body.gafUnitOwnerSignatureUrl.trim();
      if (trimmed) {
        return jsonError(
          req,
          'Unit Owner signature can only be updated via upload-app-settings-asset'
        );
      }
      patch.gaf_unit_owner_signature_url = null;
    }

    if (typeof body.emailReplyTo === 'string') {
      const err = validateOptionalEmail(body.emailReplyTo, 'Email Reply-To');
      if (err) return jsonError(req, err);
      patch.email_reply_to = body.emailReplyTo.trim() || null;
    }
    if (typeof body.parkingOwnerEmails === 'string') {
      const trimmed = body.parkingOwnerEmails.trim();
      if (trimmed) {
        const err = validateEmailList(trimmed, 'parking owner');
        if (err) return jsonError(req, err);
        patch.parking_owner_emails = trimmed;
      } else {
        patch.parking_owner_emails = null;
      }
    }
    if (typeof body.sdRefundCronEmailLeadHours === 'number') {
      const minutes = Math.round(body.sdRefundCronEmailLeadHours * 60);
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 10080) {
        return jsonError(req, 'SD refund email lead must be 0–168 hours');
      }
      patch.sd_refund_cron_email_lead_minutes = minutes;
    } else if (typeof body.sdRefundCronEmailLeadMinutes === 'number') {
      const n = Math.floor(body.sdRefundCronEmailLeadMinutes);
      if (n < 0 || n > 10080) {
        return jsonError(req, 'SD refund email lead must be 0–10080 minutes');
      }
      patch.sd_refund_cron_email_lead_minutes = n;
    }
    if (typeof body.sdRefundCronMaxCheckoutAgeDays === 'number') {
      const n = Math.floor(body.sdRefundCronMaxCheckoutAgeDays);
      if (n < 0 || n > 365) {
        return jsonError(req, 'Max checkout age must be 0–365 days');
      }
      patch.sd_refund_cron_max_checkout_age_days = n;
    }
    if (typeof body.brandColor === 'string') {
      const trimmed = body.brandColor.trim();
      if (trimmed) {
        const err = validateOrgBrandColor(trimmed);
        if (err) return jsonError(req, err);
        patch.brand_color = trimmed;
      } else {
        patch.brand_color = null;
      }
    }
    if (typeof body.facebookPageUrl === 'string') {
      const trimmed = body.facebookPageUrl.trim();
      if (trimmed) {
        const err = validateOptionalUrl(trimmed, 'Facebook page URL');
        if (err) return jsonError(req, err);
        patch.facebook_reviews_url = trimmed;
      } else {
        patch.facebook_reviews_url = null;
      }
    }
    if (typeof body.airbnbUrl === 'string') {
      const trimmed = body.airbnbUrl.trim();
      if (trimmed) {
        const err = validateOptionalUrl(trimmed, 'Airbnb URL');
        if (err) return jsonError(req, err);
        patch.airbnb_url = trimmed;
      } else {
        patch.airbnb_url = null;
      }
    }
    if (typeof body.instagramUrl === 'string') {
      const trimmed = body.instagramUrl.trim();
      if (trimmed) {
        const err = validateOptionalUrl(trimmed, 'Instagram URL');
        if (err) return jsonError(req, err);
        patch.instagram_url = trimmed;
      } else {
        patch.instagram_url = null;
      }
    }
    if (typeof body.tiktokUrl === 'string') {
      const trimmed = body.tiktokUrl.trim();
      if (trimmed) {
        const err = validateOptionalUrl(trimmed, 'TikTok URL');
        if (err) return jsonError(req, err);
        patch.tiktok_url = trimmed;
      } else {
        patch.tiktok_url = null;
      }
    }

    if (Array.isArray(body.externalReviews)) {
      try {
        const existing = normalizeExternalReviewsDraft(currentRow?.external_reviews);
        patch.external_reviews = serializeExternalReviewsForOwnerPatch(
          body.externalReviews as Parameters<typeof serializeExternalReviewsForOwnerPatch>[0],
          existing
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid external reviews';
        return jsonError(req, msg);
      }
    }

    if (typeof body.vouchersEnabled === 'boolean') {
      patch.vouchers_enabled = body.vouchersEnabled;
    }
    if (Array.isArray(body.voucherPrizes)) {
      const prizes = normalizeVoucherPrizes(body.voucherPrizes);
      const willEnable =
        typeof body.vouchersEnabled === 'boolean'
          ? body.vouchersEnabled
          : currentRow?.vouchers_enabled !== false;
      if (willEnable && prizes.length === 0) {
        return jsonError(req, 'Add at least one voucher prize');
      }
      patch.voucher_prizes = prizes;
    }

    if (body.voucherRevealStyle !== undefined) {
      if (!isVoucherRevealStyle(body.voucherRevealStyle)) {
        return jsonError(req, 'Invalid voucher reveal style');
      }
      patch.voucher_reveal_style = body.voucherRevealStyle;
    }

    const automationPatch = parsePropertyAutomationTogglesPatch(body.automationToggles);
    if (automationPatch) {
      const existing = mergePropertyAutomationToggles(
        (await loadAppSettingsRow(propertyId))?.automation_toggles
      );
      patch.automation_toggles = { ...existing, ...automationPatch };
    }

    if (Object.keys(patch).length === 0) {
      return jsonError(req, 'No valid fields to update');
    }

    await DatabaseService.updateAppSettings(patch, propertyId);
    invalidateAppSettingsCache(propertyId);
    const data = await serializeAppSettingsForAdmin(propertyId);

    const changedFields = Object.keys(patch);
    await logAssetActivity({
      req,
      user,
      action: 'settings.updated',
      propertyId,
      organizationId: org.id,
      accessKind: access.accessKind,
      memberId: access.memberId,
      targetType: 'settings',
      targetId: propertyId,
      targetLabel: property.name,
      metadata: {
        area: appSettingsArea(changedFields),
        fields: changedFields,
        payment_otp_verified: paymentSettingsChanged,
      },
    });

    if (paymentSettingsChanged) {
      const supabase = createServiceClient();
      notifyPropertyPaymentSettingsChanged({
        supabase,
        organizationId: org.id,
        propertyId: property.id,
        ownerId: org.owner_id,
        propertyName: property.name,
        actorUserId: user.id,
      }).catch((err) => {
        console.error('[app-settings] settings change notify failed', err);
      });
    }

    return jsonSuccess(req, data);
  }

  return jsonError(req, `Method ${req.method} not allowed`, 405);
});
