import {
  BarChart3,
  BookOpen,
  Building2,
  CreditCard,
  Crown,
  History,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';

import type { TeamPermission } from '@/features/dashboard/team/types/propertyTeam';

export const ORG_ROLES = [
  {
    value: 'OWNER' as const,
    label: 'Owner',
    description: 'Full organization access, including settings, billing, and deletion.',
    color: 'bg-amber-500',
    icon: Crown,
  },
  {
    value: 'ADMIN' as const,
    label: 'Full Access',
    description: 'Org hub permissions and listing access assigned on invite.',
    color: 'bg-purple-500',
    icon: Users,
  },
] as const;

export type BuiltinOrgRole = (typeof ORG_ROLES)[number]['value'];

/** Granular org hub permission ids — keep in sync with supabase/functions/_shared/orgTeamPermissions.ts */
export const ORG_TEAM_PERMISSIONS: TeamPermission[] = [
  {
    id: 'org.dashboard:view',
    name: 'View Dashboard',
    description: 'Access organization dashboard',
    category: 'Organization',
    icon: LayoutDashboard,
  },
  {
    id: 'org.bookings:view',
    name: 'View Bookings',
    description: 'View bookings across assigned listings',
    category: 'Organization',
    icon: BookOpen,
  },
  {
    id: 'org.properties:view',
    name: 'View Properties',
    description: 'View organization property list',
    category: 'Organization',
    icon: Building2,
  },
  {
    id: 'org.properties:create',
    name: 'Add Properties',
    description: 'Create new properties',
    category: 'Organization',
    icon: Building2,
  },
  {
    id: 'org.properties:manage',
    name: 'Manage Properties',
    description: 'Edit properties from org inventory',
    category: 'Organization',
    icon: Building2,
  },
  {
    id: 'org.parkings:view',
    name: 'View Parkings',
    description: 'View organization parking list',
    category: 'Organization',
    icon: Building2,
  },
  {
    id: 'org.parkings:create',
    name: 'Add Parkings',
    description: 'Create new parking slots',
    category: 'Organization',
    icon: Building2,
  },
  {
    id: 'org.parkings:manage',
    name: 'Manage Parkings',
    description: 'Edit parkings from org inventory',
    category: 'Organization',
    icon: Building2,
  },
  {
    id: 'org.settings:view',
    name: 'View Org Settings',
    description: 'View organization profile and branding',
    category: 'Settings',
    icon: Settings,
  },
  {
    id: 'org.settings.basic:edit',
    name: 'Edit Basic Info',
    description: 'Organization name, logo, and profile',
    category: 'Settings',
    icon: Settings,
  },
  {
    id: 'org.settings.socials:edit',
    name: 'Edit Socials',
    description: 'Social links and public branding',
    category: 'Settings',
    icon: Settings,
  },
  {
    id: 'org.settings.aiPlatform:edit',
    name: 'Toggle AI',
    description: 'Turn AI on or off for the organization',
    category: 'Settings',
    icon: Settings,
  },
  {
    id: 'org.settings.aiAssistant:edit',
    name: 'Edit AI Assistant',
    description: 'Assistant on or off and property opt-outs',
    category: 'Settings',
    icon: Settings,
  },
  {
    id: 'org.plans:view',
    name: 'View Plans',
    description: 'View plans and billing history',
    category: 'Plans',
    icon: CreditCard,
  },
  {
    id: 'org.analytics:view',
    name: 'View Portfolio Analytics',
    description: 'View the org-wide analytics rollup across properties and parkings',
    category: 'Analytics',
    icon: BarChart3,
  },
  {
    id: 'org.analytics:export',
    name: 'Export Portfolio Analytics',
    description: 'Download the listings comparison as CSV',
    category: 'Analytics',
    icon: BarChart3,
  },
  {
    id: 'org.activity:view',
    name: 'View Activity',
    description: 'View the organization activity and audit log',
    category: 'Activity',
    icon: History,
  },
  {
    id: 'org.team:view',
    name: 'View Team',
    description: 'View organization team',
    category: 'Team',
    icon: Users,
  },
  {
    id: 'org.team.invitations:add',
    name: 'Invite Members',
    description: 'Send organization invitations',
    category: 'Team',
    icon: Users,
  },
  {
    id: 'org.team.invitations:edit',
    name: 'Resend Invitations',
    description: 'Resend pending invitations',
    category: 'Team',
    icon: Users,
  },
  {
    id: 'org.team.invitations:delete',
    name: 'Cancel Invitations',
    description: 'Cancel pending invitations',
    category: 'Team',
    icon: Users,
  },
  {
    id: 'org.team.members:edit',
    name: 'Edit Members',
    description: 'Edit member permissions and listings',
    category: 'Team',
    icon: Users,
  },
  {
    id: 'org.team.members:delete',
    name: 'Remove Members',
    description: 'Deactivate or remove members',
    category: 'Team',
    icon: Users,
  },
  {
    id: 'org.team.roles:add',
    name: 'Add Roles',
    description: 'Create org permission templates',
    category: 'Team',
    icon: Users,
  },
  {
    id: 'org.team.roles:edit',
    name: 'Edit Roles',
    description: 'Edit org permission templates',
    category: 'Team',
    icon: Users,
  },
  {
    id: 'org.team.roles:delete',
    name: 'Delete Roles',
    description: 'Delete unused org templates',
    category: 'Team',
    icon: Users,
  },
];

/** Default granular presets per built-in org role. */
export const ORG_ROLE_PERMISSIONS: Record<BuiltinOrgRole, string[]> = {
  OWNER: ORG_TEAM_PERMISSIONS.map((p) => p.id),
  ADMIN: [
    'org.dashboard:view',
    'org.bookings:view',
    'org.properties:view',
    'org.properties:manage',
    'org.parkings:view',
    'org.parkings:manage',
    'org.analytics:view',
    'org.analytics:export',
    'org.activity:view',
    'org.team:view',
    'org.team.invitations:add',
    'org.team.invitations:edit',
    'org.team.invitations:delete',
    'org.team.members:edit',
    'org.team.members:delete',
  ],
};

export const ORG_PERMISSION_CATEGORIES = [...new Set(ORG_TEAM_PERMISSIONS.map((p) => p.category))];

export function orgRoleConfig(role: BuiltinOrgRole) {
  return ORG_ROLES.find((r) => r.value === role);
}

export function getOrgRoleLabel(roleId: string): string {
  return ORG_ROLES.find((role) => role.value === roleId)?.label ?? roleId;
}

export function getOrgRoleColor(roleId: string): string {
  return ORG_ROLES.find((role) => role.value === roleId)?.color ?? 'bg-gray-500';
}
