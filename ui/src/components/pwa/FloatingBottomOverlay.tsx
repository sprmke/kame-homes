import type { ReactNode } from 'react';

import { aboveBottomTabBarOverlayClassName } from '@/components/mobile/BottomTabBar';
import { cn } from '@/lib/utils';

type FloatingBottomOverlayProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Centers a compact bottom toast above the tab bar without blocking clicks outside
 * the child. The outer row is full width for layout only (`pointer-events-none`);
 * the child must set `pointer-events-auto` (and a bounded width, e.g. `max-w-sm`).
 */
export function FloatingBottomOverlay({ children, className }: FloatingBottomOverlayProps) {
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[45] flex justify-center px-3',
        aboveBottomTabBarOverlayClassName(),
        className
      )}
    >
      {children}
    </div>
  );
}
