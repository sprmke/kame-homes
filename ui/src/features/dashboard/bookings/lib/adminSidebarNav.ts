import type { ComponentType } from 'react';

import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Car,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Settings,
  Star,
  Tags,
  Users,
  Wrench,
} from 'lucide-react';

import {
  orgBookingsPath,
  orgDashboardPath,
  orgParkingsPath,
  orgPlansPath,
  orgPropertiesPath,
  orgSettingsPath,
  orgTeamPath,
  parkingSectionPath,
  propertySectionPath,
} from '@/features/dashboard/org/lib/tenantPaths';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import { SUPER_ADMIN_NAV_GROUPS } from '@/features/dashboard/super-admin/lib/superAdminPlatformNav';
import type { OrgPermissionId } from '@/features/dashboard/team/lib/orgPermissions';
import {
  hasOrgPermission,
  ORG_NAV_VIEW_PERMISSION,
  orgSectionPath,
} from '@/features/dashboard/team/lib/orgPermissions';
import {
  hasParkingPermission,
  PARKING_NAV_VIEW_PERMISSION,
} from '@/features/dashboard/team/lib/parkingPermissions';
import {
  hasPropertyPermission,
  PROPERTY_NAV_VIEW_PERMISSION,
} from '@/features/dashboard/team/lib/propertyPermissions';

export type SidebarNavItem = {
  label: string;
  href?: string;
  Icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
};

export type SidebarNavSection = {
  label: string;
  items: SidebarNavItem[];
  /** Suppress the section heading even when multiple sections are shown. */
  hideLabel?: boolean;
};

/** Organization context — mirrors property-management-app org nav. */
export function buildOrgNavSections(
  orgSlug: string,
  options?: { showProperties?: boolean; showParkings?: boolean }
): SidebarNavSection[] {
  const showProperties = options?.showProperties !== false;
  const showParkings = options?.showParkings !== false;

  const items: SidebarNavItem[] = [
    {
      label: 'Dashboard',
      href: orgDashboardPath(orgSlug),
      Icon: LayoutDashboard,
    },
    {
      label: 'Bookings',
      href: orgBookingsPath(orgSlug),
      Icon: BookOpen,
    },
    {
      label: 'Reviews',
      href: orgSectionPath(orgSlug, 'reviews'),
      Icon: Star,
    },
  ];

  if (showProperties) {
    items.push({
      label: 'Properties',
      href: orgPropertiesPath(orgSlug),
      Icon: Building2,
    });
  }

  if (showParkings) {
    items.push({
      label: 'Parkings',
      href: orgParkingsPath(orgSlug),
      Icon: Car,
    });
  }

  items.push(
    {
      label: 'Analytics',
      href: orgSectionPath(orgSlug, 'analytics'),
      Icon: BarChart3,
    },
    {
      label: 'Team',
      href: orgTeamPath(orgSlug),
      Icon: Users,
    },
    {
      label: 'Plans & Billing',
      href: orgPlansPath(orgSlug),
      Icon: CreditCard,
    },
    {
      label: 'Announcements',
      href: orgSectionPath(orgSlug, 'announcements'),
      Icon: Megaphone,
    },
    {
      label: 'Settings',
      href: orgSettingsPath(orgSlug),
      Icon: Settings,
    },
    { label: 'Help & Support', href: orgSectionPath(orgSlug, 'help-support'), Icon: HelpCircle }
  );

  return [{ label: 'Org', items }];
}

/** Property context — guest-form operational sections. */
export function buildPropertyNavSections(
  orgSlug: string,
  propertySlug: string
): SidebarNavSection[] {
  return [
    {
      label: 'Property',
      items: [
        {
          label: 'Dashboard',
          href: propertySectionPath(orgSlug, propertySlug, 'dashboard'),
          Icon: LayoutDashboard,
        },
        {
          label: 'Bookings',
          href: propertySectionPath(orgSlug, propertySlug, 'bookings'),
          Icon: BookOpen,
        },
        {
          label: 'Finance',
          href: propertySectionPath(orgSlug, propertySlug, 'finance'),
          Icon: DollarSign,
        },
        {
          label: 'Maintenance',
          href: propertySectionPath(orgSlug, propertySlug, 'maintenance'),
          Icon: Wrench,
        },
        {
          label: 'Pricing',
          href: propertySectionPath(orgSlug, propertySlug, 'pricing'),
          Icon: Tags,
        },
        {
          label: 'Analytics',
          href: propertySectionPath(orgSlug, propertySlug, 'analytics'),
          Icon: BarChart3,
        },
        {
          label: 'Team',
          href: propertySectionPath(orgSlug, propertySlug, 'team'),
          Icon: Users,
        },
        {
          label: 'Marketing',
          href: propertySectionPath(orgSlug, propertySlug, 'marketing'),
          Icon: Megaphone,
        },
        {
          label: 'Inbox',
          href: propertySectionPath(orgSlug, propertySlug, 'inbox'),
          Icon: Inbox,
        },
        {
          label: 'Reviews',
          href: propertySectionPath(orgSlug, propertySlug, 'reviews'),
          Icon: Star,
        },
        {
          label: 'Notifications',
          href: propertySectionPath(orgSlug, propertySlug, 'notifications'),
          Icon: Bell,
        },
        {
          label: 'Templates',
          href: propertySectionPath(orgSlug, propertySlug, 'templates'),
          Icon: FileText,
        },
        {
          label: 'Public Pages',
          href: propertySectionPath(orgSlug, propertySlug, 'public-pages'),
          Icon: Globe,
        },
        {
          label: 'Settings',
          href: propertySectionPath(orgSlug, propertySlug, 'settings'),
          Icon: Settings,
        },
        {
          label: 'Help & Support',
          href: propertySectionPath(orgSlug, propertySlug, 'help-support'),
          Icon: HelpCircle,
        },
      ],
    },
  ];
}

/** Parking context — operational sections for a parking slot. */
export function buildParkingNavSections(orgSlug: string, parkingSlug: string): SidebarNavSection[] {
  return [
    {
      label: 'Parking',
      items: [
        {
          label: 'Dashboard',
          href: parkingSectionPath(orgSlug, parkingSlug, 'dashboard'),
          Icon: LayoutDashboard,
        },
        {
          label: 'Bookings',
          href: parkingSectionPath(orgSlug, parkingSlug, 'bookings'),
          Icon: BookOpen,
        },
        {
          label: 'Finance',
          href: parkingSectionPath(orgSlug, parkingSlug, 'finance'),
          Icon: DollarSign,
        },
        {
          label: 'Pricing',
          href: parkingSectionPath(orgSlug, parkingSlug, 'pricing'),
          Icon: Tags,
        },
        {
          label: 'Team',
          href: parkingSectionPath(orgSlug, parkingSlug, 'team'),
          Icon: Users,
        },
        {
          label: 'Inbox',
          href: parkingSectionPath(orgSlug, parkingSlug, 'inbox'),
          Icon: Inbox,
        },
        {
          label: 'Notifications',
          href: parkingSectionPath(orgSlug, parkingSlug, 'notifications'),
          Icon: Bell,
        },
        {
          label: 'Settings',
          href: parkingSectionPath(orgSlug, parkingSlug, 'settings'),
          Icon: Settings,
        },
        {
          label: 'Help & Support',
          href: parkingSectionPath(orgSlug, parkingSlug, 'help-support'),
          Icon: HelpCircle,
        },
      ],
    },
  ];
}

/** Hide org nav items the current user cannot view. */
export function filterOrgNavSections(
  sections: SidebarNavSection[],
  permissions: readonly string[] | undefined
): SidebarNavSection[] {
  const granted = permissions ?? [];

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.disabled || !item.href) return true;
        const required = ORG_NAV_VIEW_PERMISSION[item.label];
        if (!required) return true;
        return hasOrgPermission(granted, required);
      }),
    }))
    .filter((section) => section.items.some((item) => item.href || item.disabled));
}

/** Hide property nav items the current user cannot view. */
export function filterPropertyNavSections(
  sections: SidebarNavSection[],
  permissions: readonly string[] | undefined
): SidebarNavSection[] {
  const granted = permissions ?? [];

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.disabled || !item.href) return true;
        if (item.label === 'Pricing') {
          return hasPropertyPermission(granted, 'pricing:view');
        }
        const required = PROPERTY_NAV_VIEW_PERMISSION[item.label];
        if (!required) return true;
        return hasPropertyPermission(granted, required);
      }),
    }))
    .filter((section) => section.items.some((item) => item.href || item.disabled));
}

const LEGACY_PARKING_NAV_VIEW_PERMISSION: Record<string, OrgPermissionId> = {
  Dashboard: 'org:parkings:view',
  Bookings: 'org:parkings:view',
  Finance: 'org:parkings:view',
  Pricing: 'org:parkings:view',
  Notifications: 'org:parkings:view',
  Settings: 'org:parkings:manage',
};

/** Hide parking nav items using parking-scoped team permissions. */
export function filterParkingNavSections(
  sections: SidebarNavSection[],
  permissions: readonly string[] | undefined
): SidebarNavSection[] {
  const granted = permissions ?? [];

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.disabled || !item.href) return true;
        const parkingRequired = PARKING_NAV_VIEW_PERMISSION[item.label];
        if (parkingRequired) {
          return hasParkingPermission(granted, parkingRequired);
        }
        const orgRequired = LEGACY_PARKING_NAV_VIEW_PERMISSION[item.label];
        if (!orgRequired) return true;
        return hasOrgPermission(granted, orgRequired);
      }),
    }))
    .filter((section) => section.items.some((item) => item.href || item.disabled));
}

export const LEGACY_NAV_SECTIONS: SidebarNavSection[] = [
  {
    label: 'Legacy',
    items: [
      { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
      { label: 'Bookings', href: '/bookings', Icon: BookOpen },
      { label: 'Finance', href: '/finance', Icon: DollarSign },
      { label: 'Maintenance', href: '/maintenance', Icon: Wrench },
      { label: 'Notifications', href: '/notifications', Icon: Bell },
      { label: 'Settings', href: '/settings', Icon: Settings },
    ],
  },
];

/**
 * Super-admin platform nav. The organization hub (`/admin/orgs/:orgSlug`) is a single
 * scrollable page with its own in-page section nav (`AdminSectionNavLayout`) — it does not
 * add items to this global sidebar.
 */
export function buildSuperAdminNavSections(): SidebarNavSection[] {
  return [
    {
      label: 'Overview',
      hideLabel: true,
      items: [{ label: 'Overview', href: superAdminPaths.root, Icon: LayoutDashboard }],
    },
    ...SUPER_ADMIN_NAV_GROUPS.map((group) => ({
      label: group.label,
      items: group.items.map((item) => ({ ...item })),
    })),
  ];
}

export function isSuperAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function isPropertyAdminPath(pathname: string): boolean {
  return /\/org\/[^/]+\/property\/[^/]+/.test(pathname);
}

export function isParkingAdminPath(pathname: string): boolean {
  return /\/org\/[^/]+\/parking\/[^/]+/.test(pathname);
}

export function isOrgAdminPath(pathname: string): boolean {
  return (
    /\/org\/[^/]+/.test(pathname) && !isPropertyAdminPath(pathname) && !isParkingAdminPath(pathname)
  );
}
