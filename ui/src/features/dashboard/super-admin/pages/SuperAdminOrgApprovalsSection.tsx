import { useState } from 'react';

import { ClipboardCheck } from 'lucide-react';

import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminApprovalReviewDialog } from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalReviewDialog';
import { SuperAdminApprovalsCardGrid } from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalsCardGrid';
import { SuperAdminExternalReviewDialog } from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminExternalReviewDialog';
import { SuperAdminListingVerificationDialog } from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminListingVerificationDialog';
import { useSuperAdminOrgContext } from '@/features/dashboard/super-admin/components/super-admin-orgs/superAdminOrgContext';
import { useApprovals } from '@/features/dashboard/super-admin/hooks/useApprovals';
import {
  DEFAULT_APPROVALS_FILTERS,
  isExternalReviewApprovalSummary,
  isListingVerificationApprovalSummary,
  isOrgApprovalSummary,
} from '@/features/dashboard/super-admin/lib/superAdminApprovalsFilters';
import type {
  ApprovalQueueItem,
  ExternalReviewApprovalSummary,
  ListingVerificationApprovalSummary,
  OrgApprovalSummary,
} from '@/features/dashboard/super-admin/types/approval';

import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';

export function SuperAdminOrgApprovalsSection() {
  const { org } = useSuperAdminOrgContext();
  const { data, isLoading, error } = useApprovals(
    { ...DEFAULT_APPROVALS_FILTERS, status: 'all' },
    1,
    100,
    org.id
  );
  const approvals = data?.rows ?? [];

  const [selectedOrg, setSelectedOrg] = useState<OrgApprovalSummary | null>(null);
  const [selectedListing, setSelectedListing] = useState<ListingVerificationApprovalSummary | null>(
    null
  );
  const [selectedReview, setSelectedReview] = useState<ExternalReviewApprovalSummary | null>(null);

  function handleSelect(item: ApprovalQueueItem) {
    setSelectedOrg(isOrgApprovalSummary(item) ? item : null);
    setSelectedListing(isListingVerificationApprovalSummary(item) ? item : null);
    setSelectedReview(isExternalReviewApprovalSummary(item) ? item : null);
  }

  if (isLoading) return <SuperAdminAdminListBodySkeleton metricCount={0} />;
  if (error) return <p className="text-destructive text-sm">Could not load approvals.</p>;

  return (
    <div className="space-y-3 sm:space-y-4">
      {approvals.length === 0 ? (
        <SuperAdminEmptyState icon={ClipboardCheck} title="No approvals for this organization" />
      ) : (
        <SuperAdminApprovalsCardGrid approvals={approvals} onSelect={handleSelect} />
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
