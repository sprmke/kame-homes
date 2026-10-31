/**
 * super-admin-verification — send / verify a step-up OTP for sensitive Super Admin actions.
 * POST { action: 'send_otp', gatedAction? } | { action: 'verify_otp', challengeId, code }
 *
 * `verify_otp` returns a short-lived signed "sudo" token the client replays as the
 * `x-superadmin-otp` header on every gated `serveSuperAdmin` mutation. See
 * `_shared/superAdminVerification.ts` and docs/workflow/in-progress/super-admin-step-up-otp.md.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { sendSuperAdminStepUpEmail } from '../_shared/superAdminStepUpEmail.ts';
import {
  assertStepUpRateLimit,
  createStepUpChallenge,
  maskEmail,
  OTP_TTL_MS,
  signSudoToken,
  SUDO_TOKEN_TTL_MS,
  superAdminActionLabel,
  verifyStepUpChallenge,
} from '../_shared/superAdminVerification.ts';

function readString(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === 'string' ? (body[key] as string).trim() : '';
}

serveSuperAdmin('super-admin-verification', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const action = readString(body, 'action');
  const supabase = createServiceClient();

  if (action === 'send_otp') {
    if (!user.email?.trim()) {
      return jsonError(req, 'Your account has no email on file', 400);
    }
    const gatedAction = readString(body, 'gatedAction') || null;

    await assertStepUpRateLimit(supabase, user.id);
    const challenge = await createStepUpChallenge(supabase, {
      userId: user.id,
      email: user.email,
    });

    await sendSuperAdminStepUpEmail({
      toEmail: user.email,
      code: challenge.code,
      expiresMinutes: Math.round(OTP_TTL_MS / 60_000),
      actionLabel: superAdminActionLabel(gatedAction),
    });

    await logSuperAdminAction(user, {
      action: 'super_admin.step_up_requested',
      summary: `Requested step-up code to ${maskEmail(user.email)}`,
      metadata: { gatedAction },
    });

    return jsonSuccess(req, {
      challengeId: challenge.challengeId,
      emailMasked: maskEmail(user.email),
      expiresAt: challenge.expiresAt,
    });
  }

  if (action === 'verify_otp') {
    const challengeId = readString(body, 'challengeId');
    const code = readString(body, 'code');
    if (!challengeId || !code) {
      return jsonError(req, 'challengeId and code are required');
    }

    try {
      await verifyStepUpChallenge(supabase, { challengeId, code, userId: user.id });
    } catch (e) {
      return jsonError(req, e instanceof Error ? e.message : 'Verification failed', 403);
    }

    const { token, expiresAt } = await signSudoToken(user.id);

    await logSuperAdminAction(user, {
      action: 'super_admin.step_up_verified',
      summary: `Verified step-up code (sudo window ${Math.round(SUDO_TOKEN_TTL_MS / 60_000)} min)`,
    });

    return jsonSuccess(req, { verificationToken: token, expiresAt });
  }

  return jsonError(req, 'Unknown action. Use send_otp or verify_otp');
});
