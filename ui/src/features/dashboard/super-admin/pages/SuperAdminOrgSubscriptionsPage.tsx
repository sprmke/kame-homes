import { useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { Building2 } from 'lucide-react';
import { toast } from 'sonner';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import {
  SuperAdminOrgSubscriptionCard,
  SuperAdminOrgSubscriptionsEmptyState,
} from '@/features/dashboard/super-admin/components/super-admin-pricing/SuperAdminOrgSubscriptionCard';
import { SuperAdminOrgSubscriptionsSummaryCards } from '@/features/dashboard/super-admin/components/super-admin-pricing/SuperAdminOrgSubscriptionsSummaryCards';
import { SuperAdminOrgSubscriptionsTable } from '@/features/dashboard/super-admin/components/super-admin-pricing/SuperAdminOrgSubscriptionsTable';
import {
  SuperAdminOrgSubscriptionsResultsMeta,
  SuperAdminOrgSubscriptionsToolbar,
} from '@/features/dashboard/super-admin/components/super-admin-pricing/SuperAdminOrgSubscriptionsToolbar';
import { useRunPlatformBillingCron } from '@/features/dashboard/super-admin/hooks/usePlatformPaymentSettings';
import {
  useAssignOrgPlan,
  useOrgSubscriptionsAdmin,
  useOrgSubscriptionsSummary,
  usePricingPlans,
} from '@/features/dashboard/super-admin/hooks/usePricingPlans';
import {
  useReassessOrgSuperhost,
  useRunSuperhostAssessmentCron,
} from '@/features/dashboard/super-admin/hooks/useSuperhostAdmin';
import {
  DEFAULT_SUPER_ADMIN_ORG_SUBSCRIPTIONS_FILTERS,
  superAdminOrgSubscriptionsHasActiveFilters,
  type SuperAdminOrgSubscriptionsViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminPricingFilters';

import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { Button } from '@/components/ui/button';
import { useAdminMobileGridViewGuard } from '@/hooks/useAdminMobileGridViewGuard';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { appPageTitle, usePageTitle } from '@/lib/pageTitle';
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  buildPageItems,
  normalizeAdminPageLimit,
} from '@/lib/table/pagination';

export function SuperAdminOrgSubscriptionsPage() {
  usePageTitle(appPageTitle('Org subscriptions'));
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const limit = normalizeAdminPageLimit(
    Number(searchParams.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE))
  );
  const [viewMode, setViewMode] = useState<SuperAdminOrgSubscriptionsViewMode>('table');
  const [filters, setFilters] = useState(DEFAULT_SUPER_ADMIN_ORG_SUBSCRIPTIONS_FILTERS);
  const isMobileLayout = useIsBelowLg();
  useAdminMobileGridViewGuard(isMobileLayout, viewMode, setViewMode);

  // Full (unpaginated first page) plan catalog — used only to populate the
  // assign-plan dropdown, not for the organizations list itself.
  const { rows: plans } = usePricingPlans();
  const {
    rows: organizations,
    total,
    isLoading,
    isFetching,
    error,
  } = useOrgSubscriptionsAdmin(
    filters.search,
    filters.planCode,
    Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    limit
  );
  // Platform-wide aggregate counts (not just the current filtered/paginated
  // page) feeding the summary cards — computed server-side via count-only
  // queries so it stays cheap at thousands of organizations.
  const { summary } = useOrgSubscriptionsSummary();
  const assignPlan = useAssignOrgPlan();
  const billingCron = useRunPlatformBillingCron();
  const superhostCron = useRunSuperhostAssessmentCron();
  const reassessSuperhost = useReassessOrgSuperhost();

  const planOptions = useMemo(() => plans.filter((plan) => plan.isActive), [plans]);
  // Filtering (search/planCode) is already applied server-side by the edge
  // function — `organizations` is the current page of already-filtered rows.
  const filteredOrganizations = organizations;
  const hasActiveFilters = superAdminOrgSubscriptionsHasActiveFilters(filters);
  const showTableView = viewMode === 'table' && !isMobileLayout;

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

  const handleAssign = async (organizationId: string, planId: string) => {
    try {
      // No propertyIds — defaults server-side to every property the org owns.
      await assignPlan.mutateAsync({
        organizationId,
        planId,
        note: 'Super-admin manual assign',
      });
      toast.success('Plan assigned');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assign failed');
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminPageHeader
        title="Org subscriptions"
        subtitle="Assign plans to organizations across the platform. Covers every property they own."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={superhostCron.isPending}
              onClick={() => superhostCron.mutate()}
            >
              Run Superhost cron
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={billingCron.isPending}
              onClick={() => billingCron.mutate()}
            >
              Run billing cron
            </Button>
          </div>
        }
      />
      {isLoading ? (
        <SuperAdminAdminListBodySkeleton metricCount={4} />
      ) : error ? (
        <p className="text-destructive text-sm">Could not load org subscriptions.</p>
      ) : (
        <>
          <SuperAdminOrgSubscriptionsSummaryCards summary={summary} />

          <SuperAdminOrgSubscriptionsToolbar
            filters={filters}
            viewMode={viewMode}
            plans={planOptions}
            hideTableView={isMobileLayout}
            limit={limit}
            onSearchChange={(search) => setFilters((current) => ({ ...current, search }))}
            onPlanCodeChange={(planCode) => setFilters((current) => ({ ...current, planCode }))}
            onViewModeChange={setViewMode}
            onLimitChange={setLimit}
          />

          {filteredOrganizations.length > 0 ? (
            showTableView ? (
              <SuperAdminOrgSubscriptionsTable
                organizations={filteredOrganizations}
                plans={planOptions}
                onAssign={handleAssign}
                isAssigning={assignPlan.isPending}
                onReassessSuperhost={(orgId) => reassessSuperhost.mutate(orgId)}
                reassessingOrgId={
                  reassessSuperhost.isPending ? (reassessSuperhost.variables ?? null) : null
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                {filteredOrganizations.map((row) => (
                  <SuperAdminOrgSubscriptionCard
                    key={row.organizationId}
                    row={row}
                    plans={planOptions}
                    onAssign={handleAssign}
                    isAssigning={assignPlan.isPending}
                  />
                ))}
              </div>
            )
          ) : organizations.length === 0 ? (
            <SuperAdminEmptyState icon={Building2} title="No organizations yet" />
          ) : (
            <SuperAdminOrgSubscriptionsEmptyState filtered={hasActiveFilters} />
          )}

          <SuperAdminOrgSubscriptionsResultsMeta
            visibleCount={filteredOrganizations.length}
            totalCount={total}
          />

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Org subscriptions pagination"
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
