import type { ReactNode } from 'react';

import { useClaimBottomBarSlot } from '@/components/mobile/BottomBarSlot';
import {
  bottomTabBarOffsetClassName,
  mobileFloatingDockClassName,
} from '@/components/mobile/BottomTabBar';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  className?: string;
  /** Extra bottom padding when the persistent tab bar is visible. */
  withTabBarOffset?: boolean;
};

/**
 * Primary-action bottom bar for wizards / edit screens.
 * Mounting this claims the BottomBarSlot (hides the tab bar) while visible.
 */
export function ContextualActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  useClaimBottomBarSlot();

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40',
        'px-4 pb-[max(0.625rem,env(safe-area-inset-bottom))]',
        'touch-manipulation',
        className
      )}
      role="toolbar"
    >
      <div className={cn(mobileFloatingDockClassName, 'px-3 py-2.5')}>{children}</div>
    </div>
  );
}

/** Content padding so scroll areas clear the fixed ContextualActionBar / BottomTabBar. */
export function MobileAppShell({ children, className, withTabBarOffset = true }: Props) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overscroll-y-contain',
        className,
        /* After `className` so shell `p-*` / `py-*` cannot wipe tab clearance (twMerge). */
        withTabBarOffset && bottomTabBarOffsetClassName()
      )}
    >
      {children}
    </div>
  );
}
