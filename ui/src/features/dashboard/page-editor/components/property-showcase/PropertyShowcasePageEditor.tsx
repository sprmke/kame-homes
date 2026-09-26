import { useEffect, useMemo } from 'react';
import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { toast } from 'sonner';

import { PreviewOverrideProvider } from '@/features/guest/lib/previewOverrideContext';
import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';
import { PropertyShowcasePage } from '@/features/guest/marketing/showcase/pages/PropertyShowcasePage';
import {
  defaultPropertyShowcaseConfig,
  isShowcaseTemplateKey,
  showcaseConfigForSave,
  type PropertyShowcaseConfig,
  type ShowcaseTemplateKey,
} from '@/features/guest/marketing/showcase/types/showcase';

import { useAdminLayoutFillMain } from '@/features/dashboard/bookings/lib/adminLayoutFillMain';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { PageEditorHeader } from '@/features/dashboard/page-editor/components/PageEditorHeader';
import { PageEditorLeaveConfirmDialog } from '@/features/dashboard/page-editor/components/PageEditorLeaveConfirmDialog';
import { PageEditorPreviewPane } from '@/features/dashboard/page-editor/components/PageEditorPreviewPane';
import { PageEditorShell } from '@/features/dashboard/page-editor/components/PageEditorShell';
import { PropertyShowcaseEditorPanel } from '@/features/dashboard/page-editor/components/property-showcase/PropertyShowcaseEditorPanel';
import { useEditorPreviewJwt } from '@/features/dashboard/page-editor/hooks/useEditorPreviewJwt';
import {
  mergePageEditorAutoSaveStatuses,
  usePageEditorAutoSave,
} from '@/features/dashboard/page-editor/hooks/usePageEditorAutoSave';
import {
  usePublicPageConfig,
  useSavePublicPageConfig,
} from '@/features/dashboard/page-editor/hooks/usePublicPageConfig';
import { resolvePageEditorPublicLinks } from '@/features/dashboard/page-editor/lib/pageEditorPublicLinks';
import { usePropertyShowcaseEditorStore } from '@/features/dashboard/page-editor/stores/propertyShowcaseEditorStore';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { usePropertyEntitlements } from '@/features/dashboard/plans/hooks/usePropertyEntitlements';
import { isFeatureEnabled } from '@/features/dashboard/plans/lib/planFeatures';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { PageEditorSkeleton } from '@/components/skeletons/AdminSkeletons';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

async function patchShowcaseTemplate(propertyId: string, templateKey: ShowcaseTemplateKey) {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('/custom-pages-settings', propertyId), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pageType: 'property_showcase', templateKey }),
  });
  const json = (await res.json()) as { success?: boolean; error?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to update template');
  }
}

export function PropertyShowcasePageEditor({
  orgSlug,
  propertySlug,
}: {
  orgSlug: string;
  propertySlug: string;
  propertyId: string | null;
}) {
  // Immersive editor — fill the admin main column so the preview frame gets height.
  useAdminLayoutFillMain(true);

  const navigate = useNavigate();
  const propertyId = usePropertyIdParam();
  const { open } = useUpgradeModal();
  const entitlements = usePropertyEntitlements();
  const canAutosave = entitlements.data
    ? isFeatureEnabled(entitlements.data, 'publicPagesAutosave')
    : false;

  const configQuery = usePublicPageConfig('property_showcase');
  const saveConfig = useSavePublicPageConfig('property_showcase');
  const previewJwt = useEditorPreviewJwt();
  const previewQuery = usePublicPropertyDetail(propertySlug, { previewJwt });

  const config = usePropertyShowcaseEditorStore((s) => s.config);
  const templateKey = usePropertyShowcaseEditorStore((s) => s.templateKey);
  const hydrated = usePropertyShowcaseEditorStore((s) => s.hydrated);
  const isDirty = usePropertyShowcaseEditorStore((s) => s.isDirty);
  const historyIndex = usePropertyShowcaseEditorStore((s) => s.historyIndex);
  const historyLength = usePropertyShowcaseEditorStore((s) => s.history.length);
  const hydrate = usePropertyShowcaseEditorStore((s) => s.hydrate);
  const reset = usePropertyShowcaseEditorStore((s) => s.reset);
  const undo = usePropertyShowcaseEditorStore((s) => s.undo);
  const redo = usePropertyShowcaseEditorStore((s) => s.redo);
  const markClean = usePropertyShowcaseEditorStore((s) => s.markClean);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isSavingBeforeLeave, setIsSavingBeforeLeave] = useState(false);
  const [templateLoaded, setTemplateLoaded] = useState(false);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  useEffect(() => {
    if (!configQuery.data || hydrated) return;
    const next = configQuery.data.config as PropertyShowcaseConfig;
    void (async () => {
      let key: ShowcaseTemplateKey = 'showcase-aurora';
      if (propertyId) {
        try {
          const jwt = await getSessionJwt();
          const res = await fetch(scopedFunctionsUrl('/custom-pages-settings', propertyId), {
            headers: { Authorization: `Bearer ${jwt}` },
          });
          const json = (await res.json()) as {
            success?: boolean;
            data?: { pages?: Array<{ pageType: string; templateKey: string }> };
          };
          const showcase = json.data?.pages?.find((p) => p.pageType === 'property_showcase');
          if (showcase && isShowcaseTemplateKey(showcase.templateKey)) {
            key = showcase.templateKey;
          }
        } catch {
          /* default */
        }
      }
      hydrate(
        {
          ...defaultPropertyShowcaseConfig(),
          ...next,
          sections: next.sections?.length
            ? next.sections
            : defaultPropertyShowcaseConfig().sections,
        },
        key
      );
      setTemplateLoaded(true);
    })();
  }, [configQuery.data, hydrated, hydrate, propertyId]);

  const configSave = usePageEditorAutoSave({
    enabled: canAutosave && hydrated,
    contentFingerprint: hydrated ? JSON.stringify(config) : null,
    save: async () => {
      await saveConfig.mutateAsync(showcaseConfigForSave(config));
      markClean();
    },
  });

  const templateSave = usePageEditorAutoSave({
    enabled: canAutosave && hydrated && templateLoaded,
    contentFingerprint: hydrated ? templateKey : null,
    save: async () => {
      if (!propertyId) return;
      await patchShowcaseTemplate(propertyId, templateKey);
      markClean();
    },
  });

  const status = mergePageEditorAutoSaveStatuses([configSave.status, templateSave.status]);
  /** Paid plans: autosave status is source of truth (store `isDirty` stays true after undo/template). */
  const hasUnsavedChanges = canAutosave ? status === 'pending' || status === 'error' : isDirty;

  const mergedPreview = useMemo(() => {
    if (!previewQuery.data) return null;
    return {
      kind: 'property-showcase' as const,
      data: previewQuery.data,
      showcaseConfig: config,
      templateKey,
    };
  }, [previewQuery.data, config, templateKey]);

  const propertyImages = previewQuery.data?.images ?? [];
  const backHref = propertySectionPath(orgSlug, propertySlug, 'public-pages');
  const publicLinks = useMemo(
    () => (propertyId ? resolvePageEditorPublicLinks('showcase', propertySlug, propertyId) : null),
    [propertyId, propertySlug]
  );

  const saveAll = async () => {
    await saveConfig.mutateAsync(showcaseConfigForSave(config));
    if (propertyId) await patchShowcaseTemplate(propertyId, templateKey);
    markClean();
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      setShowLeaveConfirm(true);
      return;
    }
    navigate(backHref);
  };

  const previewPending = previewJwt === null || previewQuery.isLoading;
  if (configQuery.isLoading || previewPending || !hydrated) {
    return (
      <AdminMobilePage title="Showcase" titleId="showcase-editor-heading">
        <PageEditorSkeleton />
      </AdminMobilePage>
    );
  }

  if (previewQuery.isError || !previewQuery.data) {
    return (
      <AdminMobilePage title="Showcase" titleId="showcase-editor-heading">
        <p className="text-muted-foreground px-4 py-16 text-center text-sm">
          Could not load this showcase.
        </p>
      </AdminMobilePage>
    );
  }

  return (
    <AdminMobilePage title="Showcase" titleId="showcase-editor-heading">
      <PageEditorShell
        canUndo={historyIndex > 0}
        canRedo={historyIndex < historyLength - 1}
        onUndo={undo}
        onRedo={redo}
        header={
          <PageEditorHeader
            pageLabel="Showcase"
            onBack={handleBack}
            autoSaveStatus={status}
            autoSaveError={configSave.errorMessage ?? templateSave.errorMessage}
            openHref={publicLinks?.openHref}
            copyHref={publicLinks?.copyHref}
            publicPageLabel={publicLinks?.pageLabel}
            manualSave={{
              visible: !canAutosave && hasUnsavedChanges,
              onClick: () => {
                void (async () => {
                  if (!canAutosave) {
                    open('publicPagesAutosave');
                    return;
                  }
                  try {
                    await saveAll();
                    toast.success('Saved');
                  } catch (error) {
                    toast.error(friendlyToastError(error, 'Could not save'));
                  }
                })();
              },
              isSaving: status === 'saving',
            }}
          />
        }
        controls={
          <PropertyShowcaseEditorPanel
            property={previewQuery.data}
            propertyImages={propertyImages}
            propertyBrandColor={previewQuery.data?.brandColor}
          />
        }
        preview={
          <PageEditorPreviewPane>
            {mergedPreview ? (
              <PreviewOverrideProvider value={mergedPreview}>
                <PropertyShowcasePage />
              </PreviewOverrideProvider>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                Loading preview
              </div>
            )}
          </PageEditorPreviewPane>
        }
      />
      <PageEditorLeaveConfirmDialog
        open={showLeaveConfirm}
        onOpenChange={setShowLeaveConfirm}
        isSaving={isSavingBeforeLeave}
        onDiscardAndLeave={() => {
          setShowLeaveConfirm(false);
          navigate(backHref);
        }}
        onSaveAndLeave={() => {
          void (async () => {
            if (!canAutosave) {
              setShowLeaveConfirm(false);
              open('publicPagesAutosave');
              return;
            }
            setIsSavingBeforeLeave(true);
            try {
              await saveAll();
              navigate(backHref);
            } catch (error) {
              toast.error(friendlyToastError(error, 'Could not save'));
            } finally {
              setIsSavingBeforeLeave(false);
            }
          })();
        }}
      />
    </AdminMobilePage>
  );
}
