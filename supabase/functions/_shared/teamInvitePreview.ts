/**
 * Public team invite preview — org/property/parking labels + logo for /accept-invite.
 */

import { resolveAppSettings } from './appSettings.ts';
import { loadPropertyEmailBranding } from './propertyEmailBranding.ts';
import { createServiceClient } from './orgAuth.ts';
import { DEFAULT_EMAIL_LOGO_URL } from './renderEmailHtml.ts';
import { isPropertyAdminRoleId } from './propertyTeamPermissions.ts';
import { isBuiltinParkingRole, type BuiltinParkingRole } from './parkingTeamPermissions.ts';

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

const BUILTIN_PARKING_ROLE_LABELS: Record<BuiltinParkingRole, string> = {
  MANAGER: 'Full Access',
  STAFF: 'Operations',
  VIEWER: 'Read Only',
};

export type OrgTeamInvitePreview = {
  kind: 'org';
  orgName: string;
  logoUrl: string;
  inviteEmail: string;
  roleLabel: string;
};

export type PropertyTeamInvitePreview = {
  kind: 'property';
  orgName: string;
  propertyName: string;
  unitLabel: string;
  propertyLocation: string;
  logoUrl: string;
  inviteEmail: string;
  roleLabel: string;
};

export type ParkingTeamInvitePreview = {
  kind: 'parking';
  orgName: string;
  parkingName: string;
  parkingLocation: string;
  logoUrl: string;
  inviteEmail: string;
  roleLabel: string;
};

export type TeamInvitePreview =
  OrgTeamInvitePreview | PropertyTeamInvitePreview | ParkingTeamInvitePreview;

function formatPropertyLocation(propertyName: string, unitLabel: string): string {
  const name = propertyName.trim();
  const unit = unitLabel.trim();
  if (!unit || unit === name) return name;
  return `${name} - ${unit}`;
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

async function resolveLogoUrl(propertyId: string | null): Promise<string> {
  if (!propertyId) return DEFAULT_EMAIL_LOGO_URL;
  const settings = await resolveAppSettings(propertyId);
  return settings.emailLogoUrl || DEFAULT_EMAIL_LOGO_URL;
}

async function loadPropertyRoleLabel(propertyId: string, roleId: string): Promise<string> {
  if (isPropertyAdminRoleId(roleId)) {
    return 'Custom';
  }
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('property_custom_roles')
    .select('name')
    .eq('id', roleId)
    .eq('property_id', propertyId)
    .maybeSingle();
  return (data?.name as string | undefined) ?? 'Custom';
}

function assertPendingInvite(invite: { status: string; expires_at: string }): void {
  if (invite.status !== 'pending') {
    throw new Error('Invitation is no longer valid');
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    throw new Error('Invitation has expired');
  }
}

async function previewOrgInvite(token: string): Promise<OrgTeamInvitePreview> {
  const supabase = createServiceClient();
  const { data: invite, error } = await supabase
    .from('organization_invitations')
    .select('email, role_id, status, expires_at, organization_id')
    .eq('token', token)
    .maybeSingle();

  if (error || !invite) {
    throw new Error('Invitation not found');
  }
  assertPendingInvite(invite);

  const organizationId = invite.organization_id as string;
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .maybeSingle();

  const brandingPropertyId = await getFirstPropertyIdForOrg(organizationId);
  const logoUrl = await resolveLogoUrl(brandingPropertyId);

  return {
    kind: 'org',
    orgName: (org?.name as string | undefined) ?? 'Organization',
    logoUrl,
    inviteEmail: invite.email as string,
    roleLabel: await loadOrgRoleLabel(organizationId, invite.role_id as string),
  };
}

async function previewPropertyInvite(token: string): Promise<PropertyTeamInvitePreview> {
  const supabase = createServiceClient();
  const { data: invite, error } = await supabase
    .from('property_invitations')
    .select('email, role_id, status, expires_at, property_id')
    .eq('token', token)
    .maybeSingle();

  if (error || !invite) {
    throw new Error('Invitation not found');
  }
  assertPendingInvite(invite);

  const propertyId = invite.property_id as string;
  const branding = await loadPropertyEmailBranding(propertyId);
  const settings = await resolveAppSettings(propertyId);
  const roleLabel = await loadPropertyRoleLabel(propertyId, invite.role_id as string);

  return {
    kind: 'property',
    orgName: branding.organizationName,
    propertyName: branding.propertyName,
    unitLabel: branding.unitLabel,
    propertyLocation: formatPropertyLocation(branding.propertyName, branding.unitLabel),
    logoUrl: settings.emailLogoUrl,
    inviteEmail: invite.email as string,
    roleLabel,
  };
}

function formatParkingLocation(row: {
  name: string;
  residence_name: string | null;
  tower: string | null;
  level: string | null;
  slot_label: string;
}): string {
  const parts: string[] = [(row.name as string).trim()];
  if (row.residence_name?.trim()) parts.push(row.residence_name.trim());
  if (row.tower?.trim()) parts.push(row.tower.trim());
  if (row.level?.trim()) parts.push(`Level ${row.level.trim()}`);
  if (row.slot_label?.trim()) parts.push(`Slot ${row.slot_label.trim()}`);
  return parts.filter(Boolean).join(' - ');
}

async function previewParkingInvite(token: string): Promise<ParkingTeamInvitePreview> {
  const supabase = createServiceClient();
  const { data: invite, error } = await supabase
    .from('parking_invitations')
    .select('email, role_id, status, expires_at, parking_id')
    .eq('token', token)
    .maybeSingle();

  if (error || !invite) {
    throw new Error('Invitation not found');
  }
  assertPendingInvite(invite);

  const parkingId = invite.parking_id as string;
  const { data: parking } = await supabase
    .from('parkings')
    .select('name, residence_name, tower, level, slot_label, organization_id')
    .eq('id', parkingId)
    .maybeSingle();

  if (!parking?.organization_id) {
    throw new Error('Parking not found');
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', parking.organization_id as string)
    .maybeSingle();

  const brandingPropertyId = await getFirstPropertyIdForOrg(parking.organization_id as string);
  const logoUrl = await resolveLogoUrl(brandingPropertyId);
  const roleId = invite.role_id as string;
  const roleLabel = isBuiltinParkingRole(roleId)
    ? BUILTIN_PARKING_ROLE_LABELS[roleId]
    : 'Team member';

  return {
    kind: 'parking',
    orgName: (org?.name as string | undefined) ?? 'Organization',
    parkingName: (parking.name as string) || 'Parking',
    parkingLocation: formatParkingLocation(parking),
    logoUrl,
    inviteEmail: invite.email as string,
    roleLabel,
  };
}

/** Resolve invite branding for accept-invite page. Honors optional scope hint. */
export async function getTeamInvitePreview(
  token: string,
  scope?: string | null
): Promise<TeamInvitePreview> {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('token is required');

  if (scope === 'org') {
    return await previewOrgInvite(trimmed);
  }
  if (scope === 'parking') {
    return await previewParkingInvite(trimmed);
  }
  if (scope === 'property') {
    return await previewPropertyInvite(trimmed);
  }

  try {
    return await previewPropertyInvite(trimmed);
  } catch (propertyError) {
    try {
      return await previewParkingInvite(trimmed);
    } catch (parkingError) {
      try {
        return await previewOrgInvite(trimmed);
      } catch {
        throw propertyError;
      }
    }
  }
}
