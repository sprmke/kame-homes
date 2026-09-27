import { useEffect, useRef, useState } from 'react';

import { Search, X } from 'lucide-react';

import {
  AdminListDesktopToolbar,
  AdminListPerPageSelect,
} from '@/features/dashboard/bookings/components/AdminListToolbar';
import {
  OrgListingViewMenu,
  OrgListingViewToggle,
} from '@/features/dashboard/org/components/OrgListingViewToggle';
import type { OrgListingViewMode } from '@/features/dashboard/org/lib/orgListingViewMode';

import {
  AdminListRefineSection,
  AdminListRefineSheet,
  AdminMobileSearchFilterRow,
} from '@/components/mobile/AdminListRefineSheet';
import { AdminListRefinePopover } from '@/components/navigation/AdminListRefinePopover';
import {
  AdminSingleSelectFilter,
  type AdminSingleSelectOption,
} from '@/components/navigation/AdminSingleSelectFilter';
import { cn } from '@/lib/utils';

export type OrgListingToolbarLabels = {
  searchPlaceholder: string;
  searchAriaLabel: string;
  filterAriaLabel: string;
  toolbarAriaLabel: string;
  viewAriaLabel: string;
  moreFiltersAriaLabel: string;
};

type Props<TStatus extends string> = {
  search: string;
  status: TStatus;
  type: string;
  statusOptions: AdminSingleSelectOption<TStatus>[];
  typeOptions: AdminSingleSelectOption[];
  viewMode: OrgListingViewMode;
  limit: number;
  labels: OrgListingToolbarLabels;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: TStatus) => void;
  onTypeChange: (value: string) => void;
  onViewModeChange: (mode: OrgListingViewMode) => void;
  onLimitChange: (limit: number) => void;
  hideTableView?: boolean;
};

/** Shared Bookings-style list chrome for org Properties / Parkings inventory. */
export function OrgListingToolbar<TStatus extends string>({
  search,
  status,
  type,
  statusOptions,
  typeOptions,
  viewMode,
  limit,
  labels,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onViewModeChange,
  onLimitChange,
  hideTableView = false,
}: Props<TStatus>) {
  const [searchDraft, setSearchDraft] = useState(search);
  const [refineOpen, setRefineOpen] = useState(false);
  const [desktopRefineOpen, setDesktopRefineOpen] = useState(false);
  const searchMount = useRef(true);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    if (searchMount.current) {
      searchMount.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      if (searchDraft !== search) onSearchChange(searchDraft);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchDraft, search, onSearchChange]);

  const statusActive = status !== ('all' as TStatus) ? 1 : 0;
  const typeActive = type !== 'all' ? 1 : 0;
  const mobileRefineCount = statusActive + typeActive;

  const clearAll = () => {
    onStatusChange('all' as TStatus);
    onTypeChange('all');
    setSearchDraft('');
    onSearchChange('');
  };

  const searchField = (
    <OrgListingSearchField
      value={searchDraft}
      onChange={setSearchDraft}
      placeholder={labels.searchPlaceholder}
      ariaLabel={labels.searchAriaLabel}
    />
  );

  const statusFilter = (
    <AdminSingleSelectFilter
      options={statusOptions}
      value={status}
      onChange={onStatusChange}
      ariaLabel="Filter by status"
      triggerWidthClassName="sm:w-[9.5rem]"
    />
  );

  const typeFilter = (
    <AdminSingleSelectFilter
      options={typeOptions}
      value={type}
      onChange={onTypeChange}
      ariaLabel="Filter by type"
      triggerWidthClassName="w-full sm:w-[9.5rem]"
      toolbarExclusive={false}
    />
  );

  return (
    <>
      <div className="space-y-2.5 lg:hidden">
        <AdminMobileSearchFilterRow
          search={searchField}
          filterCount={mobileRefineCount}
          filtersOpen={refineOpen}
          onFiltersOpenChange={setRefineOpen}
          filterAriaLabel={labels.filterAriaLabel}
        />
        <OrgListingViewToggle
          value={viewMode}
          onChange={onViewModeChange}
          hideTableView={hideTableView}
          ariaLabel={labels.viewAriaLabel}
        />
        <AdminListRefineSheet
          open={refineOpen}
          onOpenChange={setRefineOpen}
          title="Refine"
          activeCount={mobileRefineCount}
          onClear={clearAll}
        >
          <AdminListRefineSection title="Status">{statusFilter}</AdminListRefineSection>
          <AdminListRefineSection title="Type">{typeFilter}</AdminListRefineSection>
          <AdminListRefineSection title="Per page">
            <AdminListPerPageSelect limit={limit} onChange={onLimitChange} />
          </AdminListRefineSection>
        </AdminListRefineSheet>
      </div>

      <AdminListDesktopToolbar
        aria-label={labels.toolbarAriaLabel}
        search={searchField}
        leading={statusFilter}
        refine={
          <AdminListRefinePopover
            open={desktopRefineOpen}
            onOpenChange={setDesktopRefineOpen}
            activeCount={typeActive}
            onClear={() => onTypeChange('all')}
            aria-label={labels.moreFiltersAriaLabel}
          >
            <div className="flex w-full min-w-0 flex-col gap-2 px-2 py-1.5">{typeFilter}</div>
          </AdminListRefinePopover>
        }
        perPage={<AdminListPerPageSelect limit={limit} onChange={onLimitChange} />}
        view={
          <OrgListingViewMenu
            value={viewMode}
            onChange={onViewModeChange}
            hideTableView={hideTableView}
            ariaLabel={labels.viewAriaLabel}
          />
        }
      />
    </>
  );
}

export function OrgListingSearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <div className="relative w-full min-w-0">
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
        aria-label={ariaLabel}
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

/** Shared grid class for org inventory card views. */
export const orgListingGridClassName =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4';

/** Shared list stack class for org inventory list views. */
export const orgListingStackClassName = 'space-y-4';
