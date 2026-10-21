import { AdminTableRowAffordance } from '@/features/dashboard/bookings/components/AdminDataTable';
import { VerificationStatusBadge } from '@/features/dashboard/org/components/verification/VerificationStatusBadge';
import { listingKindLabel } from '@/features/dashboard/org/lib/listingVerificationCopy';
import { externalReviewSourceLabel } from '@/features/dashboard/org/lib/propertyExternalReviews';
import {
  approvalHasDualTierQueue,
  latestApprovalSubmittedAt,
} from '@/features/dashboard/super-admin/lib/approvalReviewTier';
import {
  latestListingApprovalSubmittedAt,
  listingApprovalHasDualTierQueue,
} from '@/features/dashboard/super-admin/lib/listingApprovalReviewTier';
import {
  approvalQueueItemKey,
  isListingVerificationApprovalSummary,
  isOrgApprovalSummary,
} from '@/features/dashboard/super-admin/lib/superAdminApprovalsFilters';
import type { ApprovalQueueItem } from '@/features/dashboard/super-admin/types/approval';

import { AdminCardGrid, AdminCardRow } from '@/components/mobile/AdminCardGrid';
import { softBadgeClasses, toneBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

function SuccessionBadge() {
  return <span className={softBadgeClasses('warning')}>Succession</span>;
}

function ConsiderationBadge() {
  return <span className={softBadgeClasses('info')}>Consideration</span>;
}

function ReviewBadge() {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
        toneBadgeClasses('purple')
      )}
    >
      Review
    </span>
  );
}

function ListingBadge() {
  return <span className={softBadgeClasses('info')}>Listing</span>;
}

function hostModesLabel(hostModes: string[]): string {
  const hasProperty = hostModes.includes('property');
  const hasParking = hostModes.includes('parking');
  if (hasProperty && hasParking) return 'Property + Parking';
  if (hasParking) return 'Parking';
  return 'Property';
}

function formatSubmittedDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type Props = {
  approvals: ApprovalQueueItem[];
  onSelect: (approval: ApprovalQueueItem) => void;
};

export function SuperAdminApprovalsCardGrid({ approvals, onSelect }: Props) {
  return (
    <AdminCardGrid denser={false}>
      {approvals.map((approval) => {
        const isReview = approval.type === 'external_review' || approval.type === 'reported_review';
        const isListing = approval.type === 'listing_verification';
        const label = isReview
          ? approval.propertyName
          : isListing
            ? approval.listingName
            : approval.organizationName;
        const ariaLabel = isReview
          ? `Review ${approval.propertyName} external review`
          : isListing
            ? `Review ${approval.listingName} listing verification`
            : `Review ${approval.organizationName}`;

        return (
          <AdminCardRow
            key={approvalQueueItemKey(approval)}
            onOpen={() => onSelect(approval)}
            aria-label={ariaLabel}
            className="gap-1.5 px-3 py-2.5 sm:min-h-[132px] sm:gap-3 sm:p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="text-foreground min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight sm:text-sm">
                    {label}
                  </p>
                  <span className="hidden sm:contents">
                    {isReview ? <ReviewBadge /> : null}
                    {isListing ? <ListingBadge /> : null}
                    {!isReview && !isListing && approval.hasActiveUnitConflict ? (
                      <SuccessionBadge />
                    ) : null}
                    {!isReview && !isListing && approval.hasPendingConsideration ? (
                      <ConsiderationBadge />
                    ) : null}
                    {isListing && approval.hasActiveUnitConflict ? <SuccessionBadge /> : null}
                  </span>
                  <span className="sm:hidden">
                    {isReview ? <ReviewBadge /> : null}
                    {isListing ? <ListingBadge /> : null}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 truncate text-[11px] leading-tight sm:mt-0.5 sm:text-xs">
                  {isReview
                    ? approval.organizationName
                    : isListing
                      ? approval.organizationName
                      : approval.ownerName}
                  {!isReview && !isListing && approval.ownerEmail ? (
                    <span className="sm:hidden"> · {approval.ownerEmail}</span>
                  ) : null}
                </p>
                {!isReview && !isListing && approval.ownerEmail ? (
                  <p className="text-muted-foreground hidden truncate text-xs sm:block">
                    {approval.ownerEmail}
                  </p>
                ) : null}
                {isReview ? (
                  <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[11px] sm:line-clamp-2 sm:text-xs">
                    {approval.reviewText}
                  </p>
                ) : null}
              </div>
              <AdminTableRowAffordance />
            </div>

            <div className="sm:border-border/50 mt-1 flex min-w-0 items-center justify-between gap-2 sm:mt-auto sm:flex-wrap sm:border-t sm:pt-3">
              <span className="text-muted-foreground min-w-0 truncate text-[11px] sm:text-xs">
                {approval.type === 'external_review'
                  ? externalReviewSourceLabel(approval.source)
                  : approval.type === 'reported_review'
                    ? 'Reported'
                    : isListing
                      ? listingKindLabel(approval.listingKind)
                      : hostModesLabel(approval.hostModes)}
                <span className="text-muted-foreground/40 mx-1" aria-hidden>
                  ·
                </span>
                <span className="tabular-nums">
                  {formatSubmittedDate(
                    isReview
                      ? approval.submittedAt
                      : isListing
                        ? latestListingApprovalSubmittedAt(approval)
                        : latestApprovalSubmittedAt(approval)
                  )}
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {isReview ? (
                  <VerificationStatusBadge status={approval.moderationStatus} />
                ) : isListing ? (
                  <ListingApprovalQueueStatusCell approval={approval} />
                ) : (
                  <OrgApprovalQueueStatusCell approval={approval} />
                )}
              </div>
            </div>
          </AdminCardRow>
        );
      })}
    </AdminCardGrid>
  );
}

function OrgApprovalQueueStatusCell({
  approval,
}: {
  approval: Extract<ApprovalQueueItem, { type: 'org_verification' }>;
}) {
  if (!isOrgApprovalSummary(approval)) return null;

  if (approvalHasDualTierQueue(approval)) {
    return (
      <div className="flex flex-col items-end gap-1 whitespace-nowrap">
        <div className="flex flex-nowrap items-center gap-1.5">
          <span className="text-muted-foreground shrink-0 text-[10px] font-semibold uppercase tracking-wide">
            Verified
          </span>
          <VerificationStatusBadge status={approval.baseStatus} kind={approval.baseRejectionKind} />
        </div>
        <div className="flex flex-nowrap items-center gap-1.5">
          <span className="text-muted-foreground shrink-0 text-[10px] font-semibold uppercase tracking-wide">
            Recommended
          </span>
          <VerificationStatusBadge status={approval.enhancedStatus} />
        </div>
      </div>
    );
  }

  const status =
    approval.enhancedStatus === 'pending' ? approval.enhancedStatus : approval.baseStatus;
  const kind = approval.enhancedStatus === 'pending' ? null : approval.baseRejectionKind;

  return <VerificationStatusBadge status={status} kind={kind} />;
}

function ListingApprovalQueueStatusCell({
  approval,
}: {
  approval: Extract<ApprovalQueueItem, { type: 'listing_verification' }>;
}) {
  if (!isListingVerificationApprovalSummary(approval)) return null;

  if (listingApprovalHasDualTierQueue(approval)) {
    return (
      <div className="flex flex-col items-end gap-1 whitespace-nowrap">
        <div className="flex flex-nowrap items-center gap-1.5">
          <span className="text-muted-foreground shrink-0 text-[10px] font-semibold uppercase tracking-wide">
            Verified
          </span>
          <VerificationStatusBadge status={approval.baseStatus} kind={approval.baseRejectionKind} />
        </div>
        <div className="flex flex-nowrap items-center gap-1.5">
          <span className="text-muted-foreground shrink-0 text-[10px] font-semibold uppercase tracking-wide">
            Recommended
          </span>
          <VerificationStatusBadge
            status={approval.recommendedStatus}
            kind={approval.recommendedRejectionKind}
          />
        </div>
      </div>
    );
  }

  const status =
    approval.recommendedStatus === 'pending' ? approval.recommendedStatus : approval.baseStatus;
  const kind = approval.recommendedStatus === 'pending' ? null : approval.baseRejectionKind;

  return <VerificationStatusBadge status={status} kind={kind} />;
}
