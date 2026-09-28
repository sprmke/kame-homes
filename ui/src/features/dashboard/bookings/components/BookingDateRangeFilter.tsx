import { useEffect, useRef, useState } from 'react';

import {
  CalendarDays,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { ButtonGroup, ButtonGroupItem } from '@/components/ui/button-group';
import { Calendar } from '@/components/ui/calendar';
import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';
import { useIsBelowLg, useIsBelowMd } from '@/hooks/useMediaQuery';
import {
  type DateNavigationState,
  type DatePreset,
  formatDateRangeDisplay,
  isCurrentPeriod,
} from '@/lib/date/navigation';
import { cn } from '@/lib/utils';

import type { DateRange as DayPickerDateRange } from 'react-day-picker';

type Props = DateNavigationState & {
  /** Whether a date range is currently applied to the booking query. */
  isActive: boolean;
  /** Clear the date filter (sets `from`/`to` to null in URL state). */
  onClear: () => void;
  /** Stretch trigger across available width (mobile filter card). */
  fullWidth?: boolean;
};

const PRESET_OPTIONS: {
  value: DatePreset;
  label: string;
  description: string;
}[] = [
  { value: 'week', label: 'Week', description: 'This week (Sun-Sat)' },
  { value: 'month', label: 'Month', description: 'This calendar month' },
  { value: 'year', label: 'Year', description: 'This calendar year' },
  { value: 'custom', label: 'Custom range', description: 'Pick any range' },
];

/**
 * Date range filter — presets + ←/→ navigation + custom calendar.
 * On `max-lg`, presets and custom calendar open as bottom sheets (native app pattern).
 * Desktop keeps compact anchored popovers.
 */
export function BookingDateRangeFilter({
  dateRange,
  datePreset,
  setDatePreset,
  setDateRange,
  navigatePeriod,
  goToToday,
  isActive,
  onClear,
  fullWidth = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [localRange, setLocalRange] = useState<DayPickerDateRange | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobileLayout = useIsBelowLg();
  const isBelowMd = useIsBelowMd();
  const compactChrome = useDashboardCompactChrome();

  const isCurrent = isCurrentPeriod(dateRange.from, datePreset);
  const popoverAlign = fullWidth ? 'start' : 'end';
  const calendarMonths = fullWidth && !isBelowMd && !isMobileLayout ? 2 : 1;
  const canNavigate = datePreset !== 'custom' && isActive;
  const isCustomMode = datePreset === 'custom';

  useEffect(() => {
    if (calendarOpen) {
      setLocalRange({ from: dateRange.from, to: dateRange.to });
    }
  }, [calendarOpen, dateRange.from, dateRange.to]);

  useEffect(() => {
    if (isMobileLayout) return;
    if (!open && !calendarOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCalendarOpen(false);
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 80);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, calendarOpen, isMobileLayout]);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === 'custom') {
      setOpen(false);
      setCalendarOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleApplyRange = () => {
    if (localRange?.from && localRange?.to) {
      setDateRange({ from: localRange.from, to: localRange.to });
      setCalendarOpen(false);
    }
  };

  const triggerLabel = isActive
    ? formatDateRangeDisplay(dateRange.from, dateRange.to, datePreset, {
        compact: compactChrome,
      })
    : 'Date';

  const triggerActive = isActive || open || calendarOpen;
  const showNav = canNavigate;
  const controlSize = isMobileLayout ? 'compact' : 'default';

  const desktopPresetList = (
    <div className="py-1">
      {PRESET_OPTIONS.map((opt) => {
        const isSelected = opt.value === datePreset && isActive;
        const Icon = opt.value === 'custom' ? CalendarDays : CalendarIcon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handlePresetChange(opt.value)}
            className={cn(
              'flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors',
              isSelected ? 'bg-muted/50' : 'hover:bg-muted/50'
            )}
          >
            <Icon
              className={cn(
                'size-3.5 shrink-0',
                isSelected ? 'text-sidebar-primary' : 'text-muted-foreground'
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-[13px] leading-tight',
                  isSelected ? 'text-foreground font-semibold' : 'text-foreground/75 font-medium'
                )}
              >
                {opt.label}
              </p>
              <p className="text-muted-foreground mt-[2px] text-[11px] leading-tight">
                {opt.description}
              </p>
            </div>
            {isSelected ? (
              <Check className="text-sidebar-primary ml-auto size-3.5 shrink-0" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );

  const mobilePresetList = (
    <div role="listbox" aria-label="View by">
      {PRESET_OPTIONS.map((opt) => {
        const isSelected = opt.value === datePreset && isActive;
        const Icon = opt.value === 'custom' ? CalendarDays : CalendarIcon;
        return (
          <MobileChoiceItem
            key={opt.value}
            selected={isSelected}
            label={opt.label}
            description={opt.description}
            icon={
              <Icon
                className={cn('size-5', isSelected ? 'text-primary' : 'text-muted-foreground')}
                aria-hidden
              />
            }
            onSelect={() => handlePresetChange(opt.value)}
          />
        );
      })}
    </div>
  );

  const calendarBody = (
    <>
      <div
        className={cn('flex justify-center p-2 sm:p-3', calendarMonths === 2 && 'overflow-x-auto')}
      >
        <Calendar
          mode="range"
          navLayout="around"
          defaultMonth={dateRange.from}
          selected={localRange}
          onSelect={setLocalRange}
          numberOfMonths={calendarMonths}
          weekStartsOn={0}
          className="admin-date-range-calendar"
          classNames={calendarMonths === 2 ? CALENDAR_CLASSNAMES_TWO_MONTHS : CALENDAR_CLASSNAMES}
        />
      </div>
      <div
        className={cn(
          'border-separator flex items-center justify-end gap-2 border-t px-3.5 py-2.5',
          isMobileLayout && 'gap-2 px-4 pb-1 pt-3'
        )}
      >
        {isMobileLayout ? (
          <button
            type="button"
            onClick={() => {
              setDatePreset('month');
              setCalendarOpen(false);
            }}
            className={cn(
              'bg-card text-sidebar-muted border-sidebar-border inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border px-3 py-1.5 text-sm font-semibold',
              'hover:border-sidebar-primary/40 hover:bg-sidebar-accent/50 transition-all duration-100'
            )}
          >
            Presets
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleApplyRange}
          disabled={!localRange?.from || !localRange?.to}
          className={cn(
            'bg-primary text-primary-foreground inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-1.5 text-[12px] font-semibold shadow-sm transition-all duration-100',
            'disabled:pointer-events-none disabled:opacity-40',
            'hover:brightness-[1.03] active:scale-[0.98]',
            isMobileLayout && 'min-h-12 flex-1 rounded-xl text-sm'
          )}
        >
          Apply
        </button>
      </div>
    </>
  );

  const triggerButton = (
    <ButtonGroupItem
      size={controlSize}
      type="button"
      position={showNav ? 'middle' : 'only'}
      active={triggerActive}
      onClick={() => (isCustomMode && isActive ? setCalendarOpen((v) => !v) : setOpen((v) => !v))}
      aria-expanded={open || calendarOpen}
      aria-haspopup="dialog"
      title={
        compactChrome && isActive
          ? formatDateRangeDisplay(dateRange.from, dateRange.to, datePreset)
          : undefined
      }
      className={cn(
        'select-none whitespace-nowrap',
        compactChrome ? 'gap-1' : 'gap-1.5',
        showNav && fullWidth && 'w-full justify-center',
        !showNav && fullWidth && 'w-full justify-center'
      )}
    >
      {compactChrome ? null : (
        <CalendarDays
          className={cn(
            'size-3.5 shrink-0',
            triggerActive ? 'text-foreground' : 'text-muted-foreground'
          )}
          aria-hidden
        />
      )}
      <span
        className={cn(
          'truncate',
          compactChrome
            ? fullWidth
              ? 'max-w-[min(100%,11rem)]'
              : 'max-w-[11rem]'
            : fullWidth
              ? 'max-w-[min(100%,14rem)]'
              : 'max-w-[180px]'
        )}
      >
        {triggerLabel}
      </span>
      <ChevronDown
        className={cn(
          'size-3.5 shrink-0 transition-transform duration-150',
          (open || calendarOpen) && 'rotate-180'
        )}
        aria-hidden
      />
    </ButtonGroupItem>
  );

  return (
    <div ref={containerRef} className={cn('relative min-w-0', fullWidth ? 'w-full' : 'shrink-0')}>
      <ButtonGroup fullWidth={fullWidth}>
        {showNav ? (
          <ButtonGroupItem
            size={controlSize}
            type="button"
            position="first"
            onClick={() => navigatePeriod('prev')}
            aria-label="Previous period"
            className="text-muted-foreground hover:text-accent-foreground"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
          </ButtonGroupItem>
        ) : null}

        {triggerButton}

        {showNav ? (
          <ButtonGroupItem
            size={controlSize}
            type="button"
            position="last"
            onClick={() => navigatePeriod('next')}
            aria-label="Next period"
            className="text-muted-foreground hover:text-accent-foreground"
          >
            <ChevronRight className="size-3.5" aria-hidden />
          </ButtonGroupItem>
        ) : null}
      </ButtonGroup>

      {isMobileLayout ? (
        <>
          <MobileChoiceSheet
            open={open}
            onOpenChange={setOpen}
            title="View by"
            footer={
              isActive ? (
                <div className="flex gap-2">
                  {!isCurrent && datePreset !== 'custom' ? (
                    <button
                      type="button"
                      onClick={() => {
                        goToToday();
                        setOpen(false);
                      }}
                      className="border-border bg-card text-foreground flex min-h-[48px] flex-1 items-center justify-center rounded-xl border text-sm font-semibold"
                    >
                      Today
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      onClear();
                      setOpen(false);
                    }}
                    className="text-muted-foreground hover:text-foreground flex min-h-[48px] flex-1 items-center justify-center rounded-xl text-sm font-semibold"
                  >
                    Clear
                  </button>
                </div>
              ) : null
            }
          >
            {mobilePresetList}
          </MobileChoiceSheet>

          <MobileChoiceSheet
            open={calendarOpen}
            onOpenChange={setCalendarOpen}
            title="Select dates"
          >
            {calendarBody}
          </MobileChoiceSheet>
        </>
      ) : (
        <>
          {open ? (
            <div
              className={cn(
                'border-border/50 dark:border-border/20 bg-popover shadow-elevated-lg absolute top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border',
                'max-w-[calc(100vw-24px)]',
                popoverAlign === 'end' ? 'right-0' : 'left-0'
              )}
            >
              <div className="border-separator flex items-center justify-between border-b px-3.5 py-2.5">
                <span className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                  View by
                </span>
                {isActive && !isCurrent && datePreset !== 'custom' ? (
                  <button
                    type="button"
                    onClick={() => {
                      goToToday();
                      setOpen(false);
                    }}
                    className="text-sidebar-primary text-[12px] font-semibold transition-opacity hover:opacity-80"
                  >
                    Today
                  </button>
                ) : null}
              </div>
              {desktopPresetList}
              {isActive ? (
                <div className="border-separator flex justify-end border-t px-3.5 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClear();
                      setOpen(false);
                    }}
                    className="text-muted-foreground hover:text-foreground text-[12px] font-semibold transition-colors"
                  >
                    Clear date filter
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {calendarOpen ? (
            <div
              className={cn(
                'border-border/50 dark:border-border/20 bg-popover shadow-elevated-lg absolute top-full z-50 mt-1.5 rounded-xl border',
                'max-w-[calc(100vw-24px)]',
                popoverAlign === 'end' ? 'right-0' : 'left-0',
                calendarMonths === 2
                  ? 'w-[min(calc(100vw-24px),34rem)]'
                  : 'w-[min(calc(100vw-24px),18.5rem)]'
              )}
            >
              <div className="border-separator flex items-center justify-between gap-4 border-b px-3.5 py-2.5">
                <span className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                  Select date range
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDatePreset('month');
                    setCalendarOpen(false);
                  }}
                  className="text-muted-foreground hover:text-foreground text-[12px] font-semibold transition-colors"
                >
                  Back to presets
                </button>
              </div>
              {calendarBody}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Tailwind classes for `react-day-picker` v9 — centered month + primary range. */
const navButtonClass = cn(
  'inline-flex size-8 shrink-0 items-center justify-center rounded-full p-0',
  'border-sidebar-border bg-card text-muted-foreground border',
  'hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors duration-100'
);

const CALENDAR_CLASSNAMES = {
  months: 'flex w-full flex-col items-center',
  month: 'grid w-full max-w-[17.5rem] grid-cols-[auto_1fr_auto] items-center gap-x-1 gap-y-2',
  month_caption: 'col-start-2 row-start-1 flex items-center justify-center',
  caption_label: 'text-[13px] font-bold text-foreground',
  nav: 'hidden',
  button_previous: cn(navButtonClass, 'col-start-1 row-start-1'),
  button_next: cn(navButtonClass, 'col-start-3 row-start-1'),
  month_grid: 'col-span-3 row-start-2 w-full border-collapse',
  weekdays: 'grid grid-cols-7',
  weekday:
    'text-muted-foreground py-1 text-center text-[10px] font-semibold uppercase tracking-wider',
  week: 'mt-1 grid grid-cols-7',
  day: cn(
    'relative flex items-center justify-center p-0 text-center text-[12px] font-medium',
    '[&:has([aria-selected].day-range-end)]:rounded-r-md',
    '[&:has([aria-selected])]:bg-primary/10',
    'first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
    'focus-within:relative focus-within:z-20'
  ),
  day_button: cn(
    'inline-flex size-9 min-h-9 min-w-9 items-center justify-center rounded-md p-0 text-[12px] font-medium',
    'text-foreground hover:bg-muted transition-colors duration-100 aria-selected:opacity-100'
  ),
  range_start: 'day-range-start',
  range_end: 'day-range-end',
  selected: cn(
    '[&_button]:bg-primary [&_button]:text-primary-foreground',
    '[&_button:hover]:bg-primary [&_button:hover]:text-primary-foreground'
  ),
  today: 'font-bold [&_button]:ring-2 [&_button]:ring-primary/30',
  outside:
    'day-outside text-muted-foreground/50 aria-selected:bg-primary/10 aria-selected:text-muted-foreground',
  disabled: 'text-muted-foreground/50 opacity-50 pointer-events-none',
  range_middle: 'aria-selected:bg-primary/15 aria-selected:text-foreground',
  hidden: 'invisible',
};

const CALENDAR_CLASSNAMES_TWO_MONTHS = {
  ...CALENDAR_CLASSNAMES,
  months: 'flex w-max max-w-none flex-nowrap items-start gap-4',
  month: cn('grid grid-cols-[auto_1fr_auto] items-center gap-x-1 gap-y-2', 'w-[17.5rem] shrink-0'),
};
