import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import {
  AlertTriangle,
  ClipboardList,
  CopyPlus,
  FormInput,
  Gift,
  Globe,
  Home,
  Image as ImageIcon,
  Info,
  ListChecks,
  Mail,
  MapPin,
  Mic,
  Save,
  ScrollText,
  Share2,
  Shield,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import { ActivitySettingsSection } from '@/features/dashboard/activity/components/ActivitySettingsSection';
import {
  AdminSection,
  AdminSectionNavLayout,
  type AdminSectionNavItem,
} from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import {
  appSettingsToFormValues,
  useAppSettings,
  useUpdateAppSettings,
  type AppSettingsFormValues,
} from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  buildVoiceReceptionistPatch,
  useUpdateVoiceReceptionistSettings,
  useVoiceReceptionistSettings,
  voiceReceptionistFormIsDirty,
  voiceReceptionistToFormValues,
  type VoiceReceptionistFormValues,
} from '@/features/dashboard/bookings/hooks/useVoiceReceptionistSettings';
import {
  applyBuildingFormsTeamDefaults,
  pickBuildingFormsTeamContact,
} from '@/features/dashboard/bookings/lib/buildingFormsTeamDefaults';
import { PropertyAiPlatformSection } from '@/features/dashboard/org/components/property-settings/PropertyAiPlatformSection';
import { PropertyGuestRewardsSection } from '@/features/dashboard/org/components/property-settings/PropertyGuestRewardsSection';
import {
  operationalSettingsDraftIsDirty,
  PropertyOperationalSettingsSections,
} from '@/features/dashboard/org/components/property-settings/PropertyOperationalSettingsSections';
import {
  PropertyDangerZoneSection,
  PropertyProfileMainSections,
} from '@/features/dashboard/org/components/property-settings/PropertyProfileSettingsSections';
import { PropertySettingsBrandColorPreview } from '@/features/dashboard/org/components/property-settings/PropertySettingsBrandColorPreview';
import { PropertySocialsSection } from '@/features/dashboard/org/components/property-settings/PropertySocialsBrandingSection';
import { PublicPagesCrossLink } from '@/features/dashboard/org/components/property-settings/PublicPagesCrossLink';
import { SensitiveSettingsOtpDialog } from '@/features/dashboard/org/components/property-settings/SensitiveSettingsOtpDialog';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useCheckPropertyName } from '@/features/dashboard/org/hooks/useCheckPropertyName';
import { useDeleteProperty } from '@/features/dashboard/org/hooks/useDeleteProperty';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';
import {
  orgSettingsToFormValues,
  useOrgSettings,
} from '@/features/dashboard/org/hooks/useOrgSettings';
import { usePropertySettingsCompletionForDraft } from '@/features/dashboard/org/hooks/usePropertySettingsCompletion';
import { useTowerUnitConflict } from '@/features/dashboard/org/hooks/useTowerUnitConflict';
import { useUpdateProperty } from '@/features/dashboard/org/hooks/useUpdateProperty';
import { publicPropertySlugUrlPrefix } from '@/features/dashboard/org/lib/guestPublicPaths';
import { paymentMethodsDraftIsDirty } from '@/features/dashboard/org/lib/paymentMethods';
import type { PropertyAutomationToggleKey } from '@/features/dashboard/org/lib/propertyEmailAutomation';
import {
  mergeExternalReviewsForSingleReviewSave,
  validateExternalReviewDraft,
} from '@/features/dashboard/org/lib/propertyExternalReviews';
import type { PropertyLocationFields } from '@/features/dashboard/org/lib/propertyLocation';
import { type PropertySettingsSectionId } from '@/features/dashboard/org/lib/propertySettingsCompletion';
import { resolvePropertySettingsFieldError } from '@/features/dashboard/org/lib/propertySettingsFieldError';
import {
  gafTowerUnitFromProfile,
  propertyProfileDraftFromProperty,
  propertyProfileDraftIsDirty,
  propertySlugPreview,
  type PropertyProfileDraft,
} from '@/features/dashboard/org/lib/propertySettingsForm';
import { setPropertySettingsIssueSections } from '@/features/dashboard/org/lib/propertySettingsIssuesStore';
import {
  applySavedOperationalSections,
  applySavedProfileSections,
  buildAppSettingsPatchForSections,
  buildProfilePatchForSections,
  planPropertySettingsSave,
} from '@/features/dashboard/org/lib/propertySettingsSave';
import { normalizePropertySocialLinksForSave } from '@/features/dashboard/org/lib/propertySocialLinks';
import { computePaymentSettingsFingerprint } from '@/features/dashboard/org/lib/settingsVerificationFingerprint';
import { orgPropertiesPath, propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { usePropertyTeam } from '@/features/dashboard/team/hooks/usePropertyTeam';
import {
  hasPropertyPermission,
  SETTINGS_SECTION_EDIT_PERMISSION,
} from '@/features/dashboard/team/lib/propertyPermissions';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import {
  MobileHeroActionMenu,
  type MobileHeroActionMenuItem,
} from '@/components/mobile/MobileHeroActionButton';
import { AppSettingsCardSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { resolveNameAvailabilityState } from '@/lib/availabilityCheckState';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { propertyBrandColorStoredValue } from '@/lib/theme/brandColor';

const SETTINGS_SECTIONS: AdminSectionNavItem[] = [
  { id: 'basic', label: 'Basic Information', icon: Info },
  { id: 'details', label: 'Property Details', icon: Home },
  { id: 'media', label: 'Photos & Videos', icon: ImageIcon },
  { id: 'amenities', label: 'Amenities', icon: Sparkles },
  { id: 'house-rules', label: 'House Rules', icon: ListChecks },
  { id: 'guest-form', label: 'Guest Form', icon: FormInput },
  { id: 'cancellation', label: 'Cancellation', icon: Shield },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'branding', label: 'Socials', icon: Share2 },
  { id: 'guest-rewards', label: 'Reviews & vouchers', icon: Gift },
  { id: 'payment', label: 'Payment', icon: Wallet },
  { id: 'building-forms', label: 'Building Forms', icon: ClipboardList },
  { id: 'email-automations', label: 'Email Automations', icon: Mail },
  { id: 'integrations', label: 'Integrations', icon: Globe },
  { id: 'voice-receptionist', label: 'Voice Receptionist', icon: Mic },
  { id: 'ai', label: 'AI Overrides', icon: Sparkles },
  { id: 'activity', label: 'Activity', icon: ScrollText },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
];

function mergeProfileDraftAfterSave(
  current: PropertyProfileDraft,
  saved: PropertyProfileDraft
): PropertyProfileDraft {
  return {
    ...saved,
    type: current.type,
  };
}

export function usePropertySettingsController() {
  const navigate = useNavigate();
  const { property, orgSlug, propertySlug } = useOrgContext();
  const { data: orgPropertiesData } = useProperties(orgSlug);
  const canCopyFromOtherProperty = (orgPropertiesData?.properties.length ?? 0) >= 2;
  const { data: propertyAccess } = usePropertyPermissions();
  const canEditSettingsSection = useCallback(
    (sectionId: PropertySettingsSectionId) => {
      const perm = SETTINGS_SECTION_EDIT_PERMISSION[sectionId];
      if (!perm) return false;
      return hasPropertyPermission(propertyAccess?.permissions, perm);
    },
    [propertyAccess?.permissions]
  );
  const sectionEditLocked = useMemo(() => {
    const locked: Partial<Record<PropertySettingsSectionId, boolean>> = {};
    for (const section of SETTINGS_SECTIONS) {
      const id = section.id as PropertySettingsSectionId;
      if (id === 'integrations') {
        locked[id] = true;
        continue;
      }
      locked[id] = !canEditSettingsSection(id);
    }
    return locked;
  }, [canEditSettingsSection]);
  const canEditDangerZone = canEditSettingsSection('danger');
  const canDeleteProperty =
    propertyAccess?.accessKind === 'owner' || propertyAccess?.accessKind === 'platform_admin';
  const {
    data: appSettings,
    isLoading: appSettingsLoading,
    isError: appSettingsError,
    error: appSettingsLoadError,
  } = useAppSettings();
  const { data: propertyTeam } = usePropertyTeam();
  const updateProperty = useUpdateProperty(orgSlug);
  const deleteProperty = useDeleteProperty(orgSlug);
  const updateAppSettings = useUpdateAppSettings();
  const {
    data: voiceSettings,
    isLoading: voiceSettingsLoading,
    isError: voiceSettingsError,
    error: voiceSettingsLoadError,
  } = useVoiceReceptionistSettings();
  const updateVoiceSettings = useUpdateVoiceReceptionistSettings();
  const { canUse: canEnableReceptionist, isLoading: receptionistEntitlementsLoading } =
    useFeatureGate('aiReceptionist');
  const { canUse: canUseAiOverrides } = useFeatureGate('aiMonthlyCreditAllowance');
  const { open: openUpgradeModal } = useUpgradeModal();
  const orgBrandColor = useOrgBrandColor();
  const inheritedBrandColor = appSettings?.inheritedBrandColor ?? orgBrandColor;
  const { data: orgSettings } = useOrgSettings();
  const orgSocialLinks = useMemo(
    () =>
      orgSettings
        ? orgSettingsToFormValues(orgSettings)
        : {
            facebookPageUrl: '',
            airbnbUrl: '',
            instagramUrl: '',
            tiktokUrl: '',
          },
    [orgSettings]
  );

  const [profileBaseline, setProfileBaseline] = useState(() =>
    propertyProfileDraftFromProperty(property)
  );
  const [profileDraft, setProfileDraft] = useState(profileBaseline);
  const [operationalDraft, setOperationalDraft] = useState<AppSettingsFormValues | null>(null);
  const [operationalBaseline, setOperationalBaseline] = useState<AppSettingsFormValues | null>(
    null
  );
  const [voiceDraft, setVoiceDraft] = useState<VoiceReceptionistFormValues | null>(null);
  const [voiceBaseline, setVoiceBaseline] = useState<VoiceReceptionistFormValues | null>(null);
  const [newCustomAmenityInputs, setNewCustomAmenityInputs] = useState<Record<string, string>>({});
  const [newCustomHouseRuleInputs, setNewCustomHouseRuleInputs] = useState<Record<string, string>>(
    {}
  );
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [interactedFields, setInteractedFields] = useState<Record<string, boolean>>({});
  const [paymentOtpOpen, setPaymentOtpOpen] = useState(false);
  const [paymentOtpFingerprint, setPaymentOtpFingerprint] = useState('');
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const paymentOtpSucceededRef = useRef(false);
  const pendingSaveDeferredRef = useRef<{
    resolve: (ok: boolean) => void;
  } | null>(null);

  const markFieldInteracted = useCallback((fieldId: string) => {
    setInteractedFields((current) => {
      if (current[fieldId]) return current;
      return { ...current, [fieldId]: true };
    });
  }, []);

  const profileDirtyRef = useRef(false);
  const operationalDirtyRef = useRef(false);
  const voiceDirtyRef = useRef(false);
  const skipProfileSyncRef = useRef(false);
  const [mediaGalleryBusy, setMediaGalleryBusy] = useState(false);

  useEffect(() => {
    if (profileDirtyRef.current) return;
    if (skipProfileSyncRef.current) {
      skipProfileSyncRef.current = false;
      return;
    }
    const next = propertyProfileDraftFromProperty(property);
    setProfileDraft(next);
    setProfileBaseline(next);
  }, [property.id, property.updatedAt, property.settings]);

  useEffect(() => {
    if (!appSettings) return;
    if (operationalDirtyRef.current) return;
    let values = appSettingsToFormValues(appSettings);
    const teamDefaults = propertyTeam?.members
      ? pickBuildingFormsTeamContact(propertyTeam.members)
      : null;
    values = applyBuildingFormsTeamDefaults(values, appSettings.fieldSources, teamDefaults);
    setOperationalDraft(values);
    setOperationalBaseline(values);
  }, [appSettings, propertyTeam?.members]);

  useEffect(() => {
    if (!voiceSettings) return;
    if (voiceDirtyRef.current) return;
    const values = voiceReceptionistToFormValues(voiceSettings);
    setVoiceDraft(values);
    setVoiceBaseline(values);
  }, [voiceSettings]);

  const gafTowerUnit = useMemo(
    () => gafTowerUnitFromProfile(profileDraft),
    [profileDraft.tower, profileDraft.unitNumber]
  );

  useEffect(() => {
    setOperationalDraft((current) => {
      if (!current || current.gafTowerAndUnitNumber === gafTowerUnit) return current;
      return { ...current, gafTowerAndUnitNumber: gafTowerUnit };
    });
  }, [gafTowerUnit]);

  const profileDirty = propertyProfileDraftIsDirty(profileDraft, profileBaseline);
  profileDirtyRef.current = profileDirty;

  const nameChanged =
    profileDraft.name.trim().toLowerCase() !== profileBaseline.name.trim().toLowerCase();

  const nameCheck = useCheckPropertyName(profileDraft.name, property.id, nameChanged);

  const nameUnavailable = nameChanged && nameCheck.isUnavailable;
  const nameConflictMessage = nameUnavailable ? (nameCheck.data?.message ?? null) : null;
  const nameChecking = nameChanged && nameCheck.showChecking;
  const nameAvailabilityState = resolveNameAvailabilityState({
    ready: nameChanged && profileDraft.name.trim().length >= 2,
    showChecking: nameCheck.showChecking,
    isUnavailable: nameCheck.isUnavailable,
    isFetched: nameCheck.isFetched,
  });

  const { conflict: towerConflictDetail, hasActiveListing: towerUnitListed } = useTowerUnitConflict(
    profileDraft.tower,
    profileDraft.unitNumber,
    property.id
  );

  // Only treat ACTIVE peer as a save blocker when this listing is (or would stay) ACTIVE.
  const towerUnitBlocksSave =
    towerUnitListed && (profileDraft.status === 'ACTIVE' || property.status === 'ACTIVE');

  const { completion: draftCompletion } = usePropertySettingsCompletionForDraft({
    profile: profileDraft,
    operational: operationalDraft,
    propertyId: property.id,
    orgSlug,
    nameUnavailable,
    towerUnitConflict: towerUnitBlocksSave,
  });

  const { completion: savedCompletion } = usePropertySettingsCompletionForDraft({
    profile: profileBaseline,
    operational: operationalBaseline,
    propertyId: property.id,
    orgSlug,
    nameUnavailable: false,
    towerUnitConflict: false,
  });

  const towerConflict = towerUnitBlocksSave ? towerConflictDetail : null;

  const settingsCompletion = draftCompletion;

  const resolveFieldError = useCallback(
    (fieldId: string) =>
      resolvePropertySettingsFieldError(
        fieldId,
        settingsCompletion.fieldErrors,
        interactedFields,
        showValidationErrors
      ),
    [settingsCompletion.fieldErrors, interactedFields, showValidationErrors]
  );
  const operationalDirty =
    operationalDraft && operationalBaseline && appSettings
      ? operationalSettingsDraftIsDirty(operationalDraft, operationalBaseline, inheritedBrandColor)
      : false;
  operationalDirtyRef.current = operationalDirty;

  const handleSaveExternalReview = async (reviewId: string) => {
    if (!operationalDraft || !operationalBaseline) return;

    const draftReviews = operationalDraft.externalReviews;
    const baselineReviews = operationalBaseline.externalReviews;
    const reviewIndex = draftReviews.findIndex((review) => review.id === reviewId);
    const draftReview = draftReviews[reviewIndex];
    if (!draftReview) return;

    const validationError = validateExternalReviewDraft(draftReview, `Review ${reviewIndex + 1}`);
    if (validationError) {
      setShowValidationErrors(true);
      markFieldInteracted('property-external-reviews');
      return;
    }

    const mergedReviews = mergeExternalReviewsForSingleReviewSave(
      reviewId,
      draftReviews,
      baselineReviews
    );
    if (!mergedReviews) return;

    setSavingReviewId(reviewId);
    try {
      const saved = await updateAppSettings.mutateAsync({ externalReviews: mergedReviews });
      const values = appSettingsToFormValues(saved);
      const savedReview = values.externalReviews.find((review) => review.id === reviewId);

      setOperationalBaseline((current) =>
        current ? { ...current, externalReviews: values.externalReviews } : current
      );
      setOperationalDraft((current) => {
        if (!current || !savedReview) return current;
        return {
          ...current,
          externalReviews: current.externalReviews.map((review) =>
            review.id === reviewId ? savedReview : review
          ),
        };
      });
      toast.success('Review saved');
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not save review'));
    } finally {
      setSavingReviewId(null);
    }
  };
  const voiceDirty =
    voiceDraft && voiceBaseline ? voiceReceptionistFormIsDirty(voiceDraft, voiceBaseline) : false;
  voiceDirtyRef.current = voiceDirty;
  const isDirty = profileDirty || operationalDirty || voiceDirty;

  const savePlan = useMemo(() => {
    if (!operationalDraft || !operationalBaseline || !appSettings) return null;
    return planPropertySettingsSave({
      profileDraft,
      profileBaseline,
      operationalDraft,
      operationalBaseline,
      completion: settingsCompletion,
      inheritedBrandColor,
    });
  }, [
    operationalDraft,
    operationalBaseline,
    appSettings,
    profileDraft,
    profileBaseline,
    settingsCompletion,
    inheritedBrandColor,
  ]);

  const paymentDirty = Boolean(
    operationalDraft &&
    operationalBaseline &&
    paymentMethodsDraftIsDirty(operationalDraft.paymentMethods, operationalBaseline.paymentMethods)
  );
  const paymentBlocksSave =
    paymentDirty &&
    (savePlan?.blockedSections.includes('payment') ||
      settingsCompletion.issueSectionIds.includes('payment'));

  const saveDisabledByValidation =
    Boolean(paymentBlocksSave) ||
    (Boolean(isDirty) && !voiceDirty && Boolean(savePlan) && !savePlan!.hasSavableWork);

  const saveDisabledReason = (() => {
    if (!saveDisabledByValidation) return undefined;
    if (paymentBlocksSave) {
      const paymentError = Object.entries(settingsCompletion.fieldErrors).find(
        ([fieldId, message]) =>
          Boolean(message) &&
          (fieldId === 'payment-methods' ||
            fieldId === 'payment-qr-image' ||
            fieldId.startsWith('payment-method-'))
      )?.[1];
      return paymentError ?? 'Complete payment fields to save';
    }
    return savePlan?.firstBlockedMessage ?? 'Fix required fields to save';
  })();

  const busy =
    appSettingsLoading ||
    updateAppSettings.isPending ||
    updateVoiceSettings.isPending ||
    deleteProperty.isPending ||
    (updateProperty.isPending && !mediaGalleryBusy);

  const saveDisabled =
    busy || Boolean(towerConflict) || nameUnavailable || nameChecking || saveDisabledByValidation;

  useEffect(() => {
    if (saveDisabledByValidation) {
      setShowValidationErrors(true);
    }
  }, [saveDisabledByValidation]);

  const propertySlugPrefix = publicPropertySlugUrlPrefix();

  const slugPreview = propertySlugPreview(profileDraft.name, property.slug, profileBaseline.name);

  const navSections = useMemo((): AdminSectionNavItem[] => {
    const hidden = new Set<string>();
    if (!canEnableReceptionist) hidden.add('voice-receptionist');
    if (!canUseAiOverrides) hidden.add('ai');
    return SETTINGS_SECTIONS.filter((section) => !hidden.has(section.id)).map((section) => ({
      ...section,
      hasIssue: settingsCompletion.issueSectionIds.includes(
        section.id as PropertySettingsSectionId
      ),
    }));
  }, [canEnableReceptionist, canUseAiOverrides, settingsCompletion.issueSectionIds]);

  useEffect(() => {
    setPropertySettingsIssueSections(settingsCompletion.issueSectionIds);
    return () => {
      setPropertySettingsIssueSections(savedCompletion.issueSectionIds);
    };
  }, [settingsCompletion.issueSectionIds, savedCompletion.issueSectionIds]);

  const scrollToSettingsSection = (sectionId: PropertySettingsSectionId) => {
    document
      .getElementById(`section-${sectionId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const setProfileField = <K extends keyof PropertyProfileDraft>(
    key: K,
    value: PropertyProfileDraft[K]
  ) => {
    setProfileDraft((current) => ({ ...current, [key]: value }));
  };

  const handleMediaPersisted = (media: PropertyProfileDraft['media']) => {
    setProfileDraft((current) => ({ ...current, media }));
    setProfileBaseline((current) => ({ ...current, media }));
  };

  const persistMediaOrder = async (media: PropertyProfileDraft['media']) => {
    skipProfileSyncRef.current = true;
    setMediaGalleryBusy(true);
    try {
      const result = await updateProperty.mutateAsync({
        propertyId: property.id,
        settings: { media },
      });
      const savedProfile = propertyProfileDraftFromProperty(result.property);
      handleMediaPersisted(savedProfile.media);
    } finally {
      setMediaGalleryBusy(false);
    }
  };

  const [locationPersistPending, setLocationPersistPending] = useState(false);

  const persistLocation = async (fields: PropertyLocationFields) => {
    if (!canEditSettingsSection('location')) {
      toast.error('You do not have permission to save location');
      throw new Error('location permission denied');
    }
    skipProfileSyncRef.current = true;
    setLocationPersistPending(true);
    try {
      const nextDraft: PropertyProfileDraft = {
        ...profileDraft,
        address: fields.address,
        city: fields.city,
        province: fields.province,
        country: fields.country,
        zipCode: fields.zipCode,
        latitude: fields.latitude,
        longitude: fields.longitude,
        mapsUrl: fields.mapsUrl,
        placeId: fields.placeId,
      };
      const payload = buildProfilePatchForSections(nextDraft, property.id, ['location']);
      if (!payload) {
        toast.error('Could not save location');
        throw new Error('empty location payload');
      }
      const result = await updateProperty.mutateAsync(payload);
      const savedProfile = propertyProfileDraftFromProperty(result.property);
      setProfileDraft((current) => applySavedProfileSections(current, savedProfile, ['location']));
      setProfileBaseline((current) =>
        applySavedProfileSections(current, savedProfile, ['location'])
      );
      toast.success('Location saved');
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not save location'));
      throw error;
    } finally {
      setLocationPersistPending(false);
    }
  };

  const setOperationalField = <K extends keyof AppSettingsFormValues>(
    key: K,
    value: AppSettingsFormValues[K]
  ) => {
    setOperationalDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const setAutomationToggle = (key: PropertyAutomationToggleKey, value: boolean) => {
    setOperationalDraft((current) =>
      current
        ? {
            ...current,
            automationToggles: { ...current.automationToggles, [key]: value },
          }
        : current
    );
  };

  const setVoiceField = <K extends keyof VoiceReceptionistFormValues>(
    key: K,
    value: VoiceReceptionistFormValues[K]
  ) => {
    if (key === 'enabled' && value === true && !canEnableReceptionist) {
      if (!receptionistEntitlementsLoading) openUpgradeModal('aiReceptionist');
      return;
    }
    setVoiceDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async (options?: {
    skipPaymentVerification?: boolean;
    settingsVerificationToken?: string;
  }): Promise<boolean> => {
    if (!operationalDraft || !operationalBaseline || !appSettings) return false;

    if (towerConflict) {
      toast.error('Tower and unit combination is already in use');
      return false;
    }

    const plan = planPropertySettingsSave({
      profileDraft,
      profileBaseline,
      operationalDraft,
      operationalBaseline,
      completion: settingsCompletion,
      inheritedBrandColor,
    });

    const paymentChanged = paymentMethodsDraftIsDirty(
      operationalDraft.paymentMethods,
      operationalBaseline.paymentMethods
    );
    if (
      paymentChanged &&
      (plan.blockedSections.includes('payment') ||
        settingsCompletion.issueSectionIds.includes('payment'))
    ) {
      setShowValidationErrors(true);
      toast.error(saveDisabledReason ?? 'Complete payment fields to save');
      scrollToSettingsSection('payment');
      return false;
    }

    if (!plan.hasSavableWork && !voiceDirty) {
      setShowValidationErrors(true);
      if (plan.firstBlockedMessage) {
        toast.error(plan.firstBlockedMessage);
      } else if (!profileDirty && !operationalDirty && !voiceDirty) {
        toast.message('No changes to save');
      }
      if (plan.firstBlockedSectionId) {
        scrollToSettingsSection(plan.firstBlockedSectionId);
      }
      return false;
    }

    const paymentWillSave = plan.operationalSections.includes('payment');
    if (paymentWillSave && paymentChanged && !options?.skipPaymentVerification) {
      const fingerprint = await computePaymentSettingsFingerprint(operationalDraft.paymentMethods);
      setPaymentOtpFingerprint(fingerprint);
      setPaymentOtpOpen(true);
      return await new Promise<boolean>((resolve) => {
        pendingSaveDeferredRef.current = { resolve };
      });
    }

    setShowValidationErrors(false);

    try {
      let savedSomething = false;
      const savedProfileSections = plan.profileSections.filter((sectionId) =>
        canEditSettingsSection(sectionId)
      );
      const savedOperationalSections = plan.operationalSections.filter((sectionId) =>
        canEditSettingsSection(sectionId)
      );
      if (
        (plan.profileSections.length > 0 || plan.operationalSections.length > 0) &&
        savedProfileSections.length === 0 &&
        savedOperationalSections.length === 0 &&
        !voiceDirty
      ) {
        toast.error('You do not have permission to save these settings');
        return false;
      }

      const profilePayload = buildProfilePatchForSections(
        profileDraft,
        property.id,
        savedProfileSections
      );
      if (profilePayload) {
        const result = await updateProperty.mutateAsync(profilePayload);
        const savedProfile = propertyProfileDraftFromProperty(result.property);
        const mergedSaved = mergeProfileDraftAfterSave(profileDraft, savedProfile);
        setProfileDraft((current) =>
          applySavedProfileSections(current, mergedSaved, savedProfileSections)
        );
        setProfileBaseline((current) =>
          applySavedProfileSections(current, mergedSaved, savedProfileSections)
        );
        savedSomething = true;
        if (profilePayload.name && result.property.slug !== propertySlug) {
          navigate(propertySectionPath(orgSlug, result.property.slug, 'settings'), {
            replace: true,
          });
        }
      }

      const operationalPatch = buildAppSettingsPatchForSections(
        {
          ...operationalDraft,
          ...normalizePropertySocialLinksForSave(operationalDraft, orgSocialLinks),
          gafTowerAndUnitNumber: gafTowerUnitFromProfile(profileDraft),
          brandColor: propertyBrandColorStoredValue(
            operationalDraft.brandColor,
            inheritedBrandColor
          ),
        },
        savedOperationalSections
      );
      if (operationalPatch) {
        const saved = await updateAppSettings.mutateAsync({
          ...operationalPatch,
          ...(options?.settingsVerificationToken
            ? { settingsVerificationToken: options.settingsVerificationToken }
            : {}),
        });
        const values = appSettingsToFormValues(saved);
        setOperationalDraft((current) =>
          current
            ? applySavedOperationalSections(current, values, savedOperationalSections)
            : values
        );
        setOperationalBaseline((current) =>
          current
            ? applySavedOperationalSections(current, values, savedOperationalSections)
            : values
        );
        savedSomething = true;
      }

      if (voiceDirty && voiceDraft) {
        if (voiceDraft.enabled && !canEnableReceptionist) {
          if (!receptionistEntitlementsLoading) openUpgradeModal('aiReceptionist');
          return false;
        }
        const saved = await updateVoiceSettings.mutateAsync(
          buildVoiceReceptionistPatch(voiceDraft)
        );
        const values = voiceReceptionistToFormValues(saved);
        setVoiceDraft(values);
        setVoiceBaseline(values);
        savedSomething = true;
      }

      if (savedSomething) {
        setInteractedFields({});
        if (plan.blockedSections.length > 0) {
          toast.success('New changes has been saved.');
          scrollToSettingsSection(plan.blockedSections[0]!);
        } else {
          toast.success('Settings saved');
        }
        return true;
      }
      return false;
    } catch (error) {
      if (options?.settingsVerificationToken) {
        revertPaymentDraft();
      }
      toast.error(friendlyToastError(error, 'Could not save settings'));
      return false;
    } finally {
      setPaymentOtpOpen(false);
      paymentOtpSucceededRef.current = false;
    }
  };

  const revertPaymentDraft = useCallback(() => {
    setOperationalDraft((current) => {
      if (!current || !operationalBaseline) return current;
      return {
        ...current,
        paymentMethods: operationalBaseline.paymentMethods,
        paymentProvider: operationalBaseline.paymentProvider,
        gcashName: operationalBaseline.gcashName,
        gcashNumber: operationalBaseline.gcashNumber,
      };
    });
  }, [operationalBaseline]);

  const handlePaymentOtpOpenChange = (open: boolean) => {
    if (!open && !paymentOtpSucceededRef.current) {
      revertPaymentDraft();
      const deferred = pendingSaveDeferredRef.current;
      pendingSaveDeferredRef.current = null;
      deferred?.resolve(false);
    }
    if (!open) paymentOtpSucceededRef.current = false;
    setPaymentOtpOpen(open);
  };

  const handlePaymentOtpVerified = (verificationToken: string) => {
    paymentOtpSucceededRef.current = true;
    const deferred = pendingSaveDeferredRef.current;
    pendingSaveDeferredRef.current = null;
    void handleSave({
      skipPaymentVerification: true,
      settingsVerificationToken: verificationToken,
    }).then((ok) => {
      deferred?.resolve(ok);
    });
  };

  const handleArchiveProperty = async () => {
    try {
      const result = await updateProperty.mutateAsync({
        propertyId: property.id,
        status: 'INACTIVE',
      });
      const savedProfile = propertyProfileDraftFromProperty(result.property);
      setProfileDraft(savedProfile);
      setProfileBaseline(savedProfile);
      toast.success('Property archived');
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not archive property'));
      throw error;
    }
  };

  const handleRestoreProperty = async () => {
    try {
      const result = await updateProperty.mutateAsync({
        propertyId: property.id,
        status: 'ACTIVE',
      });
      const savedProfile = propertyProfileDraftFromProperty(result.property);
      setProfileDraft(savedProfile);
      setProfileBaseline(savedProfile);
      toast.success('Property restored');
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not restore property'));
      throw error;
    }
  };

  const handleDeleteProperty = async () => {
    await deleteProperty.mutateAsync(property.id);
    toast.success('Property deleted');
    navigate(orgPropertiesPath(orgSlug));
  };

  return {
    navigate,
    property,
    orgSlug,
    propertySlug,
    canCopyFromOtherProperty,
    propertyAccess,
    canEditSettingsSection,
    sectionEditLocked,
    canEditDangerZone,
    canDeleteProperty,
    appSettings,
    appSettingsLoading,
    appSettingsError,
    appSettingsLoadError,
    propertyTeam,
    updateProperty,
    deleteProperty,
    updateAppSettings,
    voiceSettings,
    voiceSettingsLoading,
    voiceSettingsError,
    voiceSettingsLoadError,
    updateVoiceSettings,
    canEnableReceptionist,
    receptionistEntitlementsLoading,
    canUseAiOverrides,
    openUpgradeModal,
    orgBrandColor,
    inheritedBrandColor,
    orgSettings,
    orgSocialLinks,
    profileBaseline,
    setProfileBaseline,
    profileDraft,
    setProfileDraft,
    operationalDraft,
    setOperationalDraft,
    operationalBaseline,
    setOperationalBaseline,
    voiceDraft,
    setVoiceDraft,
    voiceBaseline,
    setVoiceBaseline,
    newCustomAmenityInputs,
    setNewCustomAmenityInputs,
    newCustomHouseRuleInputs,
    setNewCustomHouseRuleInputs,
    showValidationErrors,
    setShowValidationErrors,
    interactedFields,
    setInteractedFields,
    paymentOtpOpen,
    setPaymentOtpOpen,
    paymentOtpFingerprint,
    setPaymentOtpFingerprint,
    savingReviewId,
    setSavingReviewId,
    paymentOtpSucceededRef,
    markFieldInteracted,
    profileDirtyRef,
    operationalDirtyRef,
    voiceDirtyRef,
    skipProfileSyncRef,
    mediaGalleryBusy,
    setMediaGalleryBusy,
    gafTowerUnit,
    profileDirty,
    nameChanged,
    nameCheck,
    nameUnavailable,
    nameConflictMessage,
    nameChecking,
    nameAvailabilityState,
    towerConflictDetail,
    towerUnitListed,
    towerUnitBlocksSave,
    draftCompletion,
    savedCompletion,
    towerConflict,
    settingsCompletion,
    resolveFieldError,
    operationalDirty,
    handleSaveExternalReview,
    voiceDirty,
    isDirty,
    savePlan,
    paymentDirty,
    paymentBlocksSave,
    saveDisabledByValidation,
    saveDisabledReason,
    busy,
    saveDisabled,
    propertySlugPrefix,
    slugPreview,
    navSections,
    scrollToSettingsSection,
    setProfileField,
    handleMediaPersisted,
    persistMediaOrder,
    locationPersistPending,
    setLocationPersistPending,
    persistLocation,
    setOperationalField,
    setAutomationToggle,
    setVoiceField,
    handleSave,
    revertPaymentDraft,
    handlePaymentOtpOpenChange,
    handlePaymentOtpVerified,
    handleArchiveProperty,
    handleRestoreProperty,
    handleDeleteProperty,
  };
}

export function PropertySettingsCard() {
  const {
    navigate,
    property,
    orgSlug,
    canCopyFromOtherProperty,
    sectionEditLocked,
    canEditDangerZone,
    canDeleteProperty,
    appSettings,
    appSettingsLoading,
    appSettingsError,
    appSettingsLoadError,
    updateProperty,
    deleteProperty,
    voiceSettings,
    voiceSettingsLoading,
    voiceSettingsError,
    voiceSettingsLoadError,
    canEnableReceptionist,
    canUseAiOverrides,
    inheritedBrandColor,
    orgSocialLinks,
    profileDraft,
    operationalDraft,
    operationalBaseline,
    voiceDraft,
    newCustomAmenityInputs,
    setNewCustomAmenityInputs,
    newCustomHouseRuleInputs,
    setNewCustomHouseRuleInputs,
    paymentOtpOpen,
    paymentOtpFingerprint,
    savingReviewId,
    markFieldInteracted,
    mediaGalleryBusy,
    gafTowerUnit,
    nameUnavailable,
    nameConflictMessage,
    nameAvailabilityState,
    towerConflict,
    settingsCompletion,
    resolveFieldError,
    handleSaveExternalReview,
    isDirty,
    saveDisabledReason,
    busy,
    saveDisabled,
    propertySlugPrefix,
    slugPreview,
    navSections,
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
    handleArchiveProperty,
    handleRestoreProperty,
    handleDeleteProperty,
  } = usePropertySettingsController();

  if (appSettingsLoading) {
    return <AppSettingsCardSkeleton />;
  }

  const copyFromHref =
    orgSlug && property?.id && canCopyFromOtherProperty
      ? `${orgPropertiesPath(orgSlug)}?copyTarget=${encodeURIComponent(property.id)}`
      : null;

  const goCopyFrom = () => {
    if (!copyFromHref) return;
    navigate(copyFromHref);
  };

  const heroTrailingItems = (() => {
    const items: MobileHeroActionMenuItem[] = [];
    if (copyFromHref) {
      items.push({
        key: 'copy-from',
        label: 'Copy from…',
        Icon: CopyPlus,
        onSelect: goCopyFrom,
      });
    }
    if (isDirty) {
      items.push({
        key: 'save',
        label: busy ? 'Saving' : 'Save changes',
        Icon: Save,
        onSelect: () => void handleSave(),
        disabled: saveDisabled,
      });
    }
    return items;
  })();

  return (
    <AdminMobilePage
      title="Settings"
      subtitle="Profile, operations, and integrations for this listing."
      titleId="property-settings-heading"
      className="flex min-h-0 flex-1 flex-col"
      heroTrailing={
        heroTrailingItems.length > 0 ? (
          <MobileHeroActionMenu items={heroTrailingItems} label="Settings actions" />
        ) : undefined
      }
      desktopActions={
        copyFromHref || isDirty ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {copyFromHref ? (
              <TierBadgeAnchor feature="copyPropertySettings">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goCopyFrom}
                  className="min-h-[44px] gap-1.5"
                >
                  <CopyPlus className="size-4" aria-hidden />
                  Copy from…
                </Button>
              </TierBadgeAnchor>
            ) : null}
            {isDirty ? (
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saveDisabled}
                title={saveDisabledReason}
                className="min-h-[44px] gap-1.5"
              >
                <Save className="size-4" aria-hidden />
                {busy ? 'Saving...' : 'Save Changes'}
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      <SensitiveSettingsOtpDialog
        open={paymentOtpOpen}
        onOpenChange={handlePaymentOtpOpenChange}
        scope="property"
        patchFingerprint={paymentOtpFingerprint}
        onVerified={handlePaymentOtpVerified}
        busy={busy}
      />
      {operationalDraft && appSettings ? (
        <PropertySettingsBrandColorPreview
          brandColor={operationalDraft.brandColor}
          resolvedBrandColor={appSettings.resolvedBrandColor}
        />
      ) : null}
      {appSettingsError ? (
        <p className="text-destructive text-sm">
          {(appSettingsLoadError as Error)?.message ?? 'Could not load operational settings'}
        </p>
      ) : null}

      {appSettings && operationalDraft ? (
        <AdminSectionNavLayout
          className="min-h-0 flex-1"
          sections={navSections}
          footer={
            isDirty ? (
              <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2 animate-pulse rounded-full bg-amber-500" />
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Unsaved changes
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saveDisabled}
                    title={saveDisabledReason}
                    className="min-h-[44px] w-full sm:w-auto"
                    size="sm"
                  >
                    {busy ? 'Saving...' : 'Save Changes'}
                  </Button>
                </CardContent>
              </Card>
            ) : null
          }
        >
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
              setNewCustomAmenityInputs((current) => ({
                ...current,
                [categoryId]: value,
              }))
            }
            newCustomHouseRuleInputs={newCustomHouseRuleInputs}
            onNewCustomHouseRuleInputChange={(categoryId, value) =>
              setNewCustomHouseRuleInputs((current) => ({
                ...current,
                [categoryId]: value,
              }))
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
          />

          <PropertySocialsSection
            data={appSettings}
            draft={operationalDraft}
            orgSocialLinks={orgSocialLinks}
            disabled={busy || Boolean(sectionEditLocked.branding)}
            resolveFieldError={resolveFieldError}
            markFieldInteracted={markFieldInteracted}
            onChange={setOperationalField}
            sectionMessages={settingsCompletion.sectionMessages}
            headerAction={<PublicPagesCrossLink orgSlug={orgSlug} propertySlug={property.slug} />}
          />

          <PropertyGuestRewardsSection
            draft={operationalDraft}
            externalReviewsBaseline={operationalBaseline?.externalReviews ?? []}
            disabled={busy || Boolean(sectionEditLocked['guest-rewards'])}
            resolveFieldError={resolveFieldError}
            markFieldInteracted={markFieldInteracted}
            onChange={setOperationalField}
            sectionMessages={settingsCompletion.sectionMessages}
            onSaveReview={(reviewId) => void handleSaveExternalReview(reviewId)}
            savingReviewId={savingReviewId}
          />

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
            showVoiceReceptionist={canEnableReceptionist}
            voiceReceptionist={{
              draft: voiceDraft,
              propertyName: profileDraft.name.trim(),
              availableVoices: voiceSettings?.availableVoices ?? [],
              isLoading: voiceSettingsLoading,
              isError: voiceSettingsError,
              errorMessage: (voiceSettingsLoadError as Error)?.message ?? null,
              onChange: setVoiceField,
            }}
          />

          {canUseAiOverrides ? <PropertyAiPlatformSection /> : null}

          <AdminSection id="activity" title="Activity" icon={ScrollText}>
            <ActivitySettingsSection scope="property" />
          </AdminSection>

          <PropertyDangerZoneSection
            propertyName={profileDraft.name.trim() || property.name}
            isArchived={profileDraft.status === 'INACTIVE'}
            disabled={busy || !canEditDangerZone}
            showDelete={canDeleteProperty}
            archivePending={updateProperty.isPending}
            restorePending={updateProperty.isPending}
            deletePending={deleteProperty.isPending}
            onArchive={handleArchiveProperty}
            onRestore={handleRestoreProperty}
            onDelete={canDeleteProperty ? handleDeleteProperty : async () => undefined}
          />
        </AdminSectionNavLayout>
      ) : null}
    </AdminMobilePage>
  );
}
