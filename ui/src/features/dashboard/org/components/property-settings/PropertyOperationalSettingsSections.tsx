import { useEffect, useRef, useState } from 'react';

import { ClipboardList, Globe, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import {
  BuildingFormsSettingsSection,
  BuildingFormsSettingsSummary,
} from '@/features/dashboard/bookings/components/BuildingFormsSettingsSection';
import { PropertyIntegrationsPanel } from '@/features/dashboard/bookings/components/PropertyIntegrationsPanel';
import {
  operationalFormIsDirty,
  type AppSettingsDto,
  type AppSettingsFormValues,
} from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useUploadAppSettingsAsset } from '@/features/dashboard/bookings/hooks/useUploadAppSettingsAsset';
import { storedAppSettingsMediaUrl } from '@/features/dashboard/lib/storedMediaDisplay';
import { MarketingResetConfirmDialog } from '@/features/dashboard/marketing/components/shared/MarketingResetConfirmDialog';
import { PropertyEmailAutomationsSection } from '@/features/dashboard/org/components/property-settings/PropertyEmailAutomationsSection';
import {
  PropertyPaymentMethodsSection,
  PropertyPaymentMethodsSummary,
} from '@/features/dashboard/org/components/property-settings/PropertyPaymentMethodsSection';
import { PropertySettingsSectionAlert } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  BUILDING_FORMS_MANAGE_FIELD_IDS,
  buildingFormsFieldsEqual,
  cloneBuildingFormsFields,
  validateBuildingFormsManage,
  type BuildingFormsManageFields,
} from '@/features/dashboard/org/lib/buildingFormsManage';
import {
  clonePaymentMethods,
  paymentMethodEditorFieldIds,
  paymentMethodsDraftIsDirty,
  setPaymentMethodQrUrl,
  syncLegacyPaymentFieldsFromMethods,
  validatePaymentMethods,
  type PropertyPaymentMethod,
} from '@/features/dashboard/org/lib/paymentMethods';
import type { PropertyAutomationToggleKey } from '@/features/dashboard/org/lib/propertyEmailAutomation';
import type { PropertySettingsSectionId } from '@/features/dashboard/org/lib/propertySettingsCompletion';
import { propertySettingsSectionBanner } from '@/features/dashboard/org/lib/propertySettingsFieldError';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { cn } from '@/lib/utils';

type Props = {
  data: AppSettingsDto;
  draft: AppSettingsFormValues;
  residenceName: string;
  towerUnitLabel: string;
  disabled?: boolean;
  sectionEditLocked?: Partial<Record<PropertySettingsSectionId, boolean>>;
  onChange: <K extends keyof AppSettingsFormValues>(
    key: K,
    value: AppSettingsFormValues[K]
  ) => void;
  onAutomationToggleChange: (key: PropertyAutomationToggleKey, value: boolean) => void;
  resolveFieldError: (fieldId: string) => string | null;
  markFieldInteracted: (fieldId: string) => void;
  sectionMessages?: Partial<Record<PropertySettingsSectionId, string>>;
  /** When set, only these section cards render (Setup Guide step bodies). */
  visibleSectionIds?: readonly PropertySettingsSectionId[];
  /** Inline payment editor (Setup Guide). */
  embedded?: boolean;
};

export function PropertyOperationalSettingsSections({
  data,
  draft,
  residenceName,
  towerUnitLabel,
  disabled = false,
  sectionEditLocked = {},
  onChange,
  onAutomationToggleChange,
  resolveFieldError,
  markFieldInteracted,
  sectionMessages = {},
  visibleSectionIds,
  embedded = false,
}: Props) {
  const sectionIsVisible = (sectionId: PropertySettingsSectionId) =>
    !visibleSectionIds || visibleSectionIds.includes(sectionId);
  const uploadMut = useUploadAppSettingsAsset();
  const [qrUploadingMethodId, setQrUploadingMethodId] = useState<string | null>(null);
  const [paymentManageOpen, setPaymentManageOpen] = useState(false);
  const [paymentSessionBaseline, setPaymentSessionBaseline] = useState<
    PropertyPaymentMethod[] | null
  >(null);
  const [paymentDiscardConfirmOpen, setPaymentDiscardConfirmOpen] = useState(false);
  /** Blocks parent dismiss while nested alert is closing (Radix outside-click race). */
  const suppressPaymentManageCloseRef = useRef(false);

  const [buildingFormsManageOpen, setBuildingFormsManageOpen] = useState(false);
  const [buildingFormsSessionBaseline, setBuildingFormsSessionBaseline] =
    useState<BuildingFormsManageFields | null>(null);
  const [buildingFormsDiscardConfirmOpen, setBuildingFormsDiscardConfirmOpen] = useState(false);
  const suppressBuildingFormsManageCloseRef = useRef(false);

  const armSuppressPaymentManageClose = () => {
    suppressPaymentManageCloseRef.current = true;
    window.setTimeout(() => {
      suppressPaymentManageCloseRef.current = false;
    }, 0);
  };

  const armSuppressBuildingFormsManageClose = () => {
    suppressBuildingFormsManageCloseRef.current = true;
    window.setTimeout(() => {
      suppressBuildingFormsManageCloseRef.current = false;
    }, 0);
  };

  const lock = (sectionId: PropertySettingsSectionId) =>
    disabled || Boolean(sectionEditLocked[sectionId]);

  const setPaymentMethods = (methods: PropertyPaymentMethod[]) => {
    const legacy = syncLegacyPaymentFieldsFromMethods(methods);
    onChange('paymentMethods', methods);
    onChange('paymentProvider', legacy.paymentProvider);
    onChange('gcashName', legacy.gcashName);
    onChange('gcashNumber', legacy.gcashNumber);
  };

  const openPaymentManage = () => {
    setPaymentSessionBaseline(clonePaymentMethods(draft.paymentMethods));
    setPaymentManageOpen(true);
  };

  const closePaymentManageClean = () => {
    setPaymentManageOpen(false);
    setPaymentSessionBaseline(null);
    setPaymentDiscardConfirmOpen(false);
  };

  const paymentManageSessionDirty = Boolean(
    paymentSessionBaseline &&
    paymentMethodsDraftIsDirty(draft.paymentMethods, paymentSessionBaseline)
  );
  const paymentManageValidationError = validatePaymentMethods(draft.paymentMethods);
  const paymentManageCanSave =
    paymentManageSessionDirty && paymentManageValidationError === null && !lock('payment');

  // Surface required-field errors while Save is disabled (same idea as dirty review editors).
  useEffect(() => {
    if (!paymentManageOpen || !paymentManageSessionDirty || !paymentManageValidationError) return;
    for (const fieldId of paymentMethodEditorFieldIds(draft.paymentMethods)) {
      markFieldInteracted(fieldId);
    }
  }, [
    draft.paymentMethods,
    markFieldInteracted,
    paymentManageOpen,
    paymentManageSessionDirty,
    paymentManageValidationError,
  ]);

  const requestClosePaymentManage = () => {
    if (!paymentManageSessionDirty) {
      closePaymentManageClean();
      return;
    }
    setPaymentDiscardConfirmOpen(true);
  };

  const discardPaymentManageSession = () => {
    if (paymentSessionBaseline) {
      setPaymentMethods(clonePaymentMethods(paymentSessionBaseline));
    }
    armSuppressPaymentManageClose();
    closePaymentManageClean();
  };

  const handlePaymentManageSave = () => {
    if (!paymentManageCanSave) {
      for (const fieldId of paymentMethodEditorFieldIds(draft.paymentMethods)) {
        markFieldInteracted(fieldId);
      }
      return;
    }
    closePaymentManageClean();
  };

  const buildingFormsValues = (): BuildingFormsManageFields => ({
    gafUnitOwner: draft.gafUnitOwner,
    gafTowerAndUnitNumber: draft.gafTowerAndUnitNumber,
    gafGuestsOnsiteContactPerson: draft.gafGuestsOnsiteContactPerson,
    gafOwnerContactNumber: draft.gafOwnerContactNumber,
  });

  const signatureImageUrl = storedAppSettingsMediaUrl(
    data.gafUnitOwnerSignatureUrl,
    data.fieldSources?.gafUnitOwnerSignatureUrl
  );
  const signatureConfigured = Boolean(signatureImageUrl?.trim());

  const openBuildingFormsManage = () => {
    setBuildingFormsSessionBaseline(cloneBuildingFormsFields(buildingFormsValues()));
    setBuildingFormsManageOpen(true);
  };

  const closeBuildingFormsManageClean = () => {
    setBuildingFormsManageOpen(false);
    setBuildingFormsSessionBaseline(null);
    setBuildingFormsDiscardConfirmOpen(false);
  };

  const buildingFormsManageSessionDirty = Boolean(
    buildingFormsSessionBaseline &&
    !buildingFormsFieldsEqual(buildingFormsValues(), buildingFormsSessionBaseline)
  );
  const buildingFormsManageValidationError = validateBuildingFormsManage(
    buildingFormsValues(),
    signatureConfigured
  );
  const buildingFormsManageCanSave =
    buildingFormsManageSessionDirty &&
    buildingFormsManageValidationError === null &&
    !lock('building-forms');

  useEffect(() => {
    if (
      !buildingFormsManageOpen ||
      !buildingFormsManageSessionDirty ||
      !buildingFormsManageValidationError
    ) {
      return;
    }
    for (const fieldId of BUILDING_FORMS_MANAGE_FIELD_IDS) {
      markFieldInteracted(fieldId);
    }
  }, [
    buildingFormsManageOpen,
    buildingFormsManageSessionDirty,
    buildingFormsManageValidationError,
    markFieldInteracted,
  ]);

  const requestCloseBuildingFormsManage = () => {
    if (!buildingFormsManageSessionDirty) {
      closeBuildingFormsManageClean();
      return;
    }
    setBuildingFormsDiscardConfirmOpen(true);
  };

  const discardBuildingFormsManageSession = () => {
    if (buildingFormsSessionBaseline) {
      const baseline = cloneBuildingFormsFields(buildingFormsSessionBaseline);
      onChange('gafUnitOwner', baseline.gafUnitOwner);
      onChange('gafTowerAndUnitNumber', baseline.gafTowerAndUnitNumber);
      onChange('gafGuestsOnsiteContactPerson', baseline.gafGuestsOnsiteContactPerson);
      onChange('gafOwnerContactNumber', baseline.gafOwnerContactNumber);
    }
    armSuppressBuildingFormsManageClose();
    closeBuildingFormsManageClean();
  };

  const handleBuildingFormsManageSave = () => {
    if (!buildingFormsManageCanSave) {
      for (const fieldId of BUILDING_FORMS_MANAGE_FIELD_IDS) {
        markFieldInteracted(fieldId);
      }
      return;
    }
    closeBuildingFormsManageClean();
  };

  const applyBuildingFormsChange = <K extends keyof BuildingFormsManageFields>(
    key: K,
    value: BuildingFormsManageFields[K]
  ) => {
    const fieldIds: Partial<Record<keyof BuildingFormsManageFields, string>> = {
      gafUnitOwner: 'gaf-unit-owner',
      gafGuestsOnsiteContactPerson: 'gaf-onsite-contact',
      gafOwnerContactNumber: 'gaf-owner-phone',
    };
    const fieldId = fieldIds[key];
    if (fieldId) markFieldInteracted(fieldId);
    onChange(key, value);
  };

  const buildingFormsEditor = (
    <BuildingFormsSettingsSection
      values={buildingFormsValues()}
      towerUnitLabel={towerUnitLabel}
      signatureImageUrl={signatureImageUrl}
      disabled={lock('building-forms')}
      onChange={applyBuildingFormsChange}
      onSignatureInteracted={() => markFieldInteracted('gaf-owner-signature')}
      resolveFieldError={resolveFieldError}
    />
  );

  const handleMethodQrFile = async (methodId: string, file: File) => {
    markFieldInteracted(`payment-method-${methodId}-qr`);
    setQrUploadingMethodId(methodId);
    try {
      const uploaded = await uploadMut.mutateAsync({ assetType: 'gcash_qr', file });
      setPaymentMethods(setPaymentMethodQrUrl(draft.paymentMethods, methodId, uploaded.url));
    } catch (err) {
      toast.error(friendlyToastError(err, 'Upload failed'));
    } finally {
      setQrUploadingMethodId(null);
    }
  };

  return (
    <>
      {sectionIsVisible('payment') ? (
        <AdminSection
          id="payment"
          title="Payment"
          icon={Wallet}
          description="How guests pay down payment and balance."
        >
          {embedded ? (
            <PropertyPaymentMethodsSection
              data={data}
              methods={draft.paymentMethods}
              disabled={lock('payment')}
              resolveFieldError={resolveFieldError}
              markFieldInteracted={markFieldInteracted}
              onChange={setPaymentMethods}
              onMethodQrFile={(methodId, file) => void handleMethodQrFile(methodId, file)}
              qrUploadingMethodId={qrUploadingMethodId}
            />
          ) : (
            <>
              <PropertyPaymentMethodsSummary
                methods={draft.paymentMethods}
                onManage={openPaymentManage}
              />
              <ResponsiveModal
                open={paymentManageOpen}
                onOpenChange={(open) => {
                  if (open) {
                    openPaymentManage();
                    return;
                  }
                  if (suppressPaymentManageCloseRef.current || paymentDiscardConfirmOpen) return;
                  requestClosePaymentManage();
                }}
              >
                <ResponsiveModalContent
                  sheetLayout="split"
                  className={cn(
                    'flex max-h-[min(92dvh,52rem)] w-[min(calc(100vw-1.5rem),40rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,40rem)] sm:p-0'
                  )}
                >
                  <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
                    <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
                      Payment
                    </ResponsiveModalTitle>
                  </ResponsiveModalHeader>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
                    <PropertyPaymentMethodsSection
                      data={data}
                      methods={draft.paymentMethods}
                      disabled={lock('payment')}
                      resolveFieldError={resolveFieldError}
                      markFieldInteracted={markFieldInteracted}
                      onChange={setPaymentMethods}
                      onMethodQrFile={(methodId, file) => void handleMethodQrFile(methodId, file)}
                      qrUploadingMethodId={qrUploadingMethodId}
                    />
                  </div>

                  <ResponsiveModalFooter className="border-border/60 shrink-0 border-t px-4 py-3 sm:px-5">
                    <Button
                      type="button"
                      className="min-h-[44px] w-full sm:ml-auto sm:w-auto"
                      disabled={!paymentManageCanSave}
                      onClick={handlePaymentManageSave}
                    >
                      Save
                    </Button>
                  </ResponsiveModalFooter>
                </ResponsiveModalContent>
              </ResponsiveModal>

              <MarketingResetConfirmDialog
                open={paymentDiscardConfirmOpen}
                onOpenChange={(open) => {
                  if (!open) armSuppressPaymentManageClose();
                  setPaymentDiscardConfirmOpen(open);
                }}
                title="Discard unsaved changes?"
                description="Make sure you fill up all required fields and save your changes."
                confirmLabel="Discard"
                overlayClassName="z-[110]"
                contentClassName="z-[111]"
                onConfirm={discardPaymentManageSession}
              />
            </>
          )}
        </AdminSection>
      ) : null}

      {sectionIsVisible('building-forms') ? (
        <AdminSection
          id="building-forms"
          title="Building Forms"
          icon={ClipboardList}
          description="Owner and signature details for GAF and pet PDFs."
        >
          {embedded ? (
            buildingFormsEditor
          ) : (
            <>
              <BuildingFormsSettingsSummary
                values={buildingFormsValues()}
                towerUnitLabel={towerUnitLabel}
                signatureConfigured={signatureConfigured}
                disabled={lock('building-forms')}
                onManage={openBuildingFormsManage}
              />
              <ResponsiveModal
                open={buildingFormsManageOpen}
                onOpenChange={(open) => {
                  if (open) {
                    openBuildingFormsManage();
                    return;
                  }
                  if (
                    suppressBuildingFormsManageCloseRef.current ||
                    buildingFormsDiscardConfirmOpen
                  ) {
                    return;
                  }
                  requestCloseBuildingFormsManage();
                }}
              >
                <ResponsiveModalContent
                  sheetLayout="split"
                  className={cn(
                    'flex max-h-[min(92dvh,56rem)] w-[min(calc(100vw-1.5rem),64rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,64rem)] sm:p-0'
                  )}
                >
                  <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
                    <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
                      Building Forms
                    </ResponsiveModalTitle>
                  </ResponsiveModalHeader>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
                    {buildingFormsEditor}
                  </div>

                  <ResponsiveModalFooter className="border-border/60 shrink-0 border-t px-4 py-3 sm:px-5">
                    <Button
                      type="button"
                      className="min-h-[44px] w-full sm:ml-auto sm:w-auto"
                      disabled={!buildingFormsManageCanSave}
                      onClick={handleBuildingFormsManageSave}
                    >
                      Save
                    </Button>
                  </ResponsiveModalFooter>
                </ResponsiveModalContent>
              </ResponsiveModal>

              <MarketingResetConfirmDialog
                open={buildingFormsDiscardConfirmOpen}
                onOpenChange={(open) => {
                  if (!open) armSuppressBuildingFormsManageClose();
                  setBuildingFormsDiscardConfirmOpen(open);
                }}
                title="Discard unsaved changes?"
                description="Make sure you fill up all required fields and save your changes."
                confirmLabel="Discard"
                overlayClassName="z-[110]"
                contentClassName="z-[111]"
                onConfirm={discardBuildingFormsManageSession}
              />
            </>
          )}
        </AdminSection>
      ) : null}

      {sectionIsVisible('email-automations') ? (
        <PropertyEmailAutomationsSection
          draft={draft}
          residenceName={residenceName}
          disabled={lock('email-automations')}
          resolveFieldError={resolveFieldError}
          markFieldInteracted={markFieldInteracted}
          onChange={onChange}
          onAutomationToggleChange={onAutomationToggleChange}
        />
      ) : null}

      {sectionIsVisible('integrations') ? (
        <AdminSection
          id="integrations"
          title="Integrations"
          icon={Globe}
          description="Telegram and connected service status."
        >
          {propertySettingsSectionBanner('integrations', sectionMessages) ? (
            <PropertySettingsSectionAlert
              message={propertySettingsSectionBanner('integrations', sectionMessages)!}
            />
          ) : null}
          <PropertyIntegrationsPanel
            status={data.propertyIntegrations}
            aiKeys={{
              primaryKeysConfigured: data.platformSecrets.geminiApiKeyConfigured,
              fallbackKeyConfigured: data.platformSecrets.groqApiKeyConfigured,
            }}
          />
        </AdminSection>
      ) : null}
    </>
  );
}

export function operationalSettingsDraftIsDirty(
  draft: AppSettingsFormValues,
  baseline: AppSettingsFormValues,
  inheritedBrandColor: string
): boolean {
  return operationalFormIsDirty(draft, baseline, inheritedBrandColor);
}
