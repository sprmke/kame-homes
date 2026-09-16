/**
 * Org/property/parking auth — owner, platform admin, and team RBAC.
 *
 * verifyAuthenticatedUser — any valid Supabase JWT
 * verifyOrgOwner — JWT + organizations.owner_id match
 * verifyPropertyOwner — JWT + property belongs to an org the user owns
 * verifyPropertyAccess — owner | platform admin | active property_members + optional permission
 * isPlatformAdmin — ADMIN_ALLOWED_EMAILS superadmin escape hatch
 */

import { createClient, type SupabaseClient } from './supabaseJs.ts';
import { resolveSupabaseServiceRoleKey, resolveSupabaseUrl } from './supabaseRuntimeEnv.ts';

import {
  allOrgPermissions,
  effectiveOrgMemberPermissions,
  hasOrgPermission,
  isOrgHubMemberRoleId,
  ORG_PROPERTY_MEMBER_PERMISSIONS,
  type OrgPermissionId,
  type OrgPermissionParam,
} from './orgTeamPermissions.ts';
import {
  allParkingTeamPermissions,
  BUILTIN_PARKING_ROLE_PERMISSIONS,
  effectiveMemberPermissions as effectiveParkingMemberPermissions,
  type ParkingTeamPermissionId,
} from './parkingTeamPermissions.ts';
import {
  allTeamPermissions,
  effectiveMemberPermissions,
  type TeamPermissionId,
} from './propertyTeamPermissions.ts';
import type { PlanFeatureKey } from './planFeatures.ts';
import {
  catchPlanFeatureError,
  requirePropertyFeature,
  type ResolvedPropertyEntitlements,
} from './planEntitlements.ts';

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type OrgRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
  host_modes: string[] | null;
  created_at: string;
  updated_at: string;
};

export type ParkingRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: string;
  residence_name: string | null;
  tower: string | null;
  level: string | null;
  slot_label: string;
  parking_type: string;
  rate_per_night: number | null;
  accepted_vehicle_types: string[];
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PropertyRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  address: string | null;
  tower_and_unit: string | null;
  tower: string | null;
  unit_number: string | null;
  residence_name: string | null;
  max_guests: number | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function unauthorizedResponse(message: string): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function forbiddenResponse(message: string): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

function notFoundResponse(message: string): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createServiceClient(): SupabaseClient {
  return createClient(resolveSupabaseUrl(), resolveSupabaseServiceRoleKey());
}

export function isPlatformAdmin(email: string): boolean {
  const allowedRaw = Deno.env.get('ADMIN_ALLOWED_EMAILS') ?? '';
  const allowed = allowedRaw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export function isSuperAdminEmail(email: string): boolean {
  const raw = Deno.env.get('SUPER_ADMIN_EMAILS') ?? '';
  const allowed = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return email.trim() !== '' && allowed.includes(email.trim().toLowerCase());
}

function extractBearerJwt(req: Request): string {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw unauthorizedResponse('Missing or invalid Authorization header');
  }
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) {
    throw unauthorizedResponse('Missing JWT');
  }
  return jwt;
}

/** Validates JWT only — any signed-in Google user. */
export async function verifyAuthenticatedUser(req: Request): Promise<AuthenticatedUser> {
  const jwt = extractBearerJwt(req);
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) {
    throw unauthorizedResponse('Invalid or expired session');
  }
  const email = data.user.email ?? '';
  if (!email) {
    throw unauthorizedResponse('Account email is required');
  }
  return { id: data.user.id, email };
}

/** Optional JWT — returns null when missing or invalid (public endpoints). */
export async function tryGetAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}

/** JWT + org ownership (or platform admin). */
export async function verifyOrgOwner(
  req: Request,
  orgId: string
): Promise<{ user: AuthenticatedUser; org: OrgRow }> {
  const user = await verifyAuthenticatedUser(req);
  const supabase = createServiceClient();

  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();

  if (error) {
    console.error('[orgAuth] org lookup failed:', error.message);
    throw forbiddenResponse('Could not verify organization access');
  }
  if (!org) {
    throw notFoundResponse('Organization not found');
  }

  if (org.owner_id !== user.id && !isPlatformAdmin(user.email)) {
    throw forbiddenResponse('Access restricted');
  }

  return { user, org: org as OrgRow };
}

/** JWT + property belongs to an org the user owns (or platform admin). */
export async function verifyPropertyOwner(
  req: Request,
  propertyId: string
): Promise<{ user: AuthenticatedUser; property: PropertyRow; org: OrgRow }> {
  const user = await verifyAuthenticatedUser(req);
  const supabase = createServiceClient();

  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .maybeSingle();

  if (propError) {
    console.error('[orgAuth] property lookup failed:', propError.message);
    throw forbiddenResponse('Could not verify property access');
  }
  if (!property) {
    throw notFoundResponse('Property not found');
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', property.organization_id)
    .maybeSingle();

  if (orgError || !org) {
    throw forbiddenResponse('Could not verify organization access');
  }

  if (org.owner_id !== user.id && !isPlatformAdmin(user.email)) {
    throw forbiddenResponse('Access restricted');
  }

  return {
    user,
    property: property as PropertyRow,
    org: org as OrgRow,
  };
}

export type PropertyAccessKind = 'owner' | 'platform_admin' | 'org_admin' | 'member';

export type PropertyAccessContext = {
  user: AuthenticatedUser;
  property: PropertyRow;
  org: OrgRow;
  accessKind: PropertyAccessKind;
  /** Effective permission ids for this request (full catalog for owner/platform admin). */
  permissions: TeamPermissionId[];
  memberId?: string;
  planLimited?: boolean;
};

type PropertyMemberDbRow = {
  id: string;
  role_id: string;
  permissions: unknown;
  status: string;
  plan_limited?: boolean;
};

/**
 * JWT + property access for org owner, platform admin, or active property_members row.
 * Optional requiredPermission enforces RBAC (team:*, bookings:*, etc.).
 */
export async function verifyPropertyAccess(
  req: Request,
  propertyId: string,
  requiredPermission?: TeamPermissionId
): Promise<PropertyAccessContext> {
  const user = await verifyAuthenticatedUser(req);
  const supabase = createServiceClient();

  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .maybeSingle();

  if (propError) {
    console.error('[orgAuth] property lookup failed:', propError.message);
    throw forbiddenResponse('Could not verify property access');
  }
  if (!property) {
    throw notFoundResponse('Property not found');
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', property.organization_id)
    .maybeSingle();

  if (orgError || !org) {
    throw forbiddenResponse('Could not verify organization access');
  }

  const orgRow = org as OrgRow;
  const propertyRow = property as PropertyRow;

  if (orgRow.owner_id === user.id) {
    const ctx: PropertyAccessContext = {
      user,
      property: propertyRow,
      org: orgRow,
      accessKind: 'owner',
      permissions: allTeamPermissions(),
    };
    if (requiredPermission && !ctx.permissions.includes(requiredPermission)) {
      throw forbiddenResponse('Access restricted');
    }
    return ctx;
  }

  if (isPlatformAdmin(user.email)) {
    const ctx: PropertyAccessContext = {
      user,
      property: propertyRow,
      org: orgRow,
      accessKind: 'platform_admin',
      permissions: allTeamPermissions(),
    };
    if (requiredPermission && !ctx.permissions.includes(requiredPermission)) {
      throw forbiddenResponse('Access restricted');
    }
    return ctx;
  }

  const { data: orgAdminMember, error: orgAdminError } = await supabase
    .from('organization_members')
    .select('id, status, role_id, plan_limited, permissions, all_listings')
    .eq('organization_id', orgRow.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (orgAdminError) {
    console.error('[orgAuth] org member lookup failed:', orgAdminError.message);
    throw forbiddenResponse('Could not verify property access');
  }

  if (
    orgAdminMember &&
    orgAdminMember.status === 'inactive' &&
    orgAdminMember.plan_limited === true &&
    isOrgHubMemberRoleId(orgAdminMember.role_id as string)
  ) {
    // Soft-allow for property-access / gates only — permissioned callers still 403.
    if (requiredPermission) {
      throw forbiddenResponse('Access restricted');
    }
    return {
      user,
      property: propertyRow,
      org: orgRow,
      accessKind: 'org_admin',
      permissions: [],
      memberId: orgAdminMember.id as string,
      planLimited: true,
    };
  }

  if (orgAdminMember && orgAdminMember.status !== 'active') {
    // Deactivated org members must not keep access via stale assigned_via_org rows.
    throw forbiddenResponse('Access restricted');
  }

  if (orgAdminMember && isOrgHubMemberRoleId(orgAdminMember.role_id as string)) {
    if (orgAdminMember.all_listings === true) {
      const ctx: PropertyAccessContext = {
        user,
        property: propertyRow,
        org: orgRow,
        accessKind: 'org_admin',
        permissions: allTeamPermissions(),
        memberId: orgAdminMember.id as string,
      };
      if (requiredPermission && !ctx.permissions.includes(requiredPermission)) {
        throw forbiddenResponse('Access restricted');
      }
      return ctx;
    }
    // Scoped org admin — fall through to property_members row below.
  }

  const { data: member, error: memberError } = await supabase
    .from('property_members')
    .select('id, role_id, permissions, status, plan_limited')
    .eq('property_id', propertyId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError) {
    console.error('[orgAuth] property member lookup failed:', memberError.message);
    throw forbiddenResponse('Could not verify property access');
  }

  if (member && member.status === 'inactive' && member.plan_limited === true) {
    // Soft-allow for property-access / gates only — permissioned callers still 403.
    if (requiredPermission) {
      throw forbiddenResponse('Access restricted');
    }
    return {
      user,
      property: propertyRow,
      org: orgRow,
      accessKind: 'member',
      permissions: [],
      memberId: member.id as string,
      planLimited: true,
    };
  }

  if (!member || member.status !== 'active') {
    throw forbiddenResponse('Access restricted');
  }

  const memberRow = member as PropertyMemberDbRow;
  const permissions = effectiveMemberPermissions({
    permissions: Array.isArray(memberRow.permissions)
      ? memberRow.permissions.filter((p): p is string => typeof p === 'string')
      : [],
    status: 'active',
  });

  if (permissions.length === 0) {
    throw forbiddenResponse('Access restricted');
  }

  if (requiredPermission && !permissions.includes(requiredPermission)) {
    throw forbiddenResponse('Access restricted');
  }

  return {
    user,
    property: propertyRow,
    org: orgRow,
    accessKind: 'member',
    permissions,
    memberId: memberRow.id,
  };
}

export type ParkingAccessKind = 'owner' | 'platform_admin' | 'org_admin' | 'member';

export type ParkingTeamAccessContext = {
  user: AuthenticatedUser;
  parking: ParkingRow;
  org: OrgRow;
  accessKind: ParkingAccessKind;
  permissions: ParkingTeamPermissionId[];
  memberId?: string;
};

type ParkingMemberDbRow = {
  id: string;
  role_id: string;
  permissions: unknown;
  status: string;
};

function capParkingStaffMemberPermissions(
  roleId: string,
  permissions: ParkingTeamPermissionId[]
): ParkingTeamPermissionId[] {
  if (roleId !== 'STAFF') return permissions;
  const allowed = new Set(BUILTIN_PARKING_ROLE_PERMISSIONS.STAFF);
  return permissions.filter((permission) => allowed.has(permission));
}

/**
 * JWT + parking access for org owner, platform admin, org ADMIN, or active parking_members row.
 */
export async function verifyParkingTeamAccess(
  req: Request,
  parkingId: string,
  requiredPermission?: ParkingTeamPermissionId
): Promise<ParkingTeamAccessContext> {
  const user = await verifyAuthenticatedUser(req);
  const supabase = createServiceClient();

  const { data: parking, error: parkingError } = await supabase
    .from('parkings')
    .select('*')
    .eq('id', parkingId)
    .maybeSingle();

  if (parkingError) {
    console.error('[orgAuth] parking lookup failed:', parkingError.message);
    throw forbiddenResponse('Could not verify parking access');
  }
  if (!parking) {
    throw notFoundResponse('Parking not found');
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', parking.organization_id)
    .maybeSingle();

  if (orgError || !org) {
    throw forbiddenResponse('Could not verify organization access');
  }

  const orgRow = org as OrgRow;
  const parkingRow = parking as ParkingRow;

  if (orgRow.owner_id === user.id) {
    const ctx: ParkingTeamAccessContext = {
      user,
      parking: parkingRow,
      org: orgRow,
      accessKind: 'owner',
      permissions: allParkingTeamPermissions(),
    };
    if (requiredPermission && !ctx.permissions.includes(requiredPermission)) {
      throw forbiddenResponse('Access restricted');
    }
    return ctx;
  }

  if (isPlatformAdmin(user.email)) {
    const ctx: ParkingTeamAccessContext = {
      user,
      parking: parkingRow,
      org: orgRow,
      accessKind: 'platform_admin',
      permissions: allParkingTeamPermissions(),
    };
    if (requiredPermission && !ctx.permissions.includes(requiredPermission)) {
      throw forbiddenResponse('Access restricted');
    }
    return ctx;
  }

  const { data: orgAdminMember, error: orgAdminError } = await supabase
    .from('organization_members')
    .select('id, status, role_id, plan_limited, permissions, all_listings')
    .eq('organization_id', orgRow.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (orgAdminError) {
    console.error('[orgAuth] org member lookup failed:', orgAdminError.message);
    throw forbiddenResponse('Could not verify parking access');
  }

  if (
    orgAdminMember &&
    orgAdminMember.status === 'inactive' &&
    orgAdminMember.plan_limited === true &&
    isOrgHubMemberRoleId(orgAdminMember.role_id as string)
  ) {
    if (requiredPermission) {
      throw forbiddenResponse('Access restricted');
    }
    return {
      user,
      parking: parkingRow,
      org: orgRow,
      accessKind: 'org_admin',
      permissions: [],
      memberId: orgAdminMember.id as string,
    };
  }

  if (orgAdminMember && orgAdminMember.status !== 'active') {
    throw forbiddenResponse('Access restricted');
  }

  if (orgAdminMember && isOrgHubMemberRoleId(orgAdminMember.role_id as string)) {
    if (orgAdminMember.all_listings === true) {
      const ctx: ParkingTeamAccessContext = {
        user,
        parking: parkingRow,
        org: orgRow,
        accessKind: 'org_admin',
        permissions: allParkingTeamPermissions(),
        memberId: orgAdminMember.id as string,
      };
      if (requiredPermission && !ctx.permissions.includes(requiredPermission)) {
        throw forbiddenResponse('Access restricted');
      }
      return ctx;
    }
    // Scoped org admin — fall through to parking_members row below.
  }

  const { data: member, error: memberError } = await supabase
    .from('parking_members')
    .select('id, role_id, permissions, status')
    .eq('parking_id', parkingId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError) {
    console.error('[orgAuth] parking member lookup failed:', memberError.message);
    throw forbiddenResponse('Could not verify parking access');
  }

  if (!member || member.status !== 'active') {
    throw forbiddenResponse('Access restricted');
  }

  const memberRow = member as ParkingMemberDbRow;
  const permissions = capParkingStaffMemberPermissions(
    memberRow.role_id,
    effectiveParkingMemberPermissions({
      permissions: Array.isArray(memberRow.permissions)
        ? memberRow.permissions.filter((p): p is string => typeof p === 'string')
        : [],
      status: 'active',
    })
  );

  if (permissions.length === 0) {
    throw forbiddenResponse('Access restricted');
  }

  if (requiredPermission && !permissions.includes(requiredPermission)) {
    throw forbiddenResponse('Access restricted');
  }

  return {
    user,
    parking: parkingRow,
    org: orgRow,
    accessKind: 'member',
    permissions,
    memberId: memberRow.id,
  };
}

/**
 * Org list access — owner, platform admin, or active member on any property in the org.
 * `canListAllProperties` is true for owner/platform admin (all org properties).
 */
export async function verifyOrgListAccess(
  req: Request,
  orgId?: string,
  orgSlug?: string
): Promise<{
  user: AuthenticatedUser;
  org: OrgRow;
  canListAllProperties: boolean;
}> {
  const user = await verifyAuthenticatedUser(req);
  const supabase = createServiceClient();

  let org: OrgRow | null = null;
  if (orgId) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();
    if (error) {
      throw forbiddenResponse('Could not verify organization access');
    }
    org = data as OrgRow | null;
  } else if (orgSlug) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', orgSlug)
      .maybeSingle();
    if (error) {
      throw forbiddenResponse('Could not verify organization access');
    }
    org = data as OrgRow | null;
  }

  if (!org) {
    throw notFoundResponse('Organization not found');
  }

  if (org.owner_id === user.id || isPlatformAdmin(user.email) || isSuperAdminEmail(user.email)) {
    return { user, org, canListAllProperties: true };
  }

  const { data: orgAdminMember, error: orgAdminError } = await supabase
    .from('organization_members')
    .select('id, status, role_id, plan_limited, permissions, all_listings')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (orgAdminError) {
    throw forbiddenResponse('Could not verify organization access');
  }
  if (
    orgAdminMember &&
    orgAdminMember.status === 'active' &&
    isOrgHubMemberRoleId(orgAdminMember.role_id as string)
  ) {
    return { user, org, canListAllProperties: orgAdminMember.all_listings === true };
  }
  // Plan-limited inactive org admins may list (empty property set) so /org home does not 403.
  if (
    orgAdminMember &&
    orgAdminMember.status === 'inactive' &&
    orgAdminMember.plan_limited === true &&
    isOrgHubMemberRoleId(orgAdminMember.role_id as string)
  ) {
    return { user, org, canListAllProperties: false };
  }

  const { count, error: memberError } = await supabase
    .from('property_members')
    .select('id, properties!inner(organization_id)', {
      count: 'exact',
      head: true,
    })
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('properties.organization_id', org.id);

  if (memberError) {
    throw forbiddenResponse('Could not verify organization access');
  }
  if ((count ?? 0) > 0) {
    return { user, org, canListAllProperties: false };
  }

  // Plan-limited inactive property members may list their assigned properties so
  // RequireOrgContext can reach PropertyPlanLimitedGate (not a generic 403).
  const { count: planLimitedCount, error: planLimitedError } = await supabase
    .from('property_members')
    .select('id, properties!inner(organization_id)', {
      count: 'exact',
      head: true,
    })
    .eq('user_id', user.id)
    .eq('status', 'inactive')
    .eq('plan_limited', true)
    .eq('properties.organization_id', org.id);

  if (planLimitedError) {
    throw forbiddenResponse('Could not verify organization access');
  }
  if ((planLimitedCount ?? 0) === 0) {
    throw forbiddenResponse('Access restricted');
  }

  return { user, org, canListAllProperties: false };
}

async function resolveOrgRow(
  supabase: SupabaseClient,
  scope: { orgId?: string; orgSlug?: string }
): Promise<OrgRow | null> {
  if (scope.orgId) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', scope.orgId)
      .maybeSingle();
    if (error) {
      throw forbiddenResponse('Could not verify organization access');
    }
    return data as OrgRow | null;
  }
  if (scope.orgSlug) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', scope.orgSlug)
      .maybeSingle();
    if (error) {
      throw forbiddenResponse('Could not verify organization access');
    }
    return data as OrgRow | null;
  }
  return null;
}

/**
 * JWT + org access for owner, platform admin, org ADMIN, or property-only member.
 * Optional requiredPermission enforces org RBAC (org:dashboard:view, etc.).
 */
export async function verifyOrgAccess(
  req: Request,
  scope: { orgId?: string; orgSlug?: string },
  requiredPermission?: OrgPermissionParam
): Promise<OrgAccessContext> {
  const user = await verifyAuthenticatedUser(req);
  const supabase = createServiceClient();

  const org = await resolveOrgRow(supabase, scope);
  if (!org) {
    throw notFoundResponse('Organization not found');
  }

  const enforce = (ctx: OrgAccessContext): OrgAccessContext => {
    if (requiredPermission && !hasOrgPermission(ctx.permissions, requiredPermission)) {
      throw forbiddenResponse('Access restricted');
    }
    return ctx;
  };

  if (org.owner_id === user.id) {
    return enforce({
      user,
      org,
      accessKind: 'owner',
      permissions: allOrgPermissions(),
      canListAllProperties: true,
    });
  }

  if (isPlatformAdmin(user.email) || isSuperAdminEmail(user.email)) {
    return enforce({
      user,
      org,
      accessKind: 'platform_admin',
      permissions: allOrgPermissions(),
      canListAllProperties: true,
    });
  }

  const { data: orgAdminMember, error: orgAdminError } = await supabase
    .from('organization_members')
    .select('id, status, role_id, plan_limited, permissions, all_listings')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (orgAdminError) {
    console.error('[orgAuth] org member lookup failed:', orgAdminError.message);
    throw forbiddenResponse('Could not verify organization access');
  }

  if (
    orgAdminMember &&
    orgAdminMember.status === 'inactive' &&
    orgAdminMember.plan_limited === true &&
    isOrgHubMemberRoleId(orgAdminMember.role_id as string)
  ) {
    // Soft-allow for org-access / gates only — permissioned callers still 403.
    if (requiredPermission) {
      throw forbiddenResponse('Access restricted');
    }
    return {
      user,
      org,
      accessKind: 'org_admin',
      permissions: [],
      canListAllProperties: false,
      memberId: orgAdminMember.id as string,
      planLimited: true,
    };
  }

  if (
    orgAdminMember &&
    orgAdminMember.status === 'active' &&
    isOrgHubMemberRoleId(orgAdminMember.role_id as string)
  ) {
    return enforce({
      user,
      org,
      accessKind: 'org_admin',
      permissions: effectiveOrgMemberPermissions(orgAdminMember),
      canListAllProperties: orgAdminMember.all_listings === true,
      memberId: orgAdminMember.id as string,
    });
  }

  const { count, error: memberError } = await supabase
    .from('property_members')
    .select('id, properties!inner(organization_id)', {
      count: 'exact',
      head: true,
    })
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('properties.organization_id', org.id);

  if (memberError) {
    throw forbiddenResponse('Could not verify organization access');
  }
  if ((count ?? 0) === 0) {
    const { count: planLimitedCount, error: planLimitedError } = await supabase
      .from('property_members')
      .select('id, properties!inner(organization_id)', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', user.id)
      .eq('status', 'inactive')
      .eq('plan_limited', true)
      .eq('properties.organization_id', org.id);

    if (planLimitedError) {
      throw forbiddenResponse('Could not verify organization access');
    }
    if ((planLimitedCount ?? 0) > 0) {
      // Soft-allow for org-access / gates only — permissioned callers still 403.
      if (requiredPermission) {
        throw forbiddenResponse('Access restricted');
      }
      return {
        user,
        org,
        accessKind: 'property_member',
        permissions: [],
        canListAllProperties: false,
        planLimited: true,
      };
    }
    throw forbiddenResponse('Access restricted');
  }

  return enforce({
    user,
    org,
    accessKind: 'property_member',
    permissions: [...ORG_PROPERTY_MEMBER_PERMISSIONS],
    canListAllProperties: false,
  });
}

/** Resolve org by slug and verify ownership. */
export async function verifyOrgOwnerBySlug(
  req: Request,
  orgSlug: string
): Promise<{ user: AuthenticatedUser; org: OrgRow }> {
  const user = await verifyAuthenticatedUser(req);
  const supabase = createServiceClient();

  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', orgSlug)
    .maybeSingle();

  if (error) {
    console.error('[orgAuth] org slug lookup failed:', error.message);
    throw forbiddenResponse('Could not verify organization access');
  }
  if (!org) {
    throw notFoundResponse('Organization not found');
  }

  if (org.owner_id !== user.id && !isPlatformAdmin(user.email)) {
    throw forbiddenResponse('Access restricted');
  }

  return { user, org: org as OrgRow };
}

export type OrgAccessKind = 'owner' | 'platform_admin' | 'org_admin' | 'property_member';

export type OrgAccessContext = {
  user: AuthenticatedUser;
  org: OrgRow;
  accessKind: OrgAccessKind;
  permissions: OrgPermissionId[];
  canListAllProperties: boolean;
  memberId?: string;
  planLimited?: boolean;
};

/**
 * Property + parking ids the user may see under an org when `all_listings` is false.
 * Includes active memberships only (plan-limited inactive rows are omitted from hub lists).
 * Assigned sets are typically small — safe for `.in()` filters.
 */
export async function resolveAssignedListingIdsForOrgUser(
  userId: string,
  orgId: string
): Promise<{ propertyIds: string[]; parkingIds: string[] }> {
  const supabase = createServiceClient();

  const [{ data: propertyRows, error: propertyError }, { data: parkingRows, error: parkingError }] =
    await Promise.all([
      supabase
        .from('property_members')
        .select('property_id, properties!inner(organization_id)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('properties.organization_id', orgId),
      supabase
        .from('parking_members')
        .select('parking_id, parkings!inner(organization_id)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('parkings.organization_id', orgId),
    ]);

  if (propertyError) {
    console.error('[orgAuth] assigned property lookup failed:', propertyError.message);
    throw forbiddenResponse('Could not verify organization access');
  }
  if (parkingError) {
    console.error('[orgAuth] assigned parking lookup failed:', parkingError.message);
    throw forbiddenResponse('Could not verify organization access');
  }

  return {
    propertyIds: [
      ...new Set((propertyRows ?? []).map((row) => String(row.property_id)).filter(Boolean)),
    ],
    parkingIds: [
      ...new Set((parkingRows ?? []).map((row) => String(row.parking_id)).filter(Boolean)),
    ],
  };
}

export type OrgTeamAccessKind = 'owner' | 'platform_admin' | 'org_admin';

export type OrgTeamAccessContext = {
  user: AuthenticatedUser;
  org: OrgRow;
  accessKind: OrgTeamAccessKind;
  memberId?: string;
  canManage: boolean;
};

export function hasOrgTeamManagePermission(granted: readonly string[]): boolean {
  return (
    hasOrgPermission(granted, 'org.team.members:edit') ||
    hasOrgPermission(granted, 'org.team.members:delete') ||
    hasOrgPermission(granted, 'org.team.invitations:edit') ||
    hasOrgPermission(granted, 'org.team.invitations:delete')
  );
}

export function hasOrgTeamInvitePermission(granted: readonly string[]): boolean {
  return (
    hasOrgPermission(granted, 'org.team.invitations:add') || hasOrgTeamManagePermission(granted)
  );
}

export function hasOrgTeamMemberEditPermission(granted: readonly string[]): boolean {
  return hasOrgPermission(granted, 'org.team.members:edit');
}

export function hasOrgTeamMemberDeletePermission(granted: readonly string[]): boolean {
  return hasOrgPermission(granted, 'org.team.members:delete');
}

export function hasOrgTeamInvitationEditPermission(granted: readonly string[]): boolean {
  return hasOrgPermission(granted, 'org.team.invitations:edit');
}

export function hasOrgTeamInvitationDeletePermission(granted: readonly string[]): boolean {
  return hasOrgPermission(granted, 'org.team.invitations:delete');
}

/**
 * JWT + org team access for owner, platform admin, or active org ADMIN member.
 * Property-only members cannot access org team routes.
 */
export async function verifyOrgTeamAccess(
  req: Request,
  scope: { orgId?: string; orgSlug?: string },
  options?: {
    requireManage?: boolean;
    requireInvite?: boolean;
    requireMemberEdit?: boolean;
    requireMemberDelete?: boolean;
    requireInvitationEdit?: boolean;
    requireInvitationDelete?: boolean;
  }
): Promise<OrgTeamAccessContext> {
  const ctx = await verifyOrgAccess(req, scope, 'org.team:view');

  if (options?.requireManage && !hasOrgTeamManagePermission(ctx.permissions)) {
    throw forbiddenResponse('Access restricted');
  }

  if (options?.requireInvite && !hasOrgTeamInvitePermission(ctx.permissions)) {
    throw forbiddenResponse('Access restricted');
  }

  if (options?.requireMemberEdit && !hasOrgTeamMemberEditPermission(ctx.permissions)) {
    throw forbiddenResponse('Access restricted');
  }

  if (options?.requireMemberDelete && !hasOrgTeamMemberDeletePermission(ctx.permissions)) {
    throw forbiddenResponse('Access restricted');
  }

  if (options?.requireInvitationEdit && !hasOrgTeamInvitationEditPermission(ctx.permissions)) {
    throw forbiddenResponse('Access restricted');
  }

  if (options?.requireInvitationDelete && !hasOrgTeamInvitationDeletePermission(ctx.permissions)) {
    throw forbiddenResponse('Access restricted');
  }

  return {
    user: ctx.user,
    org: ctx.org,
    accessKind: ctx.accessKind as OrgTeamAccessKind,
    memberId: ctx.memberId,
    canManage: hasOrgTeamManagePermission(ctx.permissions),
  };
}

/** Pick a unique slug within organizations. */
export async function allocateOrganizationSlug(
  supabase: SupabaseClient,
  name: string,
  preferred?: string,
  excludeOrgId?: string
): Promise<string> {
  const { slugifyName, withSlugSuffix } = await import('./slugUtils.ts');
  const base = slugifyName(preferred?.trim() || name);
  for (let i = 0; i < 20; i++) {
    const candidate = withSlugSuffix(base, i);
    const { data } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
    if (excludeOrgId && data.id === excludeOrgId) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Pick a unique slug across all properties (guest ?property= resolves globally). */
export async function allocatePropertySlug(
  supabase: SupabaseClient,
  name: string,
  preferred?: string,
  excludePropertyId?: string
): Promise<string> {
  const { slugifyName, withSlugSuffix } = await import('./slugUtils.ts');
  const base = slugifyName(preferred?.trim() || name);
  for (let i = 0; i < 20; i++) {
    const candidate = withSlugSuffix(base, i);
    const { data } = await supabase
      .from('properties')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
    if (excludePropertyId && data.id === excludePropertyId) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export function serializeOrganization(org: OrgRow) {
  const hostModes = Array.isArray(org.host_modes) ? org.host_modes : [];
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description,
    logoUrl: org.logo_url,
    settings: org.settings ?? {},
    hostModes,
    createdAt: org.created_at,
    updatedAt: org.updated_at,
  };
}

export function serializeProperty(property: PropertyRow) {
  return {
    id: property.id,
    organizationId: property.organization_id,
    name: property.name,
    slug: property.slug,
    type: property.type,
    status: property.status,
    address: property.address,
    towerAndUnit: property.tower_and_unit,
    tower: property.tower,
    unitNumber: property.unit_number,
    residenceName: property.residence_name,
    maxGuests: property.max_guests,
    settings: property.settings ?? {},
    createdAt: property.created_at,
    updatedAt: property.updated_at,
  };
}

export async function allocateParkingSlug(
  supabase: SupabaseClient,
  name: string,
  preferred?: string,
  excludeParkingId?: string
): Promise<string> {
  const { slugifyName, withSlugSuffix } = await import('./slugUtils.ts');
  const base = slugifyName(preferred?.trim() || name);
  for (let i = 0; i < 20; i++) {
    const candidate = withSlugSuffix(base, i);
    const { data } = await supabase
      .from('parkings')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
    if (excludeParkingId && data.id === excludeParkingId) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export function serializeParking(parking: ParkingRow) {
  return {
    id: parking.id,
    organizationId: parking.organization_id,
    name: parking.name,
    slug: parking.slug,
    status: parking.status,
    residenceName: parking.residence_name,
    tower: parking.tower,
    level: parking.level,
    slotLabel: parking.slot_label,
    parkingType: parking.parking_type,
    ratePerNight: parking.rate_per_night,
    acceptedVehicleTypes: parking.accepted_vehicle_types ?? ['car'],
    settings: parking.settings ?? {},
    createdAt: parking.created_at,
    updatedAt: parking.updated_at,
  };
}

export type PropertyPermissionAndFeatureContext = PropertyAccessContext & {
  entitlements?: ResolvedPropertyEntitlements;
};

/**
 * Team permission (outer gate) + optional plan feature (inner gate) with one error contract.
 * Returns a Response on plan-feature denial; throws verifyPropertyAccess failures as before.
 */
export async function requirePropertyPermissionAndFeature(
  req: Request,
  propertyId: string,
  permission: TeamPermissionId,
  feature?: PlanFeatureKey
): Promise<PropertyPermissionAndFeatureContext> {
  const ctx = await verifyPropertyAccess(req, propertyId, permission);
  if (!feature) {
    return ctx;
  }
  try {
    const entitlements = await requirePropertyFeature(propertyId, feature);
    return { ...ctx, entitlements };
  } catch (err) {
    const planResponse = catchPlanFeatureError(req, err);
    if (planResponse) {
      throw planResponse;
    }
    throw err;
  }
}
