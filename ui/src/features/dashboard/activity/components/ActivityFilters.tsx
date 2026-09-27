import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CalendarDays, ChevronDown, Search, X } from 'lucide-react';

import type { ActivityLogFilters } from '@/features/dashboard/activity/lib/activityApi';
import {
  ACTIVITY_FILTER_CATEGORIES,
  ACTIVITY_SEVERITY_META,
  activityCategoryLabel,
  type ActivityCategory,
  type ActivitySeverity,
} from '@/features/dashboard/activity/lib/activityCatalog';
import { activityRefineFilterCount } from '@/features/dashboard/activity/lib/activityFilterUtils';

import { AdminListDesktopToolbar } from '@/features/dashboard/bookings/components/AdminListToolbar';
import {
  AdminListRefineSection,
  AdminListRefineSheet,
  AdminMobileSearchFilterRow,
} from '@/components/mobile/AdminListRefineSheet';
import { AdminListRefinePopover } from '@/components/navigation/AdminListRefinePopover';
import { AdminMultiSelectFilter } from '@/components/navigation/AdminMultiSelectFilter';
import {
  AdminSingleSelectFilter,
  type AdminSingleSelectOption,
} from '@/components/navigation/AdminSingleSelectFilter';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { formatDateRangeFromDates, formatDateToYYYYMMDD, stringToDate } from '@/utils/format/dates';

import type { DateRange as DayPickerDateRange } from 'react-day-picker';

type SeverityFilterValue = 'all' | ActivitySeverity;

const SEVERITY_OPTIONS: AdminSingleSelectOption<SeverityFilterValue>[] = [
  { value: 'all', label: 'All' },
  ...(Object.keys(ACTIVITY_SEVERITY_META) as ActivitySeverity[]).map((value) => ({
    value,
    label: ACTIVITY_SEVERITY_META[value].label,
  })),
];

type Props = {
  filters: ActivityLogFilters;
  onChange: (next: ActivityLogFilters) => void;
  /** Desktop trailing action (e.g. Export CSV). */
  trailing?: ReactNode;
  /** Mobile trailing action next to the refine button. */
  mobileTrailing?: ReactNode;
  className?: string;
};

export function ActivityFilters({ filters, onChange, trailing, mobileTrailing, className }: Props) {
  const [searchDraft, setSearchDraft] = useState(filters.q ?? '');
  const [mobileRefineOpen, setMobileRefineOpen] = useState(false);
  const [desktopRefineOpen, setDesktopRefineOpen] = useState(false);
  const searchMount = useRef(true);

  const categoryOptions = useMemo(
    () =>
      ACTIVITY_FILTER_CATEGORIES.map((cat) => ({
        value: cat,
        label: activityCategoryLabel(cat),
      })),
    []
  );

  const selectedCategories = filters.category ?? [];
  const severityValue: SeverityFilterValue = filters.severity ?? 'all';
  const refineCount = activityRefineFilterCount(filters);

  useEffect(() => {
    if (searchMount.current) {
      searchMount.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const nextQ = searchDraft.trim() || null;
      if (nextQ !== (filters.q ?? null)) {
        onChange({ ...filters, q: nextQ });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters, onChange]);

  useEffect(() => {
    setSearchDraft(filters.q ?? '');
  }, [filters.q]);

  const clearRefine = () =>
    onChange({
      ...filters,
      category: [],
      severity: null,
      dateFrom: null,
      dateTo: null,
    });

  const searchField = <ActivitySearchField value={searchDraft} onChange={setSearchDraft} />;

  const refineBody = (
    <>
      <AdminListRefineSection title="Category">
        <AdminMultiSelectFilter
          options={categoryOptions}
          value={selectedCategories}
          onChange={(category) =>
            onChange({ ...filters, category: category as ActivityCategory[] })
          }
          emptyLabel="All categories"
          pluralUnit="categories"
          ariaLabel="Category"
          triggerWidthClassName="w-full"
          panelAlign="left"
          panelWidthClassName="w-full"
          panelScrollable
          toolbarExclusive={false}
        />
      </AdminListRefineSection>

      <AdminListRefineSection title="Severity">
        <AdminSingleSelectFilter
          options={SEVERITY_OPTIONS}
          value={severityValue}
          onChange={(next) =>
            onChange({
              ...filters,
              severity: next === 'all' ? null : next,
            })
          }
          ariaLabel="Severity"
          triggerWidthClassName="w-full"
          panelAlign="left"
          panelWidthClassName="w-full"
          toolbarExclusive={false}
        />
      </AdminListRefineSection>

      <AdminListRefineSection title="Date range">
        <ActivityDateRangeField
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChange={(patch) => onChange({ ...filters, ...patch })}
        />
      </AdminListRefineSection>
    </>
  );

  return (
    <div className={cn('space-y-2', className)}>
      <div className="lg:hidden">
        <div className="flex items-center gap-2">
          <AdminMobileSearchFilterRow
            className="min-w-0 flex-1"
            search={searchField}
            filterCount={refineCount}
            filtersOpen={mobileRefineOpen}
            onFiltersOpenChange={setMobileRefineOpen}
            filterAriaLabel="Refine activity"
          />
          {mobileTrailing}
        </div>
        <AdminListRefineSheet
          open={mobileRefineOpen}
          onOpenChange={setMobileRefineOpen}
          title="Refine"
          description="Activity filters"
          activeCount={refineCount}
          onClear={refineCount > 0 ? clearRefine : undefined}
        >
          {refineBody}
        </AdminListRefineSheet>
      </div>

      <AdminListDesktopToolbar
        aria-label="Activity filters"
        search={searchField}
        refine={
          <AdminListRefinePopover
            open={desktopRefineOpen}
            onOpenChange={setDesktopRefineOpen}
            activeCount={refineCount}
            onClear={refineCount > 0 ? clearRefine : undefined}
            aria-label="Activity filters"
            className="w-[min(calc(100vw-2rem),20.5rem)]"
          >
            <div className="flex w-full min-w-0 flex-col gap-3 px-2.5 py-1.5">{refineBody}</div>
          </AdminListRefinePopover>
        }
        trailing={trailing}
      />
    </div>
  );
}

function ActivitySearchField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('relative w-full min-w-0', className)}>
      <Search
        className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        type="search"
        placeholder="Search activity"
        className={cn(
          'border-border bg-card text-foreground field-focus h-10 min-h-[44px] w-full rounded-lg border py-2 pl-10 text-[13px]',
          'lg:text-sm',
          value ? 'pr-10' : 'pr-3',
          'placeholder:text-muted-foreground placeholder:text-[13px] lg:placeholder:text-sm'
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search activity"
      />
      {value ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground absolute right-0.5 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Single-field range picker (same calendar pattern as BookingDateRangeFilter custom mode). */
function ActivityDateRangeField({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom?: string | null;
  dateTo?: string | null;
  onChange: (patch: { dateFrom?: string | null; dateTo?: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const fromDate = ymdToDate(dateFrom);
  const toDate = ymdToDate(dateTo);
  const hasRange = Boolean(fromDate && toDate);
  const [localRange, setLocalRange] = useState<DayPickerDateRange | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const from = ymdToDate(dateFrom);
    const to = ymdToDate(dateTo);
    setLocalRange(from || to ? { from, to } : undefined);
  }, [open, dateFrom, dateTo]);

  const label = fromDate && toDate ? formatDateRangeFromDates(fromDate, toDate) : 'Any';

  const apply = () => {
    if (!localRange?.from || !localRange?.to) return;
    onChange({
      dateFrom: formatDateToYYYYMMDD(localRange.from),
      dateTo: formatDateToYYYYMMDD(localRange.to),
    });
    setOpen(false);
  };

  const clear = () => {
    onChange({ dateFrom: null, dateTo: null });
    setLocalRange(undefined);
    setOpen(false);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Date range"
        className={cn(
          'inline-flex h-10 min-h-[44px] w-full items-center justify-between gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors',
          open || hasRange
            ? 'border-primary/30 bg-primary/10 text-primary'
            : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/60'
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 transition-transform duration-150',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-border/60 bg-card overflow-hidden rounded-xl border">
          <div className="flex justify-center px-1.5 pb-1 pt-2">
            <Calendar
              mode="range"
              navLayout="around"
              defaultMonth={fromDate ?? toDate}
              selected={localRange}
              onSelect={setLocalRange}
              numberOfMonths={1}
              weekStartsOn={0}
              className="admin-date-range-calendar"
              classNames={RANGE_CALENDAR_CLASSNAMES}
            />
          </div>
          <div className="border-border/60 flex items-center justify-end gap-2 border-t px-2.5 py-2">
            {hasRange || localRange?.from ? (
              <button
                type="button"
                onClick={clear}
                className="text-muted-foreground hover:text-foreground px-2 text-[12px] font-semibold transition-colors"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={apply}
              disabled={!localRange?.from || !localRange?.to}
              className={cn(
                'bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-[12px] font-semibold transition-opacity',
                'disabled:pointer-events-none disabled:opacity-40'
              )}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ymdToDate(ymd: string | null | undefined): Date | undefined {
  if (!ymd?.trim()) return undefined;
  try {
    const date = stringToDate(ymd.slice(0, 10));
    return Number.isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
}

/** Square day cells sized to a fixed month width (matches bookings range calendar). */
const navButtonClass = cn(
  'inline-flex size-8 shrink-0 items-center justify-center rounded-full p-0',
  'border-sidebar-border bg-card text-muted-foreground border',
  'hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors duration-100'
);

const RANGE_CALENDAR_CLASSNAMES = {
  months: 'flex w-[17.5rem] flex-col items-center',
  month: 'grid w-[17.5rem] grid-cols-[auto_1fr_auto] items-center gap-x-1 gap-y-2',
  month_caption: 'col-start-2 row-start-1 flex items-center justify-center',
  caption_label: 'text-[13px] font-bold text-foreground',
  nav: 'hidden',
  button_previous: cn(navButtonClass, 'col-start-1 row-start-1'),
  button_next: cn(navButtonClass, 'col-start-3 row-start-1'),
  month_grid: 'col-span-3 row-start-2 w-full border-collapse',
  weekdays: 'grid w-full grid-cols-7',
  weekday:
    'text-muted-foreground flex h-8 items-center justify-center text-center text-[10px] font-semibold uppercase tracking-wider',
  week: 'grid w-full grid-cols-7',
  day: cn(
    'relative aspect-square p-0.5 text-center text-[12px] font-medium',
    '[&:has([aria-selected].day-range-end)]:rounded-r-md',
    '[&:has([aria-selected])]:bg-primary/10',
    'first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
    'focus-within:relative focus-within:z-20'
  ),
  day_button: cn(
    'inline-flex aspect-square size-full items-center justify-center rounded-md p-0 text-[12px] font-medium',
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
