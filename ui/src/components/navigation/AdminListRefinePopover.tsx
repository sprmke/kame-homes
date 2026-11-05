import type { ReactNode } from 'react';

import { ChevronDown, SlidersHorizontal } from 'lucide-react';

import { useClaimToolbarMenu } from '@/components/navigation/AdminToolbarMenuScope';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount?: number;
  onClear?: () => void;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
  'aria-label'?: string;
};

/**
 * Desktop “Filters” control for secondary facets only.
 * Keep Status, Sort, and per-page on the toolbar so this panel stays short.
 */
export function AdminListRefinePopover({
  open,
  onOpenChange,
  activeCount = 0,
  onClear,
  children,
  className,
  triggerClassName,
  'aria-label': ariaLabel = 'Filters',
}: Props) {
  const menu = useClaimToolbarMenu(open, onOpenChange);
  const active = activeCount > 0 || menu.open;

  return (
    <Popover open={menu.open} onOpenChange={menu.onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={menu.open}
          aria-haspopup="dialog"
          className={cn(
            'inline-flex h-10 min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            active
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border bg-card text-foreground hover:bg-muted/60',
            triggerClassName
          )}
        >
          <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden />
          <span>Filters</span>
          {activeCount > 0 ? (
            <span
              className={cn(
                'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                active ? 'bg-primary-strong text-primary-foreground' : 'bg-muted text-foreground'
              )}
            >
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-150',
              menu.open && 'rotate-180'
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={12}
        className={cn('w-[min(calc(100vw-2rem),15.5rem)] overflow-visible p-0', className)}
      >
        {onClear && activeCount > 0 ? (
          <div className="border-border/60 flex items-center justify-end border-b px-2.5 py-1.5">
            <button
              type="button"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground text-[12px] font-semibold transition-colors"
            >
              Clear
            </button>
          </div>
        ) : null}
        <div className="divide-border/50 divide-y overflow-visible py-1">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
