import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type FloatingPanelPadding = 'none' | 'xs' | 'sm' | 'md' | 'lg';

const PADDING: Record<FloatingPanelPadding, string> = {
  none: 'p-0',
  xs: 'p-2',
  sm: 'p-3 sm:p-3.5',
  md: 'p-3.5 sm:p-4',
  lg: 'p-4 sm:p-4 md:p-5',
};

type FloatingPanelProps = {
  children: ReactNode;
  className?: string;
  /** Inner padding — mockup cards use md/lg. */
  padding?: FloatingPanelPadding;
  /** Pressable surface (list rows, filter shells). */
  interactive?: boolean;
  /**
   * When true, only phones/tablets get the floating white panel;
   * `lg+` is a transparent layout wrapper (desktop keeps existing chrome).
   */
  mobileOnly?: boolean;
  as?: 'div' | 'section' | 'aside';
};

/**
 * Soft floating surface — Finance / Findex mockup language.
 * Borderless + soft shadow on mobile; optional desktop passthrough via `mobileOnly`.
 */
export function FloatingPanel({
  children,
  className,
  padding = 'md',
  interactive = false,
  mobileOnly = false,
  as: Tag = 'div',
}: FloatingPanelProps) {
  return (
    <Tag
      className={cn(
        mobileOnly
          ? cn(
              'max-lg:bg-card max-lg:text-card-foreground max-lg:shadow-native-float max-lg:rounded-[1.35rem]',
              'lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none',
              interactive && 'max-lg:native-press'
            )
          : cn(interactive ? 'surface-card-interactive' : 'surface-card'),
        /* Padding: skip on desktop when mobileOnly (lg:p-0 above). */
        PADDING[padding],
        className
      )}
    >
      {children}
    </Tag>
  );
}

type MobilePageStackProps = {
  children: ReactNode;
  className?: string;
  /** Tighter rhythm for dense list pages. */
  dense?: boolean;
};

/**
 * Vertical page rhythm for admin mobile/tablet.
 * Comfortable section gaps without sparse “marketing” whitespace.
 */
export function MobilePageStack({ children, className, dense = false }: MobilePageStackProps) {
  return (
    <div
      className={cn(
        'flex flex-col',
        dense ? 'gap-3 sm:gap-3.5 lg:gap-4' : 'gap-3.5 sm:gap-4 lg:gap-5',
        className
      )}
    >
      {children}
    </div>
  );
}

type FloatingSectionProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  mobileOnly?: boolean;
};

/**
 * Floating panel with optional title row — charts, ledger blocks, settings groups.
 */
export function FloatingSection({
  children,
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  mobileOnly = false,
}: FloatingSectionProps) {
  return (
    <FloatingPanel padding="lg" mobileOnly={mobileOnly} className={className} as="section">
      {title || action ? (
        <div className="mb-3.5 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-section-title leading-none lg:leading-snug">{title}</h2>
            ) : null}
            {subtitle ? (
              <p className="text-muted-foreground mt-1 hidden text-xs leading-snug lg:block">
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0 self-start sm:self-center">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('min-w-0', bodyClassName)}>{children}</div>
    </FloatingPanel>
  );
}

type FloatingToolbarProps = {
  children: ReactNode;
  className?: string;
  /** Inner padding — `xs` for single-control date bars; `sm`/`md` when stacking filters. */
  padding?: FloatingPanelPadding;
};

/**
 * Soft floating shell for filter / search toolbars (phone + tablet).
 * Desktop (`lg+`) is transparent so existing toolbar layout stays.
 */
export function FloatingToolbar({ children, className, padding = 'xs' }: FloatingToolbarProps) {
  return (
    <FloatingPanel mobileOnly padding={padding} className={cn('space-y-2', className)}>
      {children}
    </FloatingPanel>
  );
}

type ListSheetProps = {
  children: ReactNode;
  className?: string;
  /** Grouped list rows (dividers) vs loose card stack. */
  divided?: boolean;
};

/**
 * Single floating sheet for grouped list rows (transactions, settings links).
 * Prefer individual floating cards for heterogeneous content.
 */
export function ListSheet({ children, className, divided = true }: ListSheetProps) {
  return (
    <FloatingPanel
      padding="none"
      className={cn('overflow-hidden', divided && 'divide-border/60 divide-y', className)}
    >
      {children}
    </FloatingPanel>
  );
}
