/**
 * Team notice after sensitive settings are saved — branded email shell.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { resolveAppSettings } from './appSettings.ts';
import { formatResendFromAddress, loadPropertyEmailBranding } from './propertyEmailBranding.ts';
import { renderPropertyTemplateSendEmail } from './propertyTemplateEmail.ts';
import {
  collectParkingSettingsNotifyEmails,
  collectPropertySettingsNotifyEmails,
} from './settingsChangeNotifyRecipients.ts';
import { resolveSettingsChangeActor } from './settingsVerificationActor.ts';
import { escapeHtml } from './renderEmailHtml.ts';

const RESEND_API = 'https://api.resend.com/emails';

const NOTICE_BODY_TEMPLATE = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;"><strong>{{setting_label}}</strong> for <strong>{{listing_name}}</strong> was updated.</p>
<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#333333;">Updated by: <strong>{{actor_name}}</strong> ({{actor_role}})</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">{{updated_at}} (Asia/Manila)</p>`;

function formatManilaTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

export async function sendSettingsChangeNoticeEmails(opts: {
  supabase: SupabaseClient;
  organizationId: string;
  recipients: string[];
  listingName: string;
  settingLabel: string;
  actorUserId: string;
  ownerId: string;
  propertyId?: string | null;
  parkingId?: string | null;
}): Promise<void> {
  if (opts.recipients.length === 0) return;

  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  if (!resendKey) {
    console.warn('[settingsChangeNotifyEmail] RESEND missing — skip');
    return;
  }

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
  const updatedAt = formatManilaTimestamp(new Date().toISOString());

  const html = await renderPropertyTemplateSendEmail({
    propertyId: brandingPropertyId,
    templateKey: 'email-booking-acknowledgement',
    emailTitle: 'Settings updated',
    contentOverride: NOTICE_BODY_TEMPLATE,
    branding,
    placeholderVars: {
      setting_label: escapeHtml(opts.settingLabel),
      listing_name: escapeHtml(opts.listingName),
      actor_name: escapeHtml(actor.name),
      actor_role: escapeHtml(actor.roleLabel),
      updated_at: escapeHtml(updatedAt),
      organization_name: escapeHtml(branding.organizationName),
      property_name: escapeHtml(opts.listingName),
      tower_and_unit_number: escapeHtml(branding.unitLabel),
      check_in_date: '',
      check_out_date: '',
    },
  });

  const subject = `${opts.listingName} — ${opts.settingLabel} updated`;

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: formatResendFromAddress(branding.organizationName, branding.fromEmail),
      to: opts.recipients,
      reply_to: settings.emailReplyTo,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[settingsChangeNotifyEmail] send failed', res.status, body.slice(0, 200));
  }
}

export async function notifyPropertyPaymentSettingsChanged(opts: {
  supabase: SupabaseClient;
  organizationId: string;
  propertyId: string;
  ownerId: string;
  propertyName: string;
  actorUserId: string;
}): Promise<void> {
  const recipients = await collectPropertySettingsNotifyEmails(
    opts.supabase,
    opts.organizationId,
    opts.propertyId,
    opts.ownerId
  );
  await sendSettingsChangeNoticeEmails({
    supabase: opts.supabase,
    organizationId: opts.organizationId,
    recipients,
    listingName: opts.propertyName,
    settingLabel: 'Payment settings',
    actorUserId: opts.actorUserId,
    ownerId: opts.ownerId,
    propertyId: opts.propertyId,
  });
}

export async function notifyParkingPaymentSettingsChanged(opts: {
  supabase: SupabaseClient;
  organizationId: string;
  parkingId: string;
  ownerId: string;
  parkingName: string;
  actorUserId: string;
}): Promise<void> {
  const recipients = await collectParkingSettingsNotifyEmails(
    opts.supabase,
    opts.organizationId,
    opts.parkingId,
    opts.ownerId
  );
  await sendSettingsChangeNoticeEmails({
    supabase: opts.supabase,
    organizationId: opts.organizationId,
    recipients,
    listingName: opts.parkingName,
    settingLabel: 'Payment settings',
    actorUserId: opts.actorUserId,
    ownerId: opts.ownerId,
    parkingId: opts.parkingId,
  });
}
