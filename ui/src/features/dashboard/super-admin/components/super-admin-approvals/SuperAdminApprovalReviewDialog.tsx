import { useEffect, useMemo, useState } from 'react';

import { Ban, FileText, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { OrgListingVerificationRollup } from '@/features/dashboard/org/components/listing-authorization/OrgListingVerificationRollup';
import {
  VerificationDocFullViewDialog,
  VerificationDocPreviewCard,
  browserVerificationAssetUrl,
  getVerificationDocType,
  type VerificationPreviewAsset,
} from '@/features/dashboard/org/components/verification/VerificationDocPreview';
import { VerificationDocThumbnail } from '@/features/dashboard/org/components/verification/VerificationDocThumbnail';
import { VerificationStatusBadge } from '@/features/dashboard/org/components/verification/VerificationStatusBadge';
import { ORG_SOCIAL_PROOF_PLATFORMS } from '@/features/dashboard/org/lib/orgVerification';
import { VERIFICATION_TIER2_DOC_LABELS } from '@/features/dashboard/org/lib/verificationCopy';
import {
  formatSuperAdminApprovalDate,
  superAdminApprovalDialogBodyClass,
  superAdminApprovalDialogContentClass,
  superAdminApprovalDialogFooterClass,
  superAdminApprovalDialogHeaderClass,
  superAdminApprovalFooterButtonClass,
  superAdminApprovalSectionTitleClass,
  SuperAdminApprovalInfoRow,
} from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalDialogLayout';
import {
  useApproveOrgVerification,
  useDecideContractConsideration,
  useOrgVerificationAssets,
  useRejectOrgVerification,
} from '@/features/dashboard/super-admin/hooks/useApprovals';
import {
  approvalHasDualTierQueue,
  defaultApprovalReviewTier,
  type ApprovalReviewTier,
} from '@/features/dashboard/super-admin/lib/approvalReviewTier';
import {
  buildRejectionMessage,
  HOST_REJECTION_REASON_OPTIONS,
  type HostRejectionReasonId,
} from '@/features/dashboard/super-admin/lib/rejectReasonOptions';
import {
  buildChangeDocOptions,
  buildRequestChangesMessage,
  HOST_REQUEST_CHANGES_REASON_OPTIONS,
  type ChangeDocId,
  type HostRequestChangesReasonId,
} from '@/features/dashboard/super-admin/lib/requestChangesMessage';
import type {
  OrgApprovalSummary,
  OrgApprovalVerification,
} from '@/features/dashboard/super-admin/types/approval';

import { ReviewDialogSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Panel = 'review' | 'changes' | 'reject';

/** Wide, wrapping reason dropdown — long labels stay readable in the panel. */
const reasonSelectTriggerClass =
  'h-auto min-h-[44px] items-start gap-2 py-2.5 text-left [&>span]:line-clamp-none [&>span]:flex-1 [&>span]:whitespace-normal [&>span]:break-words';
const reasonSelectContentClass =
  'w-[var(--radix-select-trigger-width)] max-w-[min(calc(100vw-1.5rem),40rem)]';
const reasonSelectItemClass =
  'items-start whitespace-normal py-2.5 pl-9 pr-3 leading-snug [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words';

function platformLabel(value: string | null): string | null {
  if (!value) return null;
  return ORG_SOCIAL_PROOF_PLATFORMS.find((p) => p.value === value)?.label ?? value;
}

function hostModesLabel(hostModes: string[]): string {
  const hasProperty = hostModes.includes('property');
  const hasParking = hostModes.includes('parking');
  if (hasProperty && hasParking) return 'Property + Parking';
  if (hasParking) return 'Parking';
  return 'Property';
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <SuperAdminApprovalInfoRow label={label} value={value} />;
}

function formatApprovalDate(value: string | null): string {
  return formatSuperAdminApprovalDate(value);
}

function ApprovalReviewTierSwitcher({
  reviewTier,
  verification,
  onChange,
}: {
  reviewTier: ApprovalReviewTier;
  verification: OrgApprovalVerification;
  onChange: (tier: ApprovalReviewTier) => void;
}) {
  const tiers: Array<{ id: ApprovalReviewTier; label: string }> = [
    { id: 'base', label: 'Verified' },
    { id: 'enhanced', label: 'Recommended' },
  ];

  return (
    <div
      className="border-border bg-muted/30 flex flex-wrap gap-1 rounded-xl border p-1"
      role="tablist"
      aria-label="Verification tier"
    >
      {tiers.map((tier) => {
        const status =
          tier.id === 'enhanced' ? verification.enhancedStatus : verification.baseStatus;
        const kind =
          tier.id === 'enhanced'
            ? verification.enhancedRejectionKind
            : verification.baseRejectionKind;
        const selected = reviewTier === tier.id;
        return (
          <button
            key={tier.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              'flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
            )}
            onClick={() => onChange(tier.id)}
          >
            <span className="text-xs font-semibold">{tier.label}</span>
            <VerificationStatusBadge status={status} kind={kind} />
          </button>
        );
      })}
    </div>
  );
}

type Props = {
  approval: OrgApprovalSummary | null;
  onOpenChange: (open: boolean) => void;
};

export function SuperAdminApprovalReviewDialog({ approval, onOpenChange }: Props) {
  const open = Boolean(approval);
  const orgId = approval?.organizationId;
  const { data: detail, isLoading } = useOrgVerificationAssets(orgId);
  const approveMutation = useApproveOrgVerification();
  const rejectMutation = useRejectOrgVerification();
  const decideConsideration = useDecideContractConsideration();

  const [panel, setPanel] = useState<Panel>('review');
  const [rejectReasonId, setRejectReasonId] = useState<HostRejectionReasonId | ''>('');
  const [rejectCustomNote, setRejectCustomNote] = useState('');
  const [selectedChangeReasons, setSelectedChangeReasons] = useState<
    Set<HostRequestChangesReasonId>
  >(() => new Set());
  const [changeNote, setChangeNote] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<Set<ChangeDocId>>(() => new Set());
  const [fullView, setFullView] = useState<VerificationPreviewAsset | null>(null);
  const [reviewTier, setReviewTier] = useState<ApprovalReviewTier>('base');

  const hostModes = detail?.organization.hostModes ?? approval?.hostModes ?? [];
  const changeDocOptions = useMemo(
    () => (detail ? buildChangeDocOptions(detail) : []),
    [detail, hostModes]
  );
  const selectedLabels = changeDocOptions
    .filter((option) => selectedDocs.has(option.id))
    .map((option) => option.label);
  const selectedChangeReasonIds = HOST_REQUEST_CHANGES_REASON_OPTIONS.map((o) => o.id).filter(
    (id) => selectedChangeReasons.has(id)
  );
  const changesMessage = buildRequestChangesMessage(
    selectedChangeReasonIds,
    selectedLabels,
    changeNote
  );
  const rejectMessage = buildRejectionMessage(rejectReasonId, rejectCustomNote);

  useEffect(() => {
    if (!open) return;
    setPanel('review');
    setRejectReasonId('');
    setRejectCustomNote('');
    setSelectedChangeReasons(new Set());
    setChangeNote('');
    setSelectedDocs(new Set());
  }, [open, orgId]);

  useEffect(() => {
    if (!open || !approval) return;
    setReviewTier(defaultApprovalReviewTier(approval, detail?.verification));
  }, [open, approval, detail?.verification]);

  if (!approval) return null;

  const dualTierQueue = approvalHasDualTierQueue(approval);
  const status =
    reviewTier === 'enhanced'
      ? (detail?.verification.enhancedStatus ?? approval.enhancedStatus)
      : (detail?.verification.baseStatus ?? approval.baseStatus);
  const rejectionKind =
    reviewTier === 'enhanced'
      ? (detail?.verification.enhancedRejectionKind ?? null)
      : (detail?.verification.baseRejectionKind ?? approval.baseRejectionKind ?? null);
  const rejectionReason =
    reviewTier === 'enhanced'
      ? (detail?.verification.enhancedRejectionReason ?? null)
      : (detail?.verification.baseRejectionReason ?? approval.baseRejectionReason ?? null);
  const decided = status !== 'pending';
  const verification = detail?.verification;
  const busy = approveMutation.isPending || rejectMutation.isPending;

  const close = () => {
    setPanel('review');
    setRejectReasonId('');
    setRejectCustomNote('');
    setSelectedChangeReasons(new Set());
    setChangeNote('');
    setSelectedDocs(new Set());
    setFullView(null);
    onOpenChange(false);
  };

  const switchReviewTier = (tier: ApprovalReviewTier) => {
    setReviewTier(tier);
    backToReview();
  };

  const backToReview = () => {
    setPanel('review');
    setRejectReasonId('');
    setRejectCustomNote('');
    setSelectedChangeReasons(new Set());
    setChangeNote('');
    setSelectedDocs(new Set());
  };

  const toggleDoc = (id: ChangeDocId, checked: boolean) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleChangeReason = (id: HostRequestChangesReasonId, checked: boolean) => {
    setSelectedChangeReasons((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ orgId: approval.organizationId, tier: reviewTier });
      toast.success(
        reviewTier === 'enhanced'
          ? `${approval.organizationName} Recommended tier approved`
          : `${approval.organizationName} approved`
      );
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed');
    }
  };

  const handleReject = async () => {
    if (!rejectMessage) return;
    try {
      await rejectMutation.mutateAsync({
        orgId: approval.organizationId,
        tier: reviewTier,
        kind: 'rejected',
        reason: rejectMessage,
      });
      toast.success(`${approval.organizationName} rejected`);
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save decision');
    }
  };

  const handleRequestChanges = async () => {
    if (!changesMessage) return;
    try {
      await rejectMutation.mutateAsync({
        orgId: approval.organizationId,
        tier: reviewTier,
        kind: 'changes',
        reason: changesMessage,
        ...(reviewTier === 'base' ? { changesRequestedDocs: Array.from(selectedDocs) } : {}),
      });
      toast.success(`${approval.organizationName}: changes requested`);
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not request changes');
    }
  };

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={(next) => (!next ? close() : null)}>
        <ResponsiveModalContent
          sheetLayout="split"
          showCloseButton
          className={superAdminApprovalDialogContentClass}
        >
          <ResponsiveModalHeader
            className={cn(
              superAdminApprovalDialogHeaderClass,
              panel === 'changes' && 'bg-orange-500/[0.04]',
              panel === 'reject' && 'bg-destructive/[0.04]'
            )}
          >
            {panel === 'changes' ? (
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-700">
                  <RefreshCw className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 space-y-1">
                  <ResponsiveModalTitle className="text-base font-semibold sm:text-lg">
                    Request changes
                  </ResponsiveModalTitle>
                  <p className="text-muted-foreground truncate text-xs">
                    {approval.organizationName}
                    {approval.ownerName ? ` · ${approval.ownerName}` : ''}
                  </p>
                </div>
              </div>
            ) : panel === 'reject' ? (
              <div className="flex items-start gap-3">
                <span className="bg-destructive/10 text-destructive flex size-10 shrink-0 items-center justify-center rounded-full">
                  <Ban className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 space-y-1">
                  <ResponsiveModalTitle className="text-base font-semibold sm:text-lg">
                    Reject
                  </ResponsiveModalTitle>
                  <p className="text-muted-foreground truncate text-xs">
                    {approval.organizationName}
                    {approval.ownerName ? ` · ${approval.ownerName}` : ''}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <ResponsiveModalTitle className="text-base font-semibold sm:text-lg">
                    {approval.organizationName}
                  </ResponsiveModalTitle>
                  {!dualTierQueue ? (
                    <span className="text-muted-foreground text-xs font-medium">
                      {reviewTier === 'enhanced' ? 'Recommended' : 'Verified'}
                    </span>
                  ) : null}
                  {!dualTierQueue ? (
                    <VerificationStatusBadge status={status} kind={rejectionKind} />
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  {approval.ownerName}
                  {approval.ownerEmail ? ` · ${approval.ownerEmail}` : ''}
                </p>
              </>
            )}
          </ResponsiveModalHeader>

          <div className={superAdminApprovalDialogBodyClass}>
            {isLoading || !detail || !verification ? (
              <ReviewDialogSkeleton />
            ) : panel === 'changes' ? (
              <div className="space-y-5">
                <fieldset className="space-y-2">
                  <legend className="text-foreground text-xs font-semibold">
                    Reason <span className="text-destructive">*</span>
                  </legend>
                  <div className="space-y-1.5">
                    {HOST_REQUEST_CHANGES_REASON_OPTIONS.map((option) => {
                      const checked = selectedChangeReasons.has(option.id);
                      const checkboxId = `request-change-reason-${option.id}`;
                      return (
                        <label
                          key={option.id}
                          htmlFor={checkboxId}
                          className={cn(
                            'border-border flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                            checked ? 'border-orange-500/40 bg-orange-500/5' : 'hover:bg-muted/40'
                          )}
                        >
                          <Checkbox
                            id={checkboxId}
                            checked={checked}
                            className="mt-0.5"
                            onCheckedChange={(value) =>
                              toggleChangeReason(option.id, value === true)
                            }
                          />
                          <span className="text-foreground min-w-0 flex-1 text-sm font-medium leading-snug">
                            {option.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-foreground text-xs font-semibold uppercase tracking-wide">
                    Documents to fix
                  </legend>
                  <div className="space-y-1.5">
                    {changeDocOptions.map((option) => {
                      const checked = selectedDocs.has(option.id);
                      const checkboxId = `request-change-doc-${option.id}`;
                      return (
                        <label
                          key={option.id}
                          htmlFor={checkboxId}
                          className={cn(
                            'border-border flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                            checked ? 'border-orange-500/40 bg-orange-500/5' : 'hover:bg-muted/40'
                          )}
                        >
                          <Checkbox
                            id={checkboxId}
                            checked={checked}
                            onCheckedChange={(value) => toggleDoc(option.id, value === true)}
                          />
                          <span className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-lg">
                            {(() => {
                              const thumbUrl = browserVerificationAssetUrl(option.url);
                              if (!thumbUrl) {
                                return (
                                  <span className="text-muted-foreground flex size-full items-center justify-center">
                                    <FileText className="size-4" aria-hidden />
                                  </span>
                                );
                              }
                              return (
                                <VerificationDocThumbnail
                                  url={thumbUrl}
                                  type={getVerificationDocType(thumbUrl)}
                                  label={option.label}
                                />
                              );
                            })()}
                          </span>
                          <span className="text-foreground min-w-0 flex-1 text-sm font-medium">
                            {option.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="space-y-1.5">
                  <label
                    htmlFor="request-changes-note"
                    className="text-foreground text-xs font-semibold"
                  >
                    Additional notes
                  </label>
                  <Textarea
                    id="request-changes-note"
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                    placeholder="Optional details for the host…"
                    className="min-h-[88px]"
                  />
                </div>

                <div
                  className={cn(
                    'rounded-xl border px-3.5 py-3',
                    changesMessage
                      ? 'border-orange-500/30 bg-orange-500/5'
                      : 'border-border bg-muted/30 border-dashed'
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-800/80">
                    Host will see
                  </p>
                  {changesMessage ? (
                    <p className="text-foreground mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                      {changesMessage}
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-1.5 text-sm">
                      Select at least one reason
                    </p>
                  )}
                </div>
              </div>
            ) : panel === 'reject' ? (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="reject-reason-select"
                    className="text-foreground text-xs font-semibold"
                  >
                    Rejection reason <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={rejectReasonId || undefined}
                    onValueChange={(value) => setRejectReasonId(value as HostRejectionReasonId)}
                  >
                    <SelectTrigger id="reject-reason-select" className={reasonSelectTriggerClass}>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent className={reasonSelectContentClass}>
                      {HOST_REJECTION_REASON_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.id}
                          value={option.id}
                          className={reasonSelectItemClass}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reject-custom-note"
                    className="text-foreground text-xs font-semibold"
                  >
                    Additional notes
                  </label>
                  <Textarea
                    id="reject-custom-note"
                    value={rejectCustomNote}
                    onChange={(e) => setRejectCustomNote(e.target.value)}
                    placeholder="Optional details for the host…"
                    className="min-h-[88px]"
                  />
                </div>

                <div
                  className={cn(
                    'rounded-xl border px-3.5 py-3',
                    rejectMessage
                      ? 'border-destructive/30 bg-destructive/5'
                      : 'border-border bg-muted/30 border-dashed'
                  )}
                >
                  <p className="text-destructive/80 text-[11px] font-semibold uppercase tracking-wide">
                    Host will see
                  </p>
                  {rejectMessage ? (
                    <p className="text-foreground mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                      {rejectMessage}
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-1.5 text-sm">
                      Select a rejection reason
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {dualTierQueue ? (
                  <ApprovalReviewTierSwitcher
                    reviewTier={reviewTier}
                    verification={verification}
                    onChange={switchReviewTier}
                  />
                ) : null}
                {approval.hasPendingConsideration ? (
                  <section className="border-border space-y-3 rounded-xl border p-3">
                    <p className="text-foreground text-xs font-semibold uppercase tracking-wide">
                      Consideration
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ['property', approval.propertyConsiderationStatus],
                          ['parking', approval.parkingConsiderationStatus],
                        ] as const
                      )
                        .filter(([, status]) => status === 'pending')
                        .map(([leg]) => (
                          <div key={leg} className="flex flex-wrap gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              className="min-h-[44px]"
                              disabled={decideConsideration.isPending}
                              onClick={() => {
                                void decideConsideration
                                  .mutateAsync({
                                    orgId: approval.organizationId,
                                    leg,
                                    decision: 'grant',
                                  })
                                  .then(() => {
                                    toast.success(`${leg} consideration granted`);
                                    onOpenChange(false);
                                  })
                                  .catch((err: Error) => toast.error(err.message));
                              }}
                            >
                              Grant {leg}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="min-h-[44px]"
                              disabled={decideConsideration.isPending}
                              onClick={() => {
                                void decideConsideration
                                  .mutateAsync({
                                    orgId: approval.organizationId,
                                    leg,
                                    decision: 'deny',
                                  })
                                  .then(() => {
                                    toast.success(`${leg} consideration denied`);
                                    onOpenChange(false);
                                  })
                                  .catch((err: Error) => toast.error(err.message));
                              }}
                            >
                              Deny {leg}
                            </Button>
                          </div>
                        ))}
                    </div>
                  </section>
                ) : null}
                <section className="space-y-3">
                  <p className={superAdminApprovalSectionTitleClass}>Information</p>
                  <dl className="space-y-2.5">
                    <InfoRow label="Hosting" value={hostModesLabel(hostModes)} />
                    <InfoRow
                      label="Submitted"
                      value={formatApprovalDate(
                        reviewTier === 'enhanced'
                          ? (verification.enhancedSubmittedAt ?? approval.enhancedSubmittedAt)
                          : (verification.baseSubmittedAt ?? approval.baseSubmittedAt)
                      )}
                    />
                    {reviewTier === 'enhanced' && verification.platformAdminPlatform ? (
                      <InfoRow
                        label="Platform"
                        value={
                          platformLabel(verification.platformAdminPlatform) ?? 'Platform not set'
                        }
                      />
                    ) : null}
                  </dl>
                </section>

                <section className="space-y-3">
                  <p className={superAdminApprovalSectionTitleClass}>Documents</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {reviewTier === 'enhanced' ? (
                      <>
                        <VerificationDocPreviewCard
                          label="Facebook Page screenshot"
                          url={detail.assetUrls.socialProofUrl}
                          onFullView={setFullView}
                        />
                        <VerificationDocPreviewCard
                          label={VERIFICATION_TIER2_DOC_LABELS.selfie}
                          url={detail.assetUrls.selfieWithIdUrl}
                          onFullView={setFullView}
                        />
                        <VerificationDocPreviewCard
                          label={
                            platformLabel(verification.platformAdminPlatform)
                              ? `${platformLabel(verification.platformAdminPlatform)} admin`
                              : VERIFICATION_TIER2_DOC_LABELS.platformAdmin
                          }
                          url={detail.assetUrls.platformAdminProofUrl}
                          onFullView={setFullView}
                        />
                        {detail.assetUrls.legitimacyCheckProofUrl ? (
                          <VerificationDocPreviewCard
                            label={VERIFICATION_TIER2_DOC_LABELS.legitimacyCheck}
                            url={detail.assetUrls.legitimacyCheckProofUrl}
                            onFullView={setFullView}
                          />
                        ) : null}
                        {detail.assetUrls.businessPermitOrBirUrl ? (
                          <VerificationDocPreviewCard
                            label={VERIFICATION_TIER2_DOC_LABELS.businessPermit}
                            url={detail.assetUrls.businessPermitOrBirUrl}
                            onFullView={setFullView}
                          />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <VerificationDocPreviewCard
                          label="Valid ID"
                          url={detail.assetUrls.validIdUrl}
                          onFullView={setFullView}
                        />
                        <VerificationDocPreviewCard
                          label="Facebook Page screenshot"
                          url={detail.assetUrls.socialProofUrl}
                          onFullView={setFullView}
                        />
                      </>
                    )}
                  </div>
                </section>

                <OrgListingVerificationRollup
                  orgId={approval.organizationId}
                  orgSlug={approval.organizationSlug}
                  enabled={open}
                  readOnly
                />

                {status === 'rejected' && rejectionReason ? (
                  <div
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-xs leading-relaxed',
                      rejectionKind === 'changes'
                        ? 'border-orange-500/25 bg-orange-500/5 text-orange-950'
                        : 'border-destructive/25 bg-destructive/5 text-destructive'
                    )}
                  >
                    <p className="font-semibold">
                      {rejectionKind === 'changes' ? 'Changes requested' : 'Rejection reason'}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{rejectionReason}</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <ResponsiveModalFooter className={superAdminApprovalDialogFooterClass}>
            {decided ? (
              <Button
                type="button"
                variant="outline"
                className={superAdminApprovalFooterButtonClass}
                onClick={close}
              >
                Close
              </Button>
            ) : panel === 'changes' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className={superAdminApprovalFooterButtonClass}
                  onClick={backToReview}
                  disabled={busy}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className={cn(
                    superAdminApprovalFooterButtonClass,
                    'bg-orange-600 text-white hover:bg-orange-700'
                  )}
                  disabled={busy || !changesMessage}
                  onClick={() => void handleRequestChanges()}
                >
                  {rejectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Sending…
                    </>
                  ) : (
                    'Request changes'
                  )}
                </Button>
              </>
            ) : panel === 'reject' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className={superAdminApprovalFooterButtonClass}
                  onClick={backToReview}
                  disabled={busy}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className={superAdminApprovalFooterButtonClass}
                  disabled={busy || !rejectMessage}
                  onClick={() => void handleReject()}
                >
                  {rejectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Rejecting…
                    </>
                  ) : (
                    'Confirm reject'
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    superAdminApprovalFooterButtonClass,
                    'border-orange-500/35 text-orange-800 hover:bg-orange-500/10 hover:text-orange-900'
                  )}
                  onClick={() => setPanel('changes')}
                  disabled={busy || isLoading || !detail}
                >
                  Request changes
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className={superAdminApprovalFooterButtonClass}
                  onClick={() => setPanel('reject')}
                  disabled={busy}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  className={superAdminApprovalFooterButtonClass}
                  disabled={busy || isLoading}
                  onClick={() => void handleApprove()}
                >
                  {approveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Approving…
                    </>
                  ) : (
                    'Approve'
                  )}
                </Button>
              </>
            )}
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {fullView ? (
        <VerificationDocFullViewDialog
          asset={fullView}
          onClose={() => setFullView(null)}
          overlayClassName="z-[110]"
          contentClassName="z-[111]"
        />
      ) : null}
    </>
  );
}
