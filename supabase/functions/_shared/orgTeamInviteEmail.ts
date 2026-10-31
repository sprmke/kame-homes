/**
 * Org team invitation email — Resend + property email shell for branding.
 */

import { resolveAppSettings } from './appSettings.ts';
import { formatResendFromAddress, loadPropertyEmailBranding } from './propertyEmailBranding.ts';
import { renderPropertyTemplateSendEmail } from './propertyTemplateEmail.ts';
import { escapeHtml, withEmailShellStyleVars } from './renderEmailHtml.ts';
import { createServiceClient } from './orgAuth.ts';

const ORG_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Full Access',
};

async function loadOrgRoleLabel(organizationId: string, roleId: string): Promise<string> {
  if (ORG_ROLE_LABELS[roleId]) return ORG_ROLE_LABELS[roleId]!;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('organization_custom_roles')
    .select('name')
    .eq('id', roleId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  return (data?.name as string | undefined) ?? 'Team member';
}

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

const INVITE_BODY_TEMPLATE = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;"><strong>{{invited_by_name}}</strong> invites you to join <strong>{{organization_name}}</strong> as an organization <strong>{{role_label}}</strong>.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">Organization admins can access and manage all properties in this organization.</p>
<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#333333;">Accept this invitation by signing in with <strong>{{invite_email}}</strong>.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">This invitation expires on {{expires_at}}.</p>
<p>{{accept_invite_cta}}</p>`;

export async function sendOrgTeamInviteEmail(input: {
  organizationId: string;
  brandingPropertyId: string | null;
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

  const brandingPropertyId = input.brandingPropertyId?.trim() ?? '';
  if (!brandingPropertyId) {
    throw new Error(
      'Cannot send org team invitation email: organization has no properties for email branding'
    );
  }

  const supabase = createServiceClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', input.organizationId)
    .maybeSingle();

  const orgName = (org?.name as string | undefined) ?? 'Organization';
  const roleLabel = await loadOrgRoleLabel(input.organizationId, input.roleId);

  const settings = await resolveAppSettings(brandingPropertyId);
  const branding = await loadPropertyEmailBranding(brandingPropertyId);

  const acceptUrl = `${settings.publicGuestAppOrigin.replace(/\/+$/, '')}/accept-invite?token=${encodeURIComponent(input.token)}&scope=org`;
  const emailSubject = `${branding.organizationName || orgName} - Team Invitation`;

  const html = await renderPropertyTemplateSendEmail({
    propertyId: brandingPropertyId,
    templateKey: 'email-booking-acknowledgement',
    emailTitle: 'Team Invitation',
    contentOverride: INVITE_BODY_TEMPLATE,
    branding,
    placeholderVars: {
      organization_name: escapeHtml(orgName),
      property_name: escapeHtml(orgName),
      role_label: escapeHtml(roleLabel),
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
      from: formatResendFromAddress(branding.organizationName || orgName, branding.fromEmail),
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

  const sent = (await res.json().catch(() => ({}))) as { id?: string };
  console.log('[orgTeamInviteEmail] sent', {
    to: input.inviteEmail,
    organizationId: input.organizationId,
    resendId: sent.id ?? null,
  });
}
