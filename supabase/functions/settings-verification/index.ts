/**
 * settings-verification — send / verify org-owner OTP for sensitive settings saves.
 * POST ?property_id= | ?parking_id=  { action: 'send_otp' | 'verify_otp', ... }
 */

import { loadAuthUserProfile } from '../_shared/authUserProfile.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { resolveScopedParkingAccess } from '../_shared/parkingScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  assertSettingsVerificationRateLimit,
  createSettingsVerificationChallenge,
  maskOwnerEmail,
  OTP_TTL_MS,
  SETTINGS_VERIFICATION_ACTION,
  SENSITIVE_SETTINGS_ACTIONS,
  signSettingsVerificationToken,
  verifySettingsVerificationChallenge,
} from '../_shared/settingsVerification.ts';
import { sendSettingsVerificationOtpEmail } from '../_shared/settingsVerificationOtpEmail.ts';

function readString(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === 'string' ? (body[key] as string).trim() : '';
}

serveAuthenticated('settings-verification', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const action = readString(body, 'action');
  const url = new URL(req.url);
  const propertyIdParam = url.searchParams.get('property_id')?.trim() ?? '';
  const parkingIdParam = url.searchParams.get('parking_id')?.trim() ?? '';

  if (action === 'send_otp') {
    const verificationAction =
      readString(body, 'verificationAction') || SETTINGS_VERIFICATION_ACTION;
    if (verificationAction !== SETTINGS_VERIFICATION_ACTION) {
      return jsonError(req, 'Unsupported verification action');
    }

    const patchFingerprint = readString(body, 'patchFingerprint');
    if (!patchFingerprint) {
      return jsonError(req, 'patchFingerprint is required');
    }

    if (Boolean(propertyIdParam) === Boolean(parkingIdParam)) {
      return jsonError(req, 'Provide exactly one of property_id or parking_id query param');
    }

    const supabase = createServiceClient();
    let organizationId = '';
    let ownerId = '';
    let listingName = '';
    let propertyId: string | null = null;
    let parkingId: string | null = null;

    if (propertyIdParam) {
      const { property, org } = await resolveScopedPropertyAccess(req, 'settings.payment:edit');
      organizationId = org.id;
      ownerId = org.owner_id;
      listingName = property.name;
      propertyId = property.id;
    } else {
      const { parkingRow, org } = await resolveScopedParkingAccess(req, 'org.parkings:manage');
      organizationId = org.id;
      ownerId = org.owner_id;
      listingName = parkingRow.name as string;
      parkingId = parkingRow.id as string;
    }

    await assertSettingsVerificationRateLimit(supabase, user.id, organizationId);

    const challenge = await createSettingsVerificationChallenge(supabase, {
      organizationId,
      propertyId,
      parkingId,
      action: SETTINGS_VERIFICATION_ACTION,
      patchFingerprint,
      requestedBy: user.id,
    });

    const ownerProfile = await loadAuthUserProfile(supabase, ownerId);

    await sendSettingsVerificationOtpEmail({
      supabase,
      organizationId,
      ownerId,
      actorUserId: user.id,
      listingName,
      settingLabel: SENSITIVE_SETTINGS_ACTIONS[SETTINGS_VERIFICATION_ACTION].label,
      code: challenge.code,
      expiresMinutes: Math.round(OTP_TTL_MS / 60_000),
      propertyId,
      parkingId,
    });

    return jsonSuccess(req, {
      challengeId: challenge.challengeId,
      ownerEmailMasked: maskOwnerEmail(ownerProfile.email),
      expiresAt: challenge.expiresAt,
    });
  }

  if (action === 'verify_otp') {
    const challengeId = readString(body, 'challengeId');
    const code = readString(body, 'code');
    if (!challengeId || !code) {
      return jsonError(req, 'challengeId and code are required');
    }

    const supabase = createServiceClient();
    let verified;
    try {
      verified = await verifySettingsVerificationChallenge(supabase, {
        challengeId,
        code,
        requestedBy: user.id,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Verification failed';
      return jsonError(req, msg, 403);
    }

    if (verified.propertyId) {
      await resolveScopedPropertyAccess(req, 'settings.payment:edit');
    } else if (verified.parkingId) {
      await resolveScopedParkingAccess(req, 'org.parkings:manage');
    }

    const verificationToken = await signSettingsVerificationToken({
      challengeId,
      action: verified.action,
      organizationId: verified.organizationId,
      propertyId: verified.propertyId ?? undefined,
      parkingId: verified.parkingId ?? undefined,
      patchFingerprint: verified.patchFingerprint,
    });

    return jsonSuccess(req, { verificationToken });
  }

  return jsonError(req, 'Unknown action. Use send_otp or verify_otp');
});
