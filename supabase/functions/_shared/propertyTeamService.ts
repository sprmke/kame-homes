/**
 * Property team — DB helpers, serialization, and mutations.
 */

import type { SupabaseClient } from './supabaseJs.ts';
import {
  createServiceClient,
  type OrgRow,
  type PropertyAccessContext,
  verifyPropertyAccess,
} from './orgAuth.ts';
import {
  assertValidRoleId,
  defaultPermissionsForRole,
  inviteExpiresAt,
  hasPropertyPermission,
  hasPropertyTeamManageAccess,
  isCustomRoleId,
  isPropertyAdminRoleId,
  normalizeInviteEmail,
  normalizePermissionIds,
  allTeamPermissions,
  type PropertyCustomRoleRow,
  type TeamPermissionId,
} from './propertyTeamPermissions.ts';
import { isSeededTemplateName, seedPropertyTeamTemplates } from './propertyTeamTemplates.ts';
import { readPropertyIdFromUrl } from './propertyScope.ts';
import { sendPropertyTeamInviteEmail } from './propertyTeamInviteEmail.ts';
import { assertAllowedTeamInviteEmail } from './teamInviteEmail.ts';
import { parseTeamInviteContactFields } from './teamInviteContact.ts';
import {
  reconcileTeamSeatsForProperty,
  requireTeamInviteAllowed,
  resolveTeamInviteCapacityForOrg,
  type TeamInviteCapacity,
} from './planEntitlements.ts';

export type SerializedTeamMember = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  displayName: string;
  contactPhone: string;
  role: string;
  permissions: string[];
  savedPermissions?: string[];
  status: 'active' | 'inactive';
  /** True when status='inactive' was set automatically by team-seat reconciliation (plan
   * downgrade/suspension), not by an admin — lets the UI show a distinct "plan limit" reason and
   * offer an upgrade instead of a plain "Activate" action. Always false for org-inherited rows. */
  planLimited: boolean;
  assignedAt: string;
  lastActive: string | null;
  assignedBy: string;
  fromOrg: boolean;
};

export type SerializedTeamInvitation = {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  sentAt: string;
  expiresAt: string;
  sentBy: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
};

export type SerializedCustomRole = {
  id: string;
  name: string;
  permissions: string[];
};

type AuthProfile = {
  name: string;
  email: string;
  avatar: string | null;
};

export function readTeamPropertyId(url: URL, body: Record<string, unknown>): string {
  const fromUrl = readPropertyIdFromUrl(url);
  if (fromUrl) return fromUrl;
  const fromBody = typeof body.propertyId === 'string' ? body.propertyId.trim() : '';
  return fromBody;
}

export async function requireTeamPropertyAccess(
  req: Request,
  propertyId: string,
  permission: TeamPermissionId
): Promise<PropertyAccessContext> {
  if (!propertyId) {
    throw new Response(JSON.stringify({ success: false, error: 'property_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return verifyPropertyAccess(req, propertyId, permission);
}

export async function loadCustomRolesMap(
  supabase: SupabaseClient,
  propertyId: string
): Promise<Map<string, PropertyCustomRoleRow>> {
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

export async function assertCustomRoleForProperty(
  supabase: SupabaseClient,
  propertyId: string,
  roleId: string,
  customRolesById: Map<string, PropertyCustomRoleRow>
): Promise<void> {
  assertValidRoleId(roleId);
  if (isPropertyAdminRoleId(roleId)) return;
  if (!customRolesById.has(roleId)) {
    const { data } = await supabase
      .from('property_custom_roles')
      .select('id')
      .eq('property_id', propertyId)
      .eq('id', roleId)
      .maybeSingle();
    if (!data?.id) {
      throw new Error('Custom role not found for this property');
    }
  }
}

export function resolveAssignPermissions(
  roleId: string,
  customRolesById: Map<string, PropertyCustomRoleRow>,
  explicitPermissions: unknown
): string[] {
  if (Array.isArray(explicitPermissions)) {
    const normalized = normalizePermissionIds(explicitPermissions);
    if (normalized.length > 0) return normalized;
    // Explicit empty array is never a valid active grant (invite / role change footgun).
    throw new Error('At least one permission is required');
  }
  return defaultPermissionsForRole(roleId, customRolesById);
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

export function virtualOrgAdminId(userId: string): string {
  return `org-admin-${userId}`;
}

async function isActiveOrgAdmin(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return Boolean(data?.id);
}

async function assertNotOrgManagedMember(
  supabase: SupabaseClient,
  orgId: string,
  ownerId: string,
  userId: string,
  action: 'edit' | 'remove'
): Promise<void> {
  if (userId === ownerId) {
    throw new Error(
      `Org owner cannot be ${action === 'edit' ? 'edited' : 'removed'} at property level`
    );
  }
  if (await isActiveOrgAdmin(supabase, orgId, userId)) {
    throw new Error('Org admin is managed at organization team');
  }
}

async function assertNotLastPropertyTeamManager(
  supabase: SupabaseClient,
  propertyId: string,
  memberId: string,
  action: 'deactivate' | 'remove'
): Promise<void> {
  const { data: target } = await supabase
    .from('property_members')
    .select('permissions, status')
    .eq('id', memberId)
    .eq('property_id', propertyId)
    .maybeSingle();

  if (!target || target.status !== 'active') return;

  const targetPerms = normalizePermissionIds(target.permissions);
  if (!hasPropertyTeamManageAccess(targetPerms)) return;

  const { data: activeRows, error } = await supabase
    .from('property_members')
    .select('id, permissions')
    .eq('property_id', propertyId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to verify team managers: ${error.message}`);
  }

  const manageCount = (activeRows ?? []).filter((row) =>
    hasPropertyTeamManageAccess(normalizePermissionIds(row.permissions))
  ).length;

  if (manageCount <= 1) {
    throw new Error(`Cannot ${action} the last member with team management access`);
  }
}

async function emailHasOrgLevelPropertyAccess(
  supabase: SupabaseClient,
  orgId: string,
  ownerId: string,
  email: string
): Promise<boolean> {
  const normalized = normalizeInviteEmail(email);
  const ownerProfile = await getAuthProfile(supabase, ownerId);
  if (normalizeInviteEmail(ownerProfile.email) === normalized) return true;

  const { data: orgAdmins } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  for (const row of orgAdmins ?? []) {
    const profile = await getAuthProfile(supabase, row.user_id as string);
    if (normalizeInviteEmail(profile.email) === normalized) return true;
  }
  return false;
}

async function userHasOrgLevelPropertyAccess(
  supabase: SupabaseClient,
  orgId: string,
  ownerId: string,
  userId: string
): Promise<boolean> {
  if (userId === ownerId) return true;
  return isActiveOrgAdmin(supabase, orgId, userId);
}

function serializeMemberRow(
  row: Record<string, unknown>,
  profile: AuthProfile,
  assignedByLabel: string,
  fromOrg: boolean
): SerializedTeamMember {
  const saved = row.saved_permissions ? normalizePermissionIds(row.saved_permissions) : undefined;
  const displayName =
    typeof row.display_name === 'string' && row.display_name.trim()
      ? row.display_name.trim()
      : profile.name;
  const contactPhone = typeof row.contact_phone === 'string' ? row.contact_phone.trim() : '';

  return {
    id: row.id as string,
    name: displayName,
    email: profile.email,
    avatar: profile.avatar,
    displayName,
    contactPhone,
    role: row.role_id as string,
    permissions: normalizePermissionIds(row.permissions),
    ...(saved && saved.length > 0 ? { savedPermissions: saved } : {}),
    status: row.status as 'active' | 'inactive',
    planLimited: row.plan_limited === true,
    assignedAt: isoDateOnly(row.assigned_at as string),
    lastActive: row.last_active_at ? isoDateOnly(row.last_active_at as string) : null,
    assignedBy: assignedByLabel,
    fromOrg,
  };
}

export async function getPropertyTeamInviteCapacity(
  organizationId: string,
  propertyId: string
): Promise<TeamInviteCapacity> {
  try {
    await reconcileTeamSeatsForProperty(propertyId);
  } catch (error) {
    console.error(
      '[propertyTeam] reconcileTeamSeatsForProperty failed:',
      error instanceof Error ? error.message : error
    );
  }
  try {
    return await resolveTeamInviteCapacityForOrg(organizationId);
  } catch (error) {
    console.error(
      '[propertyTeam] resolveTeamInviteCapacityForOrg failed:',
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

export async function listPropertyTeamMembers(
  ctx: PropertyAccessContext
): Promise<SerializedTeamMember[]> {
  const supabase = createServiceClient();
  const propertyId = ctx.property.id;
  const orgId = ctx.org.id;
  const ownerId = ctx.org.owner_id;

  const { data: orgAdminRows, error: orgAdminError } = await supabase
    .from('organization_members')
    .select('user_id, assigned_at, display_name, contact_phone, all_listings')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .eq('all_listings', true)
    .order('assigned_at', { ascending: true });

  if (orgAdminError) {
    throw new Error(`Failed to list org admins: ${orgAdminError.message}`);
  }

  const orgAdminUserIds = new Set((orgAdminRows ?? []).map((row) => row.user_id as string));

  const { data: rows, error } = await supabase
    .from('property_members')
    .select('*')
    .eq('property_id', propertyId)
    .order('assigned_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list members: ${error.message}`);
  }

  const propertyMembers: SerializedTeamMember[] = [];

  for (const row of rows ?? []) {
    const userId = row.user_id as string;
    if (userId === ownerId || orgAdminUserIds.has(userId)) {
      continue;
    }
    const profile = await getAuthProfile(supabase, userId);
    const assignedBy = row.invited_by
      ? (await getAuthProfile(supabase, row.invited_by as string)).name
      : 'System';
    propertyMembers.push(
      serializeMemberRow(row, profile, assignedBy, row.assigned_via_org === true)
    );
  }

  const virtualMembers: SerializedTeamMember[] = [];

  const ownerProfile = await getAuthProfile(supabase, ownerId);
  const { data: ownerMemberRow } = await supabase
    .from('organization_members')
    .select('display_name, contact_phone')
    .eq('organization_id', orgId)
    .eq('user_id', ownerId)
    .maybeSingle();
  const ownerDisplayName =
    typeof ownerMemberRow?.display_name === 'string' && ownerMemberRow.display_name.trim()
      ? ownerMemberRow.display_name.trim()
      : ownerProfile.name;
  const ownerContactPhone =
    typeof ownerMemberRow?.contact_phone === 'string' ? ownerMemberRow.contact_phone.trim() : '';
  virtualMembers.push({
    id: virtualOrgOwnerId(ctx.org),
    name: ownerDisplayName,
    email: ownerProfile.email,
    avatar: ownerProfile.avatar,
    displayName: ownerDisplayName,
    contactPhone: ownerContactPhone,
    role: 'ADMIN',
    permissions: allTeamPermissions(),
    status: 'active',
    planLimited: false,
    assignedAt: isoDateOnly(ctx.org.created_at),
    lastActive: null,
    assignedBy: 'System',
    fromOrg: true,
  });

  for (const row of orgAdminRows ?? []) {
    const userId = row.user_id as string;
    if (userId === ownerId) continue;
    const profile = await getAuthProfile(supabase, userId);
    const displayName =
      typeof row.display_name === 'string' && row.display_name.trim()
        ? row.display_name.trim()
        : profile.name;
    const contactPhone = typeof row.contact_phone === 'string' ? row.contact_phone.trim() : '';
    virtualMembers.push({
      id: virtualOrgAdminId(userId),
      name: displayName,
      email: profile.email,
      avatar: profile.avatar,
      displayName,
      contactPhone,
      role: 'ADMIN',
      permissions: allTeamPermissions(),
      status: 'active',
      planLimited: false,
      assignedAt: isoDateOnly(row.assigned_at as string),
      lastActive: null,
      assignedBy: 'System',
      fromOrg: true,
    });
  }

  return [...virtualMembers, ...propertyMembers];
}

export async function listPropertyTeamInvitations(
  propertyId: string
): Promise<SerializedTeamInvitation[]> {
  const supabase = createServiceClient();
  const now = new Date();

  const { data: rows, error } = await supabase
    .from('property_invitations')
    .select('*')
    .eq('property_id', propertyId)
    .in('status', ['pending', 'accepted', 'expired', 'cancelled'])
    .order('sent_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list invitations: ${error.message}`);
  }

  const out: SerializedTeamInvitation[] = [];

  for (const row of rows ?? []) {
    let status = row.status as SerializedTeamInvitation['status'];
    if (status === 'pending' && new Date(row.expires_at as string).getTime() < now.getTime()) {
      await supabase.from('property_invitations').update({ status: 'expired' }).eq('id', row.id);
      status = 'expired';
    }

    const sentByProfile = await getAuthProfile(supabase, row.sent_by as string);

    out.push({
      id: row.id as string,
      email: row.email as string,
      role: row.role_id as string,
      permissions: normalizePermissionIds(row.permissions),
      sentAt: isoDateOnly(row.sent_at as string),
      expiresAt: isoDateOnly(row.expires_at as string),
      sentBy: sentByProfile.name,
      status,
    });
  }

  return out.filter((i) => i.status === 'pending');
}

export async function listPropertyCustomRoles(propertyId: string): Promise<SerializedCustomRole[]> {
  const supabase = createServiceClient();
  await seedPropertyTeamTemplates(supabase, propertyId);
  const { data, error } = await supabase
    .from('property_custom_roles')
    .select('id, name, permissions')
    .eq('property_id', propertyId)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to list custom roles: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    permissions: normalizePermissionIds(row.permissions),
  }));
}

async function findActiveMemberByEmail(
  supabase: SupabaseClient,
  propertyId: string,
  email: string
): Promise<boolean> {
  const normalized = normalizeInviteEmail(email);
  const { data: invites } = await supabase
    .from('property_members')
    .select('user_id, status')
    .eq('property_id', propertyId)
    .eq('status', 'active');

  for (const row of invites ?? []) {
    const profile = await getAuthProfile(supabase, row.user_id as string);
    if (normalizeInviteEmail(profile.email) === normalized) return true;
  }
  return false;
}

export async function createPropertyInvitation(
  ctx: PropertyAccessContext,
  body: Record<string, unknown>
): Promise<SerializedTeamInvitation> {
  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  assertAllowedTeamInviteEmail(emailRaw);
  const email = normalizeInviteEmail(emailRaw);
  const roleId = typeof body.roleId === 'string' ? body.roleId.trim() : '';
  if (!roleId) throw new Error('roleId is required');

  const supabase = createServiceClient();
  const propertyId = ctx.property.id;
  const customRoles = await loadCustomRolesMap(supabase, propertyId);
  await assertCustomRoleForProperty(supabase, propertyId, roleId, customRoles);

  const permissions = resolveAssignPermissions(roleId, customRoles, undefined);
  const contact = parseTeamInviteContactFields(body);

  if (await findActiveMemberByEmail(supabase, propertyId, email)) {
    throw new Error('This email is already an active member on this property');
  }

  if (await emailHasOrgLevelPropertyAccess(supabase, ctx.org.id, ctx.org.owner_id, email)) {
    throw new Error('This email already has organization-level property access');
  }

  const { data: pending } = await supabase
    .from('property_invitations')
    .select('id')
    .eq('property_id', propertyId)
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle();

  if (pending?.id) {
    throw new Error('A pending invitation already exists for this email');
  }

  const expiresAt = inviteExpiresAt();
  const { data, error } = await supabase
    .from('property_invitations')
    .insert({
      property_id: propertyId,
      email,
      role_id: roleId,
      permissions,
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

  try {
    await sendPropertyTeamInviteEmail({
      propertyId,
      inviteEmail: data.email as string,
      token: data.token as string,
      roleId: data.role_id as string,
      invitedByName: sentByProfile.name,
      expiresAtIso: data.expires_at as string,
    });
  } catch {
    await supabase.from('property_invitations').delete().eq('id', data.id);
    throw new Error('Failed to send invitation email');
  }

  return {
    id: data.id as string,
    email: data.email as string,
    role: data.role_id as string,
    permissions: normalizePermissionIds(data.permissions),
    sentAt: isoDateOnly(data.sent_at as string),
    expiresAt: isoDateOnly(data.expires_at as string),
    sentBy: sentByProfile.name,
    status: 'pending',
  };
}

export async function resendPropertyInvitation(
  ctx: PropertyAccessContext,
  invitationId: string
): Promise<SerializedTeamInvitation> {
  const supabase = createServiceClient();
  const propertyId = ctx.property.id;

  const { data: existing, error: findError } = await supabase
    .from('property_invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('property_id', propertyId)
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
    .from('property_invitations')
    .update({
      expires_at: expiresAt.toISOString(),
      sent_at: new Date().toISOString(),
      sent_by: ctx.user.id,
      token,
    })
    .eq('id', invitationId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to resend invitation');
  }

  const sentByProfile = await getAuthProfile(supabase, ctx.user.id);

  try {
    await sendPropertyTeamInviteEmail({
      propertyId,
      inviteEmail: data.email as string,
      token: data.token as string,
      roleId: data.role_id as string,
      invitedByName: sentByProfile.name,
      expiresAtIso: data.expires_at as string,
    });
  } catch {
    await supabase
      .from('property_invitations')
      .update({
        token: previousToken,
        expires_at: previousExpiresAt,
        sent_at: previousSentAt,
        sent_by: previousSentBy,
      })
      .eq('id', invitationId);
    throw new Error('Failed to send invitation email');
  }

  return {
    id: data.id as string,
    email: data.email as string,
    role: data.role_id as string,
    permissions: normalizePermissionIds(data.permissions),
    sentAt: isoDateOnly(data.sent_at as string),
    expiresAt: isoDateOnly(data.expires_at as string),
    sentBy: sentByProfile.name,
    status: 'pending',
  };
}

export async function cancelPropertyInvitation(
  propertyId: string,
  invitationId: string
): Promise<void> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('property_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId)
    .eq('property_id', propertyId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id) {
    throw new Error('Invitation not found or not pending');
  }
}

export async function updatePropertyTeamMember(
  ctx: PropertyAccessContext,
  body: Record<string, unknown>
): Promise<SerializedTeamMember> {
  const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : '';
  if (!memberId) throw new Error('memberId is required');
  if (memberId.startsWith('org-owner-') || memberId.startsWith('org-admin-')) {
    throw new Error('Org-managed members cannot be edited at property level');
  }

  const supabase = createServiceClient();
  const propertyId = ctx.property.id;

  const { data: existing, error: findError } = await supabase
    .from('property_members')
    .select('*')
    .eq('id', memberId)
    .eq('property_id', propertyId)
    .maybeSingle();

  if (findError || !existing) {
    throw new Error('Member not found');
  }
  if (existing.assigned_via_org === true) {
    throw new Error('Org-assigned members cannot be edited at property level');
  }
  await assertNotOrgManagedMember(
    supabase,
    ctx.org.id,
    ctx.org.owner_id,
    existing.user_id as string,
    'edit'
  );

  const targetUserId = existing.user_id as string;
  if (targetUserId === ctx.user.id && body.status === 'inactive') {
    throw new Error('You cannot deactivate your own account');
  }

  const customRoles = await loadCustomRolesMap(supabase, propertyId);
  const patch: Record<string, unknown> = {};

  const nextRoleId =
    typeof body.roleId === 'string' ? body.roleId.trim() : (existing.role_id as string);
  const roleChanged = nextRoleId !== existing.role_id;

  if (typeof body.roleId === 'string') {
    await assertCustomRoleForProperty(supabase, propertyId, nextRoleId, customRoles);
    patch.role_id = nextRoleId;
  }

  if (body.status === 'inactive') {
    await assertNotLastPropertyTeamManager(supabase, propertyId, memberId, 'deactivate');
    patch.status = 'inactive';
    patch.saved_permissions = normalizePermissionIds(existing.permissions);
    patch.permissions = [];
    // A deliberate admin action always wins over a prior plan-driven deactivation record —
    // re-activating this member later must be a manual choice, never an automatic restore.
    patch.plan_limited = false;
  } else if (body.status === 'active') {
    if (existing.status !== 'active') {
      // Mirrors requireTeamInviteAllowed's cap check — reactivating is otherwise a second,
      // ungated path to the same seat count an invite would have been blocked from reaching.
      await requireTeamInviteAllowed(propertyId);
    }
    patch.status = 'active';
    if (isCustomRoleId(nextRoleId)) {
      patch.permissions = resolveAssignPermissions(nextRoleId, customRoles, undefined);
    } else {
      const saved = existing.saved_permissions
        ? normalizePermissionIds(existing.saved_permissions)
        : [];
      patch.permissions =
        saved.length > 0 ? saved : resolveAssignPermissions(nextRoleId, customRoles, undefined);
    }
    patch.saved_permissions = null;
    patch.plan_limited = false;
  } else if (existing.status === 'active' && roleChanged) {
    // Member grants always follow the role template — no per-member permission overrides.
    patch.permissions = resolveAssignPermissions(nextRoleId, customRoles, undefined);
  } else if (existing.status === 'active' && body.permissions !== undefined && !roleChanged) {
    throw new Error(
      'Member permissions cannot be customized; change the role or edit the role template'
    );
  }

  if (typeof body.displayName === 'string') {
    const trimmed = body.displayName.trim();
    patch.display_name = trimmed || null;
  }
  if (typeof body.contactPhone === 'string') {
    const trimmed = body.contactPhone.trim();
    patch.contact_phone = trimmed || null;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('No valid fields to update');
  }

  const { data, error } = await supabase
    .from('property_members')
    .update(patch)
    .eq('id', memberId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to update member');
  }

  const profile = await getAuthProfile(supabase, data.user_id as string);
  const assignedBy = data.invited_by
    ? (await getAuthProfile(supabase, data.invited_by as string)).name
    : 'System';

  return serializeMemberRow(data, profile, assignedBy, data.assigned_via_org === true);
}

export async function removePropertyTeamMember(
  ctx: PropertyAccessContext,
  memberId: string
): Promise<void> {
  if (memberId.startsWith('org-owner-') || memberId.startsWith('org-admin-')) {
    throw new Error('Org-managed members cannot be removed');
  }

  const supabase = createServiceClient();
  const { data: existing, error: findError } = await supabase
    .from('property_members')
    .select('user_id, assigned_via_org')
    .eq('id', memberId)
    .eq('property_id', ctx.property.id)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }
  if (!existing) {
    throw new Error('Member not found');
  }
  if (existing.assigned_via_org === true) {
    throw new Error('Org-assigned members cannot be removed at property level');
  }
  if (existing.user_id === ctx.user.id) {
    throw new Error('You cannot remove your own account');
  }
  await assertNotOrgManagedMember(
    supabase,
    ctx.org.id,
    ctx.org.owner_id,
    existing.user_id as string,
    'remove'
  );
  await assertNotLastPropertyTeamManager(supabase, ctx.property.id, memberId, 'remove');

  const { error } = await supabase
    .from('property_members')
    .delete()
    .eq('id', memberId)
    .eq('property_id', ctx.property.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createPropertyCustomRole(
  ctx: PropertyAccessContext,
  body: Record<string, unknown>
): Promise<SerializedCustomRole> {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 60) {
    throw new Error('Role name must be 2–60 characters');
  }
  const permissions = normalizePermissionIds(body.permissions);
  if (permissions.length === 0) {
    throw new Error('At least one permission is required');
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('property_custom_roles')
    .insert({
      property_id: ctx.property.id,
      name,
      permissions,
    })
    .select('id, name, permissions')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A custom role with this name already exists');
    }
    throw new Error(error.message);
  }

  return {
    id: data.id as string,
    name: data.name as string,
    permissions: normalizePermissionIds(data.permissions),
  };
}

export async function updatePropertyCustomRole(
  ctx: PropertyAccessContext,
  body: Record<string, unknown>
): Promise<SerializedCustomRole> {
  const roleId = typeof body.roleId === 'string' ? body.roleId.trim() : '';
  if (!roleId) throw new Error('roleId is required');

  const supabase = createServiceClient();
  const propertyId = ctx.property.id;

  const { data: existingRole, error: existingError } = await supabase
    .from('property_custom_roles')
    .select('id, name, permissions')
    .eq('id', roleId)
    .eq('property_id', propertyId)
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
      isSeededTemplateName(existingRole.name as string) &&
      name.toLowerCase() !== String(existingRole.name).trim().toLowerCase()
    ) {
      throw new Error('Default role names cannot be changed');
    }
    patch.name = name;
  }
  if (body.permissions !== undefined) {
    const permissions = normalizePermissionIds(body.permissions);
    if (permissions.length === 0) {
      throw new Error('At least one permission is required');
    }
    patch.permissions = permissions;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('No valid fields to update');
  }

  const previousPermissionKey = [...normalizePermissionIds(existingRole.permissions)]
    .sort()
    .join('\0');

  const { data, error } = await supabase
    .from('property_custom_roles')
    .update(patch)
    .eq('id', roleId)
    .eq('property_id', propertyId)
    .select('id, name, permissions')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A custom role with this name already exists');
    }
    throw new Error(error.message);
  }

  if (patch.permissions) {
    const { data: members } = await supabase
      .from('property_members')
      .select('id, permissions')
      .eq('property_id', propertyId)
      .eq('role_id', roleId)
      .eq('status', 'active')
      .eq('assigned_via_org', false);
    const matchingMemberIds = (members ?? [])
      .filter(
        (row) =>
          [...normalizePermissionIds(row.permissions)].sort().join('\0') === previousPermissionKey
      )
      .map((row) => row.id as string);
    if (matchingMemberIds.length > 0) {
      await supabase
        .from('property_members')
        .update({ permissions: patch.permissions })
        .in('id', matchingMemberIds);
    }

    const { data: invites } = await supabase
      .from('property_invitations')
      .select('id, permissions')
      .eq('property_id', propertyId)
      .eq('role_id', roleId)
      .eq('status', 'pending');
    const matchingInviteIds = (invites ?? [])
      .filter(
        (row) =>
          [...normalizePermissionIds(row.permissions)].sort().join('\0') === previousPermissionKey
      )
      .map((row) => row.id as string);
    if (matchingInviteIds.length > 0) {
      await supabase
        .from('property_invitations')
        .update({ permissions: patch.permissions })
        .in('id', matchingInviteIds);
    }
  }

  return {
    id: data.id as string,
    name: data.name as string,
    permissions: normalizePermissionIds(data.permissions),
  };
}

export async function deletePropertyCustomRole(
  ctx: PropertyAccessContext,
  roleId: string
): Promise<void> {
  const supabase = createServiceClient();
  const propertyId = ctx.property.id;

  const { data: existingRole, error: existingError } = await supabase
    .from('property_custom_roles')
    .select('id, name')
    .eq('id', roleId)
    .eq('property_id', propertyId)
    .maybeSingle();
  if (existingError || !existingRole) {
    throw new Error('Custom role not found');
  }
  if (isSeededTemplateName(existingRole.name as string)) {
    throw new Error('Default roles cannot be deleted');
  }

  const { count: memberCount } = await supabase
    .from('property_members')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .eq('role_id', roleId);

  const { count: inviteCount } = await supabase
    .from('property_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .eq('role_id', roleId)
    .eq('status', 'pending');

  if ((memberCount ?? 0) > 0 || (inviteCount ?? 0) > 0) {
    throw new Error('Remove members from this role before deleting');
  }

  const { data, error } = await supabase
    .from('property_custom_roles')
    .delete()
    .eq('id', roleId)
    .eq('property_id', propertyId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id) {
    throw new Error('Custom role not found');
  }
}

export async function acceptPropertyInvitation(
  userId: string,
  userEmail: string,
  token: string
): Promise<{
  propertyId: string;
  memberId: string;
  orgSlug: string;
  propertySlug: string;
  propertyName: string;
}> {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('token is required');

  const supabase = createServiceClient();
  const { data: invite, error: findError } = await supabase
    .from('property_invitations')
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
    await supabase.from('property_invitations').update({ status: 'expired' }).eq('id', invite.id);
    throw new Error('Invitation has expired');
  }

  const inviteEmail = normalizeInviteEmail(invite.email as string);
  if (normalizeInviteEmail(userEmail) !== inviteEmail) {
    // Never interpolate the invitee's email into this message — it's returned verbatim
    // to whichever (mismatched) account is signed in and would otherwise disclose a
    // third party's email address to an unauthorized caller.
    throw new Error('Signed-in email does not match the invitation email.');
  }

  const propertyId = invite.property_id as string;
  const permissions = normalizePermissionIds(invite.permissions);
  const roleId = invite.role_id as string;
  assertValidRoleId(roleId);

  const { data: propertyMeta, error: propertyLookupError } = await supabase
    .from('properties')
    .select('slug, name, organization_id')
    .eq('id', propertyId)
    .maybeSingle();

  if (propertyLookupError || !propertyMeta?.organization_id || !propertyMeta.slug) {
    throw new Error('Property not found');
  }

  const { data: orgMeta, error: orgLookupError } = await supabase
    .from('organizations')
    .select('owner_id, slug')
    .eq('id', propertyMeta.organization_id as string)
    .maybeSingle();

  if (orgLookupError || !orgMeta?.owner_id || !orgMeta?.slug) {
    throw new Error('Organization not found');
  }

  if (
    await userHasOrgLevelPropertyAccess(
      supabase,
      propertyMeta.organization_id as string,
      orgMeta.owner_id as string,
      userId
    )
  ) {
    throw new Error('This account already has organization-level property access');
  }

  const customRoles = await loadCustomRolesMap(supabase, propertyId);
  await assertCustomRoleForProperty(supabase, propertyId, roleId, customRoles);

  const inviteContactPhone =
    typeof invite.contact_phone === 'string' && invite.contact_phone.trim()
      ? invite.contact_phone.trim()
      : null;

  const { data: member, error: upsertError } = await supabase
    .from('property_members')
    .upsert(
      {
        property_id: propertyId,
        user_id: userId,
        role_id: roleId,
        permissions,
        saved_permissions: null,
        status: 'active',
        plan_limited: false,
        invited_by: invite.sent_by as string,
        assigned_at: new Date().toISOString(),
        display_name: null,
        contact_phone: inviteContactPhone,
      },
      { onConflict: 'property_id,user_id' }
    )
    .select('id')
    .single();

  if (upsertError || !member) {
    throw new Error(upsertError?.message ?? 'Failed to create membership');
  }

  await supabase
    .from('property_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq('id', invite.id);

  // Self-correcting rather than a hard error here: if the invite was created under an
  // since-downgraded plan and accepting pushes past the current seat cap, the new member starts
  // deactivated (plan_limited) instead of the acceptance failing outright for the invited guest.
  await reconcileTeamSeatsForProperty(propertyId);

  return {
    propertyId,
    memberId: member.id as string,
    orgSlug: orgMeta.slug as string,
    propertySlug: propertyMeta.slug as string,
    propertyName: (propertyMeta.name as string) || 'Property',
  };
}

export function virtualOrgOwnerId(org: OrgRow): string {
  return `org-owner-${org.owner_id}`;
}
