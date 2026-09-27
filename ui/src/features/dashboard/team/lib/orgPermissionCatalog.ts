/**
 * Org hub permission catalog for PermissionsTreeView (UI hierarchy only).
 */

import { ORG_TEAM_PERMISSIONS } from '@/features/dashboard/team/lib/orgTeamConstants';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import type {
  PermissionAction,
  PermissionCatalogNode,
} from '@/features/dashboard/team/lib/propertyPermissionCatalog';

export type OrgPermissionCatalog = readonly PermissionCatalogNode[];

const MODULE_ORDER = [
  'dashboard',
  'bookings',
  'properties',
  'parkings',
  'settings',
  'plans',
  'analytics',
  'activity',
  'team',
] as const;

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  bookings: 'Bookings',
  properties: 'Properties',
  parkings: 'Parkings',
  settings: 'Settings',
  plans: 'Plans & Billing',
  analytics: 'Analytics',
  activity: 'Activity',
  team: 'Team',
};

const SENSITIVE_ORG_PERMISSION_IDS = new Set([
  'org.team.members:edit',
  'org.team.members:delete',
  'org.team.roles:add',
  'org.team.roles:edit',
  'org.team.roles:delete',
]);

/** Org leaves whose action is plan-gated (mirrors property `COARSE_PLAN_FEATURES`). */
const ORG_PLAN_FEATURES: Partial<Record<string, PlanFeatureKey>> = {
  'org.analytics:export': 'analyticsInsights',
  'org.settings.aiAssistant:edit': 'aiDashboardAssistant',
};

const ORG_CHIP_LABELS: Record<string, string> = {
  'org.dashboard:view': 'Open page',
  'org.bookings:view': 'Open page',
  'org.properties:view': 'Open page',
  'org.properties:create': 'Add',
  'org.properties:manage': 'Manage',
  'org.parkings:view': 'Open page',
  'org.parkings:create': 'Add',
  'org.parkings:manage': 'Manage',
  'org.settings:view': 'Open page',
  'org.plans:view': 'Open page',
  'org.analytics:view': 'Open page',
  'org.analytics:export': 'Export',
  'org.activity:view': 'Open page',
  'org.team:view': 'Open page',
  'org.team.invitations:add': 'Invite',
  'org.team.invitations:edit': 'Resend',
  'org.team.invitations:delete': 'Cancel',
  'org.team.members:edit': 'Edit',
  'org.team.members:delete': 'Remove',
  'org.team.roles:add': 'Add',
  'org.team.roles:edit': 'Edit',
  'org.team.roles:delete': 'Delete',
};

function actionFromPermissionId(id: string): PermissionAction {
  const action = id.includes(':') ? id.split(':').pop()! : 'edit';
  if (action === 'view') return 'view';
  if (action === 'add') return 'add';
  if (action === 'delete') return 'delete';
  return 'edit';
}

function moduleFromPermissionId(id: string): string {
  const withoutOrg = id.startsWith('org.') ? id.slice(4) : id;
  const beforeColon = withoutOrg.split(':')[0] ?? withoutOrg;
  const segment = beforeColon.split('.')[0] ?? beforeColon;
  return segment;
}

function chipLabelFromOrgPermission(name: string, id: string): string {
  const exact = ORG_CHIP_LABELS[id];
  if (exact) return exact;
  if (id.startsWith('org.settings.') && id.endsWith(':edit')) {
    return name.replace(/^Edit\s+/i, '').trim() || name;
  }
  return name.replace(/^(View|Edit|Manage|Add)\s+/i, '').trim() || name;
}

function parentKeyForPermission(id: string): string {
  if (id.startsWith('org.settings.')) return 'settings.sections';
  if (id.startsWith('org.team.invitations')) return 'team.invitations';
  if (id.startsWith('org.team.members')) return 'team.members';
  if (id.startsWith('org.team.roles')) return 'team.roles';
  if (/^org\.\w+:view$/.test(id)) return moduleFromPermissionId(id);
  if (id === 'org.properties:create' || id === 'org.properties:manage') return 'properties';
  if (id === 'org.parkings:create' || id === 'org.parkings:manage') return 'parkings';
  if (id === 'org.team:view') return 'team';
  return moduleFromPermissionId(id);
}

function buildOrgCatalog(): PermissionCatalogNode[] {
  const nodes: PermissionCatalogNode[] = [];

  MODULE_ORDER.forEach((module, moduleIndex) => {
    nodes.push({
      id: null,
      key: module,
      parentKey: null,
      module,
      label: MODULE_LABELS[module] ?? module,
      order: moduleIndex,
    });
  });

  nodes.push(
    {
      id: null,
      key: 'settings.sections',
      parentKey: 'settings',
      module: 'settings',
      label: 'Edit',
      order: 0,
    },
    {
      id: null,
      key: 'team.invitations',
      parentKey: 'team',
      module: 'team',
      label: 'Invitations',
      order: 0,
    },
    {
      id: null,
      key: 'team.members',
      parentKey: 'team',
      module: 'team',
      label: 'Members',
      order: 1,
    },
    {
      id: null,
      key: 'team.roles',
      parentKey: 'team',
      module: 'team',
      label: 'Roles',
      order: 2,
    }
  );

  ORG_TEAM_PERMISSIONS.forEach((permission, index) => {
    const module = moduleFromPermissionId(permission.id);
    nodes.push({
      id: permission.id,
      key: permission.id.replace(/:/g, '.'),
      parentKey: parentKeyForPermission(permission.id),
      module,
      label: chipLabelFromOrgPermission(permission.name, permission.id),
      description: permission.description,
      action: actionFromPermissionId(permission.id),
      order: index,
      sensitive: SENSITIVE_ORG_PERMISSION_IDS.has(permission.id),
      planFeatureKey: ORG_PLAN_FEATURES[permission.id],
    });
  });

  return nodes;
}

export const ORG_PERMISSION_CATALOG: OrgPermissionCatalog = buildOrgCatalog();
