import type { LucideIcon } from 'lucide-react';

/** Mirrors `SlidingTabsList` + `SlidingTabsTrigger` for `size="primary"`. */
const slidingTabsListPrimaryClassName =
  'bg-muted text-muted-foreground relative inline-flex h-9 max-w-full items-stretch justify-start overflow-x-auto overflow-y-hidden rounded-lg p-0.5';

const slidingTabsTriggerPrimaryClassName =
  'inline-flex h-full min-h-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-0 text-[13px] font-medium leading-none lg:px-3 lg:text-sm';

export type SlidingTabsListSkeletonItem = {
  label: string;
  icon?: LucideIcon;
  /** Applied to the label node (e.g. `hidden sm:inline` on team tabs). */
  labelClassName?: string;
};

export function SlidingTabsListSkeleton({
  items,
  'aria-label': ariaLabel = 'Loading tabs',
}: {
  items: SlidingTabsListSkeletonItem[];
  'aria-label'?: string;
}) {
  return (
    <div
      className={slidingTabsListPrimaryClassName}
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      aria-hidden
    >
      {items.map(({ label, icon: Icon, labelClassName }) => (
        <span key={label} className={slidingTabsTriggerPrimaryClassName}>
          {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
          {labelClassName ? <span className={labelClassName}>{label}</span> : label}
        </span>
      ))}
    </div>
  );
}

/** Org Plans page uses Radix `TabsList`, not sliding tabs. */
const plansTabsListClassName =
  'bg-muted text-muted-foreground inline-flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto rounded-lg p-1 max-lg:h-9 sm:w-auto';

const plansTabsTriggerClassName =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap px-3 py-2 max-lg:gap-1.5 max-lg:px-2.5 max-lg:py-0 max-lg:text-[13px]';

export function PlansTabsListSkeleton({
  items,
  'aria-label': ariaLabel = 'Loading plans tabs',
}: {
  items: SlidingTabsListSkeletonItem[];
  'aria-label'?: string;
}) {
  return (
    <div
      className={plansTabsListClassName}
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      aria-hidden
    >
      {items.map(({ label, icon: Icon }) => (
        <span key={label} className={plansTabsTriggerClassName}>
          {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}
