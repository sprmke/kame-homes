/**
 * Owner emails for property / org subscription billing (PayMongo).
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { buildEmailCtaHtml, renderBrandedEmailShell } from './brandedEmailShell.ts';
import { loadAuthUserProfile } from './authUserProfile.ts';
import { PLATFORM_BRAND_NAME } from './platformBrand.ts';
import { escapeHtml } from './renderEmailHtml.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';

const RESEND_API = 'https://api.resend.com/emails';

const BODY_P = 'margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;';

async function sendOwnerBillingEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  subject: string;
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  brandName?: string;
  unitLabel?: string;
}): Promise<boolean> {
  const owner = await loadAuthUserProfile(opts.supabase, opts.ownerId);
  if (!owner.email?.trim()) {
    console.warn('[subscriptionBillingEmail] owner has no email — skip');
    return false;
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (!resendKey || !fromEmail) {
    console.warn('[subscriptionBillingEmail] RESEND missing — skip');
    return false;
  }

  const brandName = opts.brandName?.trim() || PLATFORM_BRAND_NAME || 'Billing';
  const ctaBlock =
    opts.ctaUrl && opts.ctaLabel ? buildEmailCtaHtml(opts.ctaLabel, opts.ctaUrl, null) : '';

  const bodyHtml = `<p style="${BODY_P}">Hi ${escapeHtml(owner.name || 'there')},</p>
<p style="${BODY_P}">${escapeHtml(opts.body)}</p>
${ctaBlock}`;

  const html = await renderBrandedEmailShell({
    brandName,
    unitLabel: opts.unitLabel?.trim() || brandName,
    emailTitle: opts.headline,
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
      from: `${brandName} <${fromEmail}>`,
      to: [owner.email.trim()],
      subject: opts.subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[subscriptionBillingEmail] send failed', res.status, body.slice(0, 200));
    return false;
  }
  return true;
}

export async function sendSubscriptionReceiptEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  propertyName: string;
  planName: string;
  amountPhp: number;
  orgSlug: string;
  propertySlug: string;
}): Promise<void> {
  const appOrigin = resolvePublicGuestAppOrigin(null);
  const plansUrl = `${appOrigin}/org/${opts.orgSlug}/plans`;
  await sendOwnerBillingEmail({
    supabase: opts.supabase,
    ownerId: opts.ownerId,
    subject: `Payment received — ${opts.propertyName}`,
    headline: 'Subscription payment confirmed',
    body: `${opts.propertyName} is now on ${opts.planName} (₱${opts.amountPhp.toLocaleString('en-PH')}). Your plan is active for the next billing period.`,
    ctaLabel: 'View plan',
    ctaUrl: plansUrl,
    unitLabel: opts.propertyName,
  });
}

export async function sendSubscriptionRenewalReminderEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  propertyName: string;
  planName: string;
  periodEndLabel: string;
  checkoutUrl: string;
}): Promise<void> {
  await sendOwnerBillingEmail({
    supabase: opts.supabase,
    ownerId: opts.ownerId,
    subject: `Renew ${opts.propertyName} — ${opts.planName}`,
    headline: 'Subscription renewal due soon',
    body: `${opts.propertyName} renews on ${opts.periodEndLabel}. Pay now to avoid interruption.`,
    ctaLabel: 'Pay renewal',
    ctaUrl: opts.checkoutUrl,
    unitLabel: opts.propertyName,
  });
}

export async function sendSubscriptionPastDueEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  propertyName: string;
  graceEndLabel: string;
  checkoutUrl: string;
}): Promise<void> {
  await sendOwnerBillingEmail({
    supabase: opts.supabase,
    ownerId: opts.ownerId,
    subject: `Past due — ${opts.propertyName}`,
    headline: 'Subscription payment is past due',
    body: `Pay before ${opts.graceEndLabel} to keep full dashboard access for this listing.`,
    ctaLabel: 'Pay now',
    ctaUrl: opts.checkoutUrl,
    unitLabel: opts.propertyName,
  });
}

export async function sendSubscriptionSuspendedEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  propertyName: string;
  plansUrl: string;
}): Promise<void> {
  await sendOwnerBillingEmail({
    supabase: opts.supabase,
    ownerId: opts.ownerId,
    subject: `Suspended — ${opts.propertyName}`,
    headline: 'Listing subscription suspended',
    body: `${opts.propertyName} is in read-only mode until payment is received. Guest booking flows are unaffected.`,
    ctaLabel: 'Restore access',
    ctaUrl: opts.plansUrl,
    unitLabel: opts.propertyName,
  });
}

export async function sendSubscriptionPaymentFailedEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  propertyName: string;
  plansUrl: string;
}): Promise<void> {
  await sendOwnerBillingEmail({
    supabase: opts.supabase,
    ownerId: opts.ownerId,
    subject: `Payment failed — ${opts.propertyName}`,
    headline: 'Payment could not be completed',
    body: `Your recent payment attempt for ${opts.propertyName} did not go through. You can try again from the Plans page.`,
    ctaLabel: 'Try again',
    ctaUrl: opts.plansUrl,
    unitLabel: opts.propertyName,
  });
}

/** Org-level equivalents — billing is org-scoped, so these name the org and enrolled property
 * count instead of a single property. */

export async function sendOrgSubscriptionReceiptEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  orgName: string;
  planName: string;
  propertyCount: number;
  amountPhp: number;
  orgSlug: string;
}): Promise<void> {
  const appOrigin = resolvePublicGuestAppOrigin(null);
  const plansUrl = `${appOrigin}/org/${opts.orgSlug}/plans`;
  const propertyWord = opts.propertyCount === 1 ? 'property' : 'properties';
  await sendOwnerBillingEmail({
    supabase: opts.supabase,
    ownerId: opts.ownerId,
    subject: `Payment received — ${opts.orgName}`,
    headline: 'Subscription payment confirmed',
    body: `${opts.orgName} is now on ${opts.planName} covering ${opts.propertyCount} ${propertyWord} (₱${opts.amountPhp.toLocaleString('en-PH')}). Your plan is active for the next billing period.`,
    ctaLabel: 'View plan',
    ctaUrl: plansUrl,
    brandName: opts.orgName,
    unitLabel: opts.orgName,
  });
}

export async function sendOrgSubscriptionRenewalReminderEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  orgName: string;
  planName: string;
  periodEndLabel: string;
  checkoutUrl: string;
}): Promise<void> {
  await sendOwnerBillingEmail({
    supabase: opts.supabase,
    ownerId: opts.ownerId,
    subject: `Renew ${opts.orgName} — ${opts.planName}`,
    headline: 'Subscription renewal due soon',
    body: `${opts.orgName}'s subscription renews on ${opts.periodEndLabel}. Pay now to avoid interruption.`,
    ctaLabel: 'Pay renewal',
    ctaUrl: opts.checkoutUrl,
    brandName: opts.orgName,
    unitLabel: opts.orgName,
  });
}

export async function sendOrgSubscriptionPastDueEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  orgName: string;
  graceEndLabel: string;
  checkoutUrl: string;
}): Promise<void> {
  await sendOwnerBillingEmail({
    supabase: opts.supabase,
    ownerId: opts.ownerId,
    subject: `Past due — ${opts.orgName}`,
    headline: 'Subscription payment is past due',
    body: `Pay before ${opts.graceEndLabel} to keep full dashboard access across ${opts.orgName}'s properties.`,
    ctaLabel: 'Pay now',
    ctaUrl: opts.checkoutUrl,
    brandName: opts.orgName,
    unitLabel: opts.orgName,
  });
}

export async function sendOrgSubscriptionSuspendedEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  orgName: string;
  plansUrl: string;
}): Promise<void> {
  await sendOwnerBillingEmail({
    supabase: opts.supabase,
    ownerId: opts.ownerId,
    subject: `Suspended — ${opts.orgName}`,
    headline: 'Subscription suspended',
    body: `${opts.orgName}'s properties are in read-only mode until payment is received. Guest booking flows are unaffected.`,
    ctaLabel: 'Restore access',
    ctaUrl: opts.plansUrl,
    brandName: opts.orgName,
    unitLabel: opts.orgName,
  });
}

export async function sendOrgSubscriptionPaymentFailedEmail(opts: {
  supabase: SupabaseClient;
  ownerId: string;
  orgName: string;
  plansUrl: string;
}): Promise<void> {
  await sendOwnerBillingEmail({
    supabase: opts.supabase,
    ownerId: opts.ownerId,
    subject: `Payment failed — ${opts.orgName}`,
    headline: 'Payment could not be completed',
    body: `Your recent payment attempt for ${opts.orgName} did not go through. You can try again from the Plans page.`,
    ctaLabel: 'Try again',
    ctaUrl: opts.plansUrl,
    brandName: opts.orgName,
    unitLabel: opts.orgName,
  });
}

export async function sendOrgSubscriptionPlanChangedEmail(opts: {
  supabase: SupabaseClient;
  organizationId: string;
  fromPlanName: string;
  toPlanName: string;
  toFree: boolean;
}): Promise<void> {
  const { data: org, error } = await opts.supabase
    .from('organizations')
    .select('owner_id, slug, name')
    .eq('id', opts.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!org?.owner_id) return;

  const appOrigin = resolvePublicGuestAppOrigin(null);
  const plansUrl = `${appOrigin}/org/${String(org.slug ?? '')}/plans`;
  const orgName = String(org.name ?? 'Organization');
  const body = opts.toFree
    ? `${orgName} is now on the Free plan. Paid features are turned off immediately.`
    : `${orgName} moved from ${opts.fromPlanName} to ${opts.toPlanName}. The change is effective immediately; your next renewal uses the new rate.`;

  await sendOwnerBillingEmail({
    supabase: opts.supabase,
    ownerId: org.owner_id as string,
    subject: opts.toFree
      ? `${orgName} — moved to Free`
      : `${orgName} — plan changed to ${opts.toPlanName}`,
    headline: opts.toFree ? 'Subscription canceled' : 'Plan updated',
    body,
    ctaLabel: 'View plan',
    ctaUrl: plansUrl,
    brandName: orgName,
    unitLabel: orgName,
  });
}
