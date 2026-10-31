export type ParkingAccessPayload = {
  accessKind: string;
  permissions: string[];
  memberId: string | null;
  parkingId: string;
  orgSlug: string;
  parkingSlug: string;
  parkingName: string;
};

export type ParkingSection =
  | 'dashboard'
  | 'bookings'
  | 'finance'
  | 'pricing'
  | 'notifications'
  | 'team'
  | 'settings'
  | 'inbox'
  | 'activity'
  | 'announcements'
  | 'help-support';

export type ParkingPermissionId =
  | 'bookings:view'
  | 'bookings:edit'
  | 'finance:view'
  | 'finance:edit'
  | 'pricing:view'
  | 'pricing:edit'
  | 'notifications:view'
  | 'notifications:edit'
  | 'settings:view'
  | 'settings:edit'
  | 'team:view'
  | 'team:invite'
  | 'team:manage'
  | 'inbox:view'
  | 'inbox:reply'
  | 'inbox:manage'
  | 'activity:view';

export function hasParkingPermission(
  permissions: readonly string[] | undefined,
  required: ParkingPermissionId
): boolean {
  if (!permissions?.length) return false;
  return permissions.includes(required);
}

/** Minimum view permission per parking sidebar nav label. */
export const PARKING_NAV_VIEW_PERMISSION: Record<string, ParkingPermissionId> = {
  Dashboard: 'bookings:view',
  Bookings: 'bookings:view',
  Finance: 'finance:view',
  Pricing: 'pricing:view',
  Notifications: 'notifications:view',
  Team: 'team:view',
  Settings: 'settings:view',
  Inbox: 'inbox:view',
  Activity: 'activity:view',
  Announcements: 'bookings:view',
};

/** Minimum view permission per parking route section. */
export const PARKING_SECTION_VIEW_PERMISSION = {
  dashboard: 'bookings:view',
  bookings: 'bookings:view',
  finance: 'finance:view',
  pricing: 'pricing:view',
  notifications: 'notifications:view',
  team: 'team:view',
  settings: 'settings:view',
  inbox: 'inbox:view',
  activity: 'activity:view',
  announcements: 'bookings:view',
  'help-support': 'bookings:view',
} as const satisfies Record<ParkingSection, ParkingPermissionId>;
