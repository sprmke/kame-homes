import { useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { LifeBuoy } from 'lucide-react';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminSupportCardGrid } from '@/features/dashboard/super-admin/components/super-admin-support/SuperAdminSupportCardGrid';
import { SuperAdminSupportSummaryCards } from '@/features/dashboard/super-admin/components/super-admin-support/SuperAdminSupportSummaryCards';
import { SuperAdminSupportTable } from '@/features/dashboard/super-admin/components/super-admin-support/SuperAdminSupportTable';
import {
  SuperAdminSupportResultsMeta,
  SuperAdminSupportToolbar,
} from '@/features/dashboard/super-admin/components/super-admin-support/SuperAdminSupportToolbar';
import { SuperAdminTicketDetailDialog } from '@/features/dashboard/super-admin/components/super-admin-support/SuperAdminTicketDetailDialog';
import {
  useSupportTicketsAdmin,
  useSupportTicketsSummary,
} from '@/features/dashboard/super-admin/hooks/useSupportTicketsAdmin';
import {
  DEFAULT_SUPER_ADMIN_SUPPORT_FILTERS,
  superAdminSupportHasActiveFilters,
  type SuperAdminSupportFilters,
  type SuperAdminSupportViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminSupportFilters';

import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { useAdminMobileGridViewGuard } from '@/hooks/useAdminMobileGridViewGuard';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  buildPageItems,
  normalizeAdminPageLimit,
} from '@/lib/table/pagination';

function SupportTicketsEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <SuperAdminEmptyState
      icon={LifeBuoy}
      title={filtered ? 'No tickets match your filters' : 'No tickets yet'}
    />
  );
}

export function SuperAdminSupportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const limit = normalizeAdminPageLimit(
    Number(searchParams.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE))
  );
  const filters: SuperAdminSupportFilters = {
    search: searchParams.get('search') ?? DEFAULT_SUPER_ADMIN_SUPPORT_FILTERS.search,
    category: (searchParams.get('category') ??
      DEFAULT_SUPER_ADMIN_SUPPORT_FILTERS.category) as SuperAdminSupportFilters['category'],
    status: (searchParams.get('status') ??
      DEFAULT_SUPER_ADMIN_SUPPORT_FILTERS.status) as SuperAdminSupportFilters['status'],
  };
  const { data, isLoading, isFetching, error } = useSupportTicketsAdmin(
    {
      search: filters.search.trim() || null,
      category: filters.category === 'all' ? null : filters.category,
      status: filters.status === 'all' ? null : filters.status,
      orgId: null,
    },
    page,
    limit
  );
  const { data: ticketsSummary } = useSupportTicketsSummary();
  const [viewMode, setViewMode] = useState<SuperAdminSupportViewMode>('table');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const isMobileLayout = useIsBelowLg();
  useAdminMobileGridViewGuard(isMobileLayout, viewMode, setViewMode);

  const tickets = data?.tickets ?? [];
  const total = data?.total ?? 0;
  const hasActiveFilters = superAdminSupportHasActiveFilters(filters);
  const showTableView = viewMode === 'table' && !isMobileLayout;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const pageItems = buildPageItems(page, pageCount);

  const setPage = (nextPage: number) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (nextPage <= 1) sp.delete('page');
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

  function updateFilters(next: SuperAdminSupportFilters) {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (!next.search.trim()) sp.delete('search');
        else sp.set('search', next.search);
        if (next.category === 'all') sp.delete('category');
        else sp.set('category', next.category);
        if (next.status === 'all') sp.delete('status');
        else sp.set('status', next.status);
        sp.delete('page');
        return sp;
      },
      { replace: true }
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminPageHeader
        title="Support tickets"
        subtitle="Host bug reports, suggestions, and inquiries."
      />
      {isLoading ? (
        <SuperAdminAdminListBodySkeleton metricCount={4} />
      ) : error ? (
        <p className="text-destructive text-sm">Could not load support tickets.</p>
      ) : (
        <>
          <SuperAdminSupportSummaryCards tickets={tickets} summary={ticketsSummary} />

          <SuperAdminSupportToolbar
            filters={filters}
            viewMode={viewMode}
            hideTableView={isMobileLayout}
            limit={limit}
            onSearchChange={(search) => updateFilters({ ...filters, search })}
            onCategoryChange={(category) => updateFilters({ ...filters, category })}
            onStatusChange={(status) => updateFilters({ ...filters, status })}
            onViewModeChange={setViewMode}
            onLimitChange={setLimit}
          />

          {tickets.length > 0 ? (
            showTableView ? (
              <SuperAdminSupportTable tickets={tickets} onSelect={setSelectedTicketId} />
            ) : (
              <SuperAdminSupportCardGrid tickets={tickets} onSelect={setSelectedTicketId} />
            )
          ) : (
            <SupportTicketsEmptyState filtered={hasActiveFilters} />
          )}

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Support tickets pagination"
              page={page}
              pageCount={pageCount}
              pageItems={pageItems}
              isLoading={isLoading || isFetching}
              onPageChange={setPage}
            />
          ) : null}

          <SuperAdminSupportResultsMeta visibleCount={tickets.length} totalCount={total} />
        </>
      )}

      <SuperAdminTicketDetailDialog
        ticketId={selectedTicketId}
        onOpenChange={(open) => {
          if (!open) setSelectedTicketId(null);
        }}
      />
    </div>
  );
}
