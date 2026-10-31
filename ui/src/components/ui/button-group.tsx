import * as React from 'react';

import { cn } from '@/lib/utils';

type ButtonGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  fullWidth?: boolean;
};

/** Seamless horizontal control — shared borders, no gaps between items. */
export function ButtonGroup({ className, fullWidth, ...props }: ButtonGroupProps) {
  return (
    <div
      role="group"
      className={cn('inline-flex items-stretch -space-x-px', fullWidth && 'w-full', className)}
      {...props}
    />
  );
}

type ButtonGroupPosition = 'only' | 'first' | 'middle' | 'last';
type ButtonGroupSize = 'default' | 'compact';

type ButtonGroupItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  position?: ButtonGroupPosition;
  active?: boolean;
  /**
   * `default` — 44px touch target (forms / primary actions).
   * `compact` — denser chrome for mobile toolbars (date range, filters).
   */
  size?: ButtonGroupSize;
};

const sizeClass: Record<ButtonGroupSize, string> = {
  default: 'min-h-[44px] text-[13px]',
  compact: 'min-h-9 text-xs sm:min-h-10 sm:text-[13px]',
};

const itemBaseClass = cn(
  'border-border relative inline-flex items-center justify-center border',
  'bg-card font-semibold transition-colors duration-100',
  'hover:bg-muted/60',
  'focus-visible:ring-ring focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'disabled:pointer-events-none disabled:opacity-50'
);

const itemPositionClass: Record<ButtonGroupSize, Record<ButtonGroupPosition, string>> = {
  default: {
    only: 'rounded-lg px-3 py-2.5',
    first: 'min-w-[44px] rounded-l-lg rounded-r-none px-0',
    middle: 'min-w-0 flex-1 rounded-none px-3 py-2.5',
    last: 'min-w-[44px] rounded-r-lg rounded-l-none px-0',
  },
  compact: {
    only: 'rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2',
    first: 'min-w-9 rounded-l-lg rounded-r-none px-0 sm:min-w-10',
    middle: 'min-w-0 flex-1 rounded-none px-2.5 py-1.5 sm:px-3 sm:py-2',
    last: 'min-w-9 rounded-r-lg rounded-l-none px-0 sm:min-w-10',
  },
};

export const ButtonGroupItem = React.forwardRef<HTMLButtonElement, ButtonGroupItemProps>(
  function ButtonGroupItem(
    { className, position = 'only', active = false, size = 'default', type = 'button', ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          itemBaseClass,
          sizeClass[size],
          itemPositionClass[size][position],
          active ? 'interactive-primary text-foreground z-[1]' : 'text-foreground',
          className
        )}
        {...props}
      />
    );
  }
);
