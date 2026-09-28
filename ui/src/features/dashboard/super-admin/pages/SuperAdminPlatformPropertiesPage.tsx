import { useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import {
  OrgPropertiesEmptyState,
  OrgPropertyCard,
} from '@/features/dashboard/org/components/org-properties/OrgPropertyCard';
import { SuperAdminPlatformPropertiesSummaryCards } from '@/features/dashboard/super-admin/components/super-admin-platform-properties/SuperAdminPlatformPropertiesSummaryCards';
import { SuperAdminPlatformPropertiesTable } from '@/features/dashboard/super-admin/components/super-admin-platform-properties/SuperAdminPlatformPropertiesTable';
import {
  SuperAdminPlatformPropertiesResultsMeta,
  SuperAdminPlatformPropertiesToolbar,
} from '@/features/dashboard/super-admin/components/super-admin-platform-properties/SuperAdminPlatformPropertiesToolbar';
import { usePlatformProperties } from '@/features/dashboard/super-admin/hooks/usePlatformProperties';
import { platformPropertyToProperty } from '@/features/dashboard/super-admin/lib/platformPropertyAdapter';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import {
  superAdminPlatformPropertiesHasActiveFilters,
  type PlatformPropertiesDevelopmentFilter,
  type SuperAdminPlatformPropertiesFilters,
  type SuperAdminPlatformPropertiesViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminPlatformPropertiesFilters';
import type { PlatformProperty } from '@/features/dashboard/super-admin/types/platformProperty';

import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { useAdminMobileGridViewGuard } from '@/hooks/useAdminMobileGridViewGuard';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  buildPageItems,
  normalizeAdminPageLimit,
} from '@/lib/table/pagination';

function platformPropertyCardProps(property: PlatformProperty) {
  return {
    property: platformPropertyToProperty(property),
    orgSlug: property.organizationSlug,
    hideStats: true,
    organizationName: property.organizationName,
    developmentName: property.developmentName,
    developmentHref: property.developmentSlug
      ? superAdminPaths.developmentDetail(property.developmentSlug)
      : null,
  };
}

export function SuperAdminPlatformPropertiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const limit = normalizeAdminPageLimit(
    Number(searchParams.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE))
  );
  const filters: SuperAdminPlatformPropertiesFilters = {
    search: searchParams.get('q') ?? '',
    status: (searchParams.get('status') as SuperAdminPlatformPropertiesFilters['status']) ?? 'all',
    type: searchParams.get('type') ?? 'all',
    development: (searchParams.get('development') as PlatformPropertiesDevelopmentFilter) ?? 'all',
  };
  const {
    data: platformPropertiesData,
    isLoading,
    error,
  } = usePlatformProperties({
    page,
    limit,
    q: filters.search,
    status: filters.status,
    type: filters.type,
    development: filters.development,
  });
  const platformProperties = platformPropertiesData?.rows ?? [];
  const total = platformPropertiesData?.total ?? 0;
  const [viewMode, setViewMode] = useState<SuperAdminPlatformPropertiesViewMode>('table');
  const isMobileLayout = useIsBelowLg();
  useAdminMobileGridViewGuard(isMobileLayout, viewMode, setViewMode);

  const hasActiveFilters = superAdminPlatformPropertiesHasActiveFilters(filters);
  const showTableView = viewMode === 'table' && !isMobileLayout;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const pageItems = buildPageItems(page, pageCount);

  const setPage = (nextPage: number) =>
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (nextPage === 1) sp.delete('page');
        else sp.set('page', String(nextPage));
        return sp;
      },
      { replace: true }
    );

  const setLimit = (nextLimit: number) =>
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (nextLimit === ADMIN_DEFAULT_PAGE_SIZE) sp.delete('limit');
        else sp.set('limit', String(nextLimit));
        sp.delete('page');
        return sp;
      },
      { replace: true }
    );

  const updateFilters = (
    updater: (current: SuperAdminPlatformPropertiesFilters) => SuperAdminPlatformPropertiesFilters
  ) => {
    const next = updater(filters);
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (next.search) sp.set('q', next.search);
        else sp.delete('q');
        if (next.status !== 'all') sp.set('status', next.status);
        else sp.delete('status');
        if (next.type !== 'all') sp.set('type', next.type);
        else sp.delete('type');
        if (next.development !== 'all') sp.set('development', next.development);
        else sp.delete('development');
        sp.delete('page');
        return sp;
      },
      { replace: true }
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminPageHeader title="Properties" subtitle="All properties across the platform." />
      {isLoading ? (
        <SuperAdminAdminListBodySkeleton metricCount={4} />
      ) : error ? (
        <p className="text-destructive text-sm">Could not load properties.</p>
      ) : (
        <>
          <SuperAdminPlatformPropertiesSummaryCards properties={platformProperties} />

          <SuperAdminPlatformPropertiesToolbar
            filters={filters}
            viewMode={viewMode}
            hideTableView={isMobileLayout}
            limit={limit}
            onSearchChange={(search) => updateFilters((current) => ({ ...current, search }))}
            onStatusChange={(status) => updateFilters((current) => ({ ...current, status }))}
            onTypeChange={(type) => updateFilters((current) => ({ ...current, type }))}
            onDevelopmentChange={(development) =>
              updateFilters((current) => ({ ...current, development }))
            }
            onViewModeChange={setViewMode}
            onLimitChange={setLimit}
          />

          {platformProperties.length > 0 ? (
            showTableView ? (
              <SuperAdminPlatformPropertiesTable properties={platformProperties} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                {platformProperties.map((property) => (
                  <OrgPropertyCard key={property.id} {...platformPropertyCardProps(property)} />
                ))}
              </div>
            )
          ) : (
            <OrgPropertiesEmptyState filtered={hasActiveFilters} canAdd={false} onAdd={() => {}} />
          )}

          <SuperAdminPlatformPropertiesResultsMeta
            visibleCount={platformProperties.length}
            totalCount={total}
          />

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Properties pagination"
              page={page}
              pageCount={pageCount}
              pageItems={pageItems}
              isLoading={isLoading}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
