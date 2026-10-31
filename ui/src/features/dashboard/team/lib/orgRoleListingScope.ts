import {
  emptyOrgListingAssignments,
  type OrgListingAssignments,
} from '@/features/dashboard/team/components/OrgListingAssignmentPicker';
import type {
  CustomOrgRole,
  OrgListingAssignmentsPayload,
} from '@/features/dashboard/team/types/orgTeam';

export function orgListingAssignmentsFromPayload(
  raw: OrgListingAssignmentsPayload | null | undefined
): OrgListingAssignments {
  if (!raw) return emptyOrgListingAssignments();
  return {
    properties: (raw.properties ?? []).map((entry) => ({
      propertyId: entry.propertyId,
      roleId: entry.roleId,
      permissions: entry.permissions ?? [],
    })),
    parkings: (raw.parkings ?? []).map((entry) => ({
      parkingId: entry.parkingId,
      roleId: entry.roleId,
      permissions: entry.permissions ?? [],
    })),
  };
}

export function orgListingScopeSummary(
  allListings: boolean,
  assignments: OrgListingAssignments | OrgListingAssignmentsPayload | null | undefined
): string {
  if (allListings) return 'All listings';
  const parsed =
    assignments && 'properties' in assignments && Array.isArray(assignments.properties)
      ? {
          properties: assignments.properties,
          parkings: assignments.parkings ?? [],
        }
      : orgListingAssignmentsFromPayload(assignments as OrgListingAssignmentsPayload | null);
  const propertyCount = parsed.properties.length;
  const parkingCount = parsed.parkings.length;
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

export function orgRoleListingDefaults(role: CustomOrgRole | undefined): {
  allListings: boolean;
  listingAssignments: OrgListingAssignments;
} {
  if (!role) {
    return { allListings: false, listingAssignments: emptyOrgListingAssignments() };
  }
  return {
    allListings: role.allListings ?? false,
    listingAssignments: orgListingAssignmentsFromPayload(role.listingAssignments),
  };
}

export function findOrgRoleById(
  roleId: string,
  customRoles: CustomOrgRole[]
): CustomOrgRole | undefined {
  return customRoles.find((role) => role.id === roleId);
}
