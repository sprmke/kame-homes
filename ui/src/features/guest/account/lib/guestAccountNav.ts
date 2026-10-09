import { Gift, Heart, Luggage, MessageSquare, Ticket, User, type LucideIcon } from 'lucide-react';

import {
  GUEST_ACCOUNT_FAVORITES_PATH,
  GUEST_ACCOUNT_PROFILE_PATH,
  GUEST_ACCOUNT_STAYS_PATH,
  GUEST_ACCOUNT_TICKETS_PATH,
  GUEST_ACCOUNT_TRIPS_PATH,
  GUEST_ACCOUNT_VOUCHERS_PATH,
} from '@/features/guest/account/lib/guestAccountPaths';

export type GuestAccountNavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  description?: string;
};

export const GUEST_ACCOUNT_NAV_ITEMS: GuestAccountNavItem[] = [
  {
    href: GUEST_ACCOUNT_PROFILE_PATH,
    label: 'Profile',
    Icon: User,
  },
  {
    href: GUEST_ACCOUNT_TRIPS_PATH,
    label: 'Trips',
    Icon: Luggage,
  },
  {
    href: GUEST_ACCOUNT_STAYS_PATH,
    label: 'Stays',
    Icon: MessageSquare,
  },
  {
    href: GUEST_ACCOUNT_VOUCHERS_PATH,
    label: 'Vouchers',
    Icon: Gift,
  },
  {
    href: GUEST_ACCOUNT_FAVORITES_PATH,
    label: 'Favorites',
    Icon: Heart,
  },
  {
    href: GUEST_ACCOUNT_TICKETS_PATH,
    label: 'Tickets',
    Icon: Ticket,
  },
];

export function resolveGuestAccountNavItem(pathname: string): GuestAccountNavItem {
  const hrefs = GUEST_ACCOUNT_NAV_ITEMS.map((item) => item.href);
  const activeHref =
    hrefs
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? GUEST_ACCOUNT_PROFILE_PATH;

  return (
    GUEST_ACCOUNT_NAV_ITEMS.find((item) => item.href === activeHref) ?? GUEST_ACCOUNT_NAV_ITEMS[0]!
  );
}
