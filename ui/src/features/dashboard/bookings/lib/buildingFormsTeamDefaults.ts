import type {
  AppSettingsFieldSource,
  AppSettingsFormValues,
} from '@/features/dashboard/bookings/hooks/useAppSettings';
import { expandLegacyPropertyPermissionIds } from '@/features/dashboard/team/lib/legacyPermissionExpansion';
import type { TeamMember } from '@/features/dashboard/team/types/propertyTeam';

export type BuildingFormsTeamDefaults = {
  gafUnitOwner: string;
  gafGuestsOnsiteContactPerson: string;
  gafOwnerContactNumber: string;
};

function memberDisplayName(member: TeamMember): string {
  return member.displayName?.trim() || member.name?.trim() || '';
}

function memberHasTeamManageAccess(permissions: readonly string[]): boolean {
  const expanded = expandLegacyPropertyPermissionIds(permissions);
  return (
    expanded.includes('team.members:edit') ||
    expanded.includes('team.members:delete') ||
    expanded.includes('team.customRoles:add') ||
    expanded.includes('team.customRoles:edit') ||
    expanded.includes('team.customRoles:delete') ||
    expanded.includes('team:manage')
  );
}

/** Prefer a property member with team management access, then org owner virtual row. */
export function pickBuildingFormsTeamContact(
  members: TeamMember[]
): BuildingFormsTeamDefaults | null {
  const active = members.filter((m) => m.status === 'active');
  const teamManager = active.find((m) => memberHasTeamManageAccess(m.permissions));
  const owner = active.find((m) => m.id.startsWith('org-owner-'));
  const pick = teamManager ?? owner;
  if (!pick) return null;

  const name = memberDisplayName(pick);
  if (!name) return null;

  return {
    gafUnitOwner: name,
    gafGuestsOnsiteContactPerson: name,
    gafOwnerContactNumber: pick.contactPhone?.trim() || '',
  };
}

export function applyBuildingFormsTeamDefaults(
  values: AppSettingsFormValues,
  fieldSources: Record<
    'gafUnitOwner' | 'gafGuestsOnsiteContactPerson' | 'gafOwnerContactNumber',
    AppSettingsFieldSource
  >,
  teamDefaults: BuildingFormsTeamDefaults | null
): AppSettingsFormValues {
  if (!teamDefaults) return values;

  const next = { ...values };
  if (fieldSources.gafUnitOwner !== 'db' && teamDefaults.gafUnitOwner) {
    next.gafUnitOwner = teamDefaults.gafUnitOwner;
  }
  if (
    fieldSources.gafGuestsOnsiteContactPerson !== 'db' &&
    teamDefaults.gafGuestsOnsiteContactPerson
  ) {
    next.gafGuestsOnsiteContactPerson = teamDefaults.gafGuestsOnsiteContactPerson;
  }
  if (fieldSources.gafOwnerContactNumber !== 'db' && teamDefaults.gafOwnerContactNumber) {
    next.gafOwnerContactNumber = teamDefaults.gafOwnerContactNumber;
  }
  return next;
}
