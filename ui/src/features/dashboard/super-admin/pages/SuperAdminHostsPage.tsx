import { useCallback, useState } from 'react';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import {
  SuperAdminHostCard,
  SuperAdminHostsEmptyState,
} from '@/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostCard';
import { SuperAdminHostsSummaryCards } from '@/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostsSummaryCards';
import { SuperAdminHostsTable } from '@/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostsTable';
import {
  SuperAdminHostsResultsMeta,
  SuperAdminHostsToolbar,
} from '@/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostsToolbar';
import { useAdminListPaginationParams } from '@/features/dashboard/super-admin/hooks/useAdminListPaginationParams';
import { useHosts } from '@/features/dashboard/super-admin/hooks/useHosts';
import {
  superAdminHostsHasActiveFilters,
  type SuperAdminHostsFilters,
  type SuperAdminHostsViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminHostsFilters';

import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { useAdminMobileGridViewGuard } from '@/hooks/useAdminMobileGridViewGuard';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { buildPageItems } from '@/lib/table/pagination';

export function SuperAdminHostsPage() {
  const { searchParams, setSearchParams, page, limit, setPage, setLimit } =
    useAdminListPaginationParams();
  const filters: SuperAdminHostsFilters = { search: searchParams.get('q') ?? '' };

  const { data, isLoading, isFetching, error } = useHosts({ page, limit, q: filters.search });
  const hosts = data?.rows ?? [];
  const total = data?.total ?? 0;
  const summary = data?.summary ?? { total: 0, totalOrgs: 0, totalProperties: 0, totalParking: 0 };

  const [viewMode, setViewMode] = useState<SuperAdminHostsViewMode>('table');
  const isMobileLayout = useIsBelowLg();
  useAdminMobileGridViewGuard(isMobileLayout, viewMode, setViewMode);

  const hasActiveFilters = superAdminHostsHasActiveFilters(filters);
  const showTableView = viewMode === 'table' && !isMobileLayout;

  const pageCount = Math.max(1, Math.ceil(total / limit));
  const pageItems = buildPageItems(page, pageCount);

  const handleSearchChange = useCallback(
    (search: string) =>
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (search) sp.set('q', search);
          else sp.delete('q');
          sp.delete('page');
          return sp;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminPageHeader title="Hosts" subtitle="All hosts on the platform." />
      {isLoading ? (
        <SuperAdminAdminListBodySkeleton metricCount={4} />
      ) : error ? (
        <p className="text-destructive text-sm">Could not load hosts.</p>
      ) : (
        <>
          <SuperAdminHostsSummaryCards summary={summary} />

          <SuperAdminHostsToolbar
            filters={filters}
            viewMode={viewMode}
            hideTableView={isMobileLayout}
            limit={limit}
            onSearchChange={handleSearchChange}
            onViewModeChange={setViewMode}
            onLimitChange={setLimit}
          />

          {hosts.length > 0 ? (
            showTableView ? (
              <SuperAdminHostsTable hosts={hosts} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                {hosts.map((host) => (
                  <SuperAdminHostCard key={host.id} host={host} />
                ))}
              </div>
            )
          ) : (
            <SuperAdminHostsEmptyState filtered={hasActiveFilters} />
          )}

          <SuperAdminHostsResultsMeta visibleCount={hosts.length} totalCount={total} />

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Hosts pagination"
              page={page}
              pageCount={pageCount}
              pageItems={pageItems}
              isLoading={isLoading || isFetching}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
