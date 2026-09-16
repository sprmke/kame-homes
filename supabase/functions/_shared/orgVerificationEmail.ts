/**
 * Formal email when Super Admin hard-rejects Tier 1 host verification.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { buildEmailCtaHtml, renderBrandedEmailShell } from './brandedEmailShell.ts';
import { loadAuthUserProfile } from './authUserProfile.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import { PLATFORM_BRAND_NAME } from './platformBrand.ts';
import { escapeHtml, loadEmailTemplate, replacePlaceholders } from './renderEmailHtml.ts';

const RESEND_API = 'https://api.resend.com/emails';

export async function sendOrgVerificationRejectedEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  organizationName: string;
  rejectionReason: string;
}): Promise<void> {
  const owner = await loadAuthUserProfile(opts.supabase, opts.ownerId);
  if (!owner.email?.trim()) {
    console.warn('[orgVerificationEmail] owner has no email — skip rejection notify');
    return;
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (!resendKey || !fromEmail) {
    console.warn('[orgVerificationEmail] RESEND_API_KEY or RESEND_FROM_EMAIL missing — skip');
    return;
  }

  const reason = opts.rejectionReason.trim();
  const rejectionReasonBlock = reason
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;border-collapse:separate;border-spacing:0;"><tr><td style="padding:18px 20px;background-color:#fde8e8;border:1px solid #e8a0a0;border-radius:16px;font-size:14px;line-height:1.55;color:#6b2d2d;"><p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8b3a3a;">Reason</p><p style="margin:0;white-space:pre-wrap;">${escapeHtml(reason)}</p></td></tr></table>`
    : '';

  const appOrigin = resolvePublicGuestAppOrigin(null);
  const applyUrl = `${appOrigin}/onboarding`;

  const bodyTemplate = await loadEmailTemplate('org-verification-rejected');
  const bodyHtml = replacePlaceholders(bodyTemplate, {
    organization_name: escapeHtml(opts.organizationName),
    owner_name: escapeHtml(owner.name || 'there'),
    rejection_reason_block: rejectionReasonBlock,
    apply_cta: buildEmailCtaHtml('Start a new application', applyUrl, null),
  });

  const html = await renderBrandedEmailShell({
    brandName: PLATFORM_BRAND_NAME || opts.organizationName,
    unitLabel: opts.organizationName,
    emailTitle: 'Host verification declined',
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
      to: [owner.email],
      subject: `Host verification declined — ${opts.organizationName}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed (${res.status}): ${body.slice(0, 200)}`);
  }
}
