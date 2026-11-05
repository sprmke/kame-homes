import {
  AdminDataTable,
  AdminTableHeadRow,
  AdminTableRowAffordance,
  AdminTableTh,
  adminTableBodyText,
  adminTableCell,
  adminTableRowClass,
} from '@/features/dashboard/bookings/components/AdminDataTable';
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

export function SuperAdminApprovalsTable({ approvals, onSelect }: Props) {
  return (
    <AdminDataTable minWidth={720}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Item</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Context</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Type</AdminTableTh>
        <AdminTableTh className="hidden px-3 md:table-cell md:px-4">Submitted</AdminTableTh>
        <AdminTableTh className="whitespace-nowrap px-3 sm:px-4">Status</AdminTableTh>
        <AdminTableTh className="pl-2 pr-3 sm:pl-3 sm:pr-4">
          <span className="sr-only">Review</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {approvals.map((approval, index) => {
          const isReview =
            approval.type === 'external_review' || approval.type === 'reported_review';
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
            <tr
              key={approvalQueueItemKey(approval)}
              className={adminTableRowClass(index)}
              tabIndex={0}
              role="link"
              onClick={() => onSelect(approval)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(approval);
                }
              }}
              aria-label={ariaLabel}
            >
              <td className={adminTableCell.body}>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <p className={cn('truncate', adminTableBodyText.primary)}>{label}</p>
                    {isReview ? <ReviewBadge /> : null}
                    {isListing ? <ListingBadge /> : null}
                    {!isReview && !isListing && approval.hasActiveUnitConflict ? (
                      <SuccessionBadge />
                    ) : null}
                    {!isReview && !isListing && approval.hasPendingConsideration ? (
                      <ConsiderationBadge />
                    ) : null}
                    {isListing && approval.hasActiveUnitConflict ? <SuccessionBadge /> : null}
                  </div>
                  <p className={cn('truncate sm:hidden', adminTableBodyText.secondary)}>
                    {isReview
                      ? approval.organizationName
                      : isListing
                        ? approval.organizationName
                        : approval.ownerName}
                  </p>
                  {isReview ? (
                    <p className={cn('mt-0.5 line-clamp-1', adminTableBodyText.secondary)}>
                      {approval.reviewText}
                    </p>
                  ) : null}
                </div>
              </td>
              <td className={cn(adminTableCell.body, 'hidden sm:table-cell')}>
                {isReview || isListing ? (
                  <p className={cn('truncate', adminTableBodyText.primary)}>
                    {approval.organizationName}
                  </p>
                ) : (
                  <div className="min-w-0">
                    <p className={cn('truncate', adminTableBodyText.primary)}>
                      {approval.ownerName}
                    </p>
                    {approval.ownerEmail ? (
                      <p className={cn('truncate', adminTableBodyText.secondary)}>
                        {approval.ownerEmail}
                      </p>
                    ) : null}
                  </div>
                )}
              </td>
              <td className={cn(adminTableCell.body, 'hidden sm:table-cell')}>
                <span className={adminTableBodyText.secondary}>
                  {approval.type === 'external_review'
                    ? externalReviewSourceLabel(approval.source)
                    : approval.type === 'reported_review'
                      ? 'Reported'
                      : isListing
                        ? listingKindLabel(approval.listingKind)
                        : hostModesLabel(approval.hostModes)}
                </span>
              </td>
              <td className={cn(adminTableCell.body, 'hidden md:table-cell')}>
                <span className={cn('tabular-nums', adminTableBodyText.secondary)}>
                  {formatSubmittedDate(
                    isReview
                      ? approval.submittedAt
                      : isListing
                        ? latestListingApprovalSubmittedAt(approval)
                        : latestApprovalSubmittedAt(approval)
                  )}
                </span>
              </td>
              <td className={cn(adminTableCell.body, 'whitespace-nowrap')}>
                {isReview ? (
                  <VerificationStatusBadge status={approval.moderationStatus} />
                ) : isListing ? (
                  <ListingApprovalQueueStatusCell approval={approval} />
                ) : (
                  <OrgApprovalQueueStatusCell approval={approval} />
                )}
              </td>
              <td className={adminTableCell.action}>
                <AdminTableRowAffordance />
              </td>
            </tr>
          );
        })}
      </tbody>
    </AdminDataTable>
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
      <div className="flex flex-col gap-1.5 whitespace-nowrap">
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
      <div className="flex flex-col gap-1.5 whitespace-nowrap">
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
