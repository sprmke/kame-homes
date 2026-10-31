import { useEffect, useRef, useState } from 'react';

import { ChevronDown, Search, X } from 'lucide-react';

import {
  AdminListDesktopToolbar,
  AdminListPerPageSelect,
} from '@/features/dashboard/bookings/components/AdminListToolbar';
import { BookingsSortMenu } from '@/features/dashboard/bookings/components/BookingsSortMenu';
import {
  BookingViewMenu,
  BookingViewToggle,
  type BookingView,
} from '@/features/dashboard/bookings/components/BookingViewToggle';
import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import {
  bookingsStatusFilterRows,
  statusLabel,
  type BookingStatus,
} from '@/features/dashboard/bookings/lib/bookingStatus';
import type {
  BookingsQuery,
  BookingsSort,
  BookingKind,
} from '@/features/dashboard/bookings/lib/types';

import {
  AdminListRefineSection,
  AdminListRefineSheet,
  AdminMobileSearchFilterRow,
} from '@/components/mobile/AdminListRefineSheet';
import { AdminListRefinePopover } from '@/components/navigation/AdminListRefinePopover';
import { useClaimToolbarMenu } from '@/components/navigation/AdminToolbarMenuScope';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroupDisplay } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

type Props = {
  query: BookingsQuery;
  onChange: (patch: Partial<BookingsQuery>) => void;
  onReset: () => void;
  sort: BookingsSort;
  onSortChange: (sort: BookingsSort) => void;
  view: BookingView;
  onViewChange: (view: BookingView) => void;
  hideTableView?: boolean;
  showPerPage?: boolean;
  /** Hide pets / parking toggles (parking slot admin). */
  hideGuestStayFilters?: boolean;
  /** Org list: filter property vs parking rows. */
  showBookingKindFilter?: boolean;
  hideKanbanView?: boolean;
  searchPlaceholder?: string;
  /** Extra plain status rows appended after the property enum (e.g. parking-only statuses). */
  extraStatuses?: readonly string[];
};

export function BookingFilters({
  query,
  onChange,
  onReset,
  sort,
  onSortChange,
  view,
  onViewChange,
  hideTableView = false,
  showPerPage = true,
  hideGuestStayFilters = false,
  showBookingKindFilter = false,
  hideKanbanView = false,
  searchPlaceholder = 'Search guests, email, phone, plate, pet…',
  extraStatuses,
}: Props) {
  const [draft, setDraft] = useState(query.q);
  const [refineOpen, setRefineOpen] = useState(false);
  const [desktopRefineOpen, setDesktopRefineOpen] = useState(false);
  const firstMount = useRef(true);

  useEffect(() => {
    setDraft(query.q);
  }, [query.q]);

  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (draft !== query.q) onChange({ q: draft, page: 1 });
    }, 280);
    return () => clearTimeout(t);
  }, [draft, query.q, onChange]);

  const activeStatuses = new Set(query.status);
  const toggleStatus = (v: string) => {
    const next = new Set(activeStatuses);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange({ status: Array.from(next), page: 1 });
  };

  const moreFiltersCount =
    (showBookingKindFilter && query.bookingKind ? 1 : 0) +
    (hideGuestStayFilters
      ? 0
      : (query.hasPets !== null ? 1 : 0) + (query.needParking !== null ? 1 : 0));

  const mobileRefineCount = query.status.length + moreFiltersCount;
  const showMoreFilters = !hideGuestStayFilters || showBookingKindFilter;

  const searchField = (
    <BookingsSearchField value={draft} onChange={setDraft} placeholder={searchPlaceholder} />
  );

  const statusList = (
    <>
      {bookingsStatusFilterRows(extraStatuses).map((row) =>
        row.type === 'group' ? (
          <PendingDocumentsStatusGroup
            key={row.parent}
            parent={row.parent}
            children={row.children}
            activeStatuses={activeStatuses}
            onToggle={toggleStatus}
          />
        ) : (
          <StatusFilterOption
            key={row.value}
            value={row.value}
            isChecked={activeStatuses.has(row.value)}
            onToggle={() => toggleStatus(row.value)}
          />
        )
      )}
    </>
  );

  const moreFilterBody =
    hideGuestStayFilters && !showBookingKindFilter ? null : (
      <>
        {showBookingKindFilter ? (
          <KindOptions
            value={query.bookingKind}
            onChange={(v) => onChange({ bookingKind: v, page: 1 })}
          />
        ) : null}
        {!hideGuestStayFilters ? (
          <>
            <TriOptions
              label="Has pets"
              value={query.hasPets}
              options={[
                { label: 'Any', value: null },
                { label: 'With pets', value: true },
                { label: 'No pets', value: false },
              ]}
              onChange={(v) => onChange({ hasPets: v, page: 1 })}
            />
            <TriOptions
              label="Needs parking"
              value={query.needParking}
              options={[
                { label: 'Any', value: null },
                { label: 'Needs parking', value: true },
                { label: 'No parking needed', value: false },
              ]}
              onChange={(v) => onChange({ needParking: v, page: 1 })}
            />
          </>
        ) : null}
      </>
    );

  const mobileRefineBody = (
    <>
      <AdminListRefineSection title="Status">
        <div className="border-border/60 overflow-hidden rounded-xl border">{statusList}</div>
      </AdminListRefineSection>
      {moreFilterBody ? (
        <AdminListRefineSection title="More">{moreFilterBody}</AdminListRefineSection>
      ) : null}
      <AdminListRefineSection title="Sort">
        <BookingsSortMenu sort={sort} onChange={onSortChange} fullWidth />
      </AdminListRefineSection>
      {showPerPage ? (
        <AdminListRefineSection title="Per page">
          <AdminListPerPageSelect
            limit={query.limit}
            onChange={(limit) => onChange({ limit, page: 1 })}
          />
        </AdminListRefineSection>
      ) : null}
    </>
  );

  const clearAllRefine = () => {
    onReset();
    setDraft('');
  };

  const clearMoreFilters = () => {
    onChange({
      bookingKind: null,
      hasPets: null,
      needParking: null,
      page: 1,
    });
  };

  return (
    <>
      <div className="space-y-2.5 lg:hidden">
        <AdminMobileSearchFilterRow
          search={searchField}
          filterCount={mobileRefineCount}
          filtersOpen={refineOpen}
          onFiltersOpenChange={setRefineOpen}
          filterAriaLabel="Refine bookings"
        />
        <BookingViewToggle
          value={view}
          onChange={onViewChange}
          hideTableView={hideTableView}
          hideKanbanView={hideKanbanView}
        />
        <AdminListRefineSheet
          open={refineOpen}
          onOpenChange={setRefineOpen}
          title="Refine"
          activeCount={mobileRefineCount}
          onClear={clearAllRefine}
        >
          {mobileRefineBody}
        </AdminListRefineSheet>
      </div>

      <AdminListDesktopToolbar
        aria-label="Booking filters"
        search={searchField}
        leading={
          <BookingStatusToolbarMenu
            statusCount={query.status.length}
            statusList={statusList}
            onClear={() => onChange({ status: [], page: 1 })}
          />
        }
        refine={
          showMoreFilters ? (
            <AdminListRefinePopover
              open={desktopRefineOpen}
              onOpenChange={setDesktopRefineOpen}
              activeCount={moreFiltersCount}
              onClear={clearMoreFilters}
              aria-label="More booking filters"
            >
              {moreFilterBody}
            </AdminListRefinePopover>
          ) : undefined
        }
        sort={<BookingsSortMenu sort={sort} onChange={onSortChange} />}
        perPage={
          showPerPage ? (
            <AdminListPerPageSelect
              limit={query.limit}
              onChange={(limit) => onChange({ limit, page: 1 })}
            />
          ) : undefined
        }
        view={
          <BookingViewMenu
            value={view}
            onChange={onViewChange}
            hideTableView={hideTableView}
            hideKanbanView={hideKanbanView}
          />
        }
      />
    </>
  );
}

function BookingStatusToolbarMenu({
  statusCount,
  statusList,
  onClear,
}: {
  statusCount: number;
  statusList: React.ReactNode;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menu = useClaimToolbarMenu(open, setOpen);
  const active = statusCount > 0 || menu.open;

  return (
    <Popover open={menu.open} onOpenChange={menu.onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter by status"
          aria-expanded={menu.open}
          aria-haspopup="dialog"
          className={cn(
            'inline-flex h-10 min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            active
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border bg-card text-foreground hover:bg-muted/60'
          )}
        >
          <span>Status</span>
          {statusCount > 0 ? (
            <span className="bg-primary-strong text-primary-foreground inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums">
              {statusCount > 9 ? '9+' : statusCount}
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
        className="w-[min(calc(100vw-2rem),17.5rem)] overflow-hidden p-0"
      >
        {statusCount > 0 ? (
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
        <div className="max-h-[min(55vh,20rem)] overflow-y-auto overflow-x-hidden overscroll-contain py-1">
          {statusList}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BookingsSearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn('relative w-full min-w-0', className)}>
      <Search
        className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        type="search"
        role="searchbox"
        inputMode="search"
        enterKeyHint="search"
        placeholder={placeholder}
        aria-label="Search bookings"
        className={cn(
          'border-border bg-card text-foreground field-focus h-11 min-h-[44px] w-full rounded-2xl border py-2 pl-10 text-[13px]',
          'sm:h-10 sm:rounded-xl sm:pl-10 sm:text-[13px]',
          'lg:h-10 lg:min-h-[44px] lg:rounded-lg lg:text-sm',
          value ? 'pr-11' : 'pr-3.5',
          'placeholder:text-muted-foreground placeholder:text-[13px] lg:placeholder:text-sm'
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-xl"
          aria-label="Clear search"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function KindOptions({
  value,
  onChange,
}: {
  value: BookingKind | null;
  onChange: (v: BookingKind | null) => void;
}) {
  const options: { label: string; value: BookingKind | null }[] = [
    { label: 'All types', value: null },
    { label: 'Property stays', value: 'property' },
    { label: 'Parking', value: 'parking' },
  ];
  return (
    <>
      <div className="border-separator border-b px-3.5 py-2 lg:border-0 lg:px-2.5 lg:pb-0.5 lg:pt-2">
        <span className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
          Booking type
        </span>
      </div>
      <div className="py-0.5 lg:pb-1.5">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors lg:px-2.5 lg:py-1.5',
              opt.value === value ? 'bg-muted/60' : 'hover:bg-muted/40'
            )}
          >
            <span className="text-[13px] font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function TriOptions({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: boolean | null;
  options: { label: string; value: boolean | null }[];
  onChange: (v: boolean | null) => void;
}) {
  return (
    <>
      <div className="border-separator border-b px-3.5 py-2 lg:border-0 lg:px-2.5 lg:pb-0.5 lg:pt-2">
        <span className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="py-0.5 lg:pb-1.5">
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors lg:gap-2 lg:px-2.5 lg:py-1.5',
                isSelected ? 'bg-muted/50' : 'hover:bg-muted/50'
              )}
            >
              <RadioGroupDisplay checked={isSelected} />
              <span
                className={cn(
                  'text-[13px]',
                  isSelected ? 'text-foreground font-semibold' : 'text-foreground/75 font-medium'
                )}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function StatusFilterOption({
  value,
  isChecked,
  onToggle,
  nested = false,
  indeterminate = false,
}: {
  value: string;
  isChecked: boolean;
  onToggle: () => void;
  nested?: boolean;
  indeterminate?: boolean;
}) {
  return (
    <label
      className={cn(
        'hover:bg-muted/50 flex min-h-[44px] min-w-0 cursor-pointer items-center gap-2.5 px-3.5 py-2.5 transition-colors',
        'lg:min-h-0 lg:gap-2 lg:px-2.5 lg:py-1.5',
        // Group already indents with border-l; keep a light inset only.
        nested && 'pl-3 lg:pl-2.5'
      )}
    >
      <Checkbox
        checked={indeterminate ? 'indeterminate' : isChecked}
        onCheckedChange={onToggle}
        aria-label={statusLabel(value)}
        className="shrink-0"
      />
      <StatusBadge
        status={value}
        className="min-w-0 max-w-full whitespace-normal [&>span:last-child]:overflow-visible [&>span:last-child]:whitespace-normal"
      />
    </label>
  );
}

function PendingDocumentsStatusGroup({
  parent,
  children: subStatuses,
  activeStatuses,
  onToggle,
}: {
  parent: 'PENDING_DOCUMENTS';
  children: readonly BookingStatus[];
  activeStatuses: Set<string>;
  onToggle: (value: string) => void;
}) {
  const parentChecked = activeStatuses.has(parent);
  const checkedChildCount = subStatuses.filter((s) => activeStatuses.has(s)).length;
  const allChildrenChecked = checkedChildCount === subStatuses.length;
  const parentIndeterminate =
    (parentChecked && !allChildrenChecked) || (!parentChecked && checkedChildCount > 0);

  return (
    <div className="py-0.5">
      <StatusFilterOption
        value={parent}
        isChecked={parentChecked}
        indeterminate={parentIndeterminate}
        onToggle={() => onToggle(parent)}
      />
      <div
        className="ml-3.5 mr-1 border-l border-amber-200/80 pl-1.5 lg:ml-3 dark:border-amber-500/40"
        role="group"
        aria-label="Pending Documents sub-stages"
      >
        {subStatuses.map((value) => (
          <StatusFilterOption
            key={value}
            value={value}
            isChecked={activeStatuses.has(value)}
            onToggle={() => onToggle(value)}
            nested
          />
        ))}
      </div>
    </div>
  );
}
