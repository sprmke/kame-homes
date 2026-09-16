/**
 * OTP email to org owner for sensitive settings verification — branded email shell.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { resolveAppSettings } from './appSettings.ts';
import { loadAuthUserProfile } from './authUserProfile.ts';
import { resolveEmailReadableOnWhiteHex } from './emailBrandColor.ts';
import { formatResendFromAddress, loadPropertyEmailBranding } from './propertyEmailBranding.ts';
import { renderPropertyTemplateSendEmail } from './propertyTemplateEmail.ts';
import { escapeHtml } from './renderEmailHtml.ts';
import { resolveSettingsChangeActor } from './settingsVerificationActor.ts';

const RESEND_API = 'https://api.resend.com/emails';

const BODY_P = 'margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;';
const BODY_MUTED = 'margin:0;font-size:13px;line-height:1.5;color:#6b7280;';

function buildOtpBodyHtml(input: {
  otpColorHex: string;
  isOwnerActor: boolean;
  ownerName: string;
  actorName: string;
  actorRole: string;
  settingLabel: string;
  listingName: string;
  otpCode: string;
  expiresMinutes: number;
}): string {
  const otpColor = escapeHtml(input.otpColorHex);
  const ownerName = escapeHtml(input.ownerName);
  const actorName = escapeHtml(input.actorName);
  const actorRole = escapeHtml(input.actorRole);
  const settingLabel = escapeHtml(input.settingLabel);
  const listingName = escapeHtml(input.listingName);
  const otpCode = escapeHtml(input.otpCode);

  const actionLine = input.isOwnerActor
    ? `You, <strong>${actorName}</strong> (${actorRole}), are saving <strong>${settingLabel}</strong> for <strong>${listingName}</strong>.`
    : `Your team member, <strong>${actorName}</strong> (${actorRole}), is saving <strong>${settingLabel}</strong> for <strong>${listingName}</strong>.`;

  const cautionLine = input.isOwnerActor
    ? 'If you did not expect this, do not share this code with anyone. Review your recent activity and this property’s payment settings to confirm nothing unexpected changed.'
    : `If you did not expect this, do not share this code with anyone. Contact <strong>${actorName}</strong> before approving this payment settings change.`;

  return `<p style="${BODY_P}">Hi ${ownerName},</p>
<p style="${BODY_P}">${actionLine}</p>
<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#333333;">Your verification code:</p>
<p style="margin:0 0 20px 0;font-size:28px;font-weight:700;letter-spacing:0.25em;color:${otpColor};">${otpCode}</p>
<p style="${BODY_MUTED}">This code expires in ${input.expiresMinutes} minutes. ${cautionLine}</p>`;
}

/** Inbox subject — short action + listing. */
export function settingsVerificationOtpEmailSubject(listingName: string): string {
  const name = listingName.trim() || 'your listing';
  return `Payment verification code — ${name}`;
}

async function resolveBrandingPropertyId(
  supabase: SupabaseClient,
  propertyId: string | null | undefined,
  organizationId: string
): Promise<string | undefined> {
  if (propertyId?.trim()) return propertyId.trim();
  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? undefined;
}

export async function sendSettingsVerificationOtpEmail(opts: {
  supabase: SupabaseClient;
  organizationId: string;
  ownerId: string;
  actorUserId: string;
  listingName: string;
  settingLabel: string;
  code: string;
  expiresMinutes: number;
  propertyId?: string | null;
  parkingId?: string | null;
}): Promise<void> {
  const owner = await loadAuthUserProfile(opts.supabase, opts.ownerId);
  if (!owner.email?.trim()) {
    throw new Error('Organization owner has no email on file');
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  if (!resendKey) {
    throw new Error('Email is not configured');
  }

  const isOwnerActor = opts.actorUserId === opts.ownerId;
  const actor = await resolveSettingsChangeActor({
    supabase: opts.supabase,
    actorUserId: opts.actorUserId,
    ownerId: opts.ownerId,
    organizationId: opts.organizationId,
    propertyId: opts.propertyId,
    parkingId: opts.parkingId,
  });

  const brandingPropertyId = await resolveBrandingPropertyId(
    opts.supabase,
    opts.propertyId,
    opts.organizationId
  );
  const settings = await resolveAppSettings(brandingPropertyId);
  const branding = await loadPropertyEmailBranding(brandingPropertyId);
  const otpColor = resolveEmailReadableOnWhiteHex(settings.brandColor);

  const contentOverride = buildOtpBodyHtml({
    otpColorHex: otpColor,
    isOwnerActor,
    ownerName: owner.name || 'there',
    actorName: actor.name,
    actorRole: actor.roleLabel,
    settingLabel: opts.settingLabel,
    listingName: opts.listingName,
    otpCode: opts.code,
    expiresMinutes: opts.expiresMinutes,
  });

  const html = await renderPropertyTemplateSendEmail({
    propertyId: brandingPropertyId,
    templateKey: 'email-booking-acknowledgement',
    emailTitle: 'Payment verification',
    contentOverride,
    branding,
    placeholderVars: {
      organization_name: escapeHtml(branding.organizationName),
      property_name: escapeHtml(opts.listingName),
      tower_and_unit_number: escapeHtml(branding.unitLabel),
      check_in_date: '',
      check_out_date: '',
    },
  });

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: formatResendFromAddress(branding.organizationName, branding.fromEmail),
      to: [owner.email.trim()],
      reply_to: settings.emailReplyTo,
      subject: settingsVerificationOtpEmailSubject(opts.listingName),
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[settingsVerificationOtpEmail] send failed', res.status, body.slice(0, 200));
    throw new Error('Could not send verification email');
  }
}
