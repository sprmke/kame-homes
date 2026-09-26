import { useState } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { Plus } from 'lucide-react';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { AddDevelopmentDialog } from '@/features/dashboard/super-admin/components/super-admin-developments/AddDevelopmentDialog';
import {
  SuperAdminDevelopmentCard,
  SuperAdminDevelopmentsEmptyState,
} from '@/features/dashboard/super-admin/components/super-admin-developments/SuperAdminDevelopmentCard';
import { SuperAdminDevelopmentsSummaryCards } from '@/features/dashboard/super-admin/components/super-admin-developments/SuperAdminDevelopmentsSummaryCards';
import { SuperAdminDevelopmentsTable } from '@/features/dashboard/super-admin/components/super-admin-developments/SuperAdminDevelopmentsTable';
import {
  SuperAdminDevelopmentsResultsMeta,
  SuperAdminDevelopmentsToolbar,
} from '@/features/dashboard/super-admin/components/super-admin-developments/SuperAdminDevelopmentsToolbar';
import { useDevelopments } from '@/features/dashboard/super-admin/hooks/useDevelopments';
import {
  superAdminDevelopmentsHasActiveFilters,
  type SuperAdminDevelopmentsFilters,
  type SuperAdminDevelopmentsViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminDevelopmentsFilters';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { Button } from '@/components/ui/button';
import { useAdminMobileGridViewGuard } from '@/hooks/useAdminMobileGridViewGuard';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  buildPageItems,
  normalizeAdminPageLimit,
} from '@/lib/table/pagination';

export function SuperAdminDevelopmentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const limit = normalizeAdminPageLimit(
    Number(searchParams.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE))
  );
  const filters: SuperAdminDevelopmentsFilters = {
    search: searchParams.get('q') ?? '',
    status: (searchParams.get('status') as SuperAdminDevelopmentsFilters['status']) ?? 'all',
    type: searchParams.get('type') ?? 'all',
  };
  const {
    data: developmentsData,
    isLoading,
    error,
  } = useDevelopments({
    page,
    limit,
    q: filters.search,
    status: filters.status,
    type: filters.type,
  });
  const developments = developmentsData?.rows ?? [];
  const total = developmentsData?.total ?? 0;
  const [addOpen, setAddOpen] = useState(false);
  const [viewMode, setViewMode] = useState<SuperAdminDevelopmentsViewMode>('table');
  const isMobileLayout = useIsBelowLg();
  useAdminMobileGridViewGuard(isMobileLayout, viewMode, setViewMode);

  const hasActiveFilters = superAdminDevelopmentsHasActiveFilters(filters);
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
    updater: (current: SuperAdminDevelopmentsFilters) => SuperAdminDevelopmentsFilters
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
        sp.delete('page');
        return sp;
      },
      { replace: true }
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminPageHeader
        title="Developments"
        subtitle="Buildings and developments on the platform."
        actions={
          <Button type="button" onClick={() => setAddOpen(true)} className="min-h-[44px] gap-1.5">
            <Plus className="size-4" aria-hidden />
            Add development
          </Button>
        }
      />
      {isLoading ? (
        <SuperAdminAdminListBodySkeleton metricCount={4} />
      ) : error ? (
        <p className="text-destructive text-sm">Could not load developments.</p>
      ) : (
        <>
          <SuperAdminDevelopmentsSummaryCards developments={developments} />

          <SuperAdminDevelopmentsToolbar
            filters={filters}
            viewMode={viewMode}
            hideTableView={isMobileLayout}
            limit={limit}
            onSearchChange={(search) => updateFilters((current) => ({ ...current, search }))}
            onStatusChange={(status) => updateFilters((current) => ({ ...current, status }))}
            onTypeChange={(type) => updateFilters((current) => ({ ...current, type }))}
            onViewModeChange={setViewMode}
            onLimitChange={setLimit}
          />

          {developments.length > 0 ? (
            showTableView ? (
              <SuperAdminDevelopmentsTable developments={developments} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                {developments.map((development) => (
                  <SuperAdminDevelopmentCard key={development.id} development={development} />
                ))}
              </div>
            )
          ) : (
            <SuperAdminDevelopmentsEmptyState
              filtered={hasActiveFilters}
              onAdd={() => setAddOpen(true)}
            />
          )}

          <SuperAdminDevelopmentsResultsMeta
            visibleCount={developments.length}
            totalCount={total}
          />

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Developments pagination"
              page={page}
              pageCount={pageCount}
              pageItems={pageItems}
              isLoading={isLoading}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <AddDevelopmentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(slug) => navigate(superAdminPaths.developmentDetail(slug))}
      />
    </div>
  );
}
