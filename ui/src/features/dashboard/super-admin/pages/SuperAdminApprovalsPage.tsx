import { useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { ClipboardCheck } from 'lucide-react';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminResultsMeta } from '@/features/dashboard/super-admin/components/shared/SuperAdminResultsMeta';
import { SuperAdminApprovalReviewDialog } from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalReviewDialog';
import { SuperAdminApprovalsCardGrid } from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalsCardGrid';
import { SuperAdminApprovalsSummaryCards } from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalsSummaryCards';
import { SuperAdminApprovalsTable } from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalsTable';
import { SuperAdminApprovalsToolbar } from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalsToolbar';
import { SuperAdminExternalReviewDialog } from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminExternalReviewDialog';
import { SuperAdminListingVerificationDialog } from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminListingVerificationDialog';
import {
  useApprovals,
  useApprovalsSummary,
} from '@/features/dashboard/super-admin/hooks/useApprovals';
import {
  DEFAULT_APPROVALS_FILTERS,
  isExternalReviewApprovalSummary,
  isListingVerificationApprovalSummary,
  isOrgApprovalSummary,
  superAdminApprovalsHasActiveFilters,
  type SuperAdminApprovalsFilters,
} from '@/features/dashboard/super-admin/lib/superAdminApprovalsFilters';
import type { SuperAdminListViewMode } from '@/features/dashboard/super-admin/lib/superAdminListViewMode';
import type {
  ApprovalQueueItem,
  ExternalReviewApprovalSummary,
  ListingVerificationApprovalSummary,
  OrgApprovalSummary,
} from '@/features/dashboard/super-admin/types/approval';

import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { useAdminMobileGridViewGuard } from '@/hooks/useAdminMobileGridViewGuard';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  buildPageItems,
  normalizeAdminPageLimit,
} from '@/lib/table/pagination';

function ApprovalsEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <SuperAdminEmptyState
      icon={ClipboardCheck}
      title={filtered ? 'No approvals match your filters' : 'No approvals yet'}
    />
  );
}

export function SuperAdminApprovalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const limit = normalizeAdminPageLimit(
    Number(searchParams.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE))
  );
  const filters: SuperAdminApprovalsFilters = {
    search: searchParams.get('search') ?? DEFAULT_APPROVALS_FILTERS.search,
    status: (searchParams.get('status') ??
      DEFAULT_APPROVALS_FILTERS.status) as SuperAdminApprovalsFilters['status'],
    type: (searchParams.get('type') ??
      DEFAULT_APPROVALS_FILTERS.type) as SuperAdminApprovalsFilters['type'],
  };
  const { data, isLoading, isFetching, error } = useApprovals(filters, page, limit);
  const { data: approvalsSummary } = useApprovalsSummary();
  const approvals = data?.rows ?? [];
  const total = data?.total ?? 0;
  const [selectedOrg, setSelectedOrg] = useState<OrgApprovalSummary | null>(null);
  const [selectedListing, setSelectedListing] = useState<ListingVerificationApprovalSummary | null>(
    null
  );
  const [selectedReview, setSelectedReview] = useState<ExternalReviewApprovalSummary | null>(null);
  const [viewMode, setViewMode] = useState<SuperAdminListViewMode>('table');
  const isMobileLayout = useIsBelowLg();
  useAdminMobileGridViewGuard(isMobileLayout, viewMode, setViewMode);

  const hasActiveFilters = superAdminApprovalsHasActiveFilters(filters);
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

  function updateFilters(next: SuperAdminApprovalsFilters) {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (!next.search.trim()) sp.delete('search');
        else sp.set('search', next.search);
        if (next.status === DEFAULT_APPROVALS_FILTERS.status) sp.delete('status');
        else sp.set('status', next.status);
        if (next.type === 'all') sp.delete('type');
        else sp.set('type', next.type);
        sp.delete('page');
        return sp;
      },
      { replace: true }
    );
  }

  function handleSelect(item: ApprovalQueueItem) {
    if (isOrgApprovalSummary(item)) {
      setSelectedReview(null);
      setSelectedListing(null);
      setSelectedOrg(item);
      return;
    }
    if (isListingVerificationApprovalSummary(item)) {
      setSelectedOrg(null);
      setSelectedReview(null);
      setSelectedListing(item);
      return;
    }
    if (isExternalReviewApprovalSummary(item)) {
      setSelectedOrg(null);
      setSelectedListing(null);
      setSelectedReview(item);
    }
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminPageHeader title="Approvals" subtitle="Review host verification requests." />
      {isLoading ? (
        <SuperAdminAdminListBodySkeleton metricCount={4} />
      ) : error ? (
        <p className="text-destructive text-sm">Could not load approvals.</p>
      ) : (
        <>
          <SuperAdminApprovalsSummaryCards approvals={approvals} summary={approvalsSummary} />

          <SuperAdminApprovalsToolbar
            filters={filters}
            viewMode={viewMode}
            hideTableView={isMobileLayout}
            limit={limit}
            onSearchChange={(search) => updateFilters({ ...filters, search })}
            onTypeChange={(type) => updateFilters({ ...filters, type })}
            onStatusChange={(status) => updateFilters({ ...filters, status })}
            onViewModeChange={setViewMode}
            onLimitChange={setLimit}
          />

          {approvals.length > 0 ? (
            showTableView ? (
              <SuperAdminApprovalsTable approvals={approvals} onSelect={handleSelect} />
            ) : (
              <SuperAdminApprovalsCardGrid approvals={approvals} onSelect={handleSelect} />
            )
          ) : (
            <ApprovalsEmptyState filtered={hasActiveFilters} />
          )}

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Approvals pagination"
              page={page}
              pageCount={pageCount}
              pageItems={pageItems}
              isLoading={isLoading || isFetching}
              onPageChange={setPage}
            />
          ) : null}

          <SuperAdminResultsMeta visibleCount={approvals.length} totalCount={total} />
        </>
      )}

      <SuperAdminApprovalReviewDialog
        approval={selectedOrg}
        onOpenChange={(open) => {
          if (!open) setSelectedOrg(null);
        }}
      />

      <SuperAdminListingVerificationDialog
        approval={selectedListing}
        onOpenChange={(open) => {
          if (!open) setSelectedListing(null);
        }}
      />

      <SuperAdminExternalReviewDialog
        approval={selectedReview}
        onOpenChange={(open) => {
          if (!open) setSelectedReview(null);
        }}
      />
    </div>
  );
}
