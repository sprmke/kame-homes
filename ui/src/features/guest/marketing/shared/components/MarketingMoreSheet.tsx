import type { MouseEvent } from 'react';

import { Link, useLocation } from 'react-router-dom';

import { Facebook, Instagram, LayoutDashboard, LogOut, Mail, Phone, Twitter } from 'lucide-react';

import { useGuestSignOut } from '@/features/guest/account/hooks/useGuestSignOut';
import {
  getGuestLoginCta,
  getHostMarketingNavCta,
} from '@/features/guest/auth/config/auth-navigation';
import { getAppModeFromPath } from '@/features/guest/auth/config/mode-switch';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';
import { ModeSwitcher } from '@/features/guest/marketing/shared/components/ModeSwitcher';
import { useModeSwitchTransition } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';
import { marketingGuestNavLinks } from '@/features/guest/marketing/shared/lib/marketingGuestNavLinks';
import {
  marketingCompanyLinks,
  marketingContactPhone,
  marketingHostLinks,
  marketingLegalLinks,
  marketingSocialLinks,
} from '@/features/guest/marketing/shared/lib/marketingSiteLinks';

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
import { PLATFORM_CONTACT_EMAIL, platformCopyrightLine } from '@/lib/platformBranding';
import { cn } from '@/lib/utils';

const linkGroups: { title: string; links: readonly { href: string; label: string }[] }[] = [
  {
    title: 'Explore',
    links: marketingGuestNavLinks.filter(
      (l) => l.href === '/developments' || l.href === '/services'
    ),
  },
  { title: 'For hosts', links: marketingHostLinks },
  { title: 'Company', links: marketingCompanyLinks },
  { title: 'Legal', links: marketingLegalLinks },
];

const socialIcons = { Facebook, Instagram, Twitter } as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Secondary marketing links + contact/socials/copyright (the phone replacement for `MarketingFooter`) + theme + mode switch + sign out — the overflow of `MarketingBottomNav`. */
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
      {/*
        `layout="split"`: BottomSheetContent measures link list + footer content and
        sets a definite `height` that shrinks to fit (capped 680px / 92dvh) — see
        bottom-sheet.tsx for why pure CSS (max-height alone) can't do this on iOS
        Safari. Only the link list scrolls once content exceeds the cap; theme/mode +
        sign-in/out stay pinned.
      */}
      <BottomSheetContent
        layout="split"
        maxHeightPx={680}
        className="gap-0 overflow-hidden px-0 pb-0"
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

          <div className="border-border/60 space-y-2 border-t pb-2 pt-3">
            <div className="text-muted-foreground flex flex-col text-sm">
              <a
                href={`mailto:${PLATFORM_CONTACT_EMAIL}`}
                className="flex min-h-[44px] items-center gap-2 px-2.5"
              >
                <Mail className="text-primary size-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{PLATFORM_CONTACT_EMAIL}</span>
              </a>
              {marketingContactPhone ? (
                <a
                  href={marketingContactPhone.href}
                  className="flex min-h-[44px] items-center gap-2 px-2.5"
                >
                  <Phone className="text-primary size-4 shrink-0" aria-hidden />
                  {marketingContactPhone.label}
                </a>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 px-2.5">
              <p className="text-muted-foreground min-w-0 text-xs">{platformCopyrightLine()}</p>
              <div className="flex shrink-0 items-center gap-1">
                {marketingSocialLinks.map((social) => {
                  const Icon = socialIcons[social.label];
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="text-muted-foreground hover:text-foreground flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors"
                    >
                      <Icon className="size-5" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
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
