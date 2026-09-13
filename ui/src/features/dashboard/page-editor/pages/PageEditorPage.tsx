import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { toast } from 'sonner';

import { PreviewOverrideProvider } from '@/features/guest/lib/previewOverrideContext';
import { PropertyDetailPage } from '@/features/guest/marketing/pages/PropertyDetailPage';
import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';
import type { PropertyLandingSectionConfig } from '@/features/guest/marketing/properties/types/publicProperty';

import {
  appSettingsToFormValues,
  useAppSettings,
  useUpdateAppSettings,
  type AppSettingsFormValues,
} from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useAdminLayoutFillMain } from '@/features/dashboard/bookings/lib/adminLayoutFillMain';
import { PropertySettingsBrandColorPreview } from '@/features/dashboard/org/components/property-settings/PropertySettingsBrandColorPreview';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';
import {
  orgSettingsToFormValues,
  useOrgSettings,
} from '@/features/dashboard/org/hooks/useOrgSettings';
import { useUpdateProperty } from '@/features/dashboard/org/hooks/useUpdateProperty';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { validateOrgBrandColor } from '@/features/dashboard/org/lib/orgSettingsValidation';
import {
  resolveCancellationPolicyDisplay,
  validateCancellationPolicySettings,
} from '@/features/dashboard/org/lib/propertyCancellationPolicy';
import { resolveHouseRulesForDisplay } from '@/features/dashboard/org/lib/propertyHouseRulesConstants';
import {
  resolveAmenityLabels,
  type PropertyMediaItem,
} from '@/features/dashboard/org/lib/propertySettingsConstants';
import {
  propertyMediaFromProperty,
  propertyProfileDraftFromProperty,
} from '@/features/dashboard/org/lib/propertySettingsForm';
import { normalizePropertySocialLinksForSave } from '@/features/dashboard/org/lib/propertySocialLinks';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { PageEditorHeader } from '@/features/dashboard/page-editor/components/PageEditorHeader';
import { PageEditorLeaveConfirmDialog } from '@/features/dashboard/page-editor/components/PageEditorLeaveConfirmDialog';
import { PageEditorPreviewPane } from '@/features/dashboard/page-editor/components/PageEditorPreviewPane';
import { PageEditorShell } from '@/features/dashboard/page-editor/components/PageEditorShell';
import {
  PropertyLandingEditorPanel,
  type LandingProfileContent,
} from '@/features/dashboard/page-editor/components/property-landing/PropertyLandingEditorPanel';
import { PropertyShowcasePageEditor } from '@/features/dashboard/page-editor/components/property-showcase/PropertyShowcasePageEditor';
import { StayGuidePageEditor } from '@/features/dashboard/page-editor/components/stay-guide/StayGuidePageEditor';
import {
  firstPageEditorAutoSaveError,
  mergePageEditorAutoSaveStatuses,
  usePageEditorAutoSave,
} from '@/features/dashboard/page-editor/hooks/usePageEditorAutoSave';
import {
  usePublicPageConfig,
  useSavePublicPageConfig,
} from '@/features/dashboard/page-editor/hooks/usePublicPageConfig';
import { resolvePageEditorPublicLinks } from '@/features/dashboard/page-editor/lib/pageEditorPublicLinks';
import { usePropertyLandingEditorStore } from '@/features/dashboard/page-editor/stores/propertyLandingEditorStore';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { usePropertyEntitlements } from '@/features/dashboard/plans/hooks/usePropertyEntitlements';
import { isFeatureEnabled } from '@/features/dashboard/plans/lib/planFeatures';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { SectionContentSkeleton } from '@/components/skeletons/AdminSkeletons';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { usePageTitle } from '@/lib/pageTitle';
import { propertyBrandColorStoredValue } from '@/lib/theme/brandColor';

const EDITABLE_PAGE_IDS = new Set(['stay-guide', 'listing', 'showcase']);

const PAGE_EDITOR_META = {
  listing: { label: 'Property' },
  'stay-guide': { label: 'Stay Guide' },
  showcase: { label: 'Showcase' },
} as const;

function PageEditorChrome({ children }: { children: ReactNode }) {
  // Immersive editor — fill the admin main column on mobile so the preview gets real
  // height instead of ~50% of the viewport beside the stacked controls.
  useAdminLayoutFillMain(true);

  return (
    <AdminMobilePage
      title="Public Pages"
      subtitle="Every guest URL for this listing."
      titleId="public-pages-heading"
    >
      {children}
    </AdminMobilePage>
  );
}

function mediaItemsToPreview(media: PropertyMediaItem[]) {
  const ordered = [...media].sort((a, b) => a.order - b.order);
  const images = ordered.filter((item) => item.type === 'image').map((item) => item.url);
  return {
    media: ordered.map((item) => ({
      id: item.id,
      url: item.url,
      type: item.type,
      caption: item.caption,
      isPrimary: item.isPrimary,
      order: item.order,
    })),
    images,
  };
}

export function PageEditorPage() {
  const { pageId = '' } = useParams<{ pageId: string }>();
  const { orgSlug, propertySlug, property } = useOrgContext();
  const propertyId = usePropertyIdParam();
  const { data: access, isLoading: accessLoading } = usePropertyPermissions();

  const title =
    pageId === 'listing'
      ? property?.name
        ? `${property.name} - Edit Listing`
        : 'Edit Listing'
      : pageId === 'showcase'
        ? property?.name
          ? `${property.name} - Edit Showcase`
          : 'Edit Showcase'
        : property?.name
          ? `${property.name} - Edit Stay Guide`
          : 'Edit Stay Guide';
  usePageTitle(title);

  if (!EDITABLE_PAGE_IDS.has(pageId)) {
    return <Navigate to={propertySectionPath(orgSlug, propertySlug, 'public-pages')} replace />;
  }

  const requiredEdit =
    pageId === 'listing'
      ? 'publicPages.property:edit'
      : pageId === 'showcase'
        ? 'publicPages.showcase:edit'
        : 'publicPages.stayGuide:edit';
  if (!accessLoading && !hasPropertyPermission(access?.permissions, requiredEdit)) {
    return <Navigate to={propertySectionPath(orgSlug, propertySlug, 'public-pages')} replace />;
  }

  if (pageId === 'listing') {
    return (
      <PropertyLandingPageEditor
        orgSlug={orgSlug}
        propertySlug={propertySlug}
        propertyId={propertyId}
      />
    );
  }

  if (pageId === 'showcase') {
    return (
      <PropertyShowcasePageEditor
        orgSlug={orgSlug}
        propertySlug={propertySlug}
        propertyId={propertyId}
      />
    );
  }

  return (
    <StayGuidePageEditor orgSlug={orgSlug} propertySlug={propertySlug} propertyId={propertyId} />
  );
}

function contentFromProperty(
  property: Parameters<typeof propertyProfileDraftFromProperty>[0]
): LandingProfileContent {
  const draft = propertyProfileDraftFromProperty(property);
  return {
    description: draft.description,
    enabledAmenities: draft.enabledAmenities,
    customAmenities: draft.customAmenities,
    enabledHouseRules: draft.enabledHouseRules,
    customHouseRules: draft.customHouseRules,
    cancellationPolicy: draft.cancellationPolicy,
  };
}

function PropertyLandingPageEditor({
  orgSlug,
  propertySlug,
  propertyId,
}: {
  orgSlug: string;
  propertySlug: string;
  propertyId: string | null;
}) {
  const navigate = useNavigate();
  const { property } = useOrgContext();
  const configQuery = usePublicPageConfig('property_landing');
  const saveMutation = useSavePublicPageConfig('property_landing');
  const previewQuery = usePublicPropertyDetail(propertySlug);
  const updateProperty = useUpdateProperty(orgSlug);
  const { data: appSettings } = useAppSettings();
  const updateAppSettings = useUpdateAppSettings();
  const { data: orgSettings } = useOrgSettings();
  const orgBrandColor = useOrgBrandColor();
  const inheritedBrandColor = appSettings?.inheritedBrandColor ?? orgBrandColor;
  const orgSocialLinks = orgSettings
    ? orgSettingsToFormValues(orgSettings)
    : {
        facebookPageUrl: '',
        airbnbUrl: '',
        instagramUrl: '',
        tiktokUrl: '',
      };

  const config = usePropertyLandingEditorStore((s) => s.config);
  const hydrated = usePropertyLandingEditorStore((s) => s.hydrated);
  const storeDirty = usePropertyLandingEditorStore((s) => s.isDirty);
  const historyIndex = usePropertyLandingEditorStore((s) => s.historyIndex);
  const historyLength = usePropertyLandingEditorStore((s) => s.history.length);
  const hydrate = usePropertyLandingEditorStore((s) => s.hydrate);
  const reset = usePropertyLandingEditorStore((s) => s.reset);
  const undo = usePropertyLandingEditorStore((s) => s.undo);
  const redo = usePropertyLandingEditorStore((s) => s.redo);
  const markClean = usePropertyLandingEditorStore((s) => s.markClean);

  const [media, setMedia] = useState<PropertyMediaItem[]>(() =>
    propertyMediaFromProperty(property)
  );
  const [mediaBusy, setMediaBusy] = useState(false);
  const [brandColor, setBrandColor] = useState('');
  const [brandHydrated, setBrandHydrated] = useState(false);
  const [content, setContent] = useState<LandingProfileContent>(() =>
    contentFromProperty(property)
  );
  const [contentHydrated, setContentHydrated] = useState(false);
  const [contentBaselineFp, setContentBaselineFp] = useState<string | null>(null);
  const [socialDraft, setSocialDraft] = useState<AppSettingsFormValues | null>(null);
  const [socialBaseline, setSocialBaseline] = useState<AppSettingsFormValues | null>(null);
  const [interactedFields, setInteractedFields] = useState<Record<string, boolean>>({});
  const entitlements = usePropertyEntitlements(propertyId);
  const canAutosave = entitlements.data
    ? isFeatureEnabled(entitlements.data, 'publicPagesAutosave')
    : false;
  const { open: openUpgradeModal } = useUpgradeModal();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isSavingBeforeLeave, setIsSavingBeforeLeave] = useState(false);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  useEffect(() => {
    if (!configQuery.data || hydrated) return;
    hydrate(configQuery.data.config as PropertyLandingSectionConfig);
  }, [configQuery.data, hydrate, hydrated]);

  useEffect(() => {
    setMedia(propertyMediaFromProperty(property));
    if (!contentHydrated) {
      const next = contentFromProperty(property);
      setContent(next);
      setContentBaselineFp(JSON.stringify(next));
      setContentHydrated(true);
    }
  }, [property, contentHydrated]);

  useEffect(() => {
    if (!appSettings || brandHydrated) return;
    const values = appSettingsToFormValues(appSettings);
    setBrandColor(values.brandColor);
    setBrandHydrated(true);
    setSocialDraft(values);
    setSocialBaseline(values);
  }, [appSettings, brandHydrated]);

  const fingerprint = useMemo(() => (hydrated ? JSON.stringify(config) : null), [config, hydrated]);

  const configSave = usePageEditorAutoSave({
    enabled: canAutosave && hydrated && Boolean(propertyId),
    suspended: !hydrated,
    contentFingerprint: fingerprint,
    debounceMs: 1000,
    save: async () => {
      await saveMutation.mutateAsync(config);
      markClean();
    },
  });

  const brandFingerprint = useMemo(
    () => (brandHydrated ? brandColor : null),
    [brandColor, brandHydrated]
  );
  const brandColorError = brandHydrated ? validateOrgBrandColor(brandColor) : null;

  const brandSave = usePageEditorAutoSave({
    enabled: canAutosave && brandHydrated && Boolean(propertyId) && !brandColorError,
    suspended: !appSettings || !brandHydrated,
    contentFingerprint: brandFingerprint,
    debounceMs: 800,
    save: async () => {
      if (!appSettings) return;
      const stored = propertyBrandColorStoredValue(brandColor, inheritedBrandColor);
      await updateAppSettings.mutateAsync({ brandColor: stored, publicPagesAutosaveGate: true });
    },
  });

  const cancellationError =
    content.cancellationPolicy.type === 'custom'
      ? validateCancellationPolicySettings(content.cancellationPolicy)
      : null;

  const contentFingerprint = useMemo(
    () => (contentHydrated ? JSON.stringify(content) : null),
    [content, contentHydrated]
  );

  const contentSave = usePageEditorAutoSave({
    enabled: canAutosave && contentHydrated && Boolean(propertyId) && !cancellationError,
    suspended: !contentHydrated,
    contentFingerprint,
    debounceMs: 1000,
    save: async () => {
      if (!propertyId) return;
      await updateProperty.mutateAsync({
        propertyId,
        publicPagesAutosaveGate: true,
        settings: {
          description: content.description.trim(),
          enabledAmenities: content.enabledAmenities,
          customAmenities: content.customAmenities,
          enabledHouseRules: content.enabledHouseRules,
          customHouseRules: content.customHouseRules,
          cancellationPolicy: content.cancellationPolicy,
        },
      });
      setContentBaselineFp(JSON.stringify(content));
    },
  });

  const socialFingerprint = useMemo(() => {
    if (!socialDraft) return null;
    return JSON.stringify({
      facebookPageUrl: socialDraft.facebookPageUrl,
      airbnbUrl: socialDraft.airbnbUrl,
      instagramUrl: socialDraft.instagramUrl,
      tiktokUrl: socialDraft.tiktokUrl,
    });
  }, [socialDraft]);

  const socialBaselineFingerprint = useMemo(() => {
    if (!socialBaseline) return null;
    return JSON.stringify({
      facebookPageUrl: socialBaseline.facebookPageUrl,
      airbnbUrl: socialBaseline.airbnbUrl,
      instagramUrl: socialBaseline.instagramUrl,
      tiktokUrl: socialBaseline.tiktokUrl,
    });
  }, [socialBaseline]);

  const socialSave = usePageEditorAutoSave({
    enabled: canAutosave && Boolean(socialDraft && propertyId),
    suspended: !socialDraft || !appSettings,
    contentFingerprint: socialFingerprint,
    debounceMs: 1000,
    save: async () => {
      if (!socialDraft) return;
      const normalized = normalizePropertySocialLinksForSave(socialDraft, orgSocialLinks);
      const saved = await updateAppSettings.mutateAsync({
        facebookPageUrl: normalized.facebookPageUrl,
        airbnbUrl: normalized.airbnbUrl,
        instagramUrl: normalized.instagramUrl,
        tiktokUrl: normalized.tiktokUrl,
        publicPagesAutosaveGate: true,
      });
      const values = appSettingsToFormValues(saved);
      setSocialDraft((current) =>
        current
          ? {
              ...current,
              facebookPageUrl: values.facebookPageUrl,
              airbnbUrl: values.airbnbUrl,
              instagramUrl: values.instagramUrl,
              tiktokUrl: values.tiktokUrl,
              brandColor: current.brandColor,
            }
          : values
      );
      setSocialBaseline(values);
    },
  });

  const status = mergePageEditorAutoSaveStatuses([
    configSave.status,
    brandSave.status,
    contentSave.status,
    socialSave.status,
  ]);
  const errorMessage = firstPageEditorAutoSaveError([
    configSave,
    brandSave,
    contentSave,
    socialSave,
  ]);
  const profileDirty =
    Boolean(contentFingerprint && contentBaselineFp && contentFingerprint !== contentBaselineFp) ||
    Boolean(socialBaseline && brandHydrated && brandColor !== socialBaseline.brandColor) ||
    Boolean(
      socialFingerprint &&
      socialBaselineFingerprint &&
      socialFingerprint !== socialBaselineFingerprint
    );
  const isDirty = canAutosave
    ? status === 'pending' || status === 'error'
    : storeDirty || profileDirty;

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const saveAllPending = () =>
    Promise.all([
      configSave.saveNow(),
      brandSave.saveNow(),
      contentSave.saveNow(),
      socialSave.saveNow(),
    ]);

  const handleMediaPersisted = (next: PropertyMediaItem[]) => {
    setMedia(next);
  };

  const persistMediaOrder = async (next: PropertyMediaItem[]) => {
    if (!propertyId) return;
    setMediaBusy(true);
    try {
      await updateProperty.mutateAsync({
        propertyId,
        settings: { media: next },
      });
      setMedia(next);
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not save gallery order'));
      throw error;
    } finally {
      setMediaBusy(false);
    }
  };

  const markFieldInteracted = (fieldId: string) => {
    setInteractedFields((current) =>
      current[fieldId] ? current : { ...current, [fieldId]: true }
    );
  };

  const resolveFieldError = (fieldId: string) => {
    if (fieldId === 'cancellation-custom-title' || fieldId === 'cancellation-custom-description') {
      if (!interactedFields[fieldId] || !cancellationError) return null;
      if (fieldId === 'cancellation-custom-title' && cancellationError.includes('title')) {
        return cancellationError;
      }
      if (
        fieldId === 'cancellation-custom-description' &&
        cancellationError.includes('description')
      ) {
        return cancellationError;
      }
      if (fieldId === 'cancellation-custom-title') return cancellationError;
    }
    return null;
  };

  const onContentChange = <K extends keyof LandingProfileContent>(
    key: K,
    value: LandingProfileContent[K]
  ) => {
    setContent((current) => ({ ...current, [key]: value }));
  };

  const onSocialChange = <K extends keyof AppSettingsFormValues>(
    key: K,
    value: AppSettingsFormValues[K]
  ) => {
    setSocialDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const previewMedia = mediaItemsToPreview(media);
  const resolvedBrand = brandColor.trim() || appSettings?.resolvedBrandColor || inheritedBrandColor;

  const mergedPreview = useMemo(() => {
    if (!previewQuery.data) return null;
    const profile = propertyProfileDraftFromProperty(property);
    return {
      kind: 'property-landing' as const,
      data: {
        ...previewQuery.data,
        sectionConfig: config,
        media: previewMedia.media,
        images: previewMedia.images.length > 0 ? previewMedia.images : previewQuery.data.images,
        brandColor: resolvedBrand,
        description: content.description.trim() || null,
        amenities: resolveAmenityLabels(content.enabledAmenities, content.customAmenities),
        houseRules: resolveHouseRulesForDisplay({
          enabledIds: content.enabledHouseRules,
          customRules: content.customHouseRules,
          checkInTime: profile.checkInTime,
          checkOutTime: profile.checkOutTime,
        }),
        cancellationPolicy: resolveCancellationPolicyDisplay(content.cancellationPolicy),
      },
    };
  }, [
    previewQuery.data,
    config,
    previewMedia.media,
    previewMedia.images,
    resolvedBrand,
    content,
    property,
  ]);

  const backHref = propertySectionPath(orgSlug, propertySlug, 'public-pages');
  const pageMeta = PAGE_EDITOR_META.listing;
  const publicLinks = useMemo(
    () => (propertyId ? resolvePageEditorPublicLinks('listing', propertySlug, propertyId) : null),
    [propertyId, propertySlug]
  );

  const handleManualSaveClick = async () => {
    if (!canAutosave) {
      openUpgradeModal('publicPagesAutosave');
      return;
    }
    try {
      await saveAllPending();
      toast.success('Saved');
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not save changes'));
    }
  };

  const handleBack = () => {
    if (isDirty) {
      setShowLeaveConfirm(true);
      return;
    }
    navigate(backHref);
  };

  const handleSaveAndLeave = async () => {
    if (!canAutosave) {
      setShowLeaveConfirm(false);
      openUpgradeModal('publicPagesAutosave');
      return;
    }
    setIsSavingBeforeLeave(true);
    try {
      await saveAllPending();
      navigate(backHref);
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not save changes'));
    } finally {
      setIsSavingBeforeLeave(false);
      setShowLeaveConfirm(false);
    }
  };

  const handleDiscardAndLeave = () => {
    setShowLeaveConfirm(false);
    navigate(backHref);
  };

  const isBootstrapping =
    (configQuery.isLoading && !configQuery.data) ||
    (previewQuery.isLoading && !previewQuery.data) ||
    !hydrated ||
    !brandHydrated ||
    !contentHydrated ||
    !socialDraft ||
    !appSettings;

  if (isBootstrapping) {
    return (
      <PageEditorChrome>
        <SectionContentSkeleton rows={5} className="min-h-[50vh]" />
      </PageEditorChrome>
    );
  }

  if (configQuery.isError || previewQuery.isError || !mergedPreview) {
    return (
      <PageEditorChrome>
        <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center px-4 text-center text-sm">
          Could not load the listing editor.
        </div>
      </PageEditorChrome>
    );
  }

  return (
    <PageEditorChrome>
      <PropertySettingsBrandColorPreview
        brandColor={brandColor}
        resolvedBrandColor={resolvedBrand}
      />
      <PageEditorShell
        canUndo={historyIndex > 0}
        canRedo={historyIndex < historyLength - 1}
        onUndo={undo}
        onRedo={redo}
        header={
          <PageEditorHeader
            pageLabel={pageMeta.label}
            onBack={handleBack}
            autoSaveStatus={status}
            autoSaveError={errorMessage}
            openHref={publicLinks?.openHref}
            copyHref={publicLinks?.copyHref}
            publicPageLabel={publicLinks?.pageLabel}
            manualSave={{
              visible: !canAutosave && isDirty,
              onClick: () => void handleManualSaveClick(),
              isSaving: status === 'saving',
            }}
          />
        }
        controls={
          <PropertyLandingEditorPanel
            media={media}
            onMediaChange={setMedia}
            onMediaPersisted={handleMediaPersisted}
            onPersistMediaOrder={persistMediaOrder}
            mediaBusy={mediaBusy}
            brandColor={brandColor}
            inheritedBrandColor={inheritedBrandColor}
            onBrandColorChange={setBrandColor}
            brandColorError={brandColorError}
            content={content}
            onContentChange={onContentChange}
            socialDraft={socialDraft}
            appSettings={appSettings}
            orgSocialLinks={orgSocialLinks}
            onSocialChange={onSocialChange}
            resolveFieldError={resolveFieldError}
            markFieldInteracted={markFieldInteracted}
          />
        }
        preview={
          <PageEditorPreviewPane>
            <PreviewOverrideProvider value={mergedPreview}>
              <PropertyDetailPage />
            </PreviewOverrideProvider>
          </PageEditorPreviewPane>
        }
      />
      <PageEditorLeaveConfirmDialog
        open={showLeaveConfirm}
        onOpenChange={setShowLeaveConfirm}
        onSaveAndLeave={() => void handleSaveAndLeave()}
        onDiscardAndLeave={handleDiscardAndLeave}
        isSaving={isSavingBeforeLeave}
      />
    </PageEditorChrome>
  );
}
