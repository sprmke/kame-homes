/**
 * Owner emails for Unit handoff Phase B contract-expiry milestones.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { buildEmailCtaHtml, renderBrandedEmailShell } from './brandedEmailShell.ts';
import { loadAuthUserProfile } from './authUserProfile.ts';
import type { ContractLeg, ContractNoticeMilestone } from './contractLifecycle.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import { escapeHtml, loadEmailTemplate, replacePlaceholders } from './renderEmailHtml.ts';

const RESEND_API = 'https://api.resend.com/emails';

const MILESTONE_COPY: Record<
  Extract<
    ContractNoticeMilestone,
    | 't_minus_15'
    | 't_minus_7'
    | 't_minus_1'
    | 't_plus_0_archived'
    | 't_plus_3'
    | 't_plus_5_locked'
    | 'grant_expired'
  >,
  { subject: string; headline: string; body: string }
> = {
  t_minus_15: {
    subject: 'Contract ends in 15 days',
    headline: 'Your hosting contract ends in 15 days',
    body: 'Please prepare a renewed agreement or plan next steps before the end date.',
  },
  t_minus_7: {
    subject: 'Contract ends in 7 days',
    headline: 'Your hosting contract ends in 7 days',
    body: 'After the end date, this listing goes offline. You can renew or request consideration during the grace period.',
  },
  t_minus_1: {
    subject: 'Contract ends tomorrow',
    headline: 'Your hosting contract ends tomorrow',
    body: 'Tomorrow this listing will be taken offline. Renew your contract or use Request consideration during the grace window.',
  },
  t_plus_0_archived: {
    subject: 'Listing offline — contract ended',
    headline: 'Your listing is now offline',
    body: 'The contract end date has passed. You have a short grace period to renew or request consideration.',
  },
  t_plus_3: {
    subject: 'Grace period reminder',
    headline: 'Grace period reminder',
    body: 'Two days remain in the grace period. Renew fully or request consideration before access is locked.',
  },
  t_plus_5_locked: {
    subject: 'Listing access locked',
    headline: 'Listing access is locked',
    body: 'The grace period has ended. Submit a full renewal for Super Admin review, or ask support about a consideration override.',
  },
  grant_expired: {
    subject: 'Temporary access ended',
    headline: 'Temporary consideration access has ended',
    body: 'Your granted consideration window expired. The listing is offline and locked until you complete a full renewal.',
  },
};

export async function sendContractLifecycleNoticeEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  organizationName: string;
  leg: ContractLeg;
  contractEndYmd: string;
  milestone: keyof typeof MILESTONE_COPY;
  /** Names the affected listing — expiry is per listing, so an org can have several. */
  listingName?: string | null;
}): Promise<void> {
  const owner = await loadAuthUserProfile(opts.supabase, opts.ownerId);
  if (!owner.email?.trim()) {
    console.warn('[contractLifecycleEmail] owner has no email — skip');
    return;
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (!resendKey || !fromEmail) {
    console.warn('[contractLifecycleEmail] RESEND missing — skip');
    return;
  }

  const copy = MILESTONE_COPY[opts.milestone];
  const kindLabel = opts.leg === 'parking' ? 'Parking' : 'Property';
  const legLabel = opts.listingName?.trim() || kindLabel;
  const appOrigin = resolvePublicGuestAppOrigin(null);
  const dashboardUrl = `${appOrigin}/org`;

  const bodyTemplate = await loadEmailTemplate('contract-lifecycle-notice');
  const bodyHtml = replacePlaceholders(bodyTemplate, {
    owner_name: escapeHtml(owner.name || 'there'),
    body: escapeHtml(copy.body),
    contract_end_date: escapeHtml(opts.contractEndYmd),
    dashboard_cta: buildEmailCtaHtml('Open dashboard', dashboardUrl, null),
  });

  const html = await renderBrandedEmailShell({
    brandName: opts.organizationName,
    unitLabel: legLabel,
    emailTitle: copy.headline,
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
      subject: `${copy.subject} — ${opts.organizationName} (${legLabel})`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed (${res.status}): ${body.slice(0, 200)}`);
  }
}
