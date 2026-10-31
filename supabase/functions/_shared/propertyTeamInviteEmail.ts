/**
 * Property team invitation email — Resend + configurable template shell.
 */

import { resolveAppSettings } from './appSettings.ts';
import { formatResendFromAddress, loadPropertyEmailBranding } from './propertyEmailBranding.ts';
import { renderPropertyTemplateSendEmail } from './propertyTemplateEmail.ts';
import { createServiceClient } from './orgAuth.ts';
import {
  isPropertyAdminRoleId,
  normalizePermissionIds,
  PROPERTY_ADMIN_EMAIL_DESCRIPTION,
  type PropertyCustomRoleRow,
} from './propertyTeamPermissions.ts';
import { escapeHtml, withEmailShellStyleVars } from './renderEmailHtml.ts';

function resolveRoleLabel(
  roleId: string,
  customRolesById: Map<string, PropertyCustomRoleRow>
): string {
  if (isPropertyAdminRoleId(roleId)) {
    return 'Custom';
  }
  return customRolesById.get(roleId)?.name ?? 'Custom';
}

function resolveRoleDescription(
  roleId: string,
  customRolesById: Map<string, PropertyCustomRoleRow>
): string {
  if (isPropertyAdminRoleId(roleId)) {
    return PROPERTY_ADMIN_EMAIL_DESCRIPTION;
  }
  const custom = customRolesById.get(roleId);
  if (custom) {
    return 'This permission template grants scoped access to this property based on assigned permissions.';
  }
  return 'This role grants access to this property.';
}

async function loadCustomRolesMap(propertyId: string): Promise<Map<string, PropertyCustomRoleRow>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('property_custom_roles')
    .select('id, property_id, name, permissions')
    .eq('property_id', propertyId);

  if (error) {
    throw new Error(`Failed to load custom roles: ${error.message}`);
  }

  const map = new Map<string, PropertyCustomRoleRow>();
  for (const row of data ?? []) {
    map.set(row.id as string, {
      id: row.id as string,
      property_id: row.property_id as string,
      name: row.name as string,
      permissions: normalizePermissionIds(row.permissions),
    });
  }
  return map;
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

function formatPropertyInviteLocation(branding: {
  propertyName: string;
  unitLabel: string;
}): string {
  const name = branding.propertyName.trim();
  const unit = branding.unitLabel.trim();
  if (!unit || unit === name) return name;
  return `${name} - ${unit}`;
}

const INVITE_BODY_TEMPLATE = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;"><strong>{{invited_by_name}}</strong> invites you to join <strong>{{property_location}}</strong> as <strong>{{role_label}}</strong>.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">{{role_description}}</p>
<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#333333;">Accept this invitation by signing in with <strong>{{invite_email}}</strong>.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">This invitation expires on {{expires_at}}.</p>
<p>{{accept_invite_cta}}</p>`;

export async function sendPropertyTeamInviteEmail(input: {
  propertyId: string;
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

  const propertyId = input.propertyId;
  const settings = await resolveAppSettings(propertyId);
  const branding = await loadPropertyEmailBranding(propertyId);
  const customRoles = await loadCustomRolesMap(propertyId);

  const acceptUrl = `${settings.publicGuestAppOrigin.replace(/\/+$/, '')}/accept-invite?token=${encodeURIComponent(input.token)}`;
  const roleLabel = resolveRoleLabel(input.roleId, customRoles);
  const roleDescription = resolveRoleDescription(input.roleId, customRoles);
  const propertyLocation = formatPropertyInviteLocation(branding);
  const emailSubject = `${branding.organizationName} - ${branding.propertyName} - Team Invitation`;

  const html = await renderPropertyTemplateSendEmail({
    propertyId,
    templateKey: 'email-booking-acknowledgement',
    emailTitle: 'Team Invitation',
    contentOverride: INVITE_BODY_TEMPLATE,
    branding,
    placeholderVars: {
      property_name: escapeHtml(branding.propertyName || branding.organizationName),
      property_location: escapeHtml(propertyLocation),
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
