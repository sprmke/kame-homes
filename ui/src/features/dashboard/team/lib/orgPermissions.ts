import { expandLegacyOrgPermissionIds } from '@/features/dashboard/team/lib/orgLegacyPermissionExpansion';
import { type ORG_ROLE_PERMISSIONS } from '@/features/dashboard/team/lib/orgTeamConstants';

export type OrgAccessKind = 'owner' | 'platform_admin' | 'org_admin' | 'property_member';

export type OrgPermissionId = (typeof ORG_ROLE_PERMISSIONS.OWNER)[number];

export type OrgAccessPayload = {
  accessKind: OrgAccessKind;
  permissions: string[];
  memberId: string | null;
  canListAllProperties: boolean;
  orgId: string;
  orgSlug: string;
  orgName: string;
  canManageTeam: boolean;
  canInviteTeam: boolean;
  canCreateProperties: boolean;
  canManageProperties: boolean;
  canCreateParkings: boolean;
  canManageParkings: boolean;
  canEditBasicSettings: boolean;
  canEditSocials: boolean;
  canEditAiPlatform: boolean;
  canEditAiAssistant: boolean;
  /** True when any org.settings.*:edit leaf is granted. */
  canEditSettings: boolean;
  planLimited?: boolean;
};

function expandGranted(permissions: readonly string[] | undefined): string[] {
  return expandLegacyOrgPermissionIds(permissions ?? []);
}

export function hasOrgPermission(
  permissions: readonly string[] | undefined,
  required: string
): boolean {
  const granted = expandGranted(permissions);
  const requiredExpanded = expandLegacyOrgPermissionIds([required]);
  return requiredExpanded.some((id) => granted.includes(id));
}

/** Minimum view permission per org sidebar nav label. */
export const ORG_NAV_VIEW_PERMISSION: Record<string, string> = {
  Dashboard: 'org.dashboard:view',
  Bookings: 'org.bookings:view',
  Properties: 'org.properties:view',
  Parkings: 'org.parkings:view',
  Team: 'org.team:view',
  Settings: 'org.settings:view',
  'Plans & Billing': 'org.plans:view',
  Announcements: 'org.dashboard:view',
  Analytics: 'org.analytics:view',
  Activity: 'org.activity:view',
};

/** Minimum view permission per org route section. */
export const ORG_SECTION_VIEW_PERMISSION = {
  dashboard: 'org.dashboard:view',
  bookings: 'org.bookings:view',
  properties: 'org.properties:view',
  parkings: 'org.parkings:view',
  team: 'org.team:view',
  settings: 'org.settings:view',
  plans: 'org.plans:view',
  announcements: 'org.dashboard:view',
  analytics: 'org.analytics:view',
  activity: 'org.activity:view',
  'help-support': 'org.dashboard:view',
} as const satisfies Record<string, string>;

export type OrgSection = keyof typeof ORG_SECTION_VIEW_PERMISSION;

export function orgSectionPath(orgSlug: string, section: OrgSection): string {
  switch (section) {
    case 'dashboard':
      return `/org/${orgSlug}/dashboard`;
    case 'bookings':
      return `/org/${orgSlug}/bookings`;
    case 'properties':
      return `/org/${orgSlug}/properties`;
    case 'parkings':
      return `/org/${orgSlug}/parkings`;
    case 'team':
      return `/org/${orgSlug}/team`;
    case 'settings':
      return `/org/${orgSlug}/settings`;
    case 'plans':
      return `/org/${orgSlug}/plans`;
    case 'announcements':
      return `/org/${orgSlug}/announcements`;
    case 'analytics':
      return `/org/${orgSlug}/analytics`;
    case 'activity':
      return `/org/${orgSlug}/settings?open=activity`;
    case 'help-support':
      return `/org/${orgSlug}/help-support`;
  }
}

/** True when the user may open org-scoped routes (not property-only membership). */
export function canAccessOrgScope(
  access: Pick<OrgAccessPayload, 'accessKind'> | null | undefined
): boolean {
  return Boolean(access && access.accessKind !== 'property_member');
}
