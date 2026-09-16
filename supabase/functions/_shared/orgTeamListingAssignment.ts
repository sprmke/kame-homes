/**
 * Org team listing assignment — materialize property_members / parking_members from org invites.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import {
  assertValidRoleId as assertValidPropertyRoleId,
  defaultPermissionsForRole,
  normalizePermissionIds,
  type PropertyCustomRoleRow,
} from './propertyTeamPermissions.ts';
import {
  assertValidRoleId as assertValidParkingRoleId,
  defaultPermissionsForRole as defaultParkingPermissionsForRole,
  normalizePermissionIds as normalizeParkingPermissionIds,
  type ParkingCustomRoleRow,
} from './parkingTeamPermissions.ts';
import {
  type OrgListingAssignments,
  type OrgListingParkingAssignment,
  type OrgListingPropertyAssignment,
  parseOrgListingAssignments,
} from './orgTeamPermissions.ts';

export type ParsedOrgListingAssignments = {
  properties: OrgListingPropertyAssignment[];
  parkings: OrgListingParkingAssignment[];
};

export function parseListingAssignmentsPayload(raw: unknown): ParsedOrgListingAssignments {
  const parsed = parseOrgListingAssignments(raw);
  return {
    properties: parsed?.properties ?? [],
    parkings: parsed?.parkings ?? [],
  };
}

async function loadPropertyCustomRolesMap(
  supabase: SupabaseClient,
  propertyId: string
): Promise<Map<string, PropertyCustomRoleRow>> {
  const { data, error } = await supabase
    .from('property_custom_roles')
    .select('id, property_id, name, permissions')
    .eq('property_id', propertyId);
  if (error) throw new Error(error.message);
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

async function loadParkingCustomRolesMap(
  supabase: SupabaseClient,
  parkingId: string
): Promise<Map<string, ParkingCustomRoleRow>> {
  const { data, error } = await supabase
    .from('parking_custom_roles')
    .select('id, parking_id, name, permissions')
    .eq('parking_id', parkingId);
  if (error) throw new Error(error.message);
  const map = new Map<string, ParkingCustomRoleRow>();
  for (const row of data ?? []) {
    map.set(row.id as string, {
      id: row.id as string,
      parking_id: row.parking_id as string,
      name: row.name as string,
      permissions: normalizeParkingPermissionIds(row.permissions),
    });
  }
  return map;
}

function resolvePropertyListingRoleId(
  roleId: string,
  customRoles: Map<string, PropertyCustomRoleRow>
): string {
  const trimmed = roleId.trim();
  const legacyToTemplateName: Record<string, string> = {
    ADMIN: 'Full Access',
    MANAGER: 'Full Access',
    STAFF: 'Operations',
    VIEWER: 'Read Only',
  };
  const targetName = legacyToTemplateName[trimmed] ?? trimmed;
  for (const row of customRoles.values()) {
    if (row.name.trim().toLowerCase() === targetName.toLowerCase()) {
      return row.id;
    }
  }
  return trimmed;
}

function resolvePropertyAssignmentPermissions(
  assignment: OrgListingPropertyAssignment,
  customRoles: Map<string, PropertyCustomRoleRow>
): { roleId: string; permissions: string[] } {
  const roleId = resolvePropertyListingRoleId(assignment.roleId, customRoles);
  assertValidPropertyRoleId(roleId);
  const explicit = normalizePermissionIds(assignment.permissions);
  const permissions =
    explicit.length > 0 ? explicit : defaultPermissionsForRole(roleId, customRoles);
  return { roleId, permissions };
}

function resolveParkingAssignmentPermissions(
  assignment: OrgListingParkingAssignment,
  customRoles: Map<string, ParkingCustomRoleRow>
): { roleId: string; permissions: string[] } {
  const roleId = assignment.roleId.trim();
  assertValidParkingRoleId(roleId);
  const explicit = normalizeParkingPermissionIds(assignment.permissions);
  const permissions =
    explicit.length > 0 ? explicit : defaultParkingPermissionsForRole(roleId, customRoles);
  return { roleId, permissions };
}

/** Property ids explicitly assigned to an org admin (not all_listings). */
export async function listOrgAssignedPropertyIds(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('property_members')
    .select('property_id, properties!inner(organization_id)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('assigned_via_org', true)
    .eq('properties.organization_id', organizationId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.property_id as string);
}

/** Parking ids explicitly assigned to an org admin (not all_listings). */
export async function listOrgAssignedParkingIds(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('parking_members')
    .select('parking_id, parkings!inner(organization_id)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('assigned_via_org', true)
    .eq('parkings.organization_id', organizationId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.parking_id as string);
}

/**
 * Upsert property_members / parking_members for org-assigned listings.
 * Removes org-assigned rows no longer in the assignment snapshot.
 */
export async function syncOrgListingMemberships(options: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  invitedBy: string;
  allListings: boolean;
  assignments: ParsedOrgListingAssignments;
  contactPhone?: string | null;
}): Promise<void> {
  const { supabase, organizationId, userId, invitedBy, allListings, assignments, contactPhone } =
    options;

  if (allListings) {
    await supabase
      .from('property_members')
      .delete()
      .eq('user_id', userId)
      .eq('assigned_via_org', true)
      .in(
        'property_id',
        (
          await supabase.from('properties').select('id').eq('organization_id', organizationId)
        ).data?.map((row) => row.id as string) ?? []
      );

    await supabase
      .from('parking_members')
      .delete()
      .eq('user_id', userId)
      .eq('assigned_via_org', true)
      .in(
        'parking_id',
        (
          await supabase.from('parkings').select('id').eq('organization_id', organizationId)
        ).data?.map((row) => row.id as string) ?? []
      );
    return;
  }

  const targetPropertyIds = new Set(assignments.properties.map((p) => p.propertyId));
  const targetParkingIds = new Set(assignments.parkings.map((p) => p.parkingId));

  for (const assignment of assignments.properties) {
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id')
      .eq('id', assignment.propertyId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (propertyError || !property) {
      throw new Error('Invalid property assignment');
    }

    const customRoles = await loadPropertyCustomRolesMap(supabase, assignment.propertyId);
    const { roleId, permissions } = resolvePropertyAssignmentPermissions(assignment, customRoles);

    const { error: upsertError } = await supabase.from('property_members').upsert(
      {
        property_id: assignment.propertyId,
        user_id: userId,
        role_id: roleId,
        permissions,
        saved_permissions: null,
        status: 'active',
        plan_limited: false,
        assigned_via_org: true,
        invited_by: invitedBy,
        assigned_at: new Date().toISOString(),
        contact_phone: contactPhone ?? null,
      },
      { onConflict: 'property_id,user_id' }
    );
    if (upsertError) throw new Error(upsertError.message);
  }

  for (const assignment of assignments.parkings) {
    const { data: parking, error: parkingError } = await supabase
      .from('parkings')
      .select('id')
      .eq('id', assignment.parkingId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (parkingError || !parking) {
      throw new Error('Invalid parking assignment');
    }

    const customRoles = await loadParkingCustomRolesMap(supabase, assignment.parkingId);
    const { roleId, permissions } = resolveParkingAssignmentPermissions(assignment, customRoles);

    const { error: upsertError } = await supabase.from('parking_members').upsert(
      {
        parking_id: assignment.parkingId,
        user_id: userId,
        role_id: roleId,
        permissions,
        saved_permissions: null,
        status: 'active',
        plan_limited: false,
        assigned_via_org: true,
        invited_by: invitedBy,
        assigned_at: new Date().toISOString(),
        contact_phone: contactPhone ?? null,
      },
      { onConflict: 'parking_id,user_id' }
    );
    if (upsertError) throw new Error(upsertError.message);
  }

  const { data: existingPropertyAssignments, error: listPropError } = await supabase
    .from('property_members')
    .select('id, property_id, properties!inner(organization_id)')
    .eq('user_id', userId)
    .eq('assigned_via_org', true)
    .eq('properties.organization_id', organizationId);
  if (listPropError) throw new Error(listPropError.message);

  for (const row of existingPropertyAssignments ?? []) {
    if (!targetPropertyIds.has(row.property_id as string)) {
      await supabase
        .from('property_members')
        .delete()
        .eq('id', row.id as string);
    }
  }

  const { data: existingParkingAssignments, error: listParkError } = await supabase
    .from('parking_members')
    .select('id, parking_id, parkings!inner(organization_id)')
    .eq('user_id', userId)
    .eq('assigned_via_org', true)
    .eq('parkings.organization_id', organizationId);
  if (listParkError) throw new Error(listParkError.message);

  for (const row of existingParkingAssignments ?? []) {
    if (!targetParkingIds.has(row.parking_id as string)) {
      await supabase
        .from('parking_members')
        .delete()
        .eq('id', row.id as string);
    }
  }
}

export function parseListingAssignmentsFromBody(body: Record<string, unknown>): {
  allListings: boolean;
  assignments: ParsedOrgListingAssignments;
} {
  const allListings = body.allListings === true;
  const assignments = parseListingAssignmentsPayload(
    body.listingAssignments ?? body.listing_assignments
  );
  return { allListings, assignments };
}

export function normalizeOrgPermissionsFromBody(
  body: Record<string, unknown>,
  roleId: string,
  customRolesById: Map<string, { permissions: string[] }>
): string[] {
  const raw = body.permissions;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  if (roleId !== 'ADMIN' && customRolesById.has(roleId)) {
    return [...(customRolesById.get(roleId)?.permissions ?? [])];
  }
  return [];
}
