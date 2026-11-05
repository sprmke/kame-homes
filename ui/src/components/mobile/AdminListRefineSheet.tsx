import type { ReactNode } from 'react';

import { SlidersHorizontal } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type FilterButtonProps = {
  count?: number;
  open?: boolean;
  onClick: () => void;
  className?: string;
  'aria-label'?: string;
};

/** Icon filter control for the compact mobile search row (badge when active). */
export function AdminMobileFilterButton({
  count = 0,
  open = false,
  onClick,
  className,
  'aria-label': ariaLabel = 'Refine list',
}: FilterButtonProps) {
  const active = count > 0 || open;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-haspopup="dialog"
      className={cn(
        'border-border relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
        'native-press min-h-[44px] min-w-[44px]',
        active
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground border-border',
        className
      )}
    >
      <SlidersHorizontal className="size-4" aria-hidden />
      {count > 0 ? (
        <span className="bg-primary-strong text-primary-foreground absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </button>
  );
}

type SearchFilterRowProps = {
  search: ReactNode;
  filterCount?: number;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  filterAriaLabel?: string;
  className?: string;
};

/** One-row mobile chrome: search + refine button. */
export function AdminMobileSearchFilterRow({
  search,
  filterCount = 0,
  filtersOpen,
  onFiltersOpenChange,
  filterAriaLabel,
  className,
}: SearchFilterRowProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="min-w-0 flex-1">{search}</div>
      <AdminMobileFilterButton
        count={filterCount}
        open={filtersOpen}
        onClick={() => onFiltersOpenChange(true)}
        aria-label={filterAriaLabel}
      />
    </div>
  );
}

type RefineSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  activeCount?: number;
  onClear?: () => void;
  children: ReactNode;
  className?: string;
};

/**
 * Bottom sheet for filters / sort / page size on mobile list pages.
 * Keeps the overlap toolbar to search + view by default (progressive disclosure).
 */
export function AdminListRefineSheet({
  open,
  onOpenChange,
  title = 'Refine',
  description = 'Filters, sort, and page size',
  activeCount = 0,
  onClear,
  children,
  className,
}: RefineSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" hideClose showHandle className={cn('gap-0 p-0', className)}>
        <SheetHeader className="border-border/60 flex-row items-center justify-between space-y-0 border-b px-4 pb-3 pt-1 text-left">
          <div className="min-w-0">
            <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
            <SheetDescription className="sr-only">{description}</SheetDescription>
          </div>
          {onClear && activeCount > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground min-h-[44px] shrink-0 px-2 text-sm font-semibold transition-colors"
            >
              Clear
            </button>
          ) : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>
        <div className="border-border/60 border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="bg-primary-strong text-primary-foreground native-press flex min-h-[48px] w-full items-center justify-center rounded-xl text-sm font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type RefineSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function AdminListRefineSection({ title, children, className }: RefineSectionProps) {
  return (
    <section className={cn('space-y-2', className)}>
      <h3 className="text-muted-foreground px-0.5 text-[11px] font-bold uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </section>
  );
}
