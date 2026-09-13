/**
 * Property permission catalog metadata for the Phase 2+ tree UI.
 * Hierarchy is UI-only — server stores/checks leaf ids only.
 *
 * Phase 3–6: Bookings through Team/Notifications/Inbox use leaves.
 */

import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import { TEAM_PERMISSIONS } from '@/features/dashboard/team/lib/propertyTeamConstants';

export type PermissionAction = 'view' | 'add' | 'edit' | 'delete';

export type PermissionCatalogNode = {
  id: string | null;
  key: string;
  parentKey: string | null;
  module: string;
  label: string;
  description?: string;
  action?: PermissionAction;
  order: number;
  sensitive?: boolean;
  planFeatureKey?: PlanFeatureKey;
};

export type PermissionCatalog = readonly PermissionCatalogNode[];

const MODULE_ORDER = [
  'bookings',
  'finance',
  'pricing',
  'analytics',
  'maintenance',
  'marketing',
  'notifications',
  'templates',
  'publicPages',
  'settings',
  'team',
  'inbox',
] as const;

const CATEGORY_TO_MODULE: Record<string, string> = {
  Bookings: 'bookings',
  Finance: 'finance',
  Pricing: 'pricing',
  Analytics: 'analytics',
  Maintenance: 'maintenance',
  Marketing: 'marketing',
  Notifications: 'notifications',
  Templates: 'templates',
  'Public Pages': 'publicPages',
  Settings: 'settings',
  Team: 'team',
  Inbox: 'inbox',
};

const MODULE_LABELS: Record<string, string> = {
  bookings: 'Bookings',
  finance: 'Finance',
  pricing: 'Pricing',
  analytics: 'Analytics',
  maintenance: 'Maintenance',
  marketing: 'Marketing',
  notifications: 'Notifications',
  templates: 'Templates',
  publicPages: 'Public Pages',
  settings: 'Settings',
  team: 'Team',
  inbox: 'Inbox',
};

const COARSE_PLAN_FEATURES: Partial<Record<string, PlanFeatureKey>> = {
  'bookings.import:add': 'bookingImport',
  'finance.export:view': 'financeReporting',
  'maintenance.export:view': 'maintenanceReporting',
  'notifications.chat:edit': 'telegramNotifications',
  'notifications.marketing:edit': 'telegramNotifications',
  'notifications.staff:edit': 'telegramNotifications',
  'notifications.operations:edit': 'telegramNotifications',
  'notifications.finance:edit': 'telegramNotifications',
  'notifications.maintenance:edit': 'telegramNotifications',
  'inbox.channels:add': 'metaChatChannel',
  'inbox.channels:delete': 'metaChatChannel',
  'inbox.quickReplies:add': 'quickReplies',
  'inbox.quickReplies:edit': 'quickReplies',
  'inbox.automation:edit': 'aiChatAutoReply',
  'team.invitations:add': 'teamManagement',
  'team.customRoles:add': 'customRoles',
  'team.customRoles:edit': 'customRoles',
  'team.customRoles:delete': 'customRoles',
  'templates.custom:add': 'customTemplates',
  'templates.email:edit': 'customTemplates',
  'marketing:view': 'marketingStudio',
  'marketing.content:add': 'marketingStudio',
  'marketing.content:edit': 'marketingStudio',
  'marketing.templates:add': 'customTemplates',
  'marketing.templates:edit': 'customTemplates',
  'marketing.generate:add': 'aiMarketingGeneration',
  'marketing.generate.video:add': 'aiMarketingVideoGeneration',
  'marketing.publish:add': 'marketingPublishLimitPerGroup',
  'publicPages.property:edit': 'publicPagesAutosave',
  'publicPages.stayGuide:edit': 'publicPagesAutosave',
  'publicPages.showcase:edit': 'propertyShowcase',
  'pricing.channels:view': 'calendarSync',
  'pricing.channels:edit': 'calendarSync',
  'analytics:view': 'analyticsInsights',
  'analytics:export': 'analyticsInsights',
  'settings.voiceReceptionist:edit': 'aiReceptionist',
  'settings.aiOverrides:edit': 'aiMonthlyCreditAllowance',
};

const SENSITIVE_PERMISSION_IDS = new Set([
  'team.members:edit',
  'team.members:delete',
  'team.customRoles:add',
  'team.customRoles:edit',
  'team.customRoles:delete',
]);

function actionFromPermissionId(id: string): PermissionAction {
  const action = id.includes(':') ? id.split(':').pop()! : 'edit';
  if (action === 'view') return 'view';
  if (action === 'add') return 'add';
  if (action === 'delete') return 'delete';
  if (action === 'invite') return 'add';
  return 'edit';
}

function toSentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function chipLabelFromPermission(name: string, id: string): string {
  const exactLabels: Record<string, string> = {
    'bookings:view': 'Open page',
    'bookings.create:add': 'Create',
    'bookings.import:add': 'Import',
    'bookings.detail.stay:edit': 'Stay',
    'bookings.detail.guests:edit': 'Guests',
    'bookings.detail.parking:edit': 'Parking',
    'bookings.detail.pets:edit': 'Pets',
    'bookings.detail.pricing:edit': 'Pricing',
    'bookings.detail.workflow:edit': 'Workflow',
    'finance:view': 'Open page',
    'finance.transactions:add': 'Add',
    'finance.transactions:edit': 'Edit',
    'finance.transactions:delete': 'Delete',
    'finance.export:view': 'Export',
    'maintenance:view': 'Open page',
    'maintenance.reminders:add': 'Add',
    'maintenance.reminders:edit': 'Edit',
    'maintenance.reminders:delete': 'Delete',
    'maintenance.export:view': 'Export',
    'marketing:view': 'Open page',
    'marketing.content:add': 'Add',
    'marketing.content:edit': 'Edit',
    'marketing.templates:add': 'Add',
    'marketing.templates:edit': 'Edit',
    'marketing.templates:delete': 'Delete',
    'marketing.generate:add': 'Generate',
    'marketing.generate.video:add': 'Generate video',
    'marketing.publish:add': 'Publish',
    'pricing:view': 'Open page',
    'pricing.rates:edit': 'Rates',
    'pricing.blocks:add': 'Block',
    'pricing.blocks:delete': 'Unblock',
    'pricing.channels:view': 'View',
    'pricing.channels:edit': 'Manage',
    'templates:view': 'Open page',
    'templates.standard:edit': 'Standard',
    'templates.email:edit': 'Email',
    'templates.custom:add': 'Add',
    'templates.custom:edit': 'Edit',
    'templates.custom:delete': 'Delete',
    'publicPages:view': 'Open page',
    'publicPages.property:edit': 'Property page',
    'publicPages.stayGuide:edit': 'Stay guide',
    'publicPages.showcase:edit': 'Showcase',
    'settings:view': 'Open page',
    'settings.integrations:view': 'Integrations',
    'notifications:view': 'Open page',
    'notifications.chat:edit': 'Chat',
    'notifications.marketing:edit': 'Marketing',
    'notifications.staff:edit': 'Staff',
    'notifications.operations:edit': 'Operations',
    'notifications.finance:edit': 'Finance',
    'notifications.maintenance:edit': 'Maintenance',
    'team:view': 'Open page',
    'team.invitations:add': 'Invite',
    'team.invitations:edit': 'Resend',
    'team.invitations:delete': 'Cancel',
    'team.members:edit': 'Edit',
    'team.members:delete': 'Remove',
    'team.customRoles:add': 'Add',
    'team.customRoles:edit': 'Edit',
    'team.customRoles:delete': 'Delete',
    'inbox:view': 'Open page',
    'inbox.messages:edit': 'Reply',
    'inbox.channels:add': 'Connect',
    'inbox.channels:delete': 'Disconnect',
    'inbox.quickReplies:add': 'Add',
    'inbox.quickReplies:edit': 'Edit',
    'inbox.quickReplies:delete': 'Delete',
    'inbox.automation:edit': 'Automation',
  };

  const exact = exactLabels[id];
  if (exact) return exact;
  if (id.startsWith('settings.') && id.endsWith(':edit')) {
    return toSentenceCase(name.replace(/^Edit\s+/i, ''));
  }
  const suffix = id.split(':')[1] ?? '';
  const suffixLabels: Record<string, string> = {
    view: 'Open page',
    edit: 'Edit',
    invite: 'Invite',
    manage: 'Manage',
    reply: 'Reply',
  };
  if (suffixLabels[suffix]) return suffixLabels[suffix]!;
  return toSentenceCase(name.replace(/^(View|Edit|Run|Manage|Invite|Reply)\s+/i, '') || name);
}

function buildCatalog(): PermissionCatalogNode[] {
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
      key: 'notifications.modules',
      parentKey: 'notifications',
      module: 'notifications',
      label: 'Edit',
      order: 0,
    },
    {
      id: null,
      key: 'bookings.list',
      parentKey: 'bookings',
      module: 'bookings',
      label: 'Actions',
      order: 0,
    },
    {
      id: null,
      key: 'bookings.detail',
      parentKey: 'bookings',
      module: 'bookings',
      label: 'Detail',
      order: 1,
    },
    {
      id: null,
      key: 'finance.transactions',
      parentKey: 'finance',
      module: 'finance',
      label: 'Transactions',
      order: 0,
    },
    {
      id: null,
      key: 'maintenance.reminders',
      parentKey: 'maintenance',
      module: 'maintenance',
      label: 'Reminders',
      order: 0,
    },
    {
      id: null,
      key: 'marketing.content',
      parentKey: 'marketing',
      module: 'marketing',
      label: 'Content',
      order: 0,
    },
    {
      id: null,
      key: 'marketing.templates',
      parentKey: 'marketing',
      module: 'marketing',
      label: 'Templates',
      order: 1,
    },
    {
      id: null,
      key: 'marketing.generate',
      parentKey: 'marketing',
      module: 'marketing',
      label: 'Generate',
      order: 2,
    },
    {
      id: null,
      key: 'marketing.publish',
      parentKey: 'marketing',
      module: 'marketing',
      label: 'Publish',
      order: 3,
    },
    {
      id: null,
      key: 'pricing.calendar',
      parentKey: 'pricing',
      module: 'pricing',
      label: 'Calendar',
      order: 0,
    },
    {
      id: null,
      key: 'pricing.channels',
      parentKey: 'pricing',
      module: 'pricing',
      label: 'Channel sync',
      order: 1,
    },
    {
      id: null,
      key: 'templates.standard',
      parentKey: 'templates',
      module: 'templates',
      label: 'Standard',
      order: 0,
    },
    {
      id: null,
      key: 'templates.email',
      parentKey: 'templates',
      module: 'templates',
      label: 'Email',
      order: 1,
    },
    {
      id: null,
      key: 'templates.custom',
      parentKey: 'templates',
      module: 'templates',
      label: 'Custom',
      order: 2,
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
      key: 'team.customRoles',
      parentKey: 'team',
      module: 'team',
      label: 'Custom roles',
      order: 2,
    },
    {
      id: null,
      key: 'inbox.messages',
      parentKey: 'inbox',
      module: 'inbox',
      label: 'Messages',
      order: 0,
    },
    {
      id: null,
      key: 'inbox.channels',
      parentKey: 'inbox',
      module: 'inbox',
      label: 'Channels',
      order: 1,
    },
    {
      id: null,
      key: 'inbox.quickReplies',
      parentKey: 'inbox',
      module: 'inbox',
      label: 'Quick replies',
      order: 2,
    },
    {
      id: null,
      key: 'inbox.automation',
      parentKey: 'inbox',
      module: 'inbox',
      label: 'Automation',
      order: 3,
    }
  );

  const sectionParent: Record<string, string> = {
    'bookings:view': 'bookings',
    'bookings.create:add': 'bookings.list',
    'bookings.import:add': 'bookings.list',
    'bookings.detail.stay:edit': 'bookings.detail',
    'bookings.detail.guests:edit': 'bookings.detail',
    'bookings.detail.parking:edit': 'bookings.detail',
    'bookings.detail.pets:edit': 'bookings.detail',
    'bookings.detail.pricing:edit': 'bookings.detail',
    'bookings.detail.workflow:edit': 'bookings.detail',
    'finance:view': 'finance',
    'finance.transactions:add': 'finance.transactions',
    'finance.transactions:edit': 'finance.transactions',
    'finance.transactions:delete': 'finance.transactions',
    'finance.export:view': 'finance',
    'analytics:view': 'analytics',
    'analytics:export': 'analytics',
    'maintenance:view': 'maintenance',
    'maintenance.reminders:add': 'maintenance.reminders',
    'maintenance.reminders:edit': 'maintenance.reminders',
    'maintenance.reminders:delete': 'maintenance.reminders',
    'maintenance.export:view': 'maintenance',
    'marketing:view': 'marketing',
    'marketing.content:add': 'marketing.content',
    'marketing.content:edit': 'marketing.content',
    'marketing.templates:add': 'marketing.templates',
    'marketing.templates:edit': 'marketing.templates',
    'marketing.templates:delete': 'marketing.templates',
    'marketing.generate:add': 'marketing.generate',
    'marketing.generate.video:add': 'marketing.generate',
    'marketing.publish:add': 'marketing.publish',
    'pricing:view': 'pricing',
    'pricing.rates:edit': 'pricing.calendar',
    'pricing.blocks:add': 'pricing.calendar',
    'pricing.blocks:delete': 'pricing.calendar',
    'pricing.channels:view': 'pricing.channels',
    'pricing.channels:edit': 'pricing.channels',
    'templates:view': 'templates',
    'templates.standard:edit': 'templates.standard',
    'templates.email:edit': 'templates.email',
    'templates.custom:add': 'templates.custom',
    'templates.custom:edit': 'templates.custom',
    'templates.custom:delete': 'templates.custom',
    'publicPages:view': 'publicPages',
    'publicPages.property:edit': 'publicPages',
    'publicPages.stayGuide:edit': 'publicPages',
    'publicPages.showcase:edit': 'publicPages',
    'settings:view': 'settings',
    'settings.integrations:view': 'settings.sections',
    'settings.basicInfo:edit': 'settings.sections',
    'settings.media:edit': 'settings.sections',
    'settings.propertyDetails:edit': 'settings.sections',
    'settings.amenities:edit': 'settings.sections',
    'settings.houseRules:edit': 'settings.sections',
    'settings.guestForm:edit': 'settings.sections',
    'settings.cancellationPolicy:edit': 'settings.sections',
    'settings.location:edit': 'settings.sections',
    'settings.socials:edit': 'settings.sections',
    'settings.payment:edit': 'settings.sections',
    'settings.buildingForms:edit': 'settings.sections',
    'settings.emailAutomations:edit': 'settings.sections',
    'settings.voiceReceptionist:edit': 'settings.sections',
    'settings.aiOverrides:edit': 'settings.sections',
    'settings.dangerZone:edit': 'settings.sections',
    'notifications:view': 'notifications',
    'notifications.chat:edit': 'notifications.modules',
    'notifications.marketing:edit': 'notifications.modules',
    'notifications.staff:edit': 'notifications.modules',
    'notifications.operations:edit': 'notifications.modules',
    'notifications.finance:edit': 'notifications.modules',
    'notifications.maintenance:edit': 'notifications.modules',
    'team:view': 'team',
    'team.invitations:add': 'team.invitations',
    'team.invitations:edit': 'team.invitations',
    'team.invitations:delete': 'team.invitations',
    'team.members:edit': 'team.members',
    'team.members:delete': 'team.members',
    'team.customRoles:add': 'team.customRoles',
    'team.customRoles:edit': 'team.customRoles',
    'team.customRoles:delete': 'team.customRoles',
    'inbox:view': 'inbox',
    'inbox.messages:edit': 'inbox.messages',
    'inbox.channels:add': 'inbox.channels',
    'inbox.channels:delete': 'inbox.channels',
    'inbox.quickReplies:add': 'inbox.quickReplies',
    'inbox.quickReplies:edit': 'inbox.quickReplies',
    'inbox.quickReplies:delete': 'inbox.quickReplies',
    'inbox.automation:edit': 'inbox.automation',
  };

  const byModule = new Map<string, typeof TEAM_PERMISSIONS>();
  for (const permission of TEAM_PERMISSIONS) {
    const module = CATEGORY_TO_MODULE[permission.category] ?? permission.category.toLowerCase();
    const list = byModule.get(module) ?? [];
    list.push(permission);
    byModule.set(module, list);
  }

  for (const [module, permissions] of byModule) {
    permissions.forEach((permission, index) => {
      const parentKey = sectionParent[permission.id] ?? module;
      const leafKey = permission.id.replace(/:/g, '.');
      const isOpenPage = permission.id === `${module}:view`;
      nodes.push({
        id: permission.id,
        key: leafKey,
        parentKey,
        module,
        label: chipLabelFromPermission(permission.name, permission.id),
        description: isOpenPage
          ? 'See this area in the menu'
          : permission.id.endsWith('export:view')
            ? 'Download reports from this area'
            : permission.description,
        action: actionFromPermissionId(permission.id),
        order: index,
        sensitive: SENSITIVE_PERMISSION_IDS.has(permission.id),
        planFeatureKey: COARSE_PLAN_FEATURES[permission.id],
      });
    });
  }

  return nodes;
}

export const PROPERTY_PERMISSION_CATALOG: PermissionCatalog = buildCatalog();

export function getCatalogPageNodes(
  catalog: PermissionCatalog = PROPERTY_PERMISSION_CATALOG
): PermissionCatalogNode[] {
  return catalog
    .filter((node) => node.parentKey === null)
    .slice()
    .sort((a, b) => a.order - b.order);
}

export function getCatalogChildren(
  parentKey: string,
  catalog: PermissionCatalog = PROPERTY_PERMISSION_CATALOG
): PermissionCatalogNode[] {
  return catalog
    .filter((node) => node.parentKey === parentKey)
    .slice()
    .sort((a, b) => a.order - b.order);
}

export function getCatalogLeafIds(
  catalog: PermissionCatalog = PROPERTY_PERMISSION_CATALOG
): string[] {
  return catalog.filter((node) => node.id != null).map((node) => node.id as string);
}

export function getDescendantLeafIds(
  parentKey: string,
  catalog: PermissionCatalog = PROPERTY_PERMISSION_CATALOG
): string[] {
  const children = getCatalogChildren(parentKey, catalog);
  const ids: string[] = [];
  for (const child of children) {
    if (child.id) {
      ids.push(child.id);
    } else {
      ids.push(...getDescendantLeafIds(child.key, catalog));
    }
  }
  return ids;
}
