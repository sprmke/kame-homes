import * as React from 'react';

import { SlidingActivePill } from '@/components/ui/SlidingActivePill';
import { useSlidingActivePill } from '@/hooks/useSlidingActivePill';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type SlidingTabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const SlidingTabsContext = React.createContext<SlidingTabsContextValue | null>(null);

export type SlidingTabsSize = 'primary' | 'compact' | 'dense';

type SlidingTabsListContextValue = {
  setItemRef: (key: string) => (node: HTMLElement | null) => void;
  size: SlidingTabsSize;
};

const SlidingTabsListContext = React.createContext<SlidingTabsListContextValue | null>(null);

const slidingTabsListClass: Record<SlidingTabsSize, string> = {
  /* Page section tabs (Team Members / Invitations). Same track height as compact. */
  primary:
    'inline-flex h-9 max-w-full items-stretch justify-start overflow-x-auto overflow-y-hidden rounded-lg p-0.5',
  /* Multi-option strips (booking detail, inbox). ~36px track. Never min-h-[44px] on triggers. */
  compact:
    'inline-flex h-9 w-fit max-w-full items-stretch justify-start overflow-x-auto overflow-y-hidden rounded-lg p-0.5',
  /* Form / toolbar toggles (Sign·Upload, GAF·Pet, Card·Calendar). ~32px track. */
  dense: 'inline-flex h-8 w-fit max-w-full items-stretch justify-start rounded-lg p-0.5',
};

const slidingTabsTriggerClass: Record<SlidingTabsSize, string> = {
  primary:
    'inline-flex h-full min-h-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-0 text-[13px] font-medium leading-none lg:px-3 lg:text-sm',
  compact:
    'inline-flex h-full min-h-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2.5 py-0 text-xs font-medium leading-none sm:text-[13px]',
  /* Fill the padded track — never fixed h-* taller than the track. */
  dense:
    'inline-flex h-full min-h-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-0 text-[11px] font-semibold leading-none sm:px-2.5',
};

function useSlidingTabsContext(): SlidingTabsContextValue {
  const ctx = React.useContext(SlidingTabsContext);
  if (!ctx) {
    throw new Error('SlidingTabs components must be used within SlidingTabs');
  }
  return ctx;
}

function useSlidingTabsListContext(): SlidingTabsListContextValue {
  const ctx = React.useContext(SlidingTabsListContext);
  if (!ctx) {
    throw new Error('SlidingTabsTrigger must be used within SlidingTabsList');
  }
  return ctx;
}

type SlidingTabsProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
};

export function SlidingTabs({
  value: valueProp,
  defaultValue = '',
  onValueChange,
  children,
  className,
}: SlidingTabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const value = valueProp ?? internalValue;

  const handleChange = React.useCallback(
    (next: string) => {
      if (valueProp === undefined) setInternalValue(next);
      onValueChange?.(next);
    },
    [valueProp, onValueChange]
  );

  const ctx = React.useMemo(() => ({ value, onValueChange: handleChange }), [value, handleChange]);

  return (
    <SlidingTabsContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </SlidingTabsContext.Provider>
  );
}

const EMPTY_REMEASURE_DEPS: unknown[] = [];

type SlidingTabsListProps = React.HTMLAttributes<HTMLDivElement> & {
  pillClassName?: string;
  remeasureDeps?: unknown[];
  size?: SlidingTabsSize;
};

export function SlidingTabsList({
  children,
  className,
  pillClassName,
  remeasureDeps = EMPTY_REMEASURE_DEPS,
  size = 'primary',
  ...props
}: SlidingTabsListProps) {
  const { value } = useSlidingTabsContext();
  const { containerRef, setItemRef, bounds } = useSlidingActivePill(value, remeasureDeps);

  const listCtx = React.useMemo(() => ({ setItemRef, size }), [setItemRef, size]);

  return (
    <SlidingTabsListContext.Provider value={listCtx}>
      <div
        ref={containerRef}
        role="tablist"
        className={cn(
          'bg-muted text-muted-foreground relative',
          slidingTabsListClass[size],
          className
        )}
        {...props}
      >
        {bounds ? (
          <SlidingActivePill
            bounds={bounds}
            className={cn('bg-card rounded-md shadow', pillClassName)}
          />
        ) : null}
        {children}
      </div>
    </SlidingTabsListContext.Provider>
  );
}

type SlidingTabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export const SlidingTabsTrigger = React.forwardRef<HTMLButtonElement, SlidingTabsTriggerProps>(
  function SlidingTabsTrigger({ value, children, className, disabled, onClick, ...props }, ref) {
    const { value: activeValue, onValueChange } = useSlidingTabsContext();
    const { setItemRef, size } = useSlidingTabsListContext();
    const active = activeValue === value;

    const mergedRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        setItemRef(value)(node);
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref, setItemRef, value]
    );

    return (
      <button
        ref={mergedRef}
        type="button"
        role="tab"
        aria-selected={active}
        disabled={disabled}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) onValueChange(value);
        }}
        className={cn(
          'ring-offset-background focus-visible:ring-ring relative z-[1] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          slidingTabsTriggerClass[size],
          active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

type SlidingTabsContentProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

export function SlidingTabsContent({ value, children, className }: SlidingTabsContentProps) {
  const { value: activeValue } = useSlidingTabsContext();
  if (activeValue !== value) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}

export type SegmentedControlOption<T extends string = string> = {
  value: T;
  label?: React.ReactNode;
  /** Accessible name + tooltip when `label` is a node (or is visually truncated). */
  ariaLabel?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
};

/** Dense equal-width segments for `AdminSurfaceCardHeader` actions (Name/Price, All/Income…). */
export const cardHeaderSegmentedListClassName = 'border-border/60 h-7 max-w-full p-0.5';
export const cardHeaderSegmentedTriggerClassName =
  'px-2 text-[11px] font-medium leading-none sm:px-2.5';

type SegmentedControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  size?: SlidingTabsSize;
  /** Stretch track + equal-width triggers (Sign/Upload, Card/Calendar, etc.). */
  fullWidth?: boolean;
  /**
   * Equal-width triggers inside a `w-fit` track (card-header All/Income/Expenses,
   * Name/Price). Prefer with `size="dense"` for surface-card actions.
   */
  equalSegments?: boolean;
  className?: string;
  listClassName?: string;
  triggerClassName?: string;
  pillClassName?: string;
  hideValues?: T[];
  'aria-label'?: string;
};

/** Data-driven segmented control with sliding pill (view toggles, chart filters, etc.). */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'compact',
  fullWidth = false,
  equalSegments = false,
  className,
  listClassName,
  triggerClassName,
  pillClassName,
  hideValues = [],
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const visible = hideValues.length
    ? options.filter((option) => !hideValues.includes(option.value))
    : options;

  const handleValueChange = React.useCallback((next: string) => onChange(next as T), [onChange]);
  const iconClassName = 'size-3.5 shrink-0';
  const resolvedPillClassName =
    pillClassName ?? (size === 'dense' ? 'bg-card rounded-md shadow-sm' : undefined);
  const equalWidthTriggers = fullWidth || equalSegments;

  return (
    <SlidingTabs value={value} onValueChange={handleValueChange} className={className}>
      <SlidingTabsList
        size={size}
        className={cn(
          size === 'dense' ? 'border-border/70 bg-muted/40 border' : 'segment-shell',
          fullWidth && 'w-full max-w-none',
          listClassName
        )}
        pillClassName={resolvedPillClassName}
        aria-label={ariaLabel}
        remeasureDeps={[
          visible.length,
          value,
          size,
          fullWidth,
          equalSegments,
          visible.map((option) => option.ariaLabel ?? '').join('|'),
        ]}
      >
        {visible.map(
          ({
            value: optionValue,
            label,
            ariaLabel,
            icon: Icon,
            disabled,
            className: optionClassName,
          }) => {
            const accessibleName =
              ariaLabel ?? (typeof label === 'string' ? label : String(optionValue));
            return (
              <SlidingTabsTrigger
                key={optionValue}
                value={optionValue}
                disabled={disabled}
                aria-label={accessibleName}
                title={accessibleName}
                className={cn(
                  size !== 'dense' && 'segment-item',
                  equalWidthTriggers && 'flex-1 basis-0 justify-center',
                  triggerClassName,
                  optionClassName
                )}
              >
                {Icon ? <Icon className={iconClassName} aria-hidden /> : null}
                {label}
              </SlidingTabsTrigger>
            );
          }
        )}
      </SlidingTabsList>
    </SlidingTabs>
  );
}

// Re-export for tabs.tsx and other Radix integrations.
export { useDomActiveSlidingPill } from '@/hooks/useSlidingActivePill';
