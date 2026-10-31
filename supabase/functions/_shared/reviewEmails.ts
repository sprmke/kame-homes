/**
 * Guest-facing review emails (request / reminder / published).
 * Host-side alerts go through Notification Center, not email, in v1.
 */

import { buildEmailCtaHtml, renderBrandedEmailShell } from './brandedEmailShell.ts';
import { isEmailSuppressed } from './emailSuppression.ts';
import { mintGuestBookingAccessToken } from './guestBookingAccessToken.ts';
import { guestGuestReviewPath } from './publicGuestPaths.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import { escapeHtml, loadEmailTemplate, replacePlaceholders } from './renderEmailHtml.ts';
import { createServiceClient } from './orgAuth.ts';

const RESEND_API = 'https://api.resend.com/emails';

async function sendReviewNotice(opts: {
  to: string | null | undefined;
  guestName: string;
  propertyName: string;
  brandColor: string | null;
  subject: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}): Promise<boolean> {
  const to = opts.to?.trim();
  if (!to) return false;
  if (await isEmailSuppressed(to)) return false;

  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (!resendKey || !fromEmail) {
    console.warn('[reviewEmails] RESEND missing — skip');
    return false;
  }

  const bodyTemplate = await loadEmailTemplate('review-notice');
  const bodyHtml = replacePlaceholders(bodyTemplate, {
    guest_name: escapeHtml(opts.guestName || 'there'),
    body: escapeHtml(opts.body),
    cta: buildEmailCtaHtml(opts.ctaLabel, opts.ctaUrl, opts.brandColor),
  });
  const html = await renderBrandedEmailShell({
    brandName: opts.propertyName,
    unitLabel: opts.propertyName,
    emailTitle: opts.headline,
    bodyHtml,
    brandColor: opts.brandColor,
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
      subject: opts.subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error('[reviewEmails] Resend failed:', await res.text());
    return false;
  }
  return true;
}

async function loadPropertyEmailBits(propertyId: string): Promise<{
  name: string;
  slug: string;
  brandColor: string | null;
}> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('properties')
    .select('name, slug, app_settings(brand_color)')
    .eq('id', propertyId)
    .maybeSingle();
  const settingsRaw = data?.app_settings as
    { brand_color?: string | null } | { brand_color?: string | null }[] | null;
  const settings = Array.isArray(settingsRaw) ? settingsRaw[0] : settingsRaw;
  return {
    name: (data?.name as string | undefined)?.trim() || 'your stay',
    slug: (data?.slug as string | undefined)?.trim() || '',
    brandColor: settings?.brand_color ?? null,
  };
}

/**
 * Tokenized `/guest-review` link. Guests open these from email on a fresh
 * device, so the link must carry its own booking access token or it fails
 * once `GUEST_BOOKING_ACCESS_ENFORCE` is on.
 */
async function guestReviewLink(
  propertySlug: string,
  bookingId: string,
  accessToken?: string | null
): Promise<string> {
  const token = accessToken?.trim() || (await mintGuestBookingAccessToken(bookingId));
  return guestGuestReviewPath(resolvePublicGuestAppOrigin(null), propertySlug, bookingId, token);
}

export async function sendReviewRequestEmail(input: {
  bookingId: string;
  propertyId: string;
  guestEmail: string | null;
  guestName: string;
  accessToken?: string | null;
}): Promise<boolean> {
  const property = await loadPropertyEmailBits(input.propertyId);
  const url = await guestReviewLink(property.slug, input.bookingId, input.accessToken);
  return sendReviewNotice({
    to: input.guestEmail,
    guestName: input.guestName,
    propertyName: property.name,
    brandColor: property.brandColor,
    subject: `How was your stay at ${property.name}?`,
    headline: `How was your stay at ${property.name}?`,
    body: 'You have 14 days to leave a review. The host will not see it until they review you, or the window closes.',
    ctaLabel: 'Leave a review',
    ctaUrl: url,
  });
}

export async function sendReviewReportDecisionEmail(input: {
  to: string | null | undefined;
  name: string;
  propertyId: string;
  upheld: boolean;
}): Promise<boolean> {
  const property = await loadPropertyEmailBits(input.propertyId);
  const origin = resolvePublicGuestAppOrigin(null);
  return sendReviewNotice({
    to: input.to,
    guestName: input.name,
    propertyName: property.name,
    brandColor: property.brandColor,
    subject: input.upheld ? 'A review was removed' : 'A review report was closed',
    headline: input.upheld ? 'A review was removed' : 'A review report was closed',
    body: input.upheld
      ? 'A reported review was removed after review.'
      : 'A reported review was kept after review.',
    ctaLabel: 'View stay',
    ctaUrl: origin,
  });
}

export async function sendReviewPublishedEmail(input: {
  bookingId: string;
  propertyId: string;
  guestEmail: string | null;
  guestName: string;
  accessToken?: string | null;
  hostReviewed: boolean;
}): Promise<boolean> {
  const property = await loadPropertyEmailBits(input.propertyId);
  const url = await guestReviewLink(property.slug, input.bookingId, input.accessToken);
  return sendReviewNotice({
    to: input.guestEmail,
    guestName: input.guestName,
    propertyName: property.name,
    brandColor: property.brandColor,
    subject: `Your review of ${property.name} is live`,
    headline: 'Your review is live',
    body: input.hostReviewed
      ? 'Your review is published. You can also read what the host wrote about you.'
      : 'Your review is published. The host can now read it.',
    ctaLabel: 'View review',
    ctaUrl: url,
  });
}

export async function sendReviewResponseEmail(input: {
  bookingId: string;
  propertyId: string;
  guestEmail: string | null;
  guestName: string;
  accessToken?: string | null;
}): Promise<boolean> {
  const property = await loadPropertyEmailBits(input.propertyId);
  const url = await guestReviewLink(property.slug, input.bookingId, input.accessToken);
  return sendReviewNotice({
    to: input.guestEmail,
    guestName: input.guestName,
    propertyName: property.name,
    brandColor: property.brandColor,
    subject: `${property.name} responded to your review`,
    headline: `${property.name} responded to your review`,
    body: 'The host posted a public response under your review.',
    ctaLabel: 'Read response',
    ctaUrl: url,
  });
}

export async function sendReviewReminderEmail(input: {
  bookingId: string;
  propertyId: string;
  guestEmail: string | null;
  guestName: string;
  accessToken?: string | null;
}): Promise<boolean> {
  const property = await loadPropertyEmailBits(input.propertyId);
  const url = await guestReviewLink(property.slug, input.bookingId, input.accessToken);
  return sendReviewNotice({
    to: input.guestEmail,
    guestName: input.guestName,
    propertyName: property.name,
    brandColor: property.brandColor,
    subject: `Reminder: review ${property.name}`,
    headline: 'A few days left to review',
    body: 'Your review window closes soon. You can skip this. The host still will not see an unpublished review.',
    ctaLabel: 'Leave a review',
    ctaUrl: url,
  });
}
