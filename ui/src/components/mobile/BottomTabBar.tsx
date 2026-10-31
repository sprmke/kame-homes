import type { ComponentType, ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { MoreHorizontal } from 'lucide-react';

import { scrollAdminViewToTop } from '@/components/navigation/ScrollToTop';
import { SlidingActivePill } from '@/components/ui/SlidingActivePill';
import { useSlidingActivePill } from '@/hooks/useSlidingActivePill';
import { cn } from '@/lib/utils';

export type BottomTabItem = {
  key: string;
  label: string;
  href?: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Dot when `true`; compact count when a positive number. */
  badge?: boolean | number;
  /** When set, tab acts as a button (e.g. More) instead of a link. */
  onClick?: () => void;
};

type Props = {
  items: BottomTabItem[];
  activeKey: string | null;
  className?: string;
  'aria-label'?: string;
};

/**
 * Shared floating dock chrome — bottom tabs + contextual action bar.
 * Soft glass, elevated shadow, inset from screen edges and home indicator.
 */
export const mobileFloatingDockClassName = cn(
  'mobile-floating-dock pointer-events-auto mx-auto w-full max-w-md',
  'border-border/40 bg-background/88 supports-[backdrop-filter]:bg-background/72',
  'rounded-[1.75rem] border backdrop-blur-2xl',
  'ring-1 ring-black/[0.04] dark:ring-white/[0.08]'
);

/**
 * Floating bottom tab bar — clear active tab, readable labels, 44×44+ targets.
 * Icons stay optically light (≈18px, thinner stroke) so the dock feels native, not chunky.
 * Active indicator is a solid brand pill (sliding) so location is obvious at a glance.
 */
export function BottomTabBar({
  items,
  activeKey,
  className,
  'aria-label': ariaLabel = 'Main',
}: Props) {
  const dense = items.length > 5;
  const { containerRef, setItemRef, bounds } = useSlidingActivePill(activeKey, [
    items.map((i) => i.key).join('\0'),
  ]);

  return (
    <nav
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40',
        'px-4 pb-[max(0.625rem,env(safe-area-inset-bottom))]',
        'touch-manipulation',
        className
      )}
      aria-label={ariaLabel}
    >
      <div className={mobileFloatingDockClassName}>
        <div
          ref={containerRef}
          className={cn(
            'relative flex items-stretch justify-around py-1',
            dense ? 'gap-0 px-1' : 'gap-0.5 px-1.5'
          )}
          role="list"
        >
          {bounds ? (
            <SlidingActivePill
              bounds={bounds}
              className="bg-primary-strong shadow-native-primary rounded-[1rem]"
            />
          ) : null}
          {items.map((item) => {
            const active = item.key === activeKey;
            const Icon = item.Icon;
            const sharedClass = cn(
              'relative z-[1] flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5',
              'rounded-[1rem] px-1 py-1',
              'native-press transition-colors duration-150',
              active ? 'text-primary-foreground' : 'text-muted-foreground active:text-foreground'
            );

            const badgeCount = typeof item.badge === 'number' ? item.badge : 0;
            const showCount = badgeCount > 0;
            const showDot = item.badge === true;
            const itemAriaLabel = showCount
              ? `${item.label}, ${badgeCount} unread`
              : item.badge
                ? `${item.label}, has updates`
                : item.label;

            const content = (
              <>
                <span className="relative inline-flex size-5 items-center justify-center">
                  <Icon
                    strokeWidth={1.75}
                    className={cn(
                      'size-[18px] shrink-0 transition-opacity duration-150',
                      active ? 'opacity-100' : 'opacity-85'
                    )}
                    aria-hidden
                  />
                  {showCount ? (
                    <span
                      className={cn(
                        'absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5',
                        'bg-destructive text-destructive-foreground text-[8px] font-semibold leading-none',
                        'ring-2',
                        active ? 'ring-primary-strong' : 'ring-background',
                        'animate-notification-badge-pulse motion-reduce:animate-none'
                      )}
                      aria-hidden
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  ) : showDot ? (
                    <span
                      className={cn(
                        'absolute -right-0.5 -top-0.5 size-1.5 rounded-full',
                        'bg-destructive ring-2',
                        active ? 'ring-primary-strong' : 'ring-background',
                        'animate-notification-badge-pulse motion-reduce:animate-none'
                      )}
                      aria-hidden
                    />
                  ) : null}
                </span>
                <span
                  className={cn(
                    'w-full truncate text-center leading-none tracking-tight',
                    dense ? 'text-[9px]' : 'text-[10px]',
                    active ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {item.label}
                </span>
              </>
            );

            if (item.onClick || !item.href) {
              return (
                <button
                  key={item.key}
                  ref={setItemRef(item.key)}
                  type="button"
                  role="listitem"
                  onClick={item.onClick}
                  aria-current={active ? 'page' : undefined}
                  aria-label={itemAriaLabel}
                  aria-expanded={item.onClick ? active : undefined}
                  className={sharedClass}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.key}
                ref={setItemRef(item.key)}
                to={item.href}
                role="listitem"
                aria-current={active ? 'page' : undefined}
                aria-label={itemAriaLabel}
                className={sharedClass}
                onClick={() => scrollAdminViewToTop('auto')}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export const MORE_TAB_KEY = 'more';

export function moreTabItem(onClick: () => void): BottomTabItem {
  return {
    key: MORE_TAB_KEY,
    label: 'More',
    Icon: MoreHorizontal,
    onClick,
  };
}

/**
 * Content bottom clearance for the floating BottomTabBar (phone/tablet only).
 * Uses `max-lg:` so desktop `lg:py-*` padding is never clobbered.
 */
export function bottomTabBarOffsetClassName(): string {
  return 'max-lg:pb-[calc(7.75rem+env(safe-area-inset-bottom,0px))]';
}

/**
 * Fixed-bottom overlays (install/update toasts) sit above the floating tab bar
 * on phone/tablet — same stack offset as `MarketingEditorMobileToolbar`, plus a
 * small gap. Desktop has no tab bar, so flush to the safe-area bottom.
 * Class strings are static so Tailwind JIT can detect them.
 *
 * Pair with z-[45] on the overlay itself: above BottomTabBar (z-40), below
 * Sheet (z-50) / Dialog (z-100) so choice sheets and modals are never covered.
 */
export function aboveBottomTabBarOverlayClassName(): string {
  return cn(
    'max-lg:bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] max-lg:pb-0',
    'lg:bottom-0 lg:pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
  );
}

export type BottomTabBarSlotProps = {
  children?: ReactNode;
};
