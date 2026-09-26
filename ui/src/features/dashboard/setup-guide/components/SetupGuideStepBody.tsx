import { useCallback } from 'react';

import type { AppSettingsDto } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  OrgBasicInformationSection,
  OrgSocialsBrandingSection,
} from '@/features/dashboard/org/components/org-settings/OrgProfileSettingsSections';
import { PropertyLocationPicker } from '@/features/dashboard/org/components/property-settings/PropertyLocationPicker';
import { PropertyOperationalSettingsSections } from '@/features/dashboard/org/components/property-settings/PropertyOperationalSettingsSections';
import { PropertyPaymentMethodsSection } from '@/features/dashboard/org/components/property-settings/PropertyPaymentMethodsSection';
import { PropertyProfileMainSections } from '@/features/dashboard/org/components/property-settings/PropertyProfileSettingsSections';
import { SensitiveSettingsOtpDialog } from '@/features/dashboard/org/components/property-settings/SensitiveSettingsOtpDialog';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { BrandColorField } from '@/features/dashboard/org/components/settings/BrandColorField';
import { GetVerifiedModal } from '@/features/dashboard/org/components/verification/GetVerifiedModal';
import { useOrgSettingsController } from '@/features/dashboard/org/hooks/useOrgSettingsController';
import { useParkingSettingsController } from '@/features/dashboard/org/hooks/useParkingSettingsController';
import { usePropertySettingsController } from '@/features/dashboard/org/hooks/usePropertySettingsController';
import type { PropertySettingsSectionId } from '@/features/dashboard/org/lib/propertySettingsCompletion';
import { ParkingBookingAutomationSection } from '@/features/dashboard/parking/components/ParkingBookingAutomationSection';
import { ParkingDetailsSection } from '@/features/dashboard/parking/components/ParkingDetailsSection';
import { ParkingEmailAutomationSection } from '@/features/dashboard/parking/components/ParkingEmailAutomationSection';
import { ParkingFeaturesSection } from '@/features/dashboard/parking/components/ParkingFeaturesSection';
import { ParkingMediaUpload } from '@/features/dashboard/parking/components/ParkingMediaUpload';
import { PARKING_DESCRIPTION_MAX } from '@/features/dashboard/parking/lib/parkingSettingsForm';
import { SETUP_GUIDE_PARKING_SAVE_SCOPE } from '@/features/dashboard/parking/lib/parkingSettingsSavePlan';
import {
  DoneStep,
  WelcomeStep,
} from '@/features/dashboard/setup-guide/components/SetupGuideMoments';
import {
  SetupGuideParkingPricingEmbed,
  SetupGuidePropertyPricingEmbed,
} from '@/features/dashboard/setup-guide/components/SetupGuidePricingEmbed';
import { useRegisterStepSave } from '@/features/dashboard/setup-guide/components/SetupGuideSaveContext';
import {
  SetupGuideParkingHost,
  SetupGuidePropertyHost,
} from '@/features/dashboard/setup-guide/components/SetupGuideSettingsHost';
import { SetupGuideStepSkeleton } from '@/features/dashboard/setup-guide/components/SetupGuideStepSkeleton';
import { SetupGuideTeamEmbed } from '@/features/dashboard/setup-guide/components/SetupGuideTeamEmbed';
import { useHostRewardOffer } from '@/features/dashboard/setup-guide/hooks/useHostRewardOffer';
import type {
  SetupGuideStep,
  SetupGuideStepKind,
} from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

import { Textarea } from '@/components/ui/textarea';

function WelcomeStepBody() {
  useRegisterStepSave(null);
  return <WelcomeStep />;
}

function OrgBrandStep() {
  const {
    operatorData,
    operatorError,
    operatorLoadError,
    canEditBasicSettings,
    canEditSocials,
    profileDraft,
    operatorDraft,
    markFieldInteracted,
    canSaveAny,
    nameUnavailable,
    nameConflictMessage,
    nameAvailabilityState,
    busy,
    isLoading,
    setProfileField,
    setOperatorField,
    handleSave,
    orgUrlPrefix,
    operatorSources,
    formBusy,
    slugPreview,
    resolveFieldError,
  } = useOrgSettingsController();

  const save = useCallback(async () => {
    if (!canSaveAny) return true;
    return handleSave();
  }, [canSaveAny, handleSave]);
  useRegisterStepSave(save);

  if (isLoading || !profileDraft || !operatorDraft || !operatorData) {
    return <SetupGuideStepSkeleton kind="org.brand" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {operatorError ? (
        <p className="text-destructive text-sm">
          {(operatorLoadError as Error)?.message ?? 'Could not load organization settings'}
        </p>
      ) : null}
      <OrgBasicInformationSection
        draft={profileDraft}
        disabled={formBusy || !canEditBasicSettings || busy}
        orgUrlPrefix={orgUrlPrefix}
        slugPreview={slugPreview}
        logoSource={operatorSources?.emailLogoUrl}
        logoUrl={operatorData.emailLogoUrl}
        nameUnavailable={nameUnavailable}
        nameConflictMessage={nameConflictMessage}
        nameAvailabilityState={nameAvailabilityState}
        resolveFieldError={resolveFieldError}
        markFieldInteracted={markFieldInteracted}
        onChange={setProfileField}
      />
      <OrgSocialsBrandingSection
        operatorDraft={operatorDraft}
        disabled={formBusy || !canEditSocials || busy}
        resolveFieldError={resolveFieldError}
        markFieldInteracted={markFieldInteracted}
        onOperatorChange={setOperatorField}
      />
    </div>
  );
}

function PropertySectionsInner({
  kind,
  profileSectionIds,
  operationalSectionIds,
  showVoice = false,
}: {
  kind: SetupGuideStepKind;
  profileSectionIds?: readonly PropertySettingsSectionId[];
  operationalSectionIds?: readonly PropertySettingsSectionId[];
  showVoice?: boolean;
}) {
  const {
    appSettings,
    appSettingsLoading,
    voiceSettings,
    voiceSettingsLoading,
    voiceSettingsError,
    voiceSettingsLoadError,
    canEnableReceptionist,
    inheritedBrandColor,
    profileDraft,
    operationalDraft,
    voiceDraft,
    newCustomAmenityInputs,
    setNewCustomAmenityInputs,
    newCustomHouseRuleInputs,
    setNewCustomHouseRuleInputs,
    paymentOtpOpen,
    paymentOtpFingerprint,
    markFieldInteracted,
    mediaGalleryBusy,
    gafTowerUnit,
    nameUnavailable,
    nameConflictMessage,
    nameAvailabilityState,
    towerConflict,
    settingsCompletion,
    resolveFieldError,
    isDirty,
    busy,
    propertySlugPrefix,
    slugPreview,
    setProfileField,
    handleMediaPersisted,
    persistMediaOrder,
    locationPersistPending,
    persistLocation,
    setOperationalField,
    setAutomationToggle,
    setVoiceField,
    handleSave,
    handlePaymentOtpOpenChange,
    handlePaymentOtpVerified,
    sectionEditLocked,
  } = usePropertySettingsController();

  const save = useCallback(async () => {
    if (!isDirty) return true;
    return handleSave();
  }, [handleSave, isDirty]);
  useRegisterStepSave(save);

  if (appSettingsLoading || !operationalDraft || !appSettings) {
    return <SetupGuideStepSkeleton kind={kind} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {profileSectionIds?.length ? (
        <PropertyProfileMainSections
          draft={profileDraft}
          onChange={setProfileField}
          disabled={busy}
          sectionEditLocked={sectionEditLocked}
          propertySlugPrefix={propertySlugPrefix}
          slugPreview={slugPreview}
          towerConflict={towerConflict}
          nameUnavailable={nameUnavailable}
          nameConflictMessage={nameConflictMessage}
          nameAvailabilityState={nameAvailabilityState}
          newCustomAmenityInputs={newCustomAmenityInputs}
          onNewCustomAmenityInputChange={(categoryId, value) =>
            setNewCustomAmenityInputs((current) => ({ ...current, [categoryId]: value }))
          }
          newCustomHouseRuleInputs={newCustomHouseRuleInputs}
          onNewCustomHouseRuleInputChange={(categoryId, value) =>
            setNewCustomHouseRuleInputs((current) => ({ ...current, [categoryId]: value }))
          }
          onMediaPersisted={handleMediaPersisted}
          onPersistMediaOrder={persistMediaOrder}
          mediaGalleryBusy={mediaGalleryBusy}
          resolveFieldError={resolveFieldError}
          markFieldInteracted={markFieldInteracted}
          sectionMessages={settingsCompletion.sectionMessages}
          brandColor={operationalDraft.brandColor}
          inheritedBrandColor={inheritedBrandColor}
          onBrandColorChange={(value) => setOperationalField('brandColor', value)}
          onPersistLocation={persistLocation}
          locationPersistPending={locationPersistPending}
          visibleSectionIds={profileSectionIds}
          embedded
        />
      ) : null}

      {operationalSectionIds?.length ? (
        <PropertyOperationalSettingsSections
          data={appSettings}
          draft={operationalDraft}
          residenceName={profileDraft.residenceName}
          towerUnitLabel={gafTowerUnit}
          disabled={busy}
          sectionEditLocked={sectionEditLocked}
          onChange={setOperationalField}
          onAutomationToggleChange={setAutomationToggle}
          resolveFieldError={resolveFieldError}
          markFieldInteracted={markFieldInteracted}
          sectionMessages={settingsCompletion.sectionMessages}
          showVoiceReceptionist={showVoice && canEnableReceptionist}
          voiceReceptionist={{
            draft: voiceDraft,
            propertyName: profileDraft.name.trim(),
            availableVoices: voiceSettings?.availableVoices ?? [],
            isLoading: voiceSettingsLoading,
            isError: voiceSettingsError,
            errorMessage: (voiceSettingsLoadError as Error)?.message ?? null,
            onChange: setVoiceField,
          }}
          visibleSectionIds={operationalSectionIds}
          embedded
        />
      ) : null}

      <SensitiveSettingsOtpDialog
        open={paymentOtpOpen}
        onOpenChange={handlePaymentOtpOpenChange}
        scope="property"
        patchFingerprint={paymentOtpFingerprint}
        onVerified={handlePaymentOtpVerified}
        busy={busy}
      />
    </div>
  );
}

function PropertySectionsStep({
  kind,
  propertyId,
  profileSectionIds,
  operationalSectionIds,
  showVoice,
}: {
  kind: SetupGuideStepKind;
  propertyId: string;
  profileSectionIds?: readonly PropertySettingsSectionId[];
  operationalSectionIds?: readonly PropertySettingsSectionId[];
  showVoice?: boolean;
}) {
  return (
    <SetupGuidePropertyHost
      propertyId={propertyId}
      loadingFallback={<SetupGuideStepSkeleton kind={kind} />}
    >
      <PropertySectionsInner
        kind={kind}
        profileSectionIds={profileSectionIds}
        operationalSectionIds={operationalSectionIds}
        showVoice={showVoice}
      />
    </SetupGuidePropertyHost>
  );
}

function PropertyPricingStep({ propertyId }: { propertyId: string }) {
  return (
    <SetupGuidePropertyHost
      propertyId={propertyId}
      loadingFallback={<SetupGuideStepSkeleton kind="property.pricing" />}
    >
      <SetupGuidePropertyPricingEmbed propertyId={propertyId} />
    </SetupGuidePropertyHost>
  );
}

function parkingPaymentSettingsDto(settings: { gcashQrImageUrl?: string | null }): AppSettingsDto {
  const gcashQrImageUrl = settings.gcashQrImageUrl?.trim() ?? '';
  return {
    gcashQrImageUrl,
    fieldSources: {
      gcashQrImageUrl: gcashQrImageUrl ? 'db' : 'default',
    },
  } as AppSettingsDto;
}

function ParkingSectionsInner({
  parkingId,
  mode,
}: {
  parkingId: string;
  mode: 'basics' | 'location' | 'photo' | 'payments' | 'email' | 'pricing';
}) {
  const kind = `parking.${mode}` as const;
  const {
    settings,
    settingsLoading,
    uploadQr,
    coverImage,
    setCoverImage,
    operationalDraft,
    featuresDraft,
    setFeaturesDraft,
    newCustomFeatureInput,
    setNewCustomFeatureInput,
    locationDraft,
    setLocationDraft,
    profileDraft,
    inheritedBrandColor,
    setBrandColorPreview,
    setProfileField,
    detailsDraft,
    setDetailsDraft,
    automationDraft,
    paymentOtpOpen,
    paymentOtpFingerprint,
    qrUploadingMethodId,
    setQrUploadingMethodId,
    markFieldInteracted,
    isDirty,
    resolveFieldError,
    busy,
    setPaymentMethods,
    handleSave,
    handlePaymentOtpOpenChange,
    handlePaymentOtpVerified,
    setAutomationToggle,
  } = useParkingSettingsController();

  const save = useCallback(async () => {
    if (!isDirty) return true;
    if (mode === 'email') {
      return handleSave({ scopeSectionIds: SETUP_GUIDE_PARKING_SAVE_SCOPE.email });
    }
    return handleSave({ scopeSectionIds: [...SETUP_GUIDE_PARKING_SAVE_SCOPE[mode]] });
  }, [handleSave, isDirty, mode]);
  useRegisterStepSave(mode === 'pricing' ? null : save);

  if (settingsLoading || !operationalDraft || !settings) {
    return <SetupGuideStepSkeleton kind={kind} />;
  }

  if (mode === 'pricing') {
    return <SetupGuideParkingPricingEmbed parkingId={parkingId} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === 'basics' ? (
        <>
          <div className="flex flex-col gap-3">
            <BrandColorField
              id="setup-parking-brand-color"
              value={profileDraft.brandColor}
              resolvedColor={inheritedBrandColor}
              resetValue={inheritedBrandColor}
              disabled={busy}
              onChange={(value) => {
                setProfileField('brandColor', value);
                setBrandColorPreview?.(value.trim() || inheritedBrandColor);
              }}
            />
            <div className="space-y-1.5">
              <label htmlFor="setup-parking-description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="setup-parking-description"
                value={profileDraft.description}
                disabled={busy}
                maxLength={PARKING_DESCRIPTION_MAX}
                rows={3}
                onChange={(event) => setProfileField('description', event.target.value)}
                onBlur={() => markFieldInteracted('parking-description')}
              />
              <p className="text-muted-foreground text-right text-xs tabular-nums">
                {profileDraft.description.length}/{PARKING_DESCRIPTION_MAX}
              </p>
            </div>
          </div>
          <ParkingDetailsSection
            draft={detailsDraft}
            onChange={setDetailsDraft}
            disabled={busy}
            resolveFieldError={resolveFieldError}
            markFieldInteracted={markFieldInteracted}
            dense
          />
        </>
      ) : null}

      {mode === 'photo' ? (
        <>
          <ParkingMediaUpload
            coverImage={coverImage}
            onCoverChange={setCoverImage}
            disabled={busy}
          />
          <ParkingFeaturesSection
            draft={featuresDraft}
            onChange={setFeaturesDraft}
            disabled={busy}
            newCustomInput={newCustomFeatureInput}
            onNewCustomInputChange={setNewCustomFeatureInput}
          />
        </>
      ) : null}

      {mode === 'location' ? (
        <PropertyLocationPicker
          disabled={busy}
          value={locationDraft}
          onChange={(patch) => setLocationDraft((current) => ({ ...current, ...patch }))}
          addressError={resolveFieldError('property-address')}
          mapError={resolveFieldError('property-location-map')}
          onFieldInteract={markFieldInteracted}
        />
      ) : null}

      {mode === 'payments' ? (
        <PropertyPaymentMethodsSection
          data={parkingPaymentSettingsDto(settings)}
          methods={operationalDraft.paymentMethods}
          disabled={busy}
          resolveFieldError={resolveFieldError}
          markFieldInteracted={markFieldInteracted}
          onChange={setPaymentMethods}
          onMethodQrFile={(methodId, file) => {
            markFieldInteracted(`payment-method-${methodId}-qr`);
            setQrUploadingMethodId(methodId);
            void uploadQr
              .mutateAsync(file)
              .then((uploaded: { publicUrl?: string; url?: string }) => {
                const url = uploaded.publicUrl ?? uploaded.url ?? '';
                setPaymentMethods(
                  operationalDraft.paymentMethods.map((method) =>
                    method.id === methodId ? { ...method, qrImageUrl: url } : method
                  )
                );
              })
              .finally(() => setQrUploadingMethodId(null));
          }}
          qrUploadingMethodId={qrUploadingMethodId}
        />
      ) : null}

      {mode === 'email' && automationDraft ? (
        <>
          <ParkingEmailAutomationSection
            value={automationDraft}
            disabled={busy}
            onChange={setAutomationToggle}
          />
          <ParkingBookingAutomationSection
            value={automationDraft}
            disabled={busy}
            onChange={setAutomationToggle}
          />
        </>
      ) : null}

      <SensitiveSettingsOtpDialog
        open={paymentOtpOpen}
        onOpenChange={handlePaymentOtpOpenChange}
        scope="parking"
        patchFingerprint={paymentOtpFingerprint}
        onVerified={handlePaymentOtpVerified}
        busy={busy}
      />
    </div>
  );
}

function ParkingSectionsStep(props: {
  parkingId: string;
  mode: 'basics' | 'location' | 'photo' | 'payments' | 'email' | 'pricing';
}) {
  return (
    <SetupGuideParkingHost
      parkingId={props.parkingId}
      loadingFallback={<SetupGuideStepSkeleton kind={`parking.${props.mode}`} />}
    >
      <ParkingSectionsInner {...props} />
    </SetupGuideParkingHost>
  );
}

function VerificationStep() {
  useRegisterStepSave(null);
  return <GetVerifiedModal open onOpenChange={() => {}} embedded lockedStep={0} hideListingOpen />;
}

function TeamStep() {
  return <SetupGuideTeamEmbed />;
}

function RecommendedStep() {
  const org = useOptionalOrgContext();
  const { data: offer } = useHostRewardOffer(org?.org?.id);
  useRegisterStepSave(null);

  const rewardLine =
    offer?.enabled && offer.eligible
      ? `Eligible for ${offer.durationDays} days of ${offer.planCode ?? 'Pro'} after ${
          offer.trigger === 'recommended_verification_submitted' ? 'submit' : 'approval'
        }.`
      : null;

  return (
    <div className="flex flex-col gap-3">
      {rewardLine ? <p className="text-muted-foreground text-sm">{rewardLine}</p> : null}
      <GetVerifiedModal open onOpenChange={() => {}} embedded lockedStep={1} hideListingOpen />
    </div>
  );
}

function DoneStepBody() {
  useRegisterStepSave(null);
  return <DoneStep />;
}

export function SetupGuideStepBody({ step }: { step: SetupGuideStep | undefined }) {
  if (!step) return null;

  switch (step.kind) {
    case 'welcome':
      return <WelcomeStepBody />;
    case 'org.brand':
      return <OrgBrandStep />;
    case 'property.basics':
      return (
        <PropertySectionsStep
          kind="property.basics"
          propertyId={step.propertyId!}
          profileSectionIds={['basic', 'details']}
        />
      );
    case 'property.location':
      return (
        <PropertySectionsStep
          kind="property.location"
          propertyId={step.propertyId!}
          profileSectionIds={['location']}
        />
      );
    case 'property.content':
      return (
        <PropertySectionsStep
          kind="property.content"
          propertyId={step.propertyId!}
          profileSectionIds={['media', 'amenities', 'house-rules', 'cancellation']}
        />
      );
    case 'property.pricing':
      return <PropertyPricingStep propertyId={step.propertyId!} />;
    case 'property.payments':
      return (
        <PropertySectionsStep
          kind="property.payments"
          propertyId={step.propertyId!}
          operationalSectionIds={['payment']}
        />
      );
    case 'property.guestform':
      return (
        <PropertySectionsStep
          kind="property.guestform"
          propertyId={step.propertyId!}
          profileSectionIds={['guest-form']}
          operationalSectionIds={['building-forms']}
          showVoice
        />
      );
    case 'property.email':
      return (
        <PropertySectionsStep
          kind="property.email"
          propertyId={step.propertyId!}
          operationalSectionIds={['email-automations']}
        />
      );
    case 'parking.basics':
      return <ParkingSectionsStep parkingId={step.parkingId!} mode="basics" />;
    case 'parking.location':
      return <ParkingSectionsStep parkingId={step.parkingId!} mode="location" />;
    case 'parking.photo':
      return <ParkingSectionsStep parkingId={step.parkingId!} mode="photo" />;
    case 'parking.pricing':
      return <ParkingSectionsStep parkingId={step.parkingId!} mode="pricing" />;
    case 'parking.payments':
      return <ParkingSectionsStep parkingId={step.parkingId!} mode="payments" />;
    case 'parking.email':
      return <ParkingSectionsStep parkingId={step.parkingId!} mode="email" />;
    case 'org.verification':
      return <VerificationStep />;
    case 'org.team':
      return <TeamStep />;
    case 'org.recommended':
      return <RecommendedStep />;
    case 'org.done':
      return <DoneStepBody />;
    default:
      return <p className="text-muted-foreground text-sm">This step is not available yet.</p>;
  }
}
