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
import { FinanceCategoryFilter } from '@/features/dashboard/finance/components/FinanceCategoryFilter';
import { FinanceLedgerSortMenu } from '@/features/dashboard/finance/components/FinanceLedgerSortMenu';
import { FinanceStatusFilter } from '@/features/dashboard/finance/components/FinanceStatusFilter';
import { FinanceTypeFilter } from '@/features/dashboard/finance/components/FinanceTypeFilter';
import type { FinanceQuery } from '@/features/dashboard/finance/lib/types';

import {
  AdminListRefineSection,
  AdminListRefineSheet,
  AdminMobileSearchFilterRow,
} from '@/components/mobile/AdminListRefineSheet';
import { AdminListRefinePopover } from '@/components/navigation/AdminListRefinePopover';
import { cn } from '@/lib/utils';

type Props = {
  query: FinanceQuery;
  categories: string[];
  onChange: (next: FinanceQuery) => void;
  hideTableView?: boolean;
  showPerPage?: boolean;
};

export function FinanceLedgerToolbar({
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

  const statusCount = query.statusFilter.length > 0 ? 1 : 0;
  const moreFilterCount =
    (query.typeFilter !== 'all' ? 1 : 0) + (query.categoryFilter.length > 0 ? 1 : 0);
  const mobileRefineCount = statusCount + moreFilterCount;

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
      typeFilter: 'all',
      statusFilter: [],
      categoryFilter: [],
    });
  }

  function clearMoreFilters() {
    onChange({
      ...query,
      page: 1,
      typeFilter: 'all',
      categoryFilter: [],
    });
  }

  const searchField = <FinanceSearchField value={searchDraft} onChange={setSearchDraft} />;

  const mobileRefineBody = (
    <>
      <AdminListRefineSection title="Filters">
        <div className="flex flex-col gap-2 [&_button]:w-full">
          <FinanceTypeFilter
            value={query.typeFilter}
            onChange={(typeFilter) => onChange({ ...query, page: 1, typeFilter })}
          />
          <FinanceStatusFilter
            value={query.statusFilter}
            onChange={(statusFilter) => onChange({ ...query, page: 1, statusFilter })}
          />
          <FinanceCategoryFilter
            categories={categories}
            value={query.categoryFilter}
            onChange={(categoryFilter) => onChange({ ...query, page: 1, categoryFilter })}
          />
        </div>
      </AdminListRefineSection>
      <AdminListRefineSection title="Sort">
        <FinanceLedgerSortMenu
          sort={query.sort}
          onChange={(sort) => onChange({ ...query, sort, page: 1 })}
          fullWidth
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
          filterAriaLabel="Refine transactions"
        />
        <AdminListViewToggle
          value={query.view}
          onChange={(view) => onChange({ ...query, view, page: 1 })}
          hideTableView={hideTableView}
          ariaLabel="Choose stays view"
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
        aria-label="Transaction filters"
        search={searchField}
        leading={
          <FinanceStatusFilter
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
            aria-label="More transaction filters"
          >
            <div className="flex w-full min-w-0 flex-col gap-2 px-2 py-1.5">
              <FinanceTypeFilter
                value={query.typeFilter}
                onChange={(typeFilter) => onChange({ ...query, page: 1, typeFilter })}
                nestedInPopover
              />
              <FinanceCategoryFilter
                categories={categories}
                value={query.categoryFilter}
                onChange={(categoryFilter) => onChange({ ...query, page: 1, categoryFilter })}
                nestedInPopover
              />
            </div>
          </AdminListRefinePopover>
        }
        sort={
          <FinanceLedgerSortMenu
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
            onChange={(view) => onChange({ ...query, view, page: 1 })}
            hideTableView={hideTableView}
            ariaLabel="Choose stays view"
          />
        }
      />
    </>
  );
}

function FinanceSearchField({
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
        className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 sm:left-3"
        aria-hidden
      />
      <input
        type="search"
        placeholder="Search transactions..."
        className={cn(
          'border-border bg-card text-foreground field-focus h-11 min-h-[44px] w-full rounded-2xl border py-2.5 pl-11 text-[13px]',
          'sm:h-10 sm:min-h-[44px] sm:rounded-xl sm:pl-10 sm:text-[13px]',
          'lg:h-10 lg:min-h-[44px] lg:rounded-lg lg:text-sm',
          value ? 'pr-11' : 'pr-3.5',
          'placeholder:text-muted-foreground placeholder:text-[13px] lg:placeholder:text-sm'
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search transactions"
      />
      {value ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-xl"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
