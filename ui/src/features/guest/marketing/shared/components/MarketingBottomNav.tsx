import { useMemo, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { Building2, Car, Compass, User } from 'lucide-react';

import { GUEST_ACCOUNT_PROFILE_PATH } from '@/features/guest/account/lib/guestAccountPaths';
import {
  getHostMarketingNavCta,
  getGuestLoginCta,
} from '@/features/guest/auth/config/auth-navigation';
import { getAppModeFromPath } from '@/features/guest/auth/config/mode-switch';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';
import { MarketingMoreSheet } from '@/features/guest/marketing/shared/components/MarketingMoreSheet';
import { useModeSwitchTransition } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';

import { BottomTabBar, moreTabItem, type BottomTabItem } from '@/components/mobile/BottomTabBar';

function resolveActiveKey(pathname: string): string | null {
  if (pathname === '/') return 'explore';
  if (pathname.startsWith('/properties')) return 'properties';
  if (pathname.startsWith('/parkings') || pathname.startsWith('/developments')) return 'parkings';
  if (pathname.startsWith('/account')) return 'account';
  return null;
}

/**
 * Persistent phone/tablet nav for every marketing + guest-account page
 * (`MarketingLayoutShell`'s `Outlet`) — replaces the old hamburger + full-screen
 * overlay. A PDP/wizard `ContextualActionBar` (Phase 2b) auto-hides this via
 * the shared `BottomBarSlotProvider`.
 */
export function MarketingBottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mode = getAppModeFromPath(pathname);
  const isExploreMode = mode !== 'host';
  const { switchMode, isTransitioning } = useModeSwitchTransition();
  const { status: guestStatus } = useGuestSession();
  const { status: adminStatus } = useAdminSession();
  const isGuestSignedIn = guestStatus === 'authenticated';
  const isHostSignedIn = adminStatus === 'admin';
  const [moreOpen, setMoreOpen] = useState(false);

  const accountHref = isExploreMode
    ? isGuestSignedIn
      ? GUEST_ACCOUNT_PROFILE_PATH
      : getGuestLoginCta().href
    : isHostSignedIn
      ? getHostMarketingNavCta(true).href
      : getHostMarketingNavCta(false).href;

  const items = useMemo<BottomTabItem[]>(
    () => [
      {
        key: 'explore',
        label: 'Explore',
        Icon: Compass,
        onClick: () => {
          if (isExploreMode) {
            navigate('/');
          } else if (!isTransitioning) {
            switchMode('guest');
          }
        },
      },
      { key: 'properties', label: 'Properties', href: '/properties', Icon: Building2 },
      { key: 'parkings', label: 'Parkings', href: '/parkings', Icon: Car },
      { key: 'account', label: 'Account', href: accountHref, Icon: User },
      moreTabItem(() => setMoreOpen(true)),
    ],
    [isExploreMode, isTransitioning, navigate, switchMode, accountHref]
  );

  const activeKey = moreOpen ? 'more' : resolveActiveKey(pathname);

  return (
    <>
      <BottomTabBar items={items} activeKey={activeKey} aria-label="Main" />
      <MarketingMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
