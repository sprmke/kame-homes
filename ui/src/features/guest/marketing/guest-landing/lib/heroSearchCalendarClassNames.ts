import { cn } from '@/lib/utils';

/** Min search-bar width for two side-by-side months (2×19rem + gap + padding). */
export const HERO_SEARCH_TWO_MONTH_MIN_WIDTH = 680;

export const HERO_SEARCH_SINGLE_MONTH_PANEL_WIDTH = 400;

export function heroSearchWhenPanelWidth(calendarMonths: 1 | 2, rootWidth: number): number {
  if (rootWidth > 0 && rootWidth < 640) return rootWidth;
  return calendarMonths === 2
    ? HERO_SEARCH_TWO_MONTH_MIN_WIDTH
    : HERO_SEARCH_SINGLE_MONTH_PANEL_WIDTH;
}

/** Downgrade to one month when the bar cannot fit two calendars comfortably. */
export function heroSearchCalendarMonthCount(
  preferredMonths: number,
  availableWidth: number,
  morphProgress = 0
): 1 | 2 {
  if (preferredMonths < 2) return 1;
  if (availableWidth <= 0) {
    return morphProgress > 0.38 ? 1 : 2;
  }
  return availableWidth >= HERO_SEARCH_TWO_MONTH_MIN_WIDTH ? 2 : 1;
}

const navButtonClass = cn(
  'inline-flex size-9 shrink-0 items-center justify-center rounded-full p-0',
  'border-border bg-card text-muted-foreground border',
  'hover:bg-muted transition-colors'
);

const sharedDayClassNames = {
  month_grid: 'col-span-3 row-start-2 w-full border-collapse',
  weekdays: 'grid grid-cols-7',
  weekday:
    'text-muted-foreground py-1 text-center text-[11px] font-semibold uppercase tracking-wider',
  week: 'mt-1 grid grid-cols-7',
  day: cn(
    'relative flex items-center justify-center p-0 text-center text-sm font-medium',
    '[&:has([aria-selected].day-range-end)]:rounded-r-full',
    '[&:has([aria-selected])]:bg-primary/10',
    'first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full',
    'focus-within:relative focus-within:z-20'
  ),
  day_button: cn(
    'inline-flex size-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-full p-0 text-sm font-medium',
    'text-foreground hover:bg-muted transition-colors aria-selected:opacity-100'
  ),
  range_start: 'day-range-start',
  range_end: 'day-range-end',
  selected: cn(
    '[&_button]:bg-primary [&_button]:text-primary-foreground',
    '[&_button:hover]:bg-primary [&_button:hover]:text-primary-foreground'
  ),
  today: 'font-bold [&_button]:ring-2 [&_button]:ring-primary/30',
  outside: 'day-outside text-muted-foreground/40',
  disabled: 'text-muted-foreground/30 opacity-40 pointer-events-none',
  range_middle: 'aria-selected:bg-primary/15 aria-selected:text-foreground',
  hidden: 'invisible',
};

/**
 * RDP `navLayout="around"`: prev / caption / next are siblings inside each `.rdp-month`.
 * Use a 3-column grid so the label stays centered with arrows on the same row.
 */
const monthHeaderGridClassNames = {
  month: cn('grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-1 gap-y-2'),
  month_caption: 'col-start-2 row-start-1 flex items-center justify-center',
  caption_label: 'text-foreground text-sm font-semibold',
  nav: 'hidden',
  button_previous: cn(navButtonClass, 'col-start-1 row-start-1'),
  button_next: cn(navButtonClass, 'col-start-3 row-start-1'),
};

/** Class map for hero search — pass `1` or `2` for single vs dual month layout. */
export function heroSearchCalendarClassNames(monthCount: 1 | 2) {
  const base = {
    ...sharedDayClassNames,
    ...monthHeaderGridClassNames,
  };

  if (monthCount === 2) {
    return {
      ...base,
      months: 'flex w-max max-w-none flex-nowrap items-start gap-6',
      month: cn(base.month, 'w-[18.5rem] shrink-0'),
    };
  }

  return {
    ...base,
    months: 'flex w-max max-w-none flex-col',
    month: cn(base.month, 'w-[22.5rem] shrink-0'),
  };
}

/** @deprecated Use `heroSearchCalendarClassNames(1)` */
export const HERO_SEARCH_CALENDAR_CLASSNAMES = heroSearchCalendarClassNames(1);

/** @deprecated Use `heroSearchCalendarClassNames(2)` */
export const HERO_SEARCH_CALENDAR_TWO_MONTHS = heroSearchCalendarClassNames(2);
