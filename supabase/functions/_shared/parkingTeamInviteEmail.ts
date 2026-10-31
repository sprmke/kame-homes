/**
 * Parking team invite email — Resend + org property email shell for branding.
 */

import { resolveAppSettings } from './appSettings.ts';
import { formatResendFromAddress, loadPropertyEmailBranding } from './propertyEmailBranding.ts';
import { renderPropertyTemplateSendEmail } from './propertyTemplateEmail.ts';
import {
  BUILTIN_PARKING_ROLE_EMAIL_DESCRIPTIONS,
  type BuiltinParkingRole,
  isBuiltinParkingRole,
} from './parkingTeamPermissions.ts';
import { escapeHtml, withEmailShellStyleVars } from './renderEmailHtml.ts';
import { createServiceClient, type ParkingRow } from './orgAuth.ts';

const BUILTIN_ROLE_LABELS: Record<BuiltinParkingRole, string> = {
  MANAGER: 'Full Access',
  STAFF: 'Operations',
  VIEWER: 'Read Only',
};

function buildAcceptInviteCtaHtml(acceptUrl: string, brandColor: string): string {
  if (!acceptUrl.trim()) return '';
  const ctaStyle = withEmailShellStyleVars({}, brandColor).emailShellCtaBtnStyle;
  return `<div class="cta-wrap" style="margin:28px 0 8px 0;text-align:center;"><a class="cta-btn" style="${ctaStyle}" href="${escapeHtml(acceptUrl)}" target="_blank" rel="noopener">Accept invitation</a></div>`;
}

function formatInviteExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatParkingLocation(parking: ParkingRow): string {
  const parts: string[] = [parking.name.trim()];
  if (parking.residence_name?.trim()) parts.push(parking.residence_name.trim());
  if (parking.tower?.trim()) parts.push(parking.tower.trim());
  if (parking.level?.trim()) parts.push(`Level ${parking.level.trim()}`);
  if (parking.slot_label?.trim()) parts.push(`Slot ${parking.slot_label.trim()}`);
  return parts.filter(Boolean).join(' - ');
}

async function getFirstPropertyIdForOrg(organizationId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

const INVITE_BODY_TEMPLATE = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;"><strong>{{invited_by_name}}</strong> invites you to join <strong>{{parking_location}}</strong> as <strong>{{role_label}}</strong>.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">{{role_description}}</p>
<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#333333;">Accept this invitation by signing in with <strong>{{invite_email}}</strong>.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">This invitation expires on {{expires_at}}.</p>
<p>{{accept_invite_cta}}</p>`;

export async function sendParkingTeamInviteEmail(input: {
  parking: ParkingRow;
  inviteEmail: string;
  token: string;
  roleId: string;
  invitedByName: string;
  expiresAtIso: string;
}): Promise<void> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY');
  }

  const brandingPropertyId = await getFirstPropertyIdForOrg(input.parking.organization_id);
  if (!brandingPropertyId) {
    throw new Error(
      'Cannot send parking team invitation email: organization has no properties for email branding'
    );
  }

  const roleLabel = isBuiltinParkingRole(input.roleId)
    ? BUILTIN_ROLE_LABELS[input.roleId]
    : 'Team member';
  const roleDescription = isBuiltinParkingRole(input.roleId)
    ? BUILTIN_PARKING_ROLE_EMAIL_DESCRIPTIONS[input.roleId]
    : 'This role grants access to this parking slot.';

  const settings = await resolveAppSettings(brandingPropertyId);
  const branding = await loadPropertyEmailBranding(brandingPropertyId);
  const parkingLocation = formatParkingLocation(input.parking);

  const acceptUrl = `${settings.publicGuestAppOrigin.replace(/\/+$/, '')}/accept-invite?token=${encodeURIComponent(input.token)}&scope=parking`;
  const emailSubject = `${branding.organizationName} - ${input.parking.name} - Team Invitation`;

  const html = await renderPropertyTemplateSendEmail({
    propertyId: brandingPropertyId,
    templateKey: 'email-booking-acknowledgement',
    emailTitle: 'Team Invitation',
    contentOverride: INVITE_BODY_TEMPLATE,
    branding,
    placeholderVars: {
      property_name: escapeHtml(branding.propertyName || branding.organizationName),
      parking_location: escapeHtml(parkingLocation),
      role_label: escapeHtml(roleLabel),
      role_description: escapeHtml(roleDescription),
      invited_by_name: escapeHtml(input.invitedByName),
      expires_at: escapeHtml(formatInviteExpiry(input.expiresAtIso)),
      invite_email: escapeHtml(input.inviteEmail),
      accept_invite_cta: buildAcceptInviteCtaHtml(acceptUrl, settings.brandColor),
      tower_and_unit_number: escapeHtml(branding.unitLabel),
      check_in_date: '',
      check_out_date: '',
    },
  });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: formatResendFromAddress(branding.organizationName, branding.fromEmail),
      to: [input.inviteEmail],
      reply_to: settings.emailReplyTo,
      subject: emailSubject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Failed to send invitation email (${res.status})${body ? `: ${body.slice(0, 200)}` : ''}`
    );
  }
}
