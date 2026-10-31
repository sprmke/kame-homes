import { Bell, Sparkles } from 'lucide-react';

import type {
  SidebarNavItem,
  SidebarNavSection,
} from '@/features/dashboard/bookings/lib/adminSidebarNav';

import type { BottomTabItem } from '@/components/mobile/BottomTabBar';
import { MORE_TAB_KEY, moreTabItem } from '@/components/mobile/BottomTabBar';

export const ASSISTANT_TAB_KEY = 'assistant';
export const NOTIFICATIONS_TAB_KEY = 'notifications';

const MAX_PRIMARY_ROUTE_TABS = 3;
const CORE_ROUTE_LABELS = ['Dashboard', 'Bookings', 'Inbox'] as const;

export type AdminBottomNavOverlays = {
  onMoreClick: () => void;
  assistant?: {
    onClick: () => void;
  };
  notifications?: {
    onClick: () => void;
    badge?: boolean | number;
  };
};

export function flattenNavigableNavItems(sections: SidebarNavSection[]): SidebarNavItem[] {
  return sections.flatMap((section) =>
    section.items.filter((item): item is SidebarNavItem & { href: string } =>
      Boolean(item.href && !item.disabled)
    )
  );
}

function pickPrimaryRouteTabs(navigable: SidebarNavItem[]): SidebarNavItem[] {
  const picked: SidebarNavItem[] = [];
  const used = new Set<string>();

  for (const label of CORE_ROUTE_LABELS) {
    const item = navigable.find((candidate) => candidate.label === label);
    if (item?.href && !used.has(item.href)) {
      picked.push(item);
      used.add(item.href);
    }
  }

  for (const item of navigable) {
    if (picked.length >= MAX_PRIMARY_ROUTE_TABS) break;
    if (!item.href || used.has(item.href)) continue;
    picked.push(item);
    used.add(item.href);
  }

  return picked;
}

/**
 * Split permission-filtered sidebar nav into primary bottom tabs + full list for the More sheet.
 * Route tabs prefer Dashboard / Bookings / Inbox, then fill from remaining nav.
 * Notifications then Assistant are overlay actions (not routes) when provided.
 */
export function splitAdminBottomNav(
  sections: SidebarNavSection[],
  overlays: AdminBottomNavOverlays
): { tabItems: BottomTabItem[]; moreItems: SidebarNavItem[]; primaryHrefs: string[] } {
  const navigable = flattenNavigableNavItems(sections);
  const primary = pickPrimaryRouteTabs(navigable);
  const moreItems = navigable;

  const tabItems: BottomTabItem[] = [
    ...primary.map((item) => ({
      key: item.href!,
      label: item.label,
      href: item.href,
      Icon: item.Icon,
    })),
  ];

  if (overlays.notifications) {
    tabItems.push({
      key: NOTIFICATIONS_TAB_KEY,
      label: 'Notifications',
      Icon: Bell,
      onClick: overlays.notifications.onClick,
      badge: overlays.notifications.badge,
    });
  }

  if (overlays.assistant) {
    tabItems.push({
      key: ASSISTANT_TAB_KEY,
      label: 'Assistant',
      Icon: Sparkles,
      onClick: overlays.assistant.onClick,
    });
  }

  tabItems.push(moreTabItem(overlays.onMoreClick));

  return {
    tabItems,
    moreItems,
    primaryHrefs: primary.map((item) => item.href!),
  };
}

export function resolveBottomTabActiveKey(
  activeNavHref: string | null,
  primaryHrefs: string[],
  moreOpen: boolean,
  overlayKey?: string | null
): string | null {
  if (moreOpen) return MORE_TAB_KEY;
  if (overlayKey) return overlayKey;
  if (activeNavHref && primaryHrefs.includes(activeNavHref)) return activeNavHref;
  if (activeNavHref) return MORE_TAB_KEY;
  return primaryHrefs[0] ?? null;
}
