import {
  findTemplateIdByName,
  isSeededTemplateName,
  SEEDED_PROPERTY_TEMPLATE_NAMES,
  type SeededPropertyTemplateName,
} from '@/features/dashboard/team/lib/propertyTeamTemplates';
import type { CustomPropertyRole } from '@/features/dashboard/team/types/propertyTeam';

/** Seeded property roles shown when assigning org members to individual listings. */
export const LISTING_PROPERTY_TEMPLATE_OPTIONS = [
  { name: SEEDED_PROPERTY_TEMPLATE_NAMES.FULL_ACCESS, label: 'Full Access' },
  { name: SEEDED_PROPERTY_TEMPLATE_NAMES.OPERATIONS, label: 'Operations' },
  { name: SEEDED_PROPERTY_TEMPLATE_NAMES.READ_ONLY, label: 'Read Only' },
] as const;

const LEGACY_PROPERTY_ROLE_TO_TEMPLATE: Record<string, SeededPropertyTemplateName> = {
  ADMIN: SEEDED_PROPERTY_TEMPLATE_NAMES.FULL_ACCESS,
  MANAGER: SEEDED_PROPERTY_TEMPLATE_NAMES.FULL_ACCESS,
  STAFF: SEEDED_PROPERTY_TEMPLATE_NAMES.OPERATIONS,
  VIEWER: SEEDED_PROPERTY_TEMPLATE_NAMES.READ_ONLY,
};

export function defaultListingPropertyTemplateName(): SeededPropertyTemplateName {
  return SEEDED_PROPERTY_TEMPLATE_NAMES.FULL_ACCESS;
}

export function resolveListingPropertyTemplateName(
  roleId: string,
  propertyCustomRoles: CustomPropertyRole[] = []
): SeededPropertyTemplateName {
  const trimmed = roleId.trim();
  if (isSeededTemplateName(trimmed)) {
    const canonical = Object.values(SEEDED_PROPERTY_TEMPLATE_NAMES).find(
      (name) => name.toLowerCase() === trimmed.toLowerCase()
    );
    if (canonical) return canonical;
  }

  const legacy = LEGACY_PROPERTY_ROLE_TO_TEMPLATE[trimmed];
  if (legacy) return legacy;

  const match = propertyCustomRoles.find((role) => role.id === trimmed);
  if (match && isSeededTemplateName(match.name)) {
    return match.name as SeededPropertyTemplateName;
  }

  return defaultListingPropertyTemplateName();
}

export function resolveListingPropertyRoleId(
  templateName: SeededPropertyTemplateName,
  propertyCustomRoles: CustomPropertyRole[]
): string {
  return (
    findTemplateIdByName(propertyCustomRoles, templateName) ??
    findTemplateIdByName(propertyCustomRoles, defaultListingPropertyTemplateName()) ??
    propertyCustomRoles[0]?.id ??
    'ADMIN'
  );
}

export function normalizeListingPropertyAssignments<
  T extends { propertyId: string; roleId: string; permissions: string[] },
>(assignments: T[], rolesByPropertyId: Map<string, CustomPropertyRole[]>): T[] {
  return assignments.map((entry) => {
    const propertyRoles = rolesByPropertyId.get(entry.propertyId) ?? [];
    const templateName = resolveListingPropertyTemplateName(entry.roleId, propertyRoles);
    return {
      ...entry,
      roleId: resolveListingPropertyRoleId(templateName, propertyRoles),
      permissions: [],
    };
  });
}

/** Parking still stores MANAGER | STAFF | VIEWER — UI labels mirror seeded template names. */
export const LISTING_PARKING_ROLE_OPTIONS = [
  { value: 'MANAGER' as const, label: 'Full Access' },
  { value: 'STAFF' as const, label: 'Operations' },
  { value: 'VIEWER' as const, label: 'Read Only' },
] as const;

export function normalizeLegacyParkingListingRoleId(roleId: string): string {
  if (roleId === 'ADMIN') return 'MANAGER';
  return roleId;
}
