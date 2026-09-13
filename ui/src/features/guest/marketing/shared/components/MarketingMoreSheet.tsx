import type { MouseEvent } from 'react';

import { Link, useLocation } from 'react-router-dom';

import { LayoutDashboard, LogOut } from 'lucide-react';

import { useGuestSignOut } from '@/features/guest/account/hooks/useGuestSignOut';
import {
  getGuestLoginCta,
  getHostMarketingNavCta,
} from '@/features/guest/auth/config/auth-navigation';
import { getAppModeFromPath } from '@/features/guest/auth/config/mode-switch';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';
import { ModeSwitcher } from '@/features/guest/marketing/shared/components/ModeSwitcher';
import { useModeSwitchTransition } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';

import { ThemeToggle } from '@/components/theme/MarketingThemeToggle';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const linkGroups: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'For hosts',
    links: [
      { href: '/for-hosts', label: 'Become a host' },
      { href: '/for-hosts/pricing', label: 'Pricing' },
      { href: '/services', label: 'Services' },
      { href: '/support', label: 'Support' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About us' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of service' },
      { href: '/cookies', label: 'Cookie policy' },
    ],
  },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Secondary marketing links + theme + mode switch + sign out — the overflow of `MarketingBottomNav`. */
export function MarketingMoreSheet({ open, onOpenChange }: Props) {
  const { pathname } = useLocation();
  const { status: guestStatus } = useGuestSession();
  const { status: adminStatus, signOut: hostSignOut } = useAdminSession();
  const { switchMode, isTransitioning } = useModeSwitchTransition();
  const guestSignOut = useGuestSignOut();
  const isGuestSignedIn = guestStatus === 'authenticated';
  const isHostSignedIn = adminStatus === 'admin';
  const isSignedIn = isGuestSignedIn || isHostSignedIn;
  const isExploreMode = getAppModeFromPath(pathname) !== 'host';
  const signInHref = isExploreMode ? getGuestLoginCta().href : getHostMarketingNavCta(false).href;
  const dashboardHref = getHostMarketingNavCta(true).href;

  const handleDashboardClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onOpenChange(false);
    if (!isExploreMode || isTransitioning) return;
    event.preventDefault();
    switchMode('host', { destination: dashboardHref });
  };

  const handleSignOut = async () => {
    onOpenChange(false);
    try {
      if (isGuestSignedIn) await guestSignOut();
      if (isHostSignedIn) await hostSignOut();
    } catch (err) {
      console.error('[MarketingMoreSheet] signOut failed', err);
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        layout="split"
        className="!h-[85dvh] !max-h-[85dvh] gap-0 overflow-hidden px-0 pb-0"
      >
        <BottomSheetHeader className="sr-only">
          <BottomSheetTitle>More</BottomSheetTitle>
          <BottomSheetDescription>More links and account options</BottomSheetDescription>
        </BottomSheetHeader>

        <nav
          className="min-h-0 flex-[1_1_0] space-y-5 overflow-y-auto overscroll-contain px-4 py-2 [-webkit-overflow-scrolling:touch]"
          aria-label="More"
        >
          {linkGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-muted-foreground mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.links.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => onOpenChange(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-[44px] items-center rounded-lg px-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted/60 active:bg-muted'
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="bg-card shrink-0 space-y-2.5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
          <div className="border-border/60 flex items-center gap-2 border-t pt-2.5">
            <ThemeToggle variant="outline" size="icon" className="shrink-0" />
            <ModeSwitcher className="min-w-0 flex-1" />
          </div>

          {isSignedIn ? (
            <Link
              to={dashboardHref}
              onClick={handleDashboardClick}
              className={cn(
                'border-border bg-muted/40 text-foreground',
                'hover:bg-muted/70 active:bg-muted',
                'flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors',
                isTransitioning && 'pointer-events-none opacity-60'
              )}
            >
              <LayoutDashboard className="size-4 shrink-0" aria-hidden />
              Dashboard
            </Link>
          ) : null}

          {isSignedIn ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className={cn(
                'border-destructive/25 bg-destructive/5 text-destructive',
                'hover:bg-destructive/10 active:bg-destructive/15',
                'flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors'
              )}
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              Sign out
            </button>
          ) : (
            <Button
              asChild
              className="min-h-[44px] w-full rounded-full"
              onClick={() => onOpenChange(false)}
            >
              <Link to={signInHref}>Sign in</Link>
            </Button>
          )}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
