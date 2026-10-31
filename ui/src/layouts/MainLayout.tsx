import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo } from 'react';

import { Outlet, useLocation } from 'react-router-dom';

import { GuestOperationalHeader } from '@/features/guest/property/components/GuestOperationalHeader';

import { BottomBarSlotProvider } from '@/components/mobile/BottomBarSlot';
import {
  BottomTabBar,
  bottomTabBarOffsetClassName,
  type BottomTabItem,
} from '@/components/mobile/BottomTabBar';
import { useTheme } from '@/components/theme/ThemeProvider';
import { guestEnterClass, type GuestNavState } from '@/layouts/guest/navState';
import { platformCopyrightLine } from '@/lib/platformBranding';
import { applyBrandCssVariables } from '@/lib/theme/applyBrandCssVariables';
import { buildGuestBrandStyle } from '@/lib/theme/brandColor';
import { cn } from '@/lib/utils';

const DEFAULT_FOOTER_LABEL = platformCopyrightLine();

interface MainLayoutProps {
  children?: ReactNode;
  /** Animate the content card on guest route changes (calendar → form → success). */
  animateOnNavigate?: boolean;
  /** Org brand color hex (#RRGGBB) for guest-facing accents. */
  brandColor?: string | null;
  /** Footer credit line (host org, or platform brand). */
  footerLabel?: string | null;
  /** Property slug for header links. */
  propertySlug?: string | null;
  propertyImageSrc?: string | null;
  propertyName?: string | null;
  /** Overrides the header's default `/properties/:slug` link (e.g. for non-property flows like parking). */
  homeHref?: string;
  /** Max width utility for the content card wrapper (default guest form width). */
  contentMaxWidth?: string;
  /**
   * Persistent phone/tablet tab bar (`<lg`) for multi-screen operational flows
   * (e.g. calendar/messages). Omit for single-purpose pages — a wizard step
   * claims the same band via `ContextualActionBar` and auto-hides this.
   */
  bottomTabs?: BottomTabItem[];
  bottomTabsActiveKey?: string | null;
}

export function MainLayout({
  children,
  animateOnNavigate = false,
  brandColor,
  footerLabel,
  propertySlug,
  propertyImageSrc,
  propertyName,
  homeHref,
  contentMaxWidth = 'max-w-3xl',
  bottomTabs,
  bottomTabsActiveKey = null,
}: MainLayoutProps) {
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const navState = location.state as GuestNavState | null;
  const content = children ?? <Outlet />;
  const brandStyle = useMemo(
    () => buildGuestBrandStyle(brandColor, resolvedTheme === 'dark'),
    [brandColor, resolvedTheme]
  );
  const footerText = footerLabel?.trim() || DEFAULT_FOOTER_LABEL;
  const hasTabBar = Boolean(bottomTabs?.length);

  useEffect(() => {
    return applyBrandCssVariables(document.documentElement, brandStyle as Record<string, string>);
  }, [brandStyle]);

  const body = (
    <main
      className="app-shell !bg-muted sm:bg-background relative min-h-screen"
      style={brandStyle as CSSProperties}
    >
      {/* Brand-color header band + minimal operational chrome */}
      <div
        className="relative h-[132px] w-full overflow-hidden sm:h-[180px] md:h-[260px]"
        style={{ background: 'var(--brand-gradient)' }}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_-10%,hsl(var(--brand-highlight)/0.45),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/10 to-transparent"
          aria-hidden
        />
        <GuestOperationalHeader
          propertySlug={propertySlug}
          propertyImageSrc={propertyImageSrc}
          propertyName={propertyName}
          homeHref={homeHref}
        />
      </div>

      {/* Content card */}
      <div className="relative -mt-12 px-0 pb-6 sm:-mt-16 sm:px-6 sm:pb-8 lg:px-8">
        <div className={cn('mx-auto w-full min-w-0', contentMaxWidth)}>
          <div
            key={animateOnNavigate ? `${location.pathname}${location.search}` : undefined}
            className={cn(
              'surface-card relative min-w-0 overflow-visible !rounded-[2.5rem] px-5 pb-6 pt-2 sm:!rounded-3xl sm:px-0 sm:pb-0 sm:pt-0',
              animateOnNavigate && guestEnterClass(navState)
            )}
          >
            {content}
          </div>
        </div>
      </div>

      <footer
        className={cn(
          'text-muted-foreground px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 text-center text-xs sm:px-6',
          hasTabBar && bottomTabBarOffsetClassName()
        )}
      >
        <p>{footerText}</p>
      </footer>
    </main>
  );

  if (!hasTabBar) return body;

  return (
    <BottomBarSlotProvider
      tabBar={
        <BottomTabBar items={bottomTabs!} activeKey={bottomTabsActiveKey} aria-label="Property" />
      }
    >
      {body}
    </BottomBarSlotProvider>
  );
}
