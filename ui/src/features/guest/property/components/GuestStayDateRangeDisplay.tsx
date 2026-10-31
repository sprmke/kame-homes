import { differenceInDays, format } from 'date-fns';
import { ArrowRight, CalendarRange, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDateRangeFromDates } from '@/utils/format/dates';

export type GuestStayDateRangeDisplayProps = {
  checkIn: Date;
  checkOut?: Date | null;
  checkInDetail?: string | null;
  checkOutDetail?: string | null;
  onClear?: () => void;
  /** Property-detail calendar uses a green accent when dates are custom-picked. */
  tone?: 'brand' | 'success';
  /** `constrained` centers at 75% on sm+ (header/context). `full` spans the parent width. */
  width?: 'constrained' | 'full';
  /**
   * `compact` — single meta row for chat chrome (all breakpoints).
   * `default` — labeled columns from `sm` up (form / calendar).
   */
  density?: 'default' | 'compact';
  className?: string;
};

function formatStayDate(date: Date, compact = false): string {
  return format(date, compact ? 'MMM d' : 'MMM d, yyyy');
}

/** Shared selected stay range — check-in/out columns, nights pill, optional clear. */
export function GuestStayDateRangeDisplay({
  checkIn,
  checkOut,
  checkInDetail,
  checkOutDetail,
  onClear,
  tone = 'brand',
  width = 'constrained',
  density = 'default',
  className,
}: GuestStayDateRangeDisplayProps) {
  const nights = checkOut && checkOut > checkIn ? differenceInDays(checkOut, checkIn) : 0;
  const isSuccess = tone === 'success';
  const isCompact = density === 'compact';

  const accentText = isSuccess ? 'text-emerald-600' : 'text-primary';
  const labelClass = cn(
    'mb-0.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide',
    isSuccess ? 'text-emerald-700/80 dark:text-emerald-400/90' : 'text-primary/80'
  );

  const nightsPillClass = cn(
    'inline-flex shrink-0 rounded-full font-semibold tabular-nums leading-none',
    isCompact
      ? 'px-2.5 py-1 text-[11px]'
      : 'px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-[11px]',
    isSuccess ? 'bg-emerald-600 text-white' : 'bg-primary-strong text-primary-foreground'
  );

  const shellClass = cn(
    'relative overflow-hidden border',
    width === 'full' ? 'w-full' : 'mx-auto w-full sm:w-3/4',
    isCompact
      ? 'border-border/80 bg-muted/40 rounded-xl'
      : cn(
          'rounded-xl sm:rounded-2xl',
          isSuccess
            ? 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.04] to-transparent'
            : 'border-primary/15 from-primary/[0.09] via-primary/[0.04] bg-gradient-to-br to-transparent'
        ),
    className
  );

  const ariaLabel =
    checkOut && checkOut > checkIn
      ? formatDateRangeFromDates(checkIn, checkOut)
      : `Check-in ${formatStayDate(checkIn, true)}`;

  const clearButton = onClear ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'min-h-[44px] min-w-[44px] shrink-0 p-0',
        isSuccess
          ? 'text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800'
          : 'text-muted-foreground hover:text-foreground'
      )}
      onClick={onClear}
      aria-label="Clear dates"
    >
      <X className="size-3.5" aria-hidden />
    </Button>
  ) : null;

  const compactRow = (
    <div
      className={cn(
        'flex items-center gap-2',
        isCompact ? 'min-h-11 px-3 py-2.5' : 'min-h-9 py-2 pl-3 pr-2 sm:hidden'
      )}
      aria-label={ariaLabel}
    >
      <CalendarRange
        className={cn('shrink-0', isCompact ? 'size-4' : 'size-3.5', accentText)}
        aria-hidden
      />
      <p
        className={cn(
          'text-foreground min-w-0 flex-1 truncate font-semibold leading-tight',
          isCompact ? 'text-sm' : 'text-[13px]'
        )}
      >
        {checkOut && checkOut > checkIn
          ? formatDateRangeFromDates(checkIn, checkOut)
          : formatStayDate(checkIn, true)}
      </p>
      {nights > 0 ? (
        <span className={nightsPillClass}>
          {nights} night{nights === 1 ? '' : 's'}
        </span>
      ) : null}
      {clearButton}
    </div>
  );

  if (isCompact) {
    return <div className={shellClass}>{compactRow}</div>;
  }

  return (
    <div className={shellClass}>
      {/* Mobile — one compact row */}
      {compactRow}

      {/* sm+ — labeled columns */}
      <div className="hidden items-center gap-2.5 px-3.5 py-2.5 sm:flex">
        <div
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-lg border',
            isSuccess
              ? 'border-emerald-500/20 bg-emerald-500/10'
              : 'border-primary/15 bg-primary/10'
          )}
        >
          <CalendarRange className={cn('size-4', accentText)} aria-hidden />
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2.5">
          <div className="min-w-0">
            <p className={labelClass}>Check-in</p>
            <p className="text-foreground truncate text-sm font-semibold leading-tight">
              {formatStayDate(checkIn)}
            </p>
            {checkInDetail ? (
              <p className="text-muted-foreground truncate text-xs">{checkInDetail}</p>
            ) : null}
          </div>

          <ArrowRight
            className={cn(
              'size-3.5 shrink-0',
              isSuccess ? 'text-emerald-600/50' : 'text-primary/45'
            )}
            aria-hidden
          />

          <div className="min-w-0">
            <p className={labelClass}>Check-out</p>
            {checkOut ? (
              <>
                <p className="text-foreground truncate text-sm font-semibold leading-tight">
                  {formatStayDate(checkOut)}
                </p>
                {checkOutDetail ? (
                  <p className="text-muted-foreground truncate text-xs">{checkOutDetail}</p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground text-sm font-medium">Select date</p>
            )}
          </div>
        </div>

        {nights > 0 ? (
          <span className={nightsPillClass}>
            {nights} night{nights === 1 ? '' : 's'}
          </span>
        ) : null}

        {onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'min-h-[44px] min-w-[44px] shrink-0',
              isSuccess
                ? 'text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={onClear}
            aria-label="Clear dates"
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
