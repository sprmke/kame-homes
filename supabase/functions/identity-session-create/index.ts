/**
 * identity-session-create — mint a capture session plus the phone handoff token.
 *
 * Auth: public (the guest booking form is anonymous until submit) with
 * `antiSpamGate`. When the caller is signed in the verdict is linked to their account;
 * an `org_owner` session additionally requires `verifyOrgOwner`.
 *
 * Returns the token, the absolute verify URL, and the QR payload (the same URL).
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { antiSpamGate } from '../_shared/antiSpam.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { createServiceClient, tryGetAuthenticatedUser, verifyOrgOwner } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { createIdentitySession } from '../_shared/identitySessionService.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { resolveOrganizationIdForProperty } from '../_shared/propertyScope.ts';

const GUEST_SLOT_MAX = 5;

/** Only an app origin we recognise can be embedded in the handoff URL. */
function resolveAppOrigin(req: Request, requested: string | null): string | null {
  const allowed = (Deno.env.get('IDENTITY_APP_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const requestOrigin = req.headers.get('origin')?.trim().replace(/\/+$/, '') ?? '';
  const candidate = (requested ?? requestOrigin).trim().replace(/\/+$/, '');

  if (allowed.length > 0) return allowed.includes(candidate) ? candidate : null;
  // No allowlist configured (local dev): trust the browser-supplied Origin only.
  if (!requestOrigin) return null;
  return candidate === requestOrigin ? candidate : null;
}

servePublic('identity-session-create', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const blocked = await antiSpamGate(req, body, {
    scope: 'identity-session',
    heuristics: false,
    captcha: false,
    rateLimit: { limit: 12, windowSec: 60 },
  });
  if (blocked) return blocked;

  const subjectKind = body.subjectKind === 'org_owner' ? 'org_owner' : 'guest';
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
  const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
  const propertySlug = typeof body.propertySlug === 'string' ? body.propertySlug.trim() : '';
  const rawSlot = body.guestSlot;
  const guestSlot =
    typeof rawSlot === 'number' && Number.isInteger(rawSlot) && rawSlot >= 1 && rawSlot <= GUEST_SLOT_MAX
      ? rawSlot
      : null;

  const origin = resolveAppOrigin(req, typeof body.appOrigin === 'string' ? body.appOrigin : null);
  if (!origin) return jsonError(req, 'Unsupported request origin', 400);

  const supabase = createServiceClient();
  const user = await tryGetAuthenticatedUser(req);

  let email = '';
  if (subjectKind === 'guest') {
    // The booking form's email is the ownership key at submit time, so it wins over the
    // account email when both exist. The account id is still attached below.
    email = ((typeof body.email === 'string' ? body.email : '') || user?.email || '').trim();
    if (!email) return jsonError(req, 'An email address is required', 400);
    if (bookingId) {
      const { data: booking } = await supabase
        .from('guest_submissions')
        .select('id, guest_email, guest_user_id')
        .eq('id', bookingId)
        .maybeSingle();
      const row = booking as { guest_email: string | null; guest_user_id: string | null } | null;
      if (!row) return jsonError(req, 'Booking not found', 404);
      const ownsBooking =
        (user && row.guest_user_id === user.id) ||
        row.guest_email?.trim().toLowerCase() === email.toLowerCase();
      if (!ownsBooking) return jsonError(req, 'Booking not found', 404);
    }
  } else {
    if (!user) return jsonError(req, 'Unauthorized', 401);
    // Registration runs before the organization exists, so an organizationId is optional.
    // When it is supplied the caller must actually own it.
    if (organizationId) await verifyOrgOwner(req, organizationId);
  }

  // `resolvePublicPropertyId` throws when the URL has no property scope, and this endpoint
  // is called from the booking form with the slug in the body. Resolve it here instead.
  let propertyId: string | null = null;
  if (propertySlug) {
    const { data } = await supabase
      .from('properties')
      .select('id')
      .eq('slug', propertySlug)
      .maybeSingle();
    propertyId = (data as { id: string } | null)?.id ?? null;
  }

  const created = await createIdentitySession(supabase, {
    subjectKind,
    guestUserId: user?.id ?? null,
    ownerUserId: subjectKind === 'org_owner' ? user?.id ?? null : null,
    organizationId: subjectKind === 'org_owner' ? organizationId || null : null,
    bookingId: bookingId || null,
    guestSlot,
    email: subjectKind === 'guest' ? email : null,
    propertyId,
    originDevice: body.originDevice === 'mobile' ? 'mobile' : 'desktop',
  });

  const verifyUrl = `${origin}/verify/${encodeURIComponent(created.token)}`;

  let activityOrganizationId: string | null = subjectKind === 'org_owner' ? organizationId : null;
  if (!activityOrganizationId && propertyId) {
    try {
      activityOrganizationId = await resolveOrganizationIdForProperty(propertyId);
    } catch {
      activityOrganizationId = null;
    }
  }

  if (activityOrganizationId) {
    await logActivity({
      action: 'identity.session_started',
      organizationId: activityOrganizationId,
      propertyId,
      scope: 'org',
      actor: user
        ? buildActorContext('dashboard', { authUser: user, actorType: 'org_owner' }, req)
        : buildActorContext('public_form', { guest: { email } }, req),
      targetType: 'identity_verification',
      targetId: created.session.id,
      targetLabel: subjectKind === 'org_owner' ? 'host identity check' : 'guest identity check',
      metadata: { subjectKind, method: 'live_capture', guestSlot },
    });
  }

  await capturePostHogEvent('identity_session_started', {
    logPrefix: 'identity-session-create',
    distinctId: user?.id,
    request: req,
    properties: { subjectKind, hasBooking: Boolean(bookingId), guestSlot },
    groups: { organization: subjectKind === 'org_owner' ? organizationId : null, property: propertyId },
  });

  return jsonSuccess(
    req,
    {
      sessionId: created.session.id,
      token: created.token,
      expiresAt: created.expiresAt,
      verifyUrl,
      qrPayload: verifyUrl,
      subjectKind,
      guestSlot,
    },
    undefined,
    'mutation'
  );
});
