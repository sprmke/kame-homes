import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { isStaySort, nextStaySort } from '@/features/dashboard/bookings/lib/bookingsListSort';
import type { BookingsSort } from '@/features/dashboard/bookings/lib/types';

import { cn } from '@/lib/utils';

type Props = {
  sort: BookingsSort;
  onChange: (next: BookingsSort) => void;
  /** `header` = table column; `bar` = compact control above card grid */
  variant?: 'header' | 'bar';
  className?: string;
};

export function BookingStaySortControl({ sort, onChange, variant = 'header', className }: Props) {
  const active = isStaySort(sort);
  const direction = sort === 'check_in_date:desc' ? 'desc' : 'asc';

  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  const label = active
    ? direction === 'asc'
      ? 'Stay: earliest check-in first'
      : 'Stay: latest check-in first'
    : 'Sort by stay dates';

  if (variant === 'bar') {
    return (
      <button
        type="button"
        onClick={() => onChange(nextStaySort(sort))}
        aria-label={label}
        className={cn(
          'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold',
          'whitespace-nowrap border transition-all duration-100',
          active
            ? 'interactive-primary border-border'
            : 'border-border bg-card text-foreground hover:bg-muted/60',
          className
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        Stay
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onChange(nextStaySort(sort))}
      aria-label={label}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        '-my-2 inline-flex min-h-[44px] items-center gap-1 py-2',
        'text-[10px] font-bold uppercase tracking-[0.1em]',
        active ? 'text-sidebar-primary' : 'text-muted-foreground hover:text-muted-foreground',
        'transition-colors',
        className
      )}
    >
      Stay
      <Icon className="size-3 shrink-0" aria-hidden />
    </button>
  );
}
