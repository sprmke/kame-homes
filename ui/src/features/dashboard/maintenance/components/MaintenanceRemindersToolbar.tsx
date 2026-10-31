import { useEffect, useRef, useState } from 'react';

import { Search, X } from 'lucide-react';

import {
  AdminListDesktopToolbar,
  AdminListPerPageSelect,
} from '@/features/dashboard/bookings/components/AdminListToolbar';
import {
  AdminListViewMenuControl,
  AdminListViewToggle,
} from '@/features/dashboard/bookings/components/AdminListViewToggle';
import type { AdminListView } from '@/features/dashboard/bookings/lib/listView';
import { FinanceCategoryFilter } from '@/features/dashboard/finance/components/FinanceCategoryFilter';
import { MaintenanceRemindersSortMenu } from '@/features/dashboard/maintenance/components/MaintenanceRemindersSortMenu';
import { MaintenanceStatusFilter } from '@/features/dashboard/maintenance/components/MaintenanceStatusFilter';
import { MaintenanceTelegramFilter } from '@/features/dashboard/maintenance/components/MaintenanceTelegramFilter';
import type { MaintenanceQuery } from '@/features/dashboard/maintenance/lib/types';

import {
  AdminListRefineSection,
  AdminListRefineSheet,
  AdminMobileSearchFilterRow,
} from '@/components/mobile/AdminListRefineSheet';
import { AdminListRefinePopover } from '@/components/navigation/AdminListRefinePopover';
import { cn } from '@/lib/utils';

type Props = {
  query: MaintenanceQuery;
  categories: string[];
  onChange: (next: MaintenanceQuery) => void;
  hideTableView?: boolean;
  showPerPage?: boolean;
};

export function MaintenanceRemindersToolbar({
  query,
  categories,
  onChange,
  hideTableView = false,
  showPerPage = true,
}: Props) {
  const [searchDraft, setSearchDraft] = useState(query.q);
  const [refineOpen, setRefineOpen] = useState(false);
  const [desktopRefineOpen, setDesktopRefineOpen] = useState(false);
  const searchMount = useRef(true);

  const moreFilterCount = query.categoryFilter.length + (query.telegramFilter !== 'all' ? 1 : 0);
  const mobileRefineCount = query.statusFilter.length + moreFilterCount;

  useEffect(() => {
    if (searchMount.current) {
      searchMount.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      if (searchDraft !== query.q) {
        onChange({ ...query, page: 1, q: searchDraft });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft, query, onChange]);

  useEffect(() => {
    setSearchDraft(query.q);
  }, [query.q]);

  function resetAllFilters() {
    onChange({
      ...query,
      page: 1,
      statusFilter: [],
      categoryFilter: [],
      telegramFilter: 'all',
    });
  }

  function clearMoreFilters() {
    onChange({
      ...query,
      page: 1,
      categoryFilter: [],
      telegramFilter: 'all',
    });
  }

  const searchField = (
    <div className="relative w-full min-w-0">
      <Search
        className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        type="search"
        role="searchbox"
        inputMode="search"
        enterKeyHint="search"
        placeholder="Search reminders…"
        aria-label="Search reminders"
        className={cn(
          'border-border bg-card text-foreground field-focus h-11 min-h-[44px] w-full rounded-2xl border py-2.5 pl-11 text-[13px]',
          'lg:h-10 lg:min-h-[44px] lg:rounded-lg lg:pl-10 lg:text-sm',
          searchDraft ? 'pr-11' : 'pr-3',
          'placeholder:text-muted-foreground placeholder:text-[13px] lg:placeholder:text-sm'
        )}
        value={searchDraft}
        onChange={(e) => setSearchDraft(e.target.value)}
      />
      {searchDraft ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg"
          aria-label="Clear search"
          onClick={() => setSearchDraft('')}
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );

  const mobileRefineBody = (
    <>
      <AdminListRefineSection title="Filters">
        <div className="flex flex-col gap-2 [&_button]:w-full">
          <MaintenanceStatusFilter
            value={query.statusFilter}
            onChange={(statusFilter) => onChange({ ...query, page: 1, statusFilter })}
          />
          <FinanceCategoryFilter
            categories={categories}
            value={query.categoryFilter}
            onChange={(categoryFilter) => onChange({ ...query, page: 1, categoryFilter })}
          />
          <MaintenanceTelegramFilter
            value={query.telegramFilter}
            onChange={(telegramFilter) => onChange({ ...query, page: 1, telegramFilter })}
          />
        </div>
      </AdminListRefineSection>
      <AdminListRefineSection title="Sort">
        <MaintenanceRemindersSortMenu
          sort={query.sort}
          onChange={(sort) => onChange({ ...query, sort, page: 1 })}
        />
      </AdminListRefineSection>
      {showPerPage ? (
        <AdminListRefineSection title="Per page">
          <AdminListPerPageSelect
            limit={query.limit}
            onChange={(limit) => onChange({ ...query, limit, page: 1 })}
          />
        </AdminListRefineSection>
      ) : null}
    </>
  );

  return (
    <>
      <div className="space-y-2.5 lg:hidden">
        <AdminMobileSearchFilterRow
          search={searchField}
          filterCount={mobileRefineCount}
          filtersOpen={refineOpen}
          onFiltersOpenChange={setRefineOpen}
          filterAriaLabel="Refine reminders"
        />
        <AdminListViewToggle
          value={query.view}
          onChange={(view: AdminListView) => onChange({ ...query, view, page: 1 })}
          hideTableView={hideTableView}
          ariaLabel="Choose reminders view"
        />
        <AdminListRefineSheet
          open={refineOpen}
          onOpenChange={setRefineOpen}
          title="Refine"
          activeCount={mobileRefineCount}
          onClear={resetAllFilters}
        >
          {mobileRefineBody}
        </AdminListRefineSheet>
      </div>

      <AdminListDesktopToolbar
        aria-label="Reminder filters"
        search={searchField}
        leading={
          <MaintenanceStatusFilter
            value={query.statusFilter}
            onChange={(statusFilter) => onChange({ ...query, page: 1, statusFilter })}
          />
        }
        refine={
          <AdminListRefinePopover
            open={desktopRefineOpen}
            onOpenChange={setDesktopRefineOpen}
            activeCount={moreFilterCount}
            onClear={clearMoreFilters}
            aria-label="More reminder filters"
          >
            <div className="flex w-full min-w-0 flex-col gap-2 px-2 py-1.5">
              <FinanceCategoryFilter
                categories={categories}
                value={query.categoryFilter}
                onChange={(categoryFilter) => onChange({ ...query, page: 1, categoryFilter })}
                nestedInPopover
              />
              <MaintenanceTelegramFilter
                value={query.telegramFilter}
                onChange={(telegramFilter) => onChange({ ...query, page: 1, telegramFilter })}
                nestedInPopover
              />
            </div>
          </AdminListRefinePopover>
        }
        sort={
          <MaintenanceRemindersSortMenu
            sort={query.sort}
            onChange={(sort) => onChange({ ...query, sort, page: 1 })}
          />
        }
        perPage={
          showPerPage ? (
            <AdminListPerPageSelect
              limit={query.limit}
              onChange={(limit) => onChange({ ...query, limit, page: 1 })}
            />
          ) : undefined
        }
        view={
          <AdminListViewMenuControl
            value={query.view}
            onChange={(view: AdminListView) => onChange({ ...query, view, page: 1 })}
            hideTableView={hideTableView}
            ariaLabel="Choose reminders view"
          />
        }
      />
    </>
  );
}
