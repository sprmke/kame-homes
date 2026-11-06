import type { ReactNode } from 'react';

import { useClaimBottomBarSlot } from '@/components/mobile/BottomBarSlot';
import {
  bottomTabBarOffsetClassName,
  mobileBottomBarClassName,
  mobileBottomBarRowClassName,
} from '@/components/mobile/BottomTabBar';
import { useVirtualKeyboardOpen } from '@/hooks/useVirtualKeyboardOpen';
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
  const keyboardOpen = useVirtualKeyboardOpen();

  // A fixed CTA would otherwise cover the field being typed into.
  if (keyboardOpen) return null;

  return (
    <div
      className={cn('fixed inset-x-0 bottom-0 z-40', mobileBottomBarClassName, className)}
      role="toolbar"
    >
      <div className={cn(mobileBottomBarRowClassName, 'px-3 py-2.5')}>{children}</div>
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
