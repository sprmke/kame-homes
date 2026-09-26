import type { ComponentType } from 'react';

import {
  Activity,
  BadgeCheck,
  BookOpen,
  Building,
  Building2,
  CreditCard,
  Gauge,
  HelpCircle,
  Landmark,
  LifeBuoy,
  Megaphone,
  Receipt,
  ScrollText,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';

import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

export type SuperAdminPlatformNavItem = {
  label: string;
  href: string;
  Icon: ComponentType<{ className?: string }>;
};

export type SuperAdminPlatformNavGroup = {
  label: string;
  items: SuperAdminPlatformNavItem[];
};

/**
 * Grouped Super Admin destinations. Single source for both the Platform
 * sidebar (rendered as labelled sections, below Overview) and the Overview
 * quick-links grid, so the two surfaces cannot drift.
 */
export const SUPER_ADMIN_NAV_GROUPS: SuperAdminPlatformNavGroup[] = [
  {
    label: 'Organizations',
    items: [
      { label: 'Organizations', href: superAdminPaths.organizations, Icon: Building2 },
      { label: 'Hosts', href: superAdminPaths.hosts, Icon: Users },
      { label: 'Developments', href: superAdminPaths.developments, Icon: Landmark },
      { label: 'Properties', href: superAdminPaths.properties, Icon: Building },
    ],
  },
  {
    label: 'Billing & catalog',
    items: [
      { label: 'Pricing plans', href: superAdminPaths.pricingPlans, Icon: CreditCard },
      { label: 'Subscriptions', href: superAdminPaths.propertySubscriptions, Icon: Receipt },
      { label: 'Payment settings', href: superAdminPaths.pricingPaymentSettings, Icon: Wallet },
      { label: 'Parking payouts', href: superAdminPaths.parkingPayouts, Icon: Wallet },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Approvals', href: superAdminPaths.approvals, Icon: BadgeCheck },
      { label: 'Support tickets', href: superAdminPaths.support, Icon: LifeBuoy },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'Announcements', href: superAdminPaths.announcements, Icon: Megaphone },
      { label: 'FAQs', href: superAdminPaths.supportFaqs, Icon: HelpCircle },
      { label: 'Playbook articles', href: superAdminPaths.playbookArticles, Icon: BookOpen },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'AI Management', href: superAdminPaths.settings, Icon: Sparkles },
      { label: 'AI usage', href: superAdminPaths.aiUsage, Icon: Activity },
      { label: 'Rate limits', href: superAdminPaths.rateLimits, Icon: Gauge },
      { label: 'Audit log', href: superAdminPaths.audit, Icon: ScrollText },
      { label: 'Platform settings', href: superAdminPaths.platformSettings, Icon: Settings },
    ],
  },
];

/** Flat list of every non-Overview destination (Overview grid, search, etc.). */
export const SUPER_ADMIN_PLATFORM_DESTINATIONS: SuperAdminPlatformNavItem[] =
  SUPER_ADMIN_NAV_GROUPS.flatMap((group) => group.items);
