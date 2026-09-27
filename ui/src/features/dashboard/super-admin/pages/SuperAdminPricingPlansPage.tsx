import { useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { Layers } from 'lucide-react';
import { toast } from 'sonner';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { EditPricingPlanDialog } from '@/features/dashboard/super-admin/components/super-admin-pricing/EditPricingPlanDialog';
import {
  SuperAdminPricingPlanCard,
  SuperAdminPricingPlansEmptyState,
} from '@/features/dashboard/super-admin/components/super-admin-pricing/SuperAdminPricingPlanCard';
import { SuperAdminPricingPlansTable } from '@/features/dashboard/super-admin/components/super-admin-pricing/SuperAdminPricingPlansTable';
import {
  SuperAdminPricingPlansResultsMeta,
  SuperAdminPricingPlansToolbar,
} from '@/features/dashboard/super-admin/components/super-admin-pricing/SuperAdminPricingPlansToolbar';
import { SuperAdminPricingSummaryCards } from '@/features/dashboard/super-admin/components/super-admin-pricing/SuperAdminPricingSummaryCards';
import {
  usePricingPlans,
  useUpdatePricingPlan,
} from '@/features/dashboard/super-admin/hooks/usePricingPlans';
import {
  DEFAULT_SUPER_ADMIN_PRICING_PLANS_FILTERS,
  superAdminPricingPlansHasActiveFilters,
  type SuperAdminPricingPlansViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminPricingFilters';
import type { PricingPlan } from '@/features/dashboard/super-admin/types/pricingPlan';

import { useAdminMobileGridViewGuard } from '@/hooks/useAdminMobileGridViewGuard';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { appPageTitle, usePageTitle } from '@/lib/pageTitle';
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  buildPageItems,
  normalizeAdminPageLimit,
} from '@/lib/table/pagination';

export function SuperAdminPricingPlansPage() {
  usePageTitle(appPageTitle('Pricing plans'));
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const limit = normalizeAdminPageLimit(
    Number(searchParams.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE))
  );
  const [filters, setFilters] = useState(DEFAULT_SUPER_ADMIN_PRICING_PLANS_FILTERS);
  const {
    rows: plans,
    total,
    isLoading,
    isFetching,
    error,
  } = usePricingPlans(
    filters.search,
    filters.status,
    Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    limit
  );
  const updatePlan = useUpdatePricingPlan();
  const [editing, setEditing] = useState<PricingPlan | null>(null);
  const [viewMode, setViewMode] = useState<SuperAdminPricingPlansViewMode>('table');
  const isMobileLayout = useIsBelowLg();
  useAdminMobileGridViewGuard(isMobileLayout, viewMode, setViewMode);

  // Filtering (search/status) is already applied server-side by the
  // edge function — `plans` is the current page of already-filtered rows.
  const filteredPlans = plans;
  const hasActiveFilters = superAdminPricingPlansHasActiveFilters(filters);
  const showTableView = viewMode === 'table' && !isMobileLayout;

  const hostLadderPlans = useMemo(
    () => plans.filter((plan) => plan.code !== 'business_plus'),
    [plans]
  );

  const pageCount = Math.max(1, Math.ceil(total / limit));
  const pageItems = useMemo(() => buildPageItems(page, pageCount), [page, pageCount]);

  const setPage = (nextPage: number) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (nextPage === 1) sp.delete('page');
        else sp.set('page', String(nextPage));
        return sp;
      },
      { replace: true }
    );
  };

  const setLimit = (nextLimit: number) => {
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
  };

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    if (page !== 1) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminPageHeader
        title="Pricing plans"
        subtitle="Subscription tier catalog for host Plans & Billing."
      />
      {isLoading ? (
        <SuperAdminAdminListBodySkeleton metricCount={4} />
      ) : error ? (
        <p className="text-destructive text-sm">Could not load pricing plans.</p>
      ) : (
        <>
          <SuperAdminPricingSummaryCards plans={plans} />

          <SuperAdminPricingPlansToolbar
            filters={filters}
            viewMode={viewMode}
            hideTableView={isMobileLayout}
            limit={limit}
            onSearchChange={(search) => setFilters((current) => ({ ...current, search }))}
            onStatusChange={(status) => setFilters((current) => ({ ...current, status }))}
            onViewModeChange={setViewMode}
            onLimitChange={setLimit}
          />

          {filteredPlans.length > 0 ? (
            showTableView ? (
              <SuperAdminPricingPlansTable plans={filteredPlans} onEdit={setEditing} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                {filteredPlans.map((plan) => (
                  <SuperAdminPricingPlanCard key={plan.id} plan={plan} onEdit={setEditing} />
                ))}
              </div>
            )
          ) : plans.length === 0 ? (
            <SuperAdminEmptyState icon={Layers} title="No pricing plans yet" />
          ) : (
            <SuperAdminPricingPlansEmptyState filtered={hasActiveFilters} />
          )}

          <SuperAdminPricingPlansResultsMeta
            visibleCount={filteredPlans.length}
            totalCount={total}
          />

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Pricing plans pagination"
              page={page}
              pageCount={pageCount}
              pageItems={pageItems}
              isLoading={isLoading || isFetching}
              onPageChange={setPage}
            />
          ) : null}

          {!isLoading && !error && !hasActiveFilters && hostLadderPlans.length !== 5 ? (
            <p className="text-muted-foreground text-xs">
              Expected 5 host subscription tiers; found {hostLadderPlans.length}.
            </p>
          ) : null}
        </>
      )}

      <EditPricingPlanDialog
        open={Boolean(editing)}
        plan={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSave={async (patch) => {
          if (!editing) return false;
          try {
            await updatePlan.mutateAsync({ planId: editing.id, ...patch });
            toast.success('Plan saved');
            setEditing(null);
            return true;
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Save failed');
            return false;
          }
        }}
        isSaving={updatePlan.isPending}
      />
    </div>
  );
}
