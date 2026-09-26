import { useEffect, useMemo, useState } from 'react';

import { Ban, FileText, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import {
  VerificationDocFullViewDialog,
  VerificationDocPreviewCard,
  browserVerificationAssetUrl,
  getVerificationDocType,
  type VerificationPreviewAsset,
} from '@/features/dashboard/org/components/verification/VerificationDocPreview';
import { VerificationDocThumbnail } from '@/features/dashboard/org/components/verification/VerificationDocThumbnail';
import { VerificationStatusBadge } from '@/features/dashboard/org/components/verification/VerificationStatusBadge';
import {
  LISTING_VERIFICATION_DOC_LABELS,
  listingKindLabel,
} from '@/features/dashboard/org/lib/listingVerificationCopy';
import { ORG_VERIFICATION_RIGHTS } from '@/features/dashboard/org/lib/orgVerification';
import { formatTowerAndUnit } from '@/features/dashboard/org/lib/propertyTowerUnit';
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
  useApproveListingAuthorization,
  useApproveListingRecommended,
  useListingAuthorizationAssets,
  useRejectListingAuthorization,
} from '@/features/dashboard/super-admin/hooks/useApprovals';
import {
  defaultListingApprovalReviewTier,
  listingApprovalHasDualTierQueue,
  listingApprovalTierRejectionKind,
  listingApprovalTierRejectionReason,
  listingApprovalTierStatus,
  listingApprovalTierSubmittedAt,
  type ListingApprovalReviewTier,
} from '@/features/dashboard/super-admin/lib/listingApprovalReviewTier';
import {
  buildListingChangeDocOptions,
  type ListingChangeDocId,
} from '@/features/dashboard/super-admin/lib/listingRequestChangesMessage';
import {
  buildRejectionMessage,
  HOST_REJECTION_REASON_OPTIONS,
  type HostRejectionReasonId,
} from '@/features/dashboard/super-admin/lib/rejectReasonOptions';
import {
  buildRequestChangesMessage,
  HOST_REQUEST_CHANGES_REASON_OPTIONS,
  type HostRequestChangesReasonId,
} from '@/features/dashboard/super-admin/lib/requestChangesMessage';
import type {
  ListingVerificationApprovalSummary,
  OrgApprovalUnitConflict,
} from '@/features/dashboard/super-admin/types/approval';

import { ReviewDialogSkeleton } from '@/components/skeletons/AdminSkeletons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

const reasonSelectTriggerClass =
  'h-auto min-h-[44px] items-start gap-2 py-2.5 text-left [&>span]:line-clamp-none [&>span]:flex-1 [&>span]:whitespace-normal [&>span]:break-words';
const reasonSelectContentClass =
  'w-[var(--radix-select-trigger-width)] max-w-[min(calc(100vw-1.5rem),40rem)]';
const reasonSelectItemClass =
  'items-start whitespace-normal py-2.5 pl-9 pr-3 leading-snug [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words';

function rightsLabel(value: string | null): string | null {
  if (!value) return null;
  return ORG_VERIFICATION_RIGHTS.find((r) => r.value === value)?.label ?? value;
}

function successionConfirmMessage(conflicts: OrgApprovalUnitConflict[]): string {
  const orgNames = [...new Set(conflicts.map((c) => c.orgName.trim()).filter(Boolean))];
  const orgLabel = orgNames[0] || 'the current host';
  if (orgNames.length <= 1) {
    return `Archive ${orgLabel}'s active listing and activate this one. Future bookings stay on the old property.`;
  }
  return `Archive active listings from ${orgNames.join(', ')} and activate this one. Future bookings stay on the old property.`;
}

function UnitConflictList({ conflicts }: { conflicts: OrgApprovalUnitConflict[] }) {
  if (conflicts.length === 0) return null;

  return (
    <section className="space-y-3">
      <p className="text-foreground text-xs font-semibold uppercase tracking-wide">
        Active listing
      </p>
      <ul className="border-border divide-border divide-y overflow-hidden rounded-xl border">
        {conflicts.map((conflict) => {
          const orgLabel = conflict.orgName.trim() || 'Unknown org';
          const unitLabel = formatTowerAndUnit(conflict.tower, conflict.unitNumber);
          return (
            <li
              key={conflict.propertyId}
              className="flex min-h-[44px] flex-col gap-0.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">{orgLabel}</p>
                <p className="text-muted-foreground truncate text-xs tabular-nums">{unitLabel}</p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs font-medium uppercase tracking-wide">
                {conflict.status || 'ACTIVE'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ListingReviewTierSwitcher({
  reviewTier,
  approval,
  detail,
  onChange,
}: {
  reviewTier: ListingApprovalReviewTier;
  approval: ListingVerificationApprovalSummary;
  detail: NonNullable<ReturnType<typeof useListingAuthorizationAssets>['data']> | undefined;
  onChange: (tier: ListingApprovalReviewTier) => void;
}) {
  const tiers: Array<{ id: ListingApprovalReviewTier; label: string }> = [
    { id: 'base', label: 'Verified' },
    { id: 'recommended', label: 'Recommended' },
  ];

  return (
    <div
      className="border-border bg-muted/30 flex flex-wrap gap-1 rounded-xl border p-1"
      role="tablist"
      aria-label="Listing verification tier"
    >
      {tiers.map((tier) => {
        const status = listingApprovalTierStatus(approval, tier.id, detail ?? null);
        const kind = listingApprovalTierRejectionKind(approval, tier.id, detail ?? null);
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
  approval: ListingVerificationApprovalSummary | null;
  onOpenChange: (open: boolean) => void;
};

export function SuperAdminListingVerificationDialog({ approval, onOpenChange }: Props) {
  const open = Boolean(approval);
  const listingKind = approval?.listingKind;
  const listingId = approval?.listingId;
  const { data: detail, isLoading } = useListingAuthorizationAssets(listingKind, listingId, open);
  const approveBase = useApproveListingAuthorization();
  const approveRecommended = useApproveListingRecommended();
  const rejectMutation = useRejectListingAuthorization();

  const [panel, setPanel] = useState<Panel>('review');
  const [rejectReasonId, setRejectReasonId] = useState<HostRejectionReasonId | ''>('');
  const [rejectCustomNote, setRejectCustomNote] = useState('');
  const [selectedChangeReasons, setSelectedChangeReasons] = useState<
    Set<HostRequestChangesReasonId>
  >(() => new Set());
  const [changeNote, setChangeNote] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<Set<ListingChangeDocId>>(() => new Set());
  const [fullView, setFullView] = useState<VerificationPreviewAsset | null>(null);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [reviewTier, setReviewTier] = useState<ListingApprovalReviewTier>('base');

  const changeDocOptions = useMemo(
    () => (detail ? buildListingChangeDocOptions(detail, reviewTier) : []),
    [detail, reviewTier]
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
    setApproveConfirmOpen(false);
  }, [open, listingId, listingKind]);

  useEffect(() => {
    if (!open || !approval) return;
    setReviewTier(defaultListingApprovalReviewTier(approval, detail ?? null));
  }, [open, approval, detail]);

  if (!approval) return null;

  const unitConflicts = approval.unitConflicts ?? [];
  const hasActiveUnitConflict = approval.hasActiveUnitConflict === true || unitConflicts.length > 0;
  const dualTierQueue = listingApprovalHasDualTierQueue(approval);
  const status = listingApprovalTierStatus(approval, reviewTier, detail ?? null);
  const rejectionKind = listingApprovalTierRejectionKind(approval, reviewTier, detail ?? null);
  const rejectionReason = listingApprovalTierRejectionReason(approval, reviewTier, detail ?? null);
  const decided = status !== 'pending';
  const busy = approveBase.isPending || approveRecommended.isPending || rejectMutation.isPending;

  const close = () => {
    setPanel('review');
    setRejectReasonId('');
    setRejectCustomNote('');
    setSelectedChangeReasons(new Set());
    setChangeNote('');
    setSelectedDocs(new Set());
    setFullView(null);
    setApproveConfirmOpen(false);
    onOpenChange(false);
  };

  const backToReview = () => {
    setPanel('review');
    setRejectReasonId('');
    setRejectCustomNote('');
    setSelectedChangeReasons(new Set());
    setChangeNote('');
    setSelectedDocs(new Set());
  };

  const switchReviewTier = (tier: ListingApprovalReviewTier) => {
    setReviewTier(tier);
    backToReview();
  };

  const toggleDoc = (id: ListingChangeDocId, checked: boolean) => {
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
    if (!approval) return;
    try {
      if (reviewTier === 'recommended') {
        await approveRecommended.mutateAsync({
          listingKind: approval.listingKind,
          listingId: approval.listingId,
        });
        toast.success(`${approval.listingName} Recommended tier approved`);
      } else {
        await approveBase.mutateAsync({
          listingKind: approval.listingKind,
          listingId: approval.listingId,
        });
        toast.success(`${approval.listingName} approved`);
      }
      setApproveConfirmOpen(false);
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed');
    }
  };

  const requestApprove = () => {
    if (reviewTier === 'base' && approval.listingKind === 'property' && hasActiveUnitConflict) {
      setApproveConfirmOpen(true);
      return;
    }
    void handleApprove();
  };

  const handleReject = async () => {
    if (!rejectMessage || !approval) return;
    try {
      await rejectMutation.mutateAsync({
        listingKind: approval.listingKind,
        listingId: approval.listingId,
        tier: reviewTier,
        kind: 'rejected',
        reason: rejectMessage,
      });
      toast.success(`${approval.listingName} rejected`);
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save decision');
    }
  };

  const handleRequestChanges = async () => {
    if (!changesMessage || !approval) return;
    try {
      await rejectMutation.mutateAsync({
        listingKind: approval.listingKind,
        listingId: approval.listingId,
        tier: reviewTier,
        kind: 'changes',
        reason: changesMessage,
      });
      toast.success(`${approval.listingName}: changes requested`);
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not request changes');
    }
  };

  const relationship = detail?.authorization.relationship ?? approval.relationship ?? null;
  const contractEndDate = detail?.authorization.contractEndDate ?? approval.contractEndDate ?? null;

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
                    {approval.listingName} · {approval.organizationName}
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
                    {approval.listingName} · {approval.organizationName}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <ResponsiveModalTitle className="text-base font-semibold sm:text-lg">
                    {approval.listingName}
                  </ResponsiveModalTitle>
                  {!dualTierQueue ? (
                    <span className="text-muted-foreground text-xs font-medium">
                      {reviewTier === 'recommended' ? 'Recommended' : 'Verified'}
                    </span>
                  ) : null}
                  {!dualTierQueue ? (
                    <VerificationStatusBadge status={status} kind={rejectionKind} />
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  {approval.organizationName}
                  {approval.ownerName ? ` · ${approval.ownerName}` : ''}
                </p>
              </>
            )}
          </ResponsiveModalHeader>

          <div className={superAdminApprovalDialogBodyClass}>
            {isLoading || !detail ? (
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
                      const checkboxId = `listing-request-change-reason-${option.id}`;
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
                      const checkboxId = `listing-request-change-doc-${option.id}`;
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
                    htmlFor="listing-request-changes-note"
                    className="text-foreground text-xs font-semibold"
                  >
                    Additional notes
                  </label>
                  <Textarea
                    id="listing-request-changes-note"
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
                    htmlFor="listing-reject-reason-select"
                    className="text-foreground text-xs font-semibold"
                  >
                    Rejection reason <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={rejectReasonId || undefined}
                    onValueChange={(value) => setRejectReasonId(value as HostRejectionReasonId)}
                  >
                    <SelectTrigger
                      id="listing-reject-reason-select"
                      className={reasonSelectTriggerClass}
                    >
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
                    htmlFor="listing-reject-custom-note"
                    className="text-foreground text-xs font-semibold"
                  >
                    Additional notes
                  </label>
                  <Textarea
                    id="listing-reject-custom-note"
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
                  <ListingReviewTierSwitcher
                    reviewTier={reviewTier}
                    approval={approval}
                    detail={detail}
                    onChange={switchReviewTier}
                  />
                ) : null}

                <section className="space-y-3">
                  <p className={superAdminApprovalSectionTitleClass}>Information</p>
                  <dl className="space-y-2.5">
                    <SuperAdminApprovalInfoRow
                      label="Kind"
                      value={listingKindLabel(approval.listingKind)}
                    />
                    <SuperAdminApprovalInfoRow
                      label="Submitted"
                      value={formatSuperAdminApprovalDate(
                        listingApprovalTierSubmittedAt(approval, reviewTier, detail)
                      )}
                    />
                    {reviewTier === 'base' ? (
                      <>
                        <SuperAdminApprovalInfoRow
                          label="Rights"
                          value={rightsLabel(relationship) ?? 'Rights not set'}
                        />
                        {contractEndDate ? (
                          <SuperAdminApprovalInfoRow
                            label="Contract end"
                            value={formatSuperAdminApprovalDate(contractEndDate)}
                          />
                        ) : null}
                        {approval.tower && approval.unitNumber ? (
                          <SuperAdminApprovalInfoRow
                            label="Unit"
                            value={formatTowerAndUnit(approval.tower, approval.unitNumber)}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </dl>
                </section>

                {reviewTier === 'base' ? <UnitConflictList conflicts={unitConflicts} /> : null}

                <section className="space-y-3">
                  <p className={superAdminApprovalSectionTitleClass}>Documents</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {reviewTier === 'base' ? (
                      <VerificationDocPreviewCard
                        label={LISTING_VERIFICATION_DOC_LABELS.proof}
                        url={detail.assetUrls.proofUrl}
                        onFullView={setFullView}
                      />
                    ) : (
                      <>
                        <VerificationDocPreviewCard
                          label={LISTING_VERIFICATION_DOC_LABELS.additionalProof}
                          url={detail.assetUrls.additionalProofUrl}
                          onFullView={setFullView}
                        />
                        <VerificationDocPreviewCard
                          label={LISTING_VERIFICATION_DOC_LABELS.azurePmoConfirmation}
                          url={detail.assetUrls.azurePmoConfirmationUrl}
                          onFullView={setFullView}
                        />
                      </>
                    )}
                  </div>
                </section>

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
                  onClick={() => void requestApprove()}
                >
                  {approveBase.isPending || approveRecommended.isPending ? (
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

      <AlertDialog open={approveConfirmOpen} onOpenChange={setApproveConfirmOpen}>
        <AlertDialogContent
          className={cn(
            'max-h-[min(90dvh,32rem)] max-w-[min(calc(100vw-1.5rem),28rem)] overflow-y-auto'
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Approve succession?</AlertDialogTitle>
            <AlertDialogDescription>
              {successionConfirmMessage(unitConflicts)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="min-h-[44px]" disabled={busy}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[44px]"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void handleApprove();
              }}
            >
              {approveBase.isPending ? 'Approving…' : 'Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
