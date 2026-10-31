import { useEffect, useMemo, useState } from 'react';

import { AlertCircle, Check, Home, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { ListingRecommendedBadgePreview } from '@/features/dashboard/org/components/listing-authorization/ListingRecommendedBadgePreview';
import { ListingVerificationSubmittedDocs } from '@/features/dashboard/org/components/listing-authorization/ListingVerificationSubmittedDocs';
import { OnboardingProofUpload } from '@/features/dashboard/org/components/onboarding/OnboardingProofUpload';
import { OnboardingVerificationRightsFields } from '@/features/dashboard/org/components/onboarding/OnboardingVerificationRightsFields';
import { VerificationTierProgress } from '@/features/dashboard/org/components/verification/VerificationTierProgress';
import {
  useListingAuthorizationAssets,
  useListingAuthorizationMutations,
} from '@/features/dashboard/org/hooks/useListingAuthorization';
import { handleAiMutationError, isAiQuotaError } from '@/features/dashboard/org/lib/aiQuotaToast';
import {
  isInGracePeriod,
  isInPreExpiryWindow,
  isListingAccessLocked,
} from '@/features/dashboard/org/lib/contractLifecycle';
import {
  canSubmitBaseListingAuthorization,
  canSubmitListingRenewal,
  canSubmitRecommendedListingAuthorization,
  isListingAuthorizationChangesRequested,
  isListingAuthorizationHardRejected,
  isListingRenewEligible,
  listingAuthorizationHasPrimaryProof,
  listingRightsNeedContractEnd,
  readListingAuthorizationSummary,
  type ListingAuthorizationAssetType,
  type ListingKind,
} from '@/features/dashboard/org/lib/listingAuthorization';
import {
  LISTING_VERIFICATION_BENEFIT_BULLETS,
  LISTING_VERIFICATION_DOC_HELP,
  LISTING_VERIFICATION_DOC_LABELS,
  LISTING_VERIFICATION_REVIEW_TIMELINE,
  LISTING_VERIFICATION_TIER1_TITLE,
  LISTING_VERIFICATION_TIER2_APPROVED,
  LISTING_VERIFICATION_TIER2_PREREQ,
  LISTING_VERIFICATION_TIER2_TITLE,
  listingTier1ApprovedCopy,
  listingVerificationModalTitle,
} from '@/features/dashboard/org/lib/listingVerificationCopy';
import {
  buildListingBaseChecklist,
  buildListingRecommendedChecklist,
  buildListingVerificationTiers,
  defaultListingVerificationStepIndex,
} from '@/features/dashboard/org/lib/listingVerificationTiers';
import {
  todayManilaYmd,
  validateVerificationContractEndDate,
  validateVerificationFile,
  verificationRightsNeedsContractEnd,
  verificationRightsProofHelp,
  type OrgVerificationRights,
} from '@/features/dashboard/org/lib/orgVerification';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  listingKind: ListingKind;
  listingId: string;
  listingName: string;
  listingSettings: Record<string, unknown> | null | undefined;
  isOwner: boolean;
};

function VerificationFeedbackAlert({
  kind,
  title,
  message,
}: {
  kind: 'changes' | 'rejected';
  title: string;
  message: string;
}) {
  const isChanges = kind === 'changes';
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-xl border px-4 py-3.5',
        isChanges
          ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-destructive/40 bg-destructive/10'
      )}
    >
      <AlertCircle
        className={cn(
          'mt-0.5 size-5 shrink-0',
          isChanges ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'
        )}
        aria-hidden
      />
      <div className="min-w-0 space-y-1">
        <p
          className={cn(
            'text-sm font-semibold leading-snug',
            isChanges ? 'text-amber-900 dark:text-amber-100' : 'text-destructive dark:text-red-200'
          )}
        >
          {title}
        </p>
        <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

function ListingTier1ProofUpload({
  listingKind,
  sectionKind,
  rights,
  proofPreview,
  proofPath,
  uploading,
  showErrors,
  onUpload,
}: {
  listingKind: ListingKind;
  sectionKind: 'property' | 'parking';
  rights: OrgVerificationRights | '';
  proofPreview: string | null;
  proofPath: string | null;
  uploading: boolean;
  showErrors: boolean;
  onUpload: (assetType: ListingAuthorizationAssetType, file: File) => void;
}) {
  return (
    <OnboardingProofUpload
      id={`${listingKind}-verification-proof`}
      label={LISTING_VERIFICATION_DOC_LABELS.proof}
      help={verificationRightsProofHelp(rights, sectionKind)}
      file={null}
      previewUrl={proofPreview}
      uploading={uploading}
      error={showErrors && !proofPath ? 'Required' : null}
      onFileChange={(file) => {
        if (file) onUpload('proof', file);
      }}
    />
  );
}

function ListingTier2ProofUploads({
  listingKind,
  additionalProofPreview,
  azurePmoPreview,
  additionalProofPath,
  azurePmoPath,
  uploading,
  showErrors,
  onUpload,
}: {
  listingKind: ListingKind;
  additionalProofPreview: string | null;
  azurePmoPreview: string | null;
  additionalProofPath: string | null;
  azurePmoPath: string | null;
  uploading: boolean;
  showErrors: boolean;
  onUpload: (assetType: ListingAuthorizationAssetType, file: File) => void;
}) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border border-b px-4 py-2.5">
        <h4 className="text-foreground text-xs font-semibold">Docs required</h4>
      </div>
      <div className="space-y-4 p-4">
        <OnboardingProofUpload
          id={`${listingKind}-recommended-additional-proof`}
          label={LISTING_VERIFICATION_DOC_LABELS.additionalProof}
          help={LISTING_VERIFICATION_DOC_HELP.additionalProof}
          file={null}
          previewUrl={additionalProofPreview}
          uploading={uploading}
          error={showErrors && !additionalProofPath ? 'Required' : null}
          onFileChange={(file) => {
            if (file) onUpload('additional_proof', file);
          }}
        />
        <OnboardingProofUpload
          id={`${listingKind}-recommended-azure-pmo`}
          label={LISTING_VERIFICATION_DOC_LABELS.azurePmoConfirmation}
          help={LISTING_VERIFICATION_DOC_HELP.azurePmoConfirmation}
          file={null}
          previewUrl={azurePmoPreview}
          uploading={uploading}
          error={showErrors && !azurePmoPath ? 'Required' : null}
          onFileChange={(file) => {
            if (file) onUpload('azure_pmo_confirmation', file);
          }}
        />
      </div>
    </div>
  );
}

export function ListingVerificationModal({
  open,
  onOpenChange,
  orgId: _orgId,
  orgSlug,
  listingKind,
  listingId,
  listingName,
  listingSettings,
  isOwner,
}: Props) {
  const sectionKind = listingKind === 'parking' ? 'parking' : 'property';
  const today = todayManilaYmd();
  const { canUse: canSubmitRecommendedBadge, isLoading: recommendedEntitlementsLoading } =
    useFeatureGate('recommendedBadgeEligible', listingKind === 'property' ? listingId : undefined);
  const { open: openUpgradeModal } = useUpgradeModal();

  const assetsQuery = useListingAuthorizationAssets(listingKind, listingId, open && isOwner);
  const remoteAuthorization =
    assetsQuery.data?.authorization ?? readListingAuthorizationSummary(listingSettings);

  const { upload, submitBase, submitRecommended } = useListingAuthorizationMutations({
    orgId: _orgId,
    orgSlug,
    listingKind,
    listingId,
  });

  const tiers = buildListingVerificationTiers(remoteAuthorization);
  const baseChecklist = buildListingBaseChecklist(remoteAuthorization, listingKind);
  const recommendedChecklist = buildListingRecommendedChecklist(remoteAuthorization);

  const baseTier = tiers[0]!;
  const recommendedTier = tiers[1]!;
  const baseApproved = baseTier.status === 'approved';
  const basePending = baseTier.status === 'pending';
  const recommendedApproved = recommendedTier.status === 'approved';
  const recommendedPending = recommendedTier.status === 'pending';
  const recommendedEditable = isOwner && !recommendedApproved && !recommendedPending;

  const inGrace = Boolean(
    remoteAuthorization.contractEndDate &&
    isInGracePeriod(remoteAuthorization.contractEndDate, today) &&
    remoteAuthorization.baseStatus === 'approved'
  );
  const inPreExpiry = Boolean(
    remoteAuthorization.contractEndDate &&
    isInPreExpiryWindow(remoteAuthorization.contractEndDate, today) &&
    remoteAuthorization.baseStatus === 'approved'
  );
  const locked = isListingAccessLocked(remoteAuthorization.lifecycle);
  const renewMode =
    remoteAuthorization.baseStatus === 'approved' &&
    isListingRenewEligible(remoteAuthorization, today);

  const baseEditable =
    isOwner &&
    remoteAuthorization.baseStatus !== 'pending' &&
    !isListingAuthorizationHardRejected(remoteAuthorization) &&
    (remoteAuthorization.baseStatus !== 'approved' || renewMode);

  const [activeStep, setActiveStep] = useState(0);
  const [rights, setRights] = useState<OrgVerificationRights | ''>('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [baseTouched, setBaseTouched] = useState(false);
  const [recommendedTouched, setRecommendedTouched] = useState(false);
  const [localPreviews, setLocalPreviews] = useState<
    Partial<Record<ListingAuthorizationAssetType, string | null>>
  >({});

  useEffect(() => {
    if (!open) return;
    setRights(remoteAuthorization.relationship ?? '');
    setContractEndDate(remoteAuthorization.contractEndDate ?? '');
    setLocalPreviews({});
    setBaseTouched(false);
    setRecommendedTouched(false);
    setActiveStep(defaultListingVerificationStepIndex(remoteAuthorization, { renewMode }));
  }, [
    open,
    listingId,
    renewMode,
    remoteAuthorization.baseStatus,
    remoteAuthorization.recommendedStatus,
    remoteAuthorization.baseSubmittedAt,
    remoteAuthorization.recommendedSubmittedAt,
  ]);

  const assetUrls = assetsQuery.data?.assetUrls;

  const contractEndError =
    baseTouched && verificationRightsNeedsContractEnd(rights)
      ? validateVerificationContractEndDate(contractEndDate)
      : null;
  const rightsError = baseTouched && !rights ? 'Required' : null;

  const draftState = useMemo(
    () => ({
      ...remoteAuthorization,
      relationship: rights || remoteAuthorization.relationship,
      contractEndDate: contractEndDate || remoteAuthorization.contractEndDate,
      assets: {
        ...remoteAuthorization.assets,
        proofPath: remoteAuthorization.assets.proofPath,
        additionalProofPath: remoteAuthorization.assets.additionalProofPath,
        azurePmoConfirmationPath: remoteAuthorization.assets.azurePmoConfirmationPath,
      },
    }),
    [remoteAuthorization, rights, contractEndDate]
  );

  const listingPrimaryProofComplete = listingAuthorizationHasPrimaryProof(draftState);
  const canSubmitBase = renewMode
    ? canSubmitListingRenewal(draftState) &&
      listingPrimaryProofComplete &&
      !contractEndError &&
      Boolean(rights)
    : canSubmitBaseListingAuthorization(draftState) &&
      listingPrimaryProofComplete &&
      !contractEndError &&
      Boolean(rights);
  const canSubmitRecommended =
    canSubmitRecommendedListingAuthorization(remoteAuthorization) && baseApproved;

  const previewFor = (
    assetType: ListingAuthorizationAssetType,
    remoteUrl: string | null | undefined
  ) => localPreviews[assetType] ?? remoteUrl ?? null;

  const handleUpload = async (assetType: ListingAuthorizationAssetType, file: File) => {
    const err = validateVerificationFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      const result = await upload.mutateAsync({ assetType, file });
      setLocalPreviews((current) => ({
        ...current,
        [assetType]: result.previewUrl,
      }));
      toast.success('Uploaded');
    } catch (error) {
      toast.error(friendlyToastError(error, 'Upload failed'));
    }
  };

  const handleSubmitBase = async (): Promise<boolean> => {
    setBaseTouched(true);
    if (!rights || !canSubmitBase) return false;
    try {
      await submitBase.mutateAsync({
        relationship: rights,
        ...(listingRightsNeedContractEnd(rights) ? { contractEndDate } : {}),
      });
      toast.success(renewMode ? 'Listing renewal submitted' : 'Listing verification submitted');
      onOpenChange(false);
      return true;
    } catch (error) {
      if (isAiQuotaError(error)) {
        handleAiMutationError(error as Error);
        return false;
      }
      toast.error(friendlyToastError(error, 'Submit failed'));
      return false;
    }
  };

  const handleSubmitRecommended = async () => {
    setRecommendedTouched(true);
    if (!canSubmitRecommended) return;
    if (!canSubmitRecommendedBadge) {
      if (!recommendedEntitlementsLoading) openUpgradeModal('recommendedBadgeEligible');
      return;
    }
    try {
      await submitRecommended.mutateAsync();
      toast.success('Listing Recommended badge submitted');
      onOpenChange(false);
    } catch (error) {
      if (isAiQuotaError(error)) {
        handleAiMutationError(error as Error);
        return;
      }
      toast.error(friendlyToastError(error, 'Submit failed'));
    }
  };

  const isDirty =
    open &&
    baseEditable &&
    (rights !== (remoteAuthorization.relationship ?? '') ||
      contractEndDate !== (remoteAuthorization.contractEndDate ?? ''));
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty,
    onSave: handleSubmitBase,
  });

  const busy = upload.isPending || submitBase.isPending || submitRecommended.isPending;
  const showBaseSubmittedDocs = remoteAuthorization.baseStatus !== 'none';
  const showRecommendedSubmittedDocs = remoteAuthorization.recommendedStatus !== 'none';

  const baseForm = baseEditable ? (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-foreground text-sm font-semibold leading-tight">
          {LISTING_VERIFICATION_TIER1_TITLE}
        </h4>
        <p className="text-muted-foreground text-xs leading-relaxed">{baseTier.benefit}</p>
      </div>
      {inPreExpiry ? (
        <p className="text-muted-foreground text-sm" role="status">
          Contract ends soon. Submit a renewal before the end date.
        </p>
      ) : null}
      {inGrace ? (
        <p className="text-sm text-amber-800 dark:text-amber-100" role="status">
          Contract ended. Renew listing verification to keep this listing active.
        </p>
      ) : null}
      {locked && !inGrace ? (
        <p className="text-muted-foreground text-sm" role="status">
          Listing access is locked until verification is renewed or approved.
        </p>
      ) : null}
      {isListingAuthorizationChangesRequested(remoteAuthorization) &&
      remoteAuthorization.baseRejectionReason ? (
        <VerificationFeedbackAlert
          kind="changes"
          title="What to update"
          message={remoteAuthorization.baseRejectionReason}
        />
      ) : null}
      <OnboardingVerificationRightsFields
        idPrefix={`${listingKind}-verification`}
        kind={sectionKind}
        rights={rights}
        onRightsChange={(value) => {
          setRights(value);
          if (!verificationRightsNeedsContractEnd(value)) {
            setContractEndDate('');
          }
        }}
        rightsError={rightsError}
        contractEndDate={contractEndDate}
        onContractEndDateChange={setContractEndDate}
        contractEndDateError={contractEndError}
      />
      <ListingTier1ProofUpload
        listingKind={listingKind}
        sectionKind={sectionKind}
        rights={rights || remoteAuthorization.relationship || ''}
        proofPreview={previewFor('proof', assetUrls?.proofUrl)}
        proofPath={draftState.assets.proofPath}
        uploading={upload.isPending}
        showErrors={baseTouched}
        onUpload={(assetType, file) => void handleUpload(assetType, file)}
      />
    </div>
  ) : isListingAuthorizationHardRejected(remoteAuthorization) ? (
    <p className="text-muted-foreground text-sm leading-relaxed">
      This verification was declined. Contact support to continue with this listing.
    </p>
  ) : basePending || showBaseSubmittedDocs ? (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-foreground text-sm font-semibold leading-tight">
          {LISTING_VERIFICATION_TIER1_TITLE}
        </h4>
        {basePending ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {LISTING_VERIFICATION_REVIEW_TIMELINE}
          </p>
        ) : baseApproved ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {listingTier1ApprovedCopy(listingKind)}
          </p>
        ) : null}
      </div>
      {showBaseSubmittedDocs ? (
        <ListingVerificationSubmittedDocs
          listingKind={listingKind}
          listingId={listingId}
          enabled={open}
          items={baseChecklist}
          tierStatus={remoteAuthorization.baseStatus}
          tier="base"
        />
      ) : null}
      {isOwner && (basePending || (baseApproved && !listingPrimaryProofComplete)) ? (
        <ListingTier1ProofUpload
          listingKind={listingKind}
          sectionKind={sectionKind}
          rights={rights || remoteAuthorization.relationship || ''}
          proofPreview={previewFor('proof', assetUrls?.proofUrl)}
          proofPath={remoteAuthorization.assets.proofPath}
          uploading={upload.isPending}
          showErrors={false}
          onUpload={(assetType, file) => void handleUpload(assetType, file)}
        />
      ) : null}
    </div>
  ) : null;

  const recommendedForm = recommendedEditable ? (
    <div className="space-y-5">
      <div className="space-y-1">
        <h4 className="text-foreground text-sm font-semibold leading-tight">
          {LISTING_VERIFICATION_TIER2_TITLE}
        </h4>
        <p className="text-muted-foreground text-xs leading-relaxed">{recommendedTier.benefit}</p>
      </div>
      {!baseApproved ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {LISTING_VERIFICATION_TIER2_PREREQ}
        </p>
      ) : null}
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <div className="border-border border-b px-4 py-2.5">
          <h4 className="text-foreground text-xs font-semibold">Perks &amp; benefits</h4>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,14rem)] sm:items-start sm:gap-4">
          <ul className="space-y-2">
            {LISTING_VERIFICATION_BENEFIT_BULLETS.map((bullet) => (
              <li
                key={bullet}
                className="text-foreground flex items-start gap-2 text-xs leading-snug sm:text-sm"
              >
                <Check
                  className="text-primary mt-0.5 size-3.5 shrink-0"
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <ListingRecommendedBadgePreview listingName={listingName} />
        </div>
      </div>
      {remoteAuthorization.recommendedStatus === 'rejected' &&
      remoteAuthorization.recommendedRejectionReason ? (
        <VerificationFeedbackAlert
          kind="rejected"
          title="Rejection reason"
          message={remoteAuthorization.recommendedRejectionReason}
        />
      ) : null}
      <ListingTier2ProofUploads
        listingKind={listingKind}
        additionalProofPreview={previewFor('additional_proof', assetUrls?.additionalProofUrl)}
        azurePmoPreview={previewFor('azure_pmo_confirmation', assetUrls?.azurePmoConfirmationUrl)}
        additionalProofPath={remoteAuthorization.assets.additionalProofPath}
        azurePmoPath={remoteAuthorization.assets.azurePmoConfirmationPath}
        uploading={upload.isPending}
        showErrors={recommendedTouched}
        onUpload={(assetType, file) => void handleUpload(assetType, file)}
      />
    </div>
  ) : (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-foreground text-sm font-semibold leading-tight">
          {LISTING_VERIFICATION_TIER2_TITLE}
        </h4>
        {recommendedPending ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {LISTING_VERIFICATION_REVIEW_TIMELINE}
          </p>
        ) : recommendedApproved ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {LISTING_VERIFICATION_TIER2_APPROVED}
          </p>
        ) : null}
      </div>
      {showRecommendedSubmittedDocs ? (
        <ListingVerificationSubmittedDocs
          listingKind={listingKind}
          listingId={listingId}
          enabled={open}
          items={recommendedChecklist}
          tierStatus={remoteAuthorization.recommendedStatus}
          tier="recommended"
        />
      ) : null}
    </div>
  );

  const footerPrimary =
    activeStep === 0 && baseEditable
      ? {
          label: renewMode ? 'Submit renewal' : 'Submit for review',
          disabled: busy || !canSubmitBase,
          onClick: () => void handleSubmitBase(),
          pending: submitBase.isPending,
        }
      : activeStep === 1 && recommendedEditable
        ? {
            label: 'Submit for review',
            disabled: busy || !canSubmitRecommended,
            onClick: () => void handleSubmitRecommended(),
            pending: submitRecommended.isPending,
          }
        : null;

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className={cn(
            'flex h-[min(90dvh,40rem)] max-h-[min(90dvh,40rem)] w-[min(calc(100vw-1.5rem),40rem)] max-w-none flex-col gap-0 overflow-hidden p-0',
            'sm:h-[min(90dvh,42rem)] sm:max-h-[min(90dvh,42rem)] sm:w-[min(92vw,40rem)] sm:max-w-[40rem] sm:p-0'
          )}
        >
          <ResponsiveModalHeader className="border-border shrink-0 space-y-3 border-b px-5 pb-3.5 pt-5 text-left sm:px-6">
            <ResponsiveModalTitle className="flex items-center gap-2.5 text-left text-base font-semibold sm:text-lg">
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                <Home className="size-5" aria-hidden />
              </span>
              {listingVerificationModalTitle(listingKind)}
            </ResponsiveModalTitle>
            <VerificationTierProgress
              tiers={tiers}
              activeStep={activeStep}
              onStepChange={setActiveStep}
              hostRejectionKind={remoteAuthorization.baseRejectionKind}
              verifiedRejectionKind={remoteAuthorization.recommendedRejectionKind}
            />
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            {activeStep === 0 ? baseForm : recommendedForm}
          </div>

          <ResponsiveModalFooter className="border-border shrink-0 gap-2 border-t px-5 py-3 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={requestClose}
              disabled={busy}
            >
              Close
            </Button>
            {footerPrimary ? (
              <Button
                type="button"
                className="min-h-[44px]"
                disabled={footerPrimary.disabled}
                onClick={footerPrimary.onClick}
              >
                {footerPrimary.pending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Submitting…
                  </>
                ) : (
                  footerPrimary.label
                )}
              </Button>
            ) : null}
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
