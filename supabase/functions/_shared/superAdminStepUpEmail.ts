/**
 * OTP email for Super Admin step-up verification. Sent to the acting super admin's own
 * login address via Resend, wrapped in the shared branded email shell.
 */

import { renderBrandedEmailShell } from './brandedEmailShell.ts';
import { PLATFORM_BRAND_NAME } from './platformBrand.ts';
import { escapeHtml } from './renderEmailHtml.ts';

const RESEND_API = 'https://api.resend.com/emails';

const BODY_P = 'margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;';
const BODY_MUTED = 'margin:0;font-size:13px;line-height:1.5;color:#6b7280;';

export async function sendSuperAdminStepUpEmail(opts: {
  toEmail: string;
  code: string;
  expiresMinutes: number;
  /** Verb phrase from `superAdminActionLabel`, e.g. "change the platform's payment rails". */
  actionLabel: string;
}): Promise<void> {
  const to = opts.toEmail.trim();
  if (!to) throw new Error('No email on file for this super admin account');

  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (!resendKey || !fromEmail) {
    throw new Error('Email is not configured');
  }

  const code = escapeHtml(opts.code);
  const actionLabel = escapeHtml(opts.actionLabel);
  const brandName = PLATFORM_BRAND_NAME || 'Platform admin';

  const bodyHtml = `<p style="${BODY_P}">Someone signed in as a platform super admin is trying to <strong>${actionLabel}</strong>.</p>
<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#333333;">Your verification code:</p>
<p style="margin:0 0 20px 0;font-size:28px;font-weight:700;letter-spacing:0.25em;color:#111827;">${code}</p>
<p style="${BODY_MUTED}">This code expires in ${opts.expiresMinutes} minutes. If this was not you, do not share it. Change your password and review the super admin audit log now.</p>`;

  const html = await renderBrandedEmailShell({
    brandName,
    unitLabel: 'Super admin',
    emailTitle: 'Super admin verification',
    bodyHtml,
    brandColor: null,
  });

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: 'Super admin verification code',
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[superAdminStepUpEmail] send failed', res.status, body.slice(0, 200));
    throw new Error('Could not send verification email');
  }
}
