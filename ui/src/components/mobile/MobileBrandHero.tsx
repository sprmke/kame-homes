import { forwardRef, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';

import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';

import { MobilePageStack } from '@/components/mobile/FloatingPanel';
import { HeroTenantScope } from '@/components/mobile/HeroTenantScope';
import { MobileStickyChrome } from '@/components/mobile/MobileStickyChrome';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { useMobileHeroCollapseProgress } from '@/hooks/useMobileHeroCollapseProgress';
import { useMobileStickyChrome } from '@/hooks/useMobileStickyChrome';
import { cn } from '@/lib/utils';

type MobileBrandHeroProps = {
  /** Page title shown on the teal hero band (mobile only). */
  title: string;
  subtitle?: string;
  titleId?: string;
  /** Optional plan/status pill next to the title (e.g. `<TierBadge>`). */
  badge?: ReactNode;
  /** Optional icon actions — top-right, aligned with the tenant switcher row. */
  trailing?: ReactNode;
  /** When true, render super-admin scope readout instead of tenant switcher. */
  superAdmin?: boolean;
  /** Scroll sentinel for sticky chrome on pages without a float overlap. */
  pinSentinelRef?: RefObject<HTMLDivElement | null>;
  /**
   * No floating toolbar straddles the bottom edge — tighten the bottom pad so
   * the title sits close to the white canvas instead of over a tall green band.
   */
  flush?: boolean;
  className?: string;
  /**
   * 0 = expanded, 1 = title fully compressed (parallax). The hero bottom edge
   * stays a straight line at every step — only pad/title compress.
   * Driven by {@link useMobileHeroCollapseProgress} from the page scrollport.
   */
  collapseProgress?: number;
};

/**
 * Brand-colored top band — phone/tablet only (`max-lg`).
 * Scrolls with the page (not sticky). Straight bottom edge; title + bottom pad
 * compress via scroll parallax. Desktop renders nothing (`lg:hidden`).
 */
export const MobileBrandHero = forwardRef<HTMLElement, MobileBrandHeroProps>(
  function MobileBrandHero(
    {
      title,
      subtitle,
      titleId,
      badge,
      trailing,
      superAdmin = false,
      pinSentinelRef,
      flush = false,
      className,
      collapseProgress = 0,
    },
    ref
  ) {
    const p = collapseProgress;
    const titleOpen = 1 - p;

    const titleStyle: CSSProperties = {
      maxHeight: `${Math.round(titleOpen * 72)}px`,
      opacity: titleOpen,
      transform: `translate3d(0, ${(-p * 14).toFixed(2)}px, 0)`,
      marginTop: `${(titleOpen * 0.75).toFixed(2)}rem`,
    };

    const chromeStyle: CSSProperties = {
      transform: `translate3d(0, ${(p * -1).toFixed(2)}px, 0)`,
      paddingBottom: `${(0.25 + p * 0.15).toFixed(2)}rem`,
    };

    return (
      <header
        ref={ref}
        className={cn(
          'mobile-brand-hero relative z-0 lg:hidden',
          p > 0.02 && 'mobile-brand-hero--compact',
          flush && 'mobile-brand-hero--flush',
          className
        )}
        style={{ ['--hero-collapse' as string]: String(p) } as CSSProperties}
        data-collapsed={p > 0.85 ? 'true' : 'false'}
      >
        <div
          ref={pinSentinelRef}
          className="relative z-[1] flex items-center justify-between gap-2 px-1 pb-1"
          style={chromeStyle}
        >
          <div className="min-w-0 flex-1">
            <HeroTenantScope superAdmin={superAdmin} />
          </div>
          {trailing ? <div className="flex shrink-0 items-center gap-0.5">{trailing}</div> : null}
        </div>

        <div
          className="relative z-[1] overflow-hidden px-1"
          style={titleStyle}
          aria-hidden={p > 0.85}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h1
              id={titleId}
              /* Size matches `text-admin-page-title`; color must stay on-primary.
               * Do not use the token class here — it bakes in `text-foreground`
               * and wins over `text-primary-foreground` in the CSS cascade. */
              className="text-primary-foreground text-lg font-bold tracking-tight sm:text-xl"
            >
              {title}
            </h1>
            {badge ? (
              <span className="[&_[data-tier-badge]]:bg-primary-foreground [&_[data-tier-badge]]:text-primary">
                {badge}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="text-primary-foreground/75 mt-0.5 line-clamp-2 hidden text-sm lg:block">
              {subtitle}
            </p>
          ) : null}
        </div>
      </header>
    );
  }
);

type MobileHeroOverlapProps = {
  children: ReactNode;
  className?: string;
  /** Top-edge sentinel for sticky pin detection. */
  pinSentinelRef?: RefObject<HTMLDivElement | null>;
  /** Hide in-flow float while the fixed sticky bar is shown. */
  pinned?: boolean;
};

/** Floating toolbar straddles the hero's straight bottom edge (higher z than the hero). */
export function MobileHeroOverlap({
  children,
  className,
  pinSentinelRef,
  pinned = false,
}: MobileHeroOverlapProps) {
  return (
    <div
      className={cn(
        /* Must be a sibling above the hero in paint order — not inside a z-0 canvas. */
        'relative z-20 lg:hidden',
        'max-lg:-mt-5 max-lg:mb-3 max-lg:px-3.5 sm:max-lg:px-4 md:max-lg:px-6',
        className
      )}
    >
      <div
        ref={pinSentinelRef}
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-px"
      />
      <div
        aria-hidden
        className="bg-primary/30 pointer-events-none absolute inset-x-6 -top-2 h-7 rounded-full blur-md sm:inset-x-8"
      />
      <div
        className={cn(
          'relative',
          pinned && 'pointer-events-none invisible',
          'max-lg:[&>*]:shadow-native-float max-lg:[&>*]:rounded-[1.35rem]',
          'max-lg:[&>*]:ring-1 max-lg:[&>*]:ring-black/[0.04]'
        )}
        aria-hidden={pinned}
      >
        {children}
      </div>
    </div>
  );
}

type AdminMobilePageProps = {
  title: string;
  subtitle?: string;
  titleId?: string;
  /** Optional plan/status pill next to the title (e.g. `<TierBadge>`). */
  badge?: ReactNode;
  heroTrailing?: ReactNode;
  overlap?: ReactNode;
  /** Compact sticky row — defaults to overlap when omitted. */
  stickyPrimary?: ReactNode;
  /** Secondary sticky controls — enables More sheet while pinned. */
  stickyMore?: ReactNode;
  stickyMoreActiveCount?: number;
  stickyMoreAriaLabel?: string;
  desktopActions?: ReactNode;
  desktopActionsClassName?: string;
  superAdmin?: boolean;
  dense?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Native mobile page shell — document scroll + morphing sticky chrome (`max-lg`).
 *
 * Mobile: hero → optional float (straddling the straight edge) → full-bleed white canvas.
 * Default pages: `main` scrolls. Fill-main pages (Settings / Notifications / Inbox /
 * Templates): this shell is a flex column so `AdminSectionNavLayout`'s inner
 * `data-admin-content-scroll` can scroll under the hero.
 * Sticky: float/hero chrome morphs into a fixed brand bar when pinned.
 * Desktop: standard AdminPageHeader + stack.
 */
export function AdminMobilePage({
  title,
  subtitle,
  titleId,
  badge,
  heroTrailing,
  overlap,
  stickyPrimary,
  stickyMore,
  stickyMoreActiveCount,
  stickyMoreAriaLabel,
  desktopActions,
  desktopActionsClassName,
  superAdmin = false,
  dense = false,
  className,
  children,
}: AdminMobilePageProps) {
  const isMobileLayout = useIsBelowLg();
  const heroRef = useRef<HTMLElement | null>(null);
  const floatSentinelRef = useRef<HTMLDivElement | null>(null);
  const heroSentinelRef = useRef<HTMLDivElement | null>(null);
  const pinSentinelRef = overlap ? floatSentinelRef : heroSentinelRef;
  const collapseProgress = useMobileHeroCollapseProgress(heroRef, isMobileLayout);
  const { pinned } = useMobileStickyChrome(pinSentinelRef, isMobileLayout);

  const resolvedStickyPrimary = stickyPrimary ?? (stickyMore ? undefined : overlap);

  return (
    <div
      data-admin-mobile-page
      className={cn(
        'w-full',
        /* Participate in fillMain flex chain (Settings/Notifications/Inbox) without
         * forcing nested scroll on normal document-scroll pages. */
        'flex min-h-0 flex-1 flex-col'
      )}
    >
      <MobileBrandHero
        ref={heroRef}
        title={title}
        subtitle={subtitle}
        titleId={titleId}
        badge={badge}
        trailing={heroTrailing}
        superAdmin={superAdmin}
        pinSentinelRef={overlap ? undefined : heroSentinelRef}
        collapseProgress={collapseProgress}
        flush={!overlap}
        className="shrink-0"
      />

      {isMobileLayout ? (
        <MobileStickyChrome
          pinned={pinned}
          superAdmin={superAdmin}
          trailing={heroTrailing}
          primary={resolvedStickyPrimary}
          more={stickyMore}
          moreActiveCount={stickyMoreActiveCount}
          moreAriaLabel={stickyMoreAriaLabel}
        />
      ) : null}

      {/* Float is a sibling of the hero (not inside the canvas) so it paints on top of the edge. */}
      {isMobileLayout && overlap ? (
        <MobileHeroOverlap pinSentinelRef={floatSentinelRef} pinned={pinned}>
          {overlap}
        </MobileHeroOverlap>
      ) : null}

      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          isMobileLayout &&
            /*
             * No tuck anywhere now: no-float pages tighten the hero bottom pad
             * (`mobile-brand-hero--flush`) so the white canvas meets the straight
             * edge flush; float pages tuck the float itself (`MobileHeroOverlap`).
             */
            'bg-background relative z-0 w-full max-lg:pb-1'
        )}
      >
        <MobilePageStack
          dense={dense}
          className={cn(
            'min-h-0 flex-1',
            isMobileLayout && cn('px-3.5 sm:px-4 md:px-6', overlap ? 'pt-1' : 'pt-3'),
            'max-lg:mt-0',
            className
          )}
        >
          <div className="hidden shrink-0 lg:block">
            <AdminPageHeader
              id={titleId}
              variant="compact"
              card={false}
              title={title}
              subtitle={subtitle}
              badge={badge}
              actions={desktopActions}
              actionsClassName={desktopActionsClassName}
            />
          </div>
          {children}
        </MobilePageStack>
      </div>
    </div>
  );
}
