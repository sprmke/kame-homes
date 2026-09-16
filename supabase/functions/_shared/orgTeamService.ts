/**
 * Org team — DB helpers, serialization, and mutations.
 */

import type { SupabaseClient } from './supabaseJs.ts';
import {
  createServiceClient,
  hasOrgTeamMemberEditPermission,
  type OrgRow,
  verifyOrgTeamAccess,
  type OrgTeamAccessContext,
} from './orgAuth.ts';
import {
  assertValidOrgRoleId,
  inviteExpiresAt,
  normalizeInviteEmail,
  normalizeOrgPermissionIds,
  ORG_ROLE_PERMISSIONS,
  parseOrgListingAssignments,
  virtualOrgOwnerMemberId,
} from './orgTeamPermissions.ts';
import {
  parseListingAssignmentsFromBody,
  parseListingAssignmentsPayload,
  syncOrgListingMemberships,
  type ParsedOrgListingAssignments,
} from './orgTeamListingAssignment.ts';
import {
  findOrgTemplateIdByName,
  isSeededOrgTemplateName,
  seedOrgTeamTemplates,
  SEEDED_ORG_TEMPLATE_NAMES,
} from './orgTeamTemplates.ts';
import { readOrgIdFromUrl, readOrgSlugFromUrl } from './propertyScope.ts';
import { sendOrgTeamInviteEmail } from './orgTeamInviteEmail.ts';
import { assertAllowedTeamInviteEmail } from './teamInviteEmail.ts';
import { parseTeamInviteContactFields } from './teamInviteContact.ts';
import { validatePhilippineMobilePhone } from './fieldValidation.ts';
import {
  reconcileTeamSeatsForOrganization,
  requireOrgTeamInviteAllowed,
  resolveTeamInviteCapacityForOrg,
  type TeamInviteCapacity,
} from './planEntitlements.ts';

export type SerializedOrgCustomRole = {
  id: string;
  name: string;
  permissions: string[];
  allListings: boolean;
  listingAssignments: ReturnType<typeof parseOrgListingAssignments>;
};

export type SerializedOrgTeamMember = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  displayName: string;
  contactPhone: string;
  role: string;
  permissions: string[];
  allListings: boolean;
  listingAssignments: Record<string, unknown> | null;
  listingScopeSummary: string;
  status: 'active' | 'inactive';
  assignedAt: string;
  lastActive: string | null;
  assignedBy: string;
  isOwner: boolean;
  planLimited: boolean;
};

export type SerializedOrgTeamInvitation = {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  allListings: boolean;
  listingAssignments: Record<string, unknown> | null;
  listingScopeSummary: string;
  sentAt: string;
  expiresAt: string;
  sentBy: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
};

type AuthProfile = {
  name: string;
  email: string;
  avatar: string | null;
};

export function readTeamOrgId(url: URL, body: Record<string, unknown>): string {
  const fromUrl = readOrgIdFromUrl(url);
  if (fromUrl) return fromUrl;
  const fromBody = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  return fromBody;
}

export function readTeamOrgSlug(url: URL): string | null {
  return readOrgSlugFromUrl(url);
}

export async function requireOrgTeamContext(
  req: Request,
  orgId: string,
  orgSlug: string | null,
  options?: {
    requireManage?: boolean;
    requireInvite?: boolean;
    requireMemberEdit?: boolean;
    requireMemberDelete?: boolean;
    requireInvitationEdit?: boolean;
    requireInvitationDelete?: boolean;
  }
): Promise<OrgTeamAccessContext> {
  if (orgId) {
    return verifyOrgTeamAccess(req, { orgId }, options);
  }
  if (orgSlug) {
    return verifyOrgTeamAccess(req, { orgSlug }, options);
  }
  throw new Response(JSON.stringify({ success: false, error: 'org_id or org_slug is required' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getAuthProfile(supabase: SupabaseClient, userId: string): Promise<AuthProfile> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) {
    return { name: 'Unknown', email: '', avatar: null };
  }
  const email = data.user.email ?? '';
  const meta = data.user.user_metadata ?? {};
  const name =
    typeof meta.full_name === 'string' && meta.full_name.trim()
      ? meta.full_name.trim()
      : typeof meta.name === 'string' && meta.name.trim()
        ? meta.name.trim()
        : email.split('@')[0] || 'User';
  const avatar =
    typeof meta.avatar_url === 'string'
      ? meta.avatar_url
      : typeof meta.picture === 'string'
        ? meta.picture
        : null;
  return { name, email, avatar };
}

function isoDateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function formatListingScopeSummary(
  allListings: boolean,
  assignments: ReturnType<typeof parseOrgListingAssignments>
): string {
  if (allListings) return 'All listings';
  const propertyCount = assignments?.properties?.length ?? 0;
  const parkingCount = assignments?.parkings?.length ?? 0;
  if (propertyCount === 0 && parkingCount === 0) return 'No listings';
  const parts: string[] = [];
  if (propertyCount > 0) {
    parts.push(`${propertyCount} propert${propertyCount === 1 ? 'y' : 'ies'}`);
  }
  if (parkingCount > 0) {
    parts.push(`${parkingCount} parking${parkingCount === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}

function serializeMemberRow(
  row: Record<string, unknown>,
  profile: AuthProfile,
  assignedByLabel: string,
  isOwner: boolean
): SerializedOrgTeamMember {
  const displayName =
    typeof row.display_name === 'string' && row.display_name.trim()
      ? row.display_name.trim()
      : profile.name;
  const contactPhone = typeof row.contact_phone === 'string' ? row.contact_phone.trim() : '';
  const allListings = row.all_listings === true;
  const listingAssignments = parseOrgListingAssignments(row.listing_assignments);
  const permissions = normalizeOrgPermissionIds(
    Array.isArray(row.permissions) ? (row.permissions as string[]) : []
  );

  return {
    id: row.id as string,
    name: displayName,
    email: profile.email,
    avatar: profile.avatar,
    displayName,
    contactPhone,
    role: row.role_id as string,
    permissions,
    allListings,
    listingAssignments: listingAssignments as Record<string, unknown> | null,
    listingScopeSummary: formatListingScopeSummary(allListings, listingAssignments),
    status: row.status as 'active' | 'inactive',
    assignedAt: isoDateOnly(row.assigned_at as string),
    lastActive: row.last_active_at ? isoDateOnly(row.last_active_at as string) : null,
    assignedBy: assignedByLabel,
    isOwner,
    planLimited: row.plan_limited === true,
  };
}

function serializeVirtualOwnerMember(
  org: OrgRow,
  profile: AuthProfile,
  contactRow: Record<string, unknown> | null,
  displayRoleId: string
): SerializedOrgTeamMember {
  const displayName =
    contactRow && typeof contactRow.display_name === 'string' && contactRow.display_name.trim()
      ? contactRow.display_name.trim()
      : profile.name;
  const contactPhone =
    contactRow && typeof contactRow.contact_phone === 'string'
      ? contactRow.contact_phone.trim()
      : '';

  return {
    id: virtualOrgOwnerMemberId(org.owner_id),
    name: displayName,
    email: profile.email,
    avatar: profile.avatar,
    displayName,
    contactPhone,
    role: displayRoleId,
    permissions: normalizeOrgPermissionIds([...ORG_ROLE_PERMISSIONS.OWNER]),
    allListings: true,
    listingAssignments: null,
    listingScopeSummary: 'All listings',
    status: 'active',
    assignedAt: isoDateOnly(org.created_at),
    lastActive: null,
    assignedBy: 'System',
    isOwner: true,
    planLimited: false,
  };
}

export async function getOrgTeamInviteCapacity(
  organizationId: string
): Promise<TeamInviteCapacity> {
  try {
    await reconcileTeamSeatsForOrganization(organizationId);
  } catch (error) {
    console.error(
      '[orgTeam] reconcileTeamSeatsForOrganization failed:',
      error instanceof Error ? error.message : error
    );
  }
  try {
    return await resolveTeamInviteCapacityForOrg(organizationId);
  } catch (error) {
    console.error(
      '[orgTeam] resolveTeamInviteCapacityForOrg failed:',
      error instanceof Error ? error.message : error
    );
    return {
      slotsUsed: 0,
      maxMembers: null,
      teamManagementEnabled: false,
      canInvite: false,
    };
  }
}

export async function listOrgTeamMembers(
  ctx: OrgTeamAccessContext
): Promise<SerializedOrgTeamMember[]> {
  const supabase = createServiceClient();
  const organizationId = ctx.org.id;
  const fullAccessRoleId = await resolveOrgFullAccessRoleId(supabase, organizationId);

  const { data: rows, error } = await supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', organizationId)
    .order('assigned_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list members: ${error.message}`);
  }

  const members: SerializedOrgTeamMember[] = [];
  let ownerIncluded = false;

  for (const row of rows ?? []) {
    if (row.user_id === ctx.org.owner_id) {
      ownerIncluded = true;
    }
    const profile = await getAuthProfile(supabase, row.user_id as string);
    const assignedBy = row.invited_by
      ? (await getAuthProfile(supabase, row.invited_by as string)).name
      : 'System';
    const isOwner = row.user_id === ctx.org.owner_id;
    const member = serializeMemberRow(row, profile, assignedBy, isOwner);
    if (isOwner && fullAccessRoleId) {
      member.role = fullAccessRoleId;
    }
    members.push(member);
  }

  if (!ownerIncluded) {
    const ownerProfile = await getAuthProfile(supabase, ctx.org.owner_id);
    const { data: ownerMemberRow } = await supabase
      .from('organization_members')
      .select('display_name, contact_phone')
      .eq('organization_id', organizationId)
      .eq('user_id', ctx.org.owner_id)
      .maybeSingle();
    members.unshift(
      serializeVirtualOwnerMember(
        ctx.org,
        ownerProfile,
        ownerMemberRow as Record<string, unknown> | null,
        fullAccessRoleId ?? 'OWNER'
      )
    );
  }

  return members;
}

export async function listOrgTeamInvitations(
  organizationId: string
): Promise<SerializedOrgTeamInvitation[]> {
  const supabase = createServiceClient();
  const now = new Date();

  const { data: rows, error } = await supabase
    .from('organization_invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'accepted', 'expired', 'cancelled'])
    .order('sent_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list invitations: ${error.message}`);
  }

  const out: SerializedOrgTeamInvitation[] = [];

  for (const row of rows ?? []) {
    let status = row.status as SerializedOrgTeamInvitation['status'];
    if (status === 'pending' && new Date(row.expires_at as string).getTime() < now.getTime()) {
      await supabase
        .from('organization_invitations')
        .update({ status: 'expired' })
        .eq('id', row.id);
      status = 'expired';
    }

    const sentByProfile = await getAuthProfile(supabase, row.sent_by as string);
    const allListings = row.all_listings === true;
    const listingAssignments = parseOrgListingAssignments(row.listing_assignments);

    out.push({
      id: row.id as string,
      email: row.email as string,
      role: row.role_id as string,
      permissions: normalizeOrgPermissionIds(
        Array.isArray(row.permissions) ? (row.permissions as string[]) : []
      ),
      allListings,
      listingAssignments: listingAssignments as Record<string, unknown> | null,
      listingScopeSummary: formatListingScopeSummary(allListings, listingAssignments),
      sentAt: isoDateOnly(row.sent_at as string),
      expiresAt: isoDateOnly(row.expires_at as string),
      sentBy: sentByProfile.name,
      status,
    });
  }

  return out.filter((i) => i.status === 'pending');
}

async function findActiveOrgMemberByEmail(
  supabase: SupabaseClient,
  organizationId: string,
  email: string
): Promise<boolean> {
  const normalized = normalizeInviteEmail(email);
  const { data: rows } = await supabase
    .from('organization_members')
    .select('user_id, status')
    .eq('organization_id', organizationId)
    .eq('status', 'active');

  for (const row of rows ?? []) {
    const profile = await getAuthProfile(supabase, row.user_id as string);
    if (normalizeInviteEmail(profile.email) === normalized) return true;
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', organizationId)
    .maybeSingle();

  if (org?.owner_id) {
    const ownerProfile = await getAuthProfile(supabase, org.owner_id as string);
    if (normalizeInviteEmail(ownerProfile.email) === normalized) return true;
  }

  return false;
}

async function getFirstPropertyIdForOrg(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function loadOrgTemplateNameRows(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('organization_custom_roles')
    .select('id, name')
    .eq('organization_id', organizationId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));
}

async function resolveOrgFullAccessRoleId(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string | null> {
  const rows = await loadOrgTemplateNameRows(supabase, organizationId);
  return findOrgTemplateIdByName(rows, SEEDED_ORG_TEMPLATE_NAMES.FULL_ACCESS) ?? null;
}

async function loadOrgCustomRolesMap(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Map<string, { permissions: string[] }>> {
  const { data, error } = await supabase
    .from('organization_custom_roles')
    .select('id, permissions')
    .eq('organization_id', organizationId);
  if (error) throw new Error(error.message);
  const map = new Map<string, { permissions: string[] }>();
  for (const row of data ?? []) {
    map.set(row.id as string, {
      permissions: normalizeOrgPermissionIds(row.permissions as string[]),
    });
  }
  return map;
}

function resolveOrgInvitePermissions(
  body: Record<string, unknown>,
  roleId: string,
  customRoles: Map<string, { permissions: string[] }>
): string[] {
  const raw = body.permissions;
  if (Array.isArray(raw) && raw.length > 0) {
    return normalizeOrgPermissionIds(
      raw.filter((item): item is string => typeof item === 'string')
    );
  }
  if (roleId !== 'ADMIN' && customRoles.has(roleId)) {
    return normalizeOrgPermissionIds(customRoles.get(roleId)?.permissions ?? []);
  }
  return normalizeOrgPermissionIds([...ORG_ROLE_PERMISSIONS.ADMIN]);
}

export async function createOrgInvitation(
  ctx: OrgTeamAccessContext,
  body: Record<string, unknown>
): Promise<SerializedOrgTeamInvitation> {
  await requireOrgTeamInviteAllowed(ctx.org.id);

  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  assertAllowedTeamInviteEmail(emailRaw);
  const email = normalizeInviteEmail(emailRaw);
  const roleId = typeof body.roleId === 'string' ? body.roleId.trim() : 'ADMIN';
  assertValidOrgRoleId(roleId);

  const supabase = createServiceClient();
  const organizationId = ctx.org.id;
  if (roleId !== 'ADMIN') {
    const { data: roleRow } = await supabase
      .from('organization_custom_roles')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('id', roleId)
      .maybeSingle();
    if (!roleRow?.id) {
      throw new Error('Selected org role template was not found');
    }
  }
  const contact = parseTeamInviteContactFields(body);
  const customRoles = await loadOrgCustomRolesMap(supabase, organizationId);
  const permissions = resolveOrgInvitePermissions({}, roleId, customRoles);
  const { allListings, assignments } = parseListingAssignmentsFromBody(body);

  if (!allListings && assignments.properties.length === 0 && assignments.parkings.length === 0) {
    throw new Error('Select at least one property or parking listing, or choose All listings');
  }

  if (await findActiveOrgMemberByEmail(supabase, organizationId, email)) {
    throw new Error('This email is already an active member of this organization');
  }

  const { data: pending } = await supabase
    .from('organization_invitations')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle();

  if (pending?.id) {
    throw new Error('A pending invitation already exists for this email');
  }

  const expiresAt = inviteExpiresAt();
  const { data, error } = await supabase
    .from('organization_invitations')
    .insert({
      organization_id: organizationId,
      email,
      role_id: roleId,
      permissions,
      all_listings: allListings,
      listing_assignments: allListings ? null : assignments,
      display_name: null,
      contact_phone: contact.contactPhone,
      expires_at: expiresAt.toISOString(),
      sent_by: ctx.user.id,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create invitation');
  }

  const sentByProfile = await getAuthProfile(supabase, ctx.user.id);
  const brandingPropertyId = await getFirstPropertyIdForOrg(supabase, organizationId);

  try {
    await sendOrgTeamInviteEmail({
      organizationId,
      brandingPropertyId,
      inviteEmail: data.email as string,
      token: data.token as string,
      roleId: data.role_id as string,
      invitedByName: sentByProfile.name,
      expiresAtIso: data.expires_at as string,
    });
  } catch (emailError) {
    await supabase.from('organization_invitations').delete().eq('id', data.id);
    const detail =
      emailError instanceof Error ? emailError.message : 'Failed to send invitation email';
    throw new Error(detail);
  }

  return {
    id: data.id as string,
    email: data.email as string,
    role: data.role_id as string,
    permissions: normalizeOrgPermissionIds(
      Array.isArray(data.permissions) ? (data.permissions as string[]) : []
    ),
    allListings: data.all_listings === true,
    listingAssignments: parseOrgListingAssignments(data.listing_assignments) as Record<
      string,
      unknown
    > | null,
    listingScopeSummary: formatListingScopeSummary(
      data.all_listings === true,
      parseOrgListingAssignments(data.listing_assignments)
    ),
    sentAt: isoDateOnly(data.sent_at as string),
    expiresAt: isoDateOnly(data.expires_at as string),
    sentBy: sentByProfile.name,
    status: 'pending',
  };
}

export async function resendOrgInvitation(
  ctx: OrgTeamAccessContext,
  invitationId: string
): Promise<SerializedOrgTeamInvitation> {
  const supabase = createServiceClient();
  const organizationId = ctx.org.id;

  const { data: existing, error: findError } = await supabase
    .from('organization_invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (findError || !existing) {
    throw new Error('Invitation not found');
  }
  if (existing.status !== 'pending') {
    throw new Error('Only pending invitations can be resent');
  }

  const previousToken = existing.token as string;
  const previousExpiresAt = existing.expires_at as string;
  const previousSentAt = existing.sent_at as string;
  const previousSentBy = existing.sent_by as string;

  const expiresAt = inviteExpiresAt();
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

  const { data, error } = await supabase
    .from('organization_invitations')
    .update({
      token,
      expires_at: expiresAt.toISOString(),
      sent_at: new Date().toISOString(),
      sent_by: ctx.user.id,
    })
    .eq('id', invitationId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to resend invitation');
  }

  const sentByProfile = await getAuthProfile(supabase, ctx.user.id);
  const brandingPropertyId = await getFirstPropertyIdForOrg(supabase, organizationId);

  try {
    await sendOrgTeamInviteEmail({
      organizationId,
      brandingPropertyId,
      inviteEmail: data.email as string,
      token: data.token as string,
      roleId: data.role_id as string,
      invitedByName: sentByProfile.name,
      expiresAtIso: data.expires_at as string,
    });
  } catch (emailError) {
    await supabase
      .from('organization_invitations')
      .update({
        token: previousToken,
        expires_at: previousExpiresAt,
        sent_at: previousSentAt,
        sent_by: previousSentBy,
      })
      .eq('id', invitationId);
    const detail =
      emailError instanceof Error ? emailError.message : 'Failed to send invitation email';
    throw new Error(detail);
  }

  return {
    id: data.id as string,
    email: data.email as string,
    role: data.role_id as string,
    permissions: normalizeOrgPermissionIds(
      Array.isArray(data.permissions) ? (data.permissions as string[]) : []
    ),
    allListings: data.all_listings === true,
    listingAssignments: parseOrgListingAssignments(data.listing_assignments) as Record<
      string,
      unknown
    > | null,
    listingScopeSummary: formatListingScopeSummary(
      data.all_listings === true,
      parseOrgListingAssignments(data.listing_assignments)
    ),
    sentAt: isoDateOnly(data.sent_at as string),
    expiresAt: isoDateOnly(data.expires_at as string),
    sentBy: sentByProfile.name,
    status: 'pending',
  };
}

export async function cancelOrgInvitation(
  organizationId: string,
  invitationId: string
): Promise<void> {
  const supabase = createServiceClient();
  const { data: existing, error: findError } = await supabase
    .from('organization_invitations')
    .select('status')
    .eq('id', invitationId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (findError || !existing) {
    throw new Error('Invitation not found');
  }
  if (existing.status !== 'pending') {
    throw new Error('Only pending invitations can be cancelled');
  }

  const { error } = await supabase
    .from('organization_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateOrgTeamMember(
  ctx: OrgTeamAccessContext,
  body: Record<string, unknown>
): Promise<SerializedOrgTeamMember> {
  const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : '';
  if (!memberId) throw new Error('memberId is required');

  const hasContactPatch =
    typeof body.displayName === 'string' || typeof body.contactPhone === 'string';
  const hasStatusPatch = body.status === 'inactive' || body.status === 'active';
  const hasRolePatch = typeof body.roleId === 'string' && body.roleId.trim().length > 0;
  const hasPermissionsPatch = body.permissions !== undefined;
  const hasListingPatch = body.allListings !== undefined || body.listingAssignments !== undefined;

  if (
    !hasContactPatch &&
    !hasStatusPatch &&
    !hasRolePatch &&
    !hasPermissionsPatch &&
    !hasListingPatch
  ) {
    throw new Error('No valid fields to update');
  }

  const supabase = createServiceClient();
  const isVirtualOwner = memberId.startsWith('org-owner-');
  const isVirtualAdmin = memberId.startsWith('org-admin-');
  let targetUserId = '';
  let existing: Record<string, unknown> | null = null;

  if (isVirtualOwner) {
    targetUserId = memberId.slice('org-owner-'.length);
    if (targetUserId !== ctx.org.owner_id) {
      throw new Error('Member not found');
    }
    const { data } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', ctx.org.id)
      .eq('user_id', targetUserId)
      .maybeSingle();
    existing = (data as Record<string, unknown> | null) ?? null;
  } else if (isVirtualAdmin) {
    targetUserId = memberId.slice('org-admin-'.length);
    const { data, error: findError } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', ctx.org.id)
      .eq('user_id', targetUserId)
      .maybeSingle();
    if (findError || !data) {
      throw new Error('Member not found');
    }
    existing = data as Record<string, unknown>;
  } else {
    const { data, error: findError } = await supabase
      .from('organization_members')
      .select('*')
      .eq('id', memberId)
      .eq('organization_id', ctx.org.id)
      .maybeSingle();

    if (findError || !data) {
      throw new Error('Member not found');
    }
    existing = data as Record<string, unknown>;
    targetUserId = existing.user_id as string;
  }

  const isSelf = ctx.user.id === targetUserId;

  if (hasStatusPatch || hasRolePatch || hasPermissionsPatch || hasListingPatch) {
    if (!hasOrgTeamMemberEditPermission(ctx.permissions)) throw new Error('Access restricted');
    if (isVirtualOwner || targetUserId === ctx.org.owner_id) {
      throw new Error('Org owner cannot be updated');
    }
    if (isSelf && body.status === 'inactive') {
      throw new Error('You cannot deactivate your own account');
    }
  }

  if (hasContactPatch && !isSelf && !hasOrgTeamMemberEditPermission(ctx.permissions)) {
    throw new Error('Access restricted');
  }

  const patch: Record<string, unknown> = {};
  const customRoles = await loadOrgCustomRolesMap(supabase, ctx.org.id);

  if (hasRolePatch) {
    const nextRoleId = (body.roleId as string).trim();
    assertValidOrgRoleId(nextRoleId);
    patch.role_id = nextRoleId;
    // Member grants always follow the role template — ignore client permission overrides.
    patch.permissions = resolveOrgInvitePermissions({}, nextRoleId, customRoles);
  } else if (hasPermissionsPatch) {
    throw new Error(
      'Member permissions cannot be customized; change the role or edit the role template'
    );
  }

  if (hasListingPatch) {
    const { allListings, assignments } = parseListingAssignmentsFromBody(body);
    if (!allListings && assignments.properties.length === 0 && assignments.parkings.length === 0) {
      throw new Error('Select at least one property or parking listing, or choose All listings');
    }
    patch.all_listings = allListings;
    patch.listing_assignments = allListings ? null : assignments;
  }

  if (body.status === 'inactive') {
    patch.status = 'inactive';
    patch.saved_permissions = normalizeOrgPermissionIds(
      Array.isArray(existing?.permissions) ? (existing.permissions as string[]) : []
    );
    patch.plan_limited = false;
  } else if (body.status === 'active') {
    if (existing?.status === 'inactive') {
      await requireOrgTeamInviteAllowed(ctx.org.id);
    }
    patch.status = 'active';
    patch.plan_limited = false;
  }

  if (typeof body.displayName === 'string') {
    patch.display_name = body.displayName.trim() || null;
  }
  if (typeof body.contactPhone === 'string') {
    const trimmed = body.contactPhone.trim();
    if (trimmed) {
      const phoneErr = validatePhilippineMobilePhone(trimmed);
      if (phoneErr) throw new Error(phoneErr);
    }
    patch.contact_phone = trimmed || null;
  }

  let savedRow: Record<string, unknown>;

  if (isVirtualOwner && !existing) {
    if (!hasContactPatch) {
      throw new Error('Org owner cannot be updated');
    }
    const { data, error } = await supabase
      .from('organization_members')
      .insert({
        organization_id: ctx.org.id,
        user_id: targetUserId,
        role_id: 'ADMIN',
        status: 'active',
        assigned_at: new Date().toISOString(),
        display_name: patch.display_name ?? null,
        contact_phone: patch.contact_phone ?? null,
      })
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to update member');
    }
    savedRow = data as Record<string, unknown>;
  } else if (existing?.id) {
    const { data, error } = await supabase
      .from('organization_members')
      .update(patch)
      .eq('id', existing.id as string)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to update member');
    }
    savedRow = data as Record<string, unknown>;

    if (hasListingPatch || body.status === 'active' || body.status === 'inactive') {
      if (body.status === 'inactive') {
        await supabase
          .from('property_members')
          .update({ status: 'inactive', plan_limited: false })
          .eq('user_id', targetUserId)
          .eq('assigned_via_org', true)
          .in(
            'property_id',
            (
              await supabase.from('properties').select('id').eq('organization_id', ctx.org.id)
            ).data?.map((row) => row.id as string) ?? []
          );
        await supabase
          .from('parking_members')
          .update({ status: 'inactive', plan_limited: false })
          .eq('user_id', targetUserId)
          .eq('assigned_via_org', true)
          .in(
            'parking_id',
            (
              await supabase.from('parkings').select('id').eq('organization_id', ctx.org.id)
            ).data?.map((row) => row.id as string) ?? []
          );
      } else {
        const allListings = savedRow.all_listings === true;
        const assignments = parseListingAssignmentsFromBody({
          listingAssignments: savedRow.listing_assignments,
        }).assignments;
        await syncOrgListingMemberships({
          supabase,
          organizationId: ctx.org.id,
          userId: targetUserId,
          invitedBy: ctx.user.id,
          allListings,
          assignments,
          contactPhone:
            typeof savedRow.contact_phone === 'string' ? savedRow.contact_phone.trim() : null,
        });
      }
    }
  } else {
    throw new Error('Member not found');
  }

  const profile = await getAuthProfile(supabase, targetUserId);
  const assignedBy = savedRow.invited_by
    ? (await getAuthProfile(supabase, savedRow.invited_by as string)).name
    : 'System';

  return serializeMemberRow(savedRow, profile, assignedBy, targetUserId === ctx.org.owner_id);
}

export async function removeOrgTeamMember(
  ctx: OrgTeamAccessContext,
  memberId: string
): Promise<void> {
  if (memberId.startsWith('org-owner-')) {
    throw new Error('Org owner cannot be removed');
  }

  const supabase = createServiceClient();
  const { data: existing, error: findError } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('id', memberId)
    .eq('organization_id', ctx.org.id)
    .maybeSingle();

  if (findError || !existing) {
    throw new Error('Member not found');
  }
  if (existing.user_id === ctx.org.owner_id) {
    throw new Error('Org owner cannot be removed');
  }
  if (existing.user_id === ctx.user.id) {
    throw new Error('You cannot remove your own account');
  }

  await supabase
    .from('property_members')
    .delete()
    .eq('user_id', existing.user_id)
    .eq('assigned_via_org', true)
    .in(
      'property_id',
      (await supabase.from('properties').select('id').eq('organization_id', ctx.org.id)).data?.map(
        (row) => row.id as string
      ) ?? []
    );

  await supabase
    .from('parking_members')
    .delete()
    .eq('user_id', existing.user_id)
    .eq('assigned_via_org', true)
    .in(
      'parking_id',
      (await supabase.from('parkings').select('id').eq('organization_id', ctx.org.id)).data?.map(
        (row) => row.id as string
      ) ?? []
    );

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', ctx.org.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function acceptOrgInvitation(
  userId: string,
  userEmail: string,
  token: string
): Promise<{
  organizationId: string;
  memberId: string;
  orgSlug: string;
  orgName: string;
}> {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('token is required');

  const supabase = createServiceClient();
  const { data: invite, error: findError } = await supabase
    .from('organization_invitations')
    .select('*')
    .eq('token', trimmed)
    .maybeSingle();

  if (findError || !invite) {
    throw new Error('Invitation not found');
  }
  if (invite.status !== 'pending') {
    throw new Error('Invitation is no longer valid');
  }
  if (new Date(invite.expires_at as string).getTime() < Date.now()) {
    await supabase
      .from('organization_invitations')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    throw new Error('Invitation has expired');
  }

  const inviteEmail = normalizeInviteEmail(invite.email as string);
  if (normalizeInviteEmail(userEmail) !== inviteEmail) {
    // Never interpolate the invitee's email into this message — it's returned verbatim
    // to whichever (mismatched) account is signed in and would otherwise disclose a
    // third party's email address to an unauthorized caller.
    throw new Error('Signed-in email does not match the invitation email.');
  }

  const organizationId = invite.organization_id as string;
  const roleId = invite.role_id as string;
  const permissions = normalizeOrgPermissionIds(invite.permissions as string[]);
  const allListings = invite.all_listings === true;
  const assignments = parseListingAssignmentsFromBody({
    listingAssignments: invite.listing_assignments,
  });
  const inviteContactPhone =
    typeof invite.contact_phone === 'string' && invite.contact_phone.trim()
      ? invite.contact_phone.trim()
      : null;

  const { data: member, error: upsertError } = await supabase
    .from('organization_members')
    .upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        role_id: roleId,
        permissions,
        all_listings: allListings,
        listing_assignments: allListings ? null : assignments.assignments,
        status: 'active',
        invited_by: invite.sent_by as string,
        assigned_at: new Date().toISOString(),
        display_name: null,
        contact_phone: inviteContactPhone,
      },
      { onConflict: 'organization_id,user_id' }
    )
    .select('id')
    .single();

  if (upsertError || !member) {
    throw new Error(upsertError?.message ?? 'Failed to create membership');
  }

  await syncOrgListingMemberships({
    supabase,
    organizationId,
    userId,
    invitedBy: invite.sent_by as string,
    allListings,
    assignments: assignments.assignments,
    contactPhone: inviteContactPhone,
  });

  await reconcileTeamSeatsForOrganization(organizationId);

  await supabase
    .from('organization_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq('id', invite.id);

  const { data: orgRow, error: orgError } = await supabase
    .from('organizations')
    .select('slug, name')
    .eq('id', organizationId)
    .maybeSingle();

  if (orgError || !orgRow?.slug) {
    throw new Error('Organization not found after accept');
  }

  return {
    organizationId,
    memberId: member.id as string,
    orgSlug: orgRow.slug as string,
    orgName: (orgRow.name as string) || 'Organization',
  };
}

export async function isActiveOrgAdmin(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return Boolean(data?.id);
}

function serializeOrgCustomRoleRow(row: Record<string, unknown>): SerializedOrgCustomRole {
  return {
    id: row.id as string,
    name: row.name as string,
    permissions: normalizeOrgPermissionIds(row.permissions as string[]),
    allListings: row.all_listings === true,
    listingAssignments: parseOrgListingAssignments(row.listing_assignments),
  };
}

function parseOrgRoleListingFromBody(body: Record<string, unknown>): {
  allListings?: boolean;
  listingAssignments?: ParsedOrgListingAssignments;
} {
  const patch: {
    allListings?: boolean;
    listingAssignments?: ParsedOrgListingAssignments;
  } = {};
  if (body.allListings !== undefined) {
    patch.allListings = body.allListings === true;
  }
  if (body.listingAssignments !== undefined || body.listing_assignments !== undefined) {
    patch.listingAssignments = parseListingAssignmentsPayload(
      body.listingAssignments ?? body.listing_assignments
    );
  }
  return patch;
}

export async function listOrgCustomRoles(
  organizationId: string
): Promise<SerializedOrgCustomRole[]> {
  const supabase = createServiceClient();
  await seedOrgTeamTemplates(supabase, organizationId);
  const { data, error } = await supabase
    .from('organization_custom_roles')
    .select('id, name, permissions, all_listings, listing_assignments')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to list custom roles: ${error.message}`);
  }

  return (data ?? []).map((row) => serializeOrgCustomRoleRow(row as Record<string, unknown>));
}

export async function createOrgCustomRole(
  ctx: OrgTeamAccessContext,
  body: Record<string, unknown>
): Promise<SerializedOrgCustomRole> {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 60) {
    throw new Error('Role name must be 2–60 characters');
  }
  const permissions = normalizeOrgPermissionIds(
    Array.isArray(body.permissions)
      ? body.permissions.filter((item): item is string => typeof item === 'string')
      : []
  );
  if (permissions.length === 0) {
    throw new Error('At least one permission is required');
  }

  const listingPatch = parseOrgRoleListingFromBody(body);
  if (
    listingPatch.allListings === false &&
    listingPatch.listingAssignments &&
    listingPatch.listingAssignments.properties.length === 0 &&
    listingPatch.listingAssignments.parkings.length === 0
  ) {
    // Allow empty selected scope on role templates (org hub only until invite overrides).
  } else if (listingPatch.listingAssignments) {
    await assertListingAssignmentsInOrg(
      createServiceClient(),
      ctx.org.id,
      listingPatch.listingAssignments
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('organization_custom_roles')
    .insert({
      organization_id: ctx.org.id,
      name,
      permissions,
      all_listings: listingPatch.allListings ?? false,
      listing_assignments: listingPatch.allListings
        ? null
        : (listingPatch.listingAssignments ?? { properties: [], parkings: [] }),
    })
    .select('id, name, permissions, all_listings, listing_assignments')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A custom role with this name already exists');
    }
    throw new Error(error.message);
  }

  return serializeOrgCustomRoleRow(data as Record<string, unknown>);
}

function sortedPermissionKey(permissions: unknown): string {
  const ids = normalizeOrgPermissionIds(
    Array.isArray(permissions)
      ? permissions.filter((item): item is string => typeof item === 'string')
      : []
  );
  return [...ids].sort().join('\0');
}

function listingScopeKey(allListings: boolean, listingAssignments: unknown): string {
  if (allListings) return 'all';
  const parsed = parseListingAssignmentsPayload(listingAssignments);
  const properties = [...parsed.properties]
    .map((entry) => `${entry.propertyId}:${entry.roleId}`)
    .sort()
    .join(',');
  const parkings = [...parsed.parkings]
    .map((entry) => `${entry.parkingId}:${entry.roleId}`)
    .sort()
    .join(',');
  return `selected|${properties}|${parkings}`;
}

export async function updateOrgCustomRole(
  ctx: OrgTeamAccessContext,
  body: Record<string, unknown>
): Promise<SerializedOrgCustomRole> {
  const roleId = typeof body.roleId === 'string' ? body.roleId.trim() : '';
  if (!roleId) throw new Error('roleId is required');

  const supabase = createServiceClient();
  const organizationId = ctx.org.id;

  const { data: existingRole, error: existingError } = await supabase
    .from('organization_custom_roles')
    .select('id, name, permissions, all_listings, listing_assignments')
    .eq('id', roleId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (existingError || !existingRole) {
    throw new Error('Custom role not found');
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 60) {
      throw new Error('Role name must be 2–60 characters');
    }
    if (
      isSeededOrgTemplateName(existingRole.name as string) &&
      name.toLowerCase() !== String(existingRole.name).trim().toLowerCase()
    ) {
      throw new Error('Default role names cannot be changed');
    }
    patch.name = name;
  }
  if (body.permissions !== undefined) {
    const permissions = normalizeOrgPermissionIds(
      Array.isArray(body.permissions)
        ? body.permissions.filter((item): item is string => typeof item === 'string')
        : []
    );
    if (permissions.length === 0) {
      throw new Error('At least one permission is required');
    }
    patch.permissions = permissions;
  }

  const listingPatch = parseOrgRoleListingFromBody(body);
  if (listingPatch.allListings !== undefined) {
    patch.all_listings = listingPatch.allListings;
    if (listingPatch.allListings) {
      patch.listing_assignments = null;
    }
  }
  if (listingPatch.listingAssignments !== undefined && listingPatch.allListings !== true) {
    await assertListingAssignmentsInOrg(supabase, organizationId, listingPatch.listingAssignments);
    patch.listing_assignments = listingPatch.listingAssignments;
    if (listingPatch.allListings === undefined && patch.all_listings === undefined) {
      patch.all_listings = false;
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('No valid fields to update');
  }

  const previousPermissionKey = sortedPermissionKey(existingRole.permissions);
  const previousListingKey = listingScopeKey(
    existingRole.all_listings === true,
    existingRole.listing_assignments
  );

  const { data, error } = await supabase
    .from('organization_custom_roles')
    .update(patch)
    .eq('id', roleId)
    .eq('organization_id', organizationId)
    .select('id, name, permissions, all_listings, listing_assignments')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A custom role with this name already exists');
    }
    throw new Error(error.message);
  }

  if (patch.permissions) {
    const { data: members } = await supabase
      .from('organization_members')
      .select('id, permissions')
      .eq('organization_id', organizationId)
      .eq('role_id', roleId)
      .eq('status', 'active');
    const matchingMemberIds = (members ?? [])
      .filter((row) => sortedPermissionKey(row.permissions) === previousPermissionKey)
      .map((row) => row.id as string);
    if (matchingMemberIds.length > 0) {
      await supabase
        .from('organization_members')
        .update({ permissions: patch.permissions })
        .in('id', matchingMemberIds);
    }

    const { data: invites } = await supabase
      .from('organization_invitations')
      .select('id, permissions')
      .eq('organization_id', organizationId)
      .eq('role_id', roleId)
      .eq('status', 'pending');
    const matchingInviteIds = (invites ?? [])
      .filter((row) => sortedPermissionKey(row.permissions) === previousPermissionKey)
      .map((row) => row.id as string);
    if (matchingInviteIds.length > 0) {
      await supabase
        .from('organization_invitations')
        .update({ permissions: patch.permissions })
        .in('id', matchingInviteIds);
    }
  }

  if (patch.all_listings !== undefined || patch.listing_assignments !== undefined) {
    const nextAllListings = data.all_listings === true;
    const nextAssignments = parseListingAssignmentsPayload(data.listing_assignments);
    const { data: members } = await supabase
      .from('organization_members')
      .select('id, user_id, all_listings, listing_assignments, contact_phone')
      .eq('organization_id', organizationId)
      .eq('role_id', roleId)
      .eq('status', 'active');

    for (const row of members ?? []) {
      const matchesPrevious =
        listingScopeKey(row.all_listings === true, row.listing_assignments) === previousListingKey;
      if (!matchesPrevious) continue;

      await supabase
        .from('organization_members')
        .update({
          all_listings: nextAllListings,
          listing_assignments: nextAllListings ? null : nextAssignments,
        })
        .eq('id', row.id as string);

      await syncOrgListingMemberships({
        supabase,
        organizationId,
        userId: row.user_id as string,
        invitedBy: ctx.user.id,
        allListings: nextAllListings,
        assignments: nextAssignments,
        contactPhone: typeof row.contact_phone === 'string' ? row.contact_phone.trim() : null,
      });
    }

    const { data: invites } = await supabase
      .from('organization_invitations')
      .select('id, all_listings, listing_assignments')
      .eq('organization_id', organizationId)
      .eq('role_id', roleId)
      .eq('status', 'pending');
    const matchingInviteIds = (invites ?? [])
      .filter(
        (row) =>
          listingScopeKey(row.all_listings === true, row.listing_assignments) === previousListingKey
      )
      .map((row) => row.id as string);
    if (matchingInviteIds.length > 0) {
      await supabase
        .from('organization_invitations')
        .update({
          all_listings: nextAllListings,
          listing_assignments: nextAllListings ? null : nextAssignments,
        })
        .in('id', matchingInviteIds);
    }
  }

  return serializeOrgCustomRoleRow(data as Record<string, unknown>);
}

async function assertListingAssignmentsInOrg(
  supabase: SupabaseClient,
  organizationId: string,
  assignments: ParsedOrgListingAssignments
): Promise<void> {
  for (const entry of assignments.properties) {
    const { data } = await supabase
      .from('properties')
      .select('id')
      .eq('id', entry.propertyId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (!data?.id) throw new Error('Invalid property assignment');
  }
  for (const entry of assignments.parkings) {
    const { data } = await supabase
      .from('parkings')
      .select('id')
      .eq('id', entry.parkingId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (!data?.id) throw new Error('Invalid parking assignment');
  }
}

export async function deleteOrgCustomRole(
  ctx: OrgTeamAccessContext,
  roleId: string
): Promise<void> {
  const supabase = createServiceClient();
  const organizationId = ctx.org.id;

  const { data: existingRole, error: existingError } = await supabase
    .from('organization_custom_roles')
    .select('id, name')
    .eq('id', roleId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (existingError || !existingRole) {
    throw new Error('Custom role not found');
  }
  if (isSeededOrgTemplateName(existingRole.name as string)) {
    throw new Error('Default roles cannot be deleted');
  }

  const { count: memberCount } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('role_id', roleId);

  const { count: inviteCount } = await supabase
    .from('organization_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('role_id', roleId)
    .eq('status', 'pending');

  if ((memberCount ?? 0) > 0 || (inviteCount ?? 0) > 0) {
    throw new Error('Remove members from this role before deleting');
  }

  const { data, error } = await supabase
    .from('organization_custom_roles')
    .delete()
    .eq('id', roleId)
    .eq('organization_id', organizationId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id) {
    throw new Error('Custom role not found');
  }
}
