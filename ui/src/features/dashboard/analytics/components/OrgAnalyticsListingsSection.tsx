import { useCallback, useMemo, useState } from 'react';

import { useParams } from 'react-router-dom';

import {
  OrgAnalyticsListingCard,
  OrgAnalyticsListingRow,
} from '@/features/dashboard/analytics/components/OrgAnalyticsListingCard';
import { OrgAnalyticsListingsTable } from '@/features/dashboard/analytics/components/OrgAnalyticsListingsTable';
import {
  ORG_ANALYTICS_DEFAULT_SORT,
  filterOrgAnalyticsRows,
  orgAnalyticsHasActiveFilters,
  sortOrgAnalyticsRows,
  type OrgAnalyticsAttentionFilter,
  type OrgAnalyticsFilters,
  type OrgAnalyticsSort,
  type OrgAnalyticsSortKey,
} from '@/features/dashboard/analytics/lib/orgAnalyticsListings';
import {
  orgPortfolioListingId,
  orgPortfolioListingKind,
  type OrgPortfolioRow,
} from '@/features/dashboard/analytics/lib/types';
import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import {
  OrgListingToolbar,
  orgListingGridClassName,
  orgListingStackClassName,
} from '@/features/dashboard/org/components/OrgListingToolbar';
import { useOrgListingPagination } from '@/features/dashboard/org/hooks/useOrgListingPagination';
import { useOrgListingViewMode } from '@/features/dashboard/org/hooks/useOrgListingViewMode';
import { sliceOrgListingPage } from '@/features/dashboard/org/lib/orgListingPagination';

import { FloatingToolbar } from '@/components/mobile/FloatingPanel';
import { useIsBelowLg } from '@/hooks/useMediaQuery';

type Props = {
  rows: OrgPortfolioRow[];
};

const ATTENTION_OPTIONS: Array<{ value: OrgAnalyticsAttentionFilter; label: string }> = [
  { value: 'all', label: 'All listings' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'on_track', label: 'On track' },
];

const KIND_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'property', label: 'Properties' },
  { value: 'parking', label: 'Parkings' },
];

export function OrgAnalyticsListingsSection({ rows }: Props) {
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  const isMobileLayout = useIsBelowLg();
  const [filters, setFilters] = useState<OrgAnalyticsFilters>({
    search: '',
    attention: 'all',
    kind: 'all',
  });
  const [sort, setSort] = useState<OrgAnalyticsSort>(ORG_ANALYTICS_DEFAULT_SORT);

  const hasProperties = rows.some((row) => orgPortfolioListingKind(row) === 'property');
  const hasParkings = rows.some((row) => orgPortfolioListingKind(row) === 'parking');
  const showKindFilter = hasProperties && hasParkings;

  const { viewMode, onViewModeChange } = useOrgListingViewMode(rows.length, false, orgSlug, {
    hideTable: isMobileLayout,
  });

  const visible = useMemo(
    () => sortOrgAnalyticsRows(filterOrgAnalyticsRows(rows, filters), sort),
    [rows, filters, sort]
  );

  const filterKey = `${filters.search}|${filters.attention}|${filters.kind}|${sort.key}|${sort.desc}`;
  const pagination = useOrgListingPagination(visible.length, filterKey);
  const pageRows = useMemo(
    () => sliceOrgListingPage(visible, { page: pagination.page, limit: pagination.limit }),
    [visible, pagination.page, pagination.limit]
  );

  const onSearchChange = useCallback((search: string) => {
    setFilters((current) => ({ ...current, search }));
  }, []);

  const onSortChange = useCallback((key: OrgAnalyticsSortKey) => {
    setSort((current) =>
      current.key === key ? { key, desc: !current.desc } : { key, desc: key !== 'name' }
    );
  }, []);

  const filtered = orgAnalyticsHasActiveFilters(filters);

  return (
    <section className="flex min-w-0 flex-col gap-2.5 sm:gap-3" aria-label="Listings">
      <FloatingToolbar>
        <OrgListingToolbar<OrgAnalyticsAttentionFilter>
          search={filters.search}
          status={filters.attention}
          type={filters.kind}
          statusOptions={ATTENTION_OPTIONS}
          typeOptions={showKindFilter ? KIND_OPTIONS : KIND_OPTIONS.slice(0, 1)}
          viewMode={viewMode}
          limit={pagination.limit}
          hideTableView={isMobileLayout}
          labels={{
            searchPlaceholder: 'Search listings…',
            searchAriaLabel: 'Search listings',
            filterAriaLabel: 'Refine listings',
            toolbarAriaLabel: 'Listing filters',
            viewAriaLabel: 'Choose listing view',
            moreFiltersAriaLabel: 'More listing filters',
          }}
          onSearchChange={onSearchChange}
          onStatusChange={(attention) => setFilters((current) => ({ ...current, attention }))}
          onTypeChange={(kind) =>
            setFilters((current) => ({ ...current, kind: kind as OrgAnalyticsFilters['kind'] }))
          }
          onViewModeChange={onViewModeChange}
          onLimitChange={pagination.setLimit}
        />
      </FloatingToolbar>

      {visible.length === 0 ? (
        <p className="text-muted-foreground surface-card py-10 text-center text-sm">
          {filtered ? 'No listings match your filters' : 'No listings yet'}
        </p>
      ) : (
        <>
          {viewMode === 'table' && !isMobileLayout ? (
            <OrgAnalyticsListingsTable
              rows={pageRows}
              orgSlug={orgSlug}
              sort={sort}
              onSortChange={onSortChange}
            />
          ) : null}

          {viewMode === 'grid' ? (
            <div className={orgListingGridClassName}>
              {pageRows.map((row) => (
                <OrgAnalyticsListingCard
                  key={`${orgPortfolioListingKind(row)}-${orgPortfolioListingId(row)}`}
                  row={row}
                  orgSlug={orgSlug}
                />
              ))}
            </div>
          ) : null}

          {viewMode === 'list' ? (
            <div className={orgListingStackClassName}>
              {pageRows.map((row) => (
                <OrgAnalyticsListingRow
                  key={`${orgPortfolioListingKind(row)}-${orgPortfolioListingId(row)}`}
                  row={row}
                  orgSlug={orgSlug}
                />
              ))}
            </div>
          ) : null}

          {pagination.pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Listings pagination"
              page={pagination.page}
              pageCount={pagination.pageCount}
              pageItems={pagination.pageItems}
              onPageChange={pagination.setPage}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
