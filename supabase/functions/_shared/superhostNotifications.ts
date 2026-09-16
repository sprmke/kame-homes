/**
 * Superhost earn / lose owner notification emails.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { loadAuthUserProfile } from './authUserProfile.ts';
import { buildEmailCtaHtml, renderBrandedEmailShell } from './brandedEmailShell.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import { escapeHtml, loadEmailTemplate, replacePlaceholders } from './renderEmailHtml.ts';

const RESEND_API = 'https://api.resend.com/emails';

async function sendSuperhostEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  organizationName: string;
  subject: string;
  headline: string;
  body: string;
  templateName: 'superhost-earned' | 'superhost-lost';
}): Promise<void> {
  const owner = await loadAuthUserProfile(opts.supabase, opts.ownerId);
  if (!owner.email?.trim()) {
    console.warn('[superhostNotifications] owner has no email — skip');
    return;
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (!resendKey || !fromEmail) {
    console.warn('[superhostNotifications] RESEND missing — skip');
    return;
  }

  const appOrigin = resolvePublicGuestAppOrigin(null);
  const dashboardUrl = `${appOrigin}/org`;

  const bodyTemplate = await loadEmailTemplate(opts.templateName);
  const bodyHtml = replacePlaceholders(bodyTemplate, {
    owner_name: escapeHtml(owner.name || 'there'),
    organization_name: escapeHtml(opts.organizationName),
    body: escapeHtml(opts.body),
    dashboard_cta: buildEmailCtaHtml('Open dashboard', dashboardUrl, null),
  });

  const shellHtml = await renderBrandedEmailShell({
    headline: opts.headline,
    bodyHtml,
    preheader: opts.subject,
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
      subject: opts.subject,
      html: shellHtml,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn('[superhostNotifications] send failed:', res.status, text);
  }
}

export async function sendSuperhostEarnedEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  organizationName: string;
}): Promise<void> {
  await sendSuperhostEmail({
    ...opts,
    subject: 'You earned Superhost',
    headline: 'Congratulations — you are a Superhost',
    body: 'Your organization met all Superhost criteria. The badge is now live on your public listings.',
    templateName: 'superhost-earned',
  });
}

export async function sendSuperhostLostEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  organizationName: string;
}): Promise<void> {
  await sendSuperhostEmail({
    ...opts,
    subject: 'Superhost status update',
    headline: 'Superhost badge removed',
    body: 'Your organization no longer meets all Superhost criteria. Review your progress in Org settings → Trust.',
    templateName: 'superhost-lost',
  });
}
