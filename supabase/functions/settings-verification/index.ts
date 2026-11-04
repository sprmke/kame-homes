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
import {
  resolvePropertyAccessContext,
  resolveScopedPropertyAccess,
} from '../_shared/propertyScope.ts';
import { resolveScopedParkingAccess } from '../_shared/parkingScope.ts';
import {
  hasPropertyPermission,
  type TeamPermissionId,
} from '../_shared/propertyTeamPermissions.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  assertSettingsVerificationRateLimit,
  createSettingsVerificationChallenge,
  isSettingsVerificationAction,
  maskOwnerEmail,
  OTP_TTL_MS,
  PROPERTY_TEMPLATES_SUDO_FINGERPRINT,
  PROPERTY_TEMPLATES_VERIFICATION_ACTION,
  SETTINGS_VERIFICATION_ACTION,
  SENSITIVE_SETTINGS_ACTIONS,
  signSettingsVerificationToken,
  TEMPLATES_SUDO_TOKEN_TTL_MS,
  TOKEN_TTL_MS,
  verifySettingsVerificationChallenge,
  type SettingsVerificationAction,
} from '../_shared/settingsVerification.ts';
import { sendSettingsVerificationOtpEmail } from '../_shared/settingsVerificationOtpEmail.ts';

const TEMPLATE_OTP_PERMISSIONS: TeamPermissionId[] = [
  'templates.standard:edit',
  'templates.email:edit',
  'templates.custom:edit',
  'templates.custom:add',
];

function readString(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === 'string' ? (body[key] as string).trim() : '';
}

async function assertTemplatesOtpAccess(
  req: Request,
  propertyId: string
): Promise<{
  organizationId: string;
  ownerId: string;
  listingName: string;
  propertyId: string;
}> {
  const { property, org, permissions } = await resolvePropertyAccessContext(req, propertyId);
  const allowed = TEMPLATE_OTP_PERMISSIONS.some((leaf) => hasPropertyPermission(permissions, leaf));
  if (!allowed) {
    throw new Response(JSON.stringify({ success: false, error: 'Access restricted' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return {
    organizationId: org.id,
    ownerId: org.owner_id,
    listingName: property.name,
    propertyId: property.id,
  };
}

serveAuthenticated('settings-verification', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const action = readString(body, 'action');
  const url = new URL(req.url);
  const propertyIdParam = url.searchParams.get('property_id')?.trim() ?? '';
  const parkingIdParam = url.searchParams.get('parking_id')?.trim() ?? '';

  if (action === 'send_otp') {
    const verificationActionRaw =
      readString(body, 'verificationAction') || SETTINGS_VERIFICATION_ACTION;
    if (!isSettingsVerificationAction(verificationActionRaw)) {
      return jsonError(req, 'Unsupported verification action');
    }
    const verificationAction: SettingsVerificationAction = verificationActionRaw;

    const patchFingerprint = readString(body, 'patchFingerprint');
    if (!patchFingerprint) {
      return jsonError(req, 'patchFingerprint is required');
    }
    if (
      verificationAction === PROPERTY_TEMPLATES_VERIFICATION_ACTION &&
      patchFingerprint !== PROPERTY_TEMPLATES_SUDO_FINGERPRINT
    ) {
      return jsonError(req, 'Invalid template verification fingerprint');
    }

    if (verificationAction === PROPERTY_TEMPLATES_VERIFICATION_ACTION) {
      if (!propertyIdParam || parkingIdParam) {
        return jsonError(req, 'property_id is required for template verification');
      }
    } else if (Boolean(propertyIdParam) === Boolean(parkingIdParam)) {
      return jsonError(req, 'Provide exactly one of property_id or parking_id query param');
    }

    const supabase = createServiceClient();
    let organizationId = '';
    let ownerId = '';
    let listingName = '';
    let propertyId: string | null = null;
    let parkingId: string | null = null;

    if (verificationAction === PROPERTY_TEMPLATES_VERIFICATION_ACTION) {
      const access = await assertTemplatesOtpAccess(req, propertyIdParam);
      organizationId = access.organizationId;
      ownerId = access.ownerId;
      listingName = access.listingName;
      propertyId = access.propertyId;
    } else if (propertyIdParam) {
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
      action: verificationAction,
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
      settingLabel: SENSITIVE_SETTINGS_ACTIONS[verificationAction].label,
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

    if (verified.action === PROPERTY_TEMPLATES_VERIFICATION_ACTION) {
      if (!verified.propertyId) {
        return jsonError(req, 'Invalid template verification challenge', 403);
      }
      await assertTemplatesOtpAccess(req, verified.propertyId);
    } else if (verified.propertyId) {
      await resolveScopedPropertyAccess(req, 'settings.payment:edit');
    } else if (verified.parkingId) {
      await resolveScopedParkingAccess(req, 'org.parkings:manage');
    }

    const expiresAt =
      verified.action === PROPERTY_TEMPLATES_VERIFICATION_ACTION
        ? Date.now() + TEMPLATES_SUDO_TOKEN_TTL_MS
        : Date.now() + TOKEN_TTL_MS;

    const verificationToken = await signSettingsVerificationToken({
      challengeId,
      action: verified.action,
      organizationId: verified.organizationId,
      propertyId: verified.propertyId ?? undefined,
      parkingId: verified.parkingId ?? undefined,
      patchFingerprint: verified.patchFingerprint,
      exp: expiresAt,
    });

    return jsonSuccess(req, { verificationToken, expiresAt });
  }

  return jsonError(req, 'Unknown action. Use send_otp or verify_otp');
});
