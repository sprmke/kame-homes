import { Bell, BookOpen, DollarSign, History, Inbox, Settings, Tags, Users } from 'lucide-react';

import type { TeamPermission } from '@/features/dashboard/team/types/propertyTeam';

export const PARKING_ROLES = [
  {
    value: 'MANAGER' as const,
    label: 'Full Access',
    description: 'Full parking access',
    color: 'bg-red-500',
  },
  {
    value: 'STAFF' as const,
    label: 'Operations',
    description: 'Bookings, pricing, and notifications',
    color: 'bg-amber-500',
  },
  {
    value: 'VIEWER' as const,
    label: 'Read Only',
    description: 'Read-only access',
    color: 'bg-blue-500',
  },
];

export type ParkingBuiltinRole = (typeof PARKING_ROLES)[number]['value'];

export const PARKING_TEAM_PERMISSIONS: TeamPermission[] = [
  {
    id: 'bookings:view',
    name: 'View Bookings',
    description: 'View parking booking list and detail',
    category: 'Bookings',
    icon: BookOpen,
  },
  {
    id: 'bookings:edit',
    name: 'Edit Bookings',
    description: 'Edit parking booking records',
    category: 'Bookings',
    icon: BookOpen,
  },
  {
    id: 'finance:view',
    name: 'View Finance',
    description: 'View parking finance dashboard',
    category: 'Finance',
    icon: DollarSign,
  },
  {
    id: 'finance:edit',
    name: 'Edit Finance',
    description: 'Add or edit parking transactions',
    category: 'Finance',
    icon: DollarSign,
  },
  {
    id: 'pricing:view',
    name: 'View Pricing',
    description: 'View nightly rates and calendar overrides',
    category: 'Pricing',
    icon: Tags,
  },
  {
    id: 'pricing:edit',
    name: 'Edit Pricing',
    description: 'Change rates and calendar prices',
    category: 'Pricing',
    icon: Tags,
  },
  {
    id: 'notifications:view',
    name: 'View Notifications',
    description: 'View Telegram parking settings',
    category: 'Notifications',
    icon: Bell,
  },
  {
    id: 'notifications:edit',
    name: 'Edit Notifications',
    description: 'Change Telegram bots and templates',
    category: 'Notifications',
    icon: Bell,
  },
  {
    id: 'settings:view',
    name: 'View Settings',
    description: 'View parking slot settings',
    category: 'Settings',
    icon: Settings,
  },
  {
    id: 'settings:edit',
    name: 'Edit Settings',
    description: 'Change parking configuration',
    category: 'Settings',
    icon: Settings,
  },
  {
    id: 'team:view',
    name: 'View Team',
    description: 'View team members',
    category: 'Team',
    icon: Users,
  },
  {
    id: 'team:invite',
    name: 'Invite Members',
    description: 'Send parking invitations',
    category: 'Team',
    icon: Users,
  },
  {
    id: 'team:manage',
    name: 'Manage Members',
    description: 'Edit roles and remove members',
    category: 'Team',
    icon: Users,
  },
  {
    id: 'inbox:view',
    name: 'View Inbox',
    description: 'View guest inbox threads',
    category: 'Inbox',
    icon: Inbox,
  },
  {
    id: 'inbox:reply',
    name: 'Reply Inbox',
    description: 'Send replies and AI suggest',
    category: 'Inbox',
    icon: Inbox,
  },
  {
    id: 'inbox:manage',
    name: 'Manage Inbox',
    description: 'Connect or disconnect Meta channels',
    category: 'Inbox',
    icon: Inbox,
  },
  {
    id: 'activity:view',
    name: 'View Activity',
    description: 'View the activity and audit log for this parking slot',
    category: 'Activity',
    icon: History,
  },
];

export const PARKING_ROLE_PERMISSIONS: Record<ParkingBuiltinRole, string[]> = {
  MANAGER: PARKING_TEAM_PERMISSIONS.map((permission) => permission.id),
  STAFF: [
    'bookings:view',
    'bookings:edit',
    'notifications:view',
    'pricing:view',
    'inbox:view',
    'inbox:reply',
    'activity:view',
  ],
  VIEWER: [
    'bookings:view',
    'notifications:view',
    'pricing:view',
    'team:view',
    'inbox:view',
    'activity:view',
  ],
};

export const PARKING_PERMISSION_CATEGORIES = [
  ...new Set(PARKING_TEAM_PERMISSIONS.map((p) => p.category)),
];

export const PARKING_FILTER_ROLES = PARKING_ROLES.map((role) => ({
  value: role.value,
  label: role.label,
}));

export function parkingRoleConfig(role: ParkingBuiltinRole) {
  return PARKING_ROLES.find((r) => r.value === role);
}
