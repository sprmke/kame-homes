import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  /** `inline` — compact chevrons for section headers; `centered` — Previous/Next row (location browse). */
  variant?: 'inline' | 'centered';
  /** Inline only — hide `{page} / {totalPages}` between chevrons. Default true. */
  showPageIndicator?: boolean;
  /** Inline only — smaller icon buttons for dense dashboard section headers. */
  compact?: boolean;
  /** Fired on hover / focus / touch of Previous or Next with the target page (prefetch). */
  onPageIntent?: (page: number) => void;
};

export function PublicListingPagination({
  page,
  totalPages,
  onPageChange,
  disabled,
  variant = 'centered',
  showPageIndicator = true,
  compact = false,
  onPageIntent,
}: Props) {
  if (totalPages <= 1) return null;

  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  const goPrevious = () => onPageChange(previousPage);
  const goNext = () => onPageChange(nextPage);
  const intentProps = (target: number) =>
    onPageIntent && target !== page
      ? {
          onMouseEnter: () => onPageIntent(target),
          onFocus: () => onPageIntent(target),
          onTouchStart: () => onPageIntent(target),
        }
      : {};

  if (variant === 'inline') {
    return (
      <nav aria-label="Listing pages" className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn('rounded-full', compact ? 'size-8' : 'min-h-[44px] min-w-[44px]')}
          disabled={page <= 1 || disabled}
          aria-label="Previous page"
          onClick={goPrevious}
        >
          <ChevronLeft className={compact ? 'size-3.5' : 'h-4 w-4'} aria-hidden />
        </Button>
        {showPageIndicator ? (
          <span className="text-muted-foreground min-w-[3.25rem] text-center text-sm tabular-nums">
            {page} / {totalPages}
          </span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn('rounded-full', compact ? 'size-8' : 'min-h-[44px] min-w-[44px]')}
          disabled={page >= totalPages || disabled}
          aria-label="Next page"
          onClick={goNext}
        >
          <ChevronRight className={compact ? 'size-3.5' : 'h-4 w-4'} aria-hidden />
        </Button>
      </nav>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px]"
        disabled={page <= 1 || disabled}
        onClick={goPrevious}
        {...intentProps(previousPage)}
      >
        Previous
      </Button>
      <span className="text-muted-foreground text-sm tabular-nums">
        {page} / {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px]"
        disabled={page >= totalPages || disabled}
        onClick={goNext}
        {...intentProps(nextPage)}
      >
        Next
      </Button>
    </div>
  );
}

type SectionHeaderProps = {
  title: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  withTopBorder?: boolean;
};

/** Section title (left) + inline pagination (right). */
export function PublicListingSectionHeader({
  title,
  page,
  totalPages,
  onPageChange,
  withTopBorder = true,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8',
        withTopBorder && 'border-border border-t pt-8 sm:pt-10'
      )}
    >
      <h2 className="text-foreground min-w-0 text-base font-bold sm:text-lg">{title}</h2>
      <PublicListingPagination
        variant="inline"
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
