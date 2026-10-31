import { useState } from 'react';

import { Link } from 'react-router-dom';

import { ExternalLink, Loader2, MessageSquare, Star } from 'lucide-react';
import { toast } from 'sonner';

import { guestPropertyPath } from '@/features/guest/lib/guestPublicPaths';

import {
  VerificationDocFullViewDialog,
  VerificationDocPreviewCard,
  type VerificationPreviewAsset,
} from '@/features/dashboard/org/components/verification/VerificationDocPreview';
import { VerificationStatusBadge } from '@/features/dashboard/org/components/verification/VerificationStatusBadge';
import { externalReviewSourceLabel } from '@/features/dashboard/org/lib/propertyExternalReviews';
import {
  formatSuperAdminApprovalDate,
  superAdminApprovalDialogBodyClass,
  superAdminApprovalDialogContentClass,
  superAdminApprovalDialogFooterClass,
  superAdminApprovalDialogHeaderClass,
  superAdminApprovalSectionTitleClass,
  SuperAdminApprovalInfoRow,
  SuperAdminExternalReviewSourceBadge,
} from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalDialogLayout';
import {
  useExternalReviewAssets,
  useModerateExternalReview,
} from '@/features/dashboard/super-admin/hooks/useApprovals';
import type { ExternalReviewApprovalSummary } from '@/features/dashboard/super-admin/types/approval';

import { ReviewDialogSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

function MiniStarRating({ value }: { value: number | null }) {
  const rating = value ?? 5;
  return (
    <span className="inline-flex items-center gap-px" aria-hidden>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'size-3.5',
            star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25'
          )}
        />
      ))}
    </span>
  );
}

type Props = {
  approval: ExternalReviewApprovalSummary | null;
  onOpenChange: (open: boolean) => void;
};

export function SuperAdminExternalReviewDialog({ approval, onOpenChange }: Props) {
  const [fullView, setFullView] = useState<VerificationPreviewAsset | null>(null);
  const moderate = useModerateExternalReview();
  const assets = useExternalReviewAssets(approval?.propertyId ?? null, approval?.reviewId ?? null);

  const open = approval != null;
  const isPending = approval?.moderationStatus === 'pending';
  const screenshotUrl = assets.data?.imageUrl ?? approval?.imageUrl ?? null;
  const stayPhotoUrls = assets.data?.stayPhotoUrls ?? approval?.stayPhotoUrls ?? [];
  const submittedLabel = formatSuperAdminApprovalDate(approval?.submittedAt ?? null);
  const listingHref = approval?.propertySlug ? guestPropertyPath(approval.propertySlug) : null;
  const pendingDecision = moderate.isPending ? moderate.variables?.decision : undefined;
  const busy = moderate.isPending || assets.isLoading;

  const close = () => onOpenChange(false);

  async function handleDecision(decision: 'approved' | 'rejected') {
    if (!approval) return;
    try {
      await moderate.mutateAsync({
        propertyId: approval.propertyId,
        reviewId: approval.reviewId,
        decision,
      });
      toast.success(decision === 'approved' ? 'Review approved' : 'Review rejected');
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update review');
    }
  }

  if (!approval) return null;

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={(next) => (!next ? close() : null)}>
        <ResponsiveModalContent
          sheetLayout="split"
          showCloseButton
          className={superAdminApprovalDialogContentClass}
        >
          <ResponsiveModalHeader className={superAdminApprovalDialogHeaderClass}>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300">
                <MessageSquare className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <ResponsiveModalTitle className="text-base font-semibold sm:text-lg">
                    {approval.propertyName}
                  </ResponsiveModalTitle>
                  <SuperAdminExternalReviewSourceBadge source={approval.source} />
                  <VerificationStatusBadge status={approval.moderationStatus} />
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <span>{approval.organizationName}</span>
                  {submittedLabel !== '-' ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>Submitted {submittedLabel}</span>
                    </>
                  ) : null}
                  {listingHref ? (
                    <>
                      <span aria-hidden>·</span>
                      <Link
                        to={listingHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                      >
                        View listing
                        <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </ResponsiveModalHeader>

          <div className={superAdminApprovalDialogBodyClass}>
            {assets.isLoading ? (
              <ReviewDialogSkeleton />
            ) : (
              <div className="space-y-6">
                <section className="space-y-3">
                  <p className={superAdminApprovalSectionTitleClass}>Information</p>
                  <dl className="space-y-2.5">
                    <SuperAdminApprovalInfoRow
                      label="Organization"
                      value={approval.organizationName}
                    />
                    <SuperAdminApprovalInfoRow
                      label="Source"
                      value={externalReviewSourceLabel(approval.source)}
                    />
                    <SuperAdminApprovalInfoRow label="Submitted" value={submittedLabel} />
                    {approval.reviewerName.trim() ? (
                      <SuperAdminApprovalInfoRow
                        label="Reviewer"
                        value={approval.reviewerName.trim()}
                      />
                    ) : null}
                    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                      <dt className="text-muted-foreground w-[7.5rem] shrink-0 text-xs font-medium">
                        Rating
                      </dt>
                      <dd>
                        <MiniStarRating value={approval.starRating} />
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="space-y-3">
                  <p className={superAdminApprovalSectionTitleClass}>Review</p>
                  <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {approval.reviewText}
                  </p>
                  {stayPhotoUrls.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2.5 sm:max-w-md">
                      {stayPhotoUrls.map((url, index) => (
                        <VerificationDocPreviewCard
                          key={`${approval.reviewId}-stay-${index}`}
                          label={`Photo ${index + 1}`}
                          url={url}
                          onFullView={setFullView}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="space-y-3">
                  <p className={superAdminApprovalSectionTitleClass}>
                    Proof of guest&apos;s review
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:max-w-md sm:grid-cols-2">
                    <VerificationDocPreviewCard
                      label="Proof screenshot"
                      url={screenshotUrl}
                      onFullView={setFullView}
                    />
                  </div>
                </section>
              </div>
            )}
          </div>

          <ResponsiveModalFooter className={superAdminApprovalDialogFooterClass}>
            {isPending ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void handleDecision('rejected')}
                >
                  {pendingDecision === 'rejected' ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Rejecting…
                    </>
                  ) : (
                    'Reject'
                  )}
                </Button>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDecision('approved')}
                >
                  {pendingDecision === 'approved' ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Approving…
                    </>
                  ) : (
                    'Approve'
                  )}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
            )}
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <VerificationDocFullViewDialog
        asset={fullView}
        onClose={() => setFullView(null)}
        overlayClassName="z-[110]"
        contentClassName="z-[111]"
      />
    </>
  );
}
