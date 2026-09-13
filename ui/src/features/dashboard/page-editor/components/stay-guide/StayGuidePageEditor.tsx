import { useEffect, useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { toast } from 'sonner';

import { PreviewOverrideProvider } from '@/features/guest/lib/previewOverrideContext';
import {
  isShowcaseTemplateKey,
  type ShowcaseTemplateKey,
} from '@/features/guest/marketing/showcase/types/showcase';
import { useGuestStayGuidePreview } from '@/features/guest/stay-guide/hooks/useGuestStayGuide';
import {
  normalizeStayGuideConfigV2,
  stayGuideConfigForSave,
} from '@/features/guest/stay-guide/lib/stayGuideConfig';
import { extractLeadingSectionHeading } from '@/features/guest/stay-guide/lib/stayGuideContent';
import { StayGuidePage } from '@/features/guest/stay-guide/pages/StayGuidePage';

import {
  usePropertyTemplateMutations,
  usePropertyTemplates,
  type PropertyTemplateDto,
} from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import { useAdminLayoutFillMain } from '@/features/dashboard/bookings/lib/adminLayoutFillMain';
import { normalizeBlockLevelPlaceholdersInHtml } from '@/features/dashboard/bookings/lib/normalizeBlockLevelPlaceholders';
import { applyPropertyTemplatePlaceholders } from '@/features/dashboard/bookings/lib/propertyTemplatePlaceholders';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { PageEditorHeader } from '@/features/dashboard/page-editor/components/PageEditorHeader';
import { PageEditorLeaveConfirmDialog } from '@/features/dashboard/page-editor/components/PageEditorLeaveConfirmDialog';
import { PageEditorPreviewPane } from '@/features/dashboard/page-editor/components/PageEditorPreviewPane';
import { PageEditorShell } from '@/features/dashboard/page-editor/components/PageEditorShell';
import { StayGuideEditorPanel } from '@/features/dashboard/page-editor/components/stay-guide/StayGuideEditorPanel';
import {
  draftFromTemplate,
  isStayGuideSectionDraftDirty,
  type StayGuideSectionDraft,
} from '@/features/dashboard/page-editor/components/stay-guide/StayGuideSectionContentCard';
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
import { STAY_GUIDE_STANDARD_TEMPLATE_KEYS } from '@/features/dashboard/page-editor/lib/stayGuideChapterSections';
import { useStayGuideEditorStore } from '@/features/dashboard/page-editor/stores/stayGuideEditorStore';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { usePropertyEntitlements } from '@/features/dashboard/plans/hooks/usePropertyEntitlements';
import { isFeatureEnabled } from '@/features/dashboard/plans/lib/planFeatures';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { SectionContentSkeleton } from '@/components/skeletons/AdminSkeletons';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

function PageChrome({ children }: { children: React.ReactNode }) {
  // Immersive editor — fill the admin main column so the preview frame gets height.
  useAdminLayoutFillMain(true);

  return (
    <AdminMobilePage title="Stay Guide" titleId="stay-guide-editor-heading">
      {children}
    </AdminMobilePage>
  );
}

async function patchStayGuideTemplate(propertyId: string, templateKey: ShowcaseTemplateKey) {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('/custom-pages-settings', propertyId), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageType: 'stay_guide', templateKey }),
  });
  const json = (await res.json()) as { success?: boolean; error?: string };
  if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to update template');
}

async function fetchStayGuideTemplateKey(propertyId: string): Promise<ShowcaseTemplateKey> {
  try {
    const jwt = await getSessionJwt();
    const res = await fetch(scopedFunctionsUrl('/custom-pages-settings', propertyId), {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const json = (await res.json()) as {
      data?: { pages?: Array<{ pageType: string; templateKey: string }> };
    };
    const row = json.data?.pages?.find((p) => p.pageType === 'stay_guide');
    if (row && isShowcaseTemplateKey(row.templateKey)) return row.templateKey;
  } catch {
    /* default */
  }
  return 'showcase-aurora';
}

export function StayGuidePageEditor({
  orgSlug,
  propertySlug,
}: {
  orgSlug: string;
  propertySlug: string;
  propertyId: string | null;
}) {
  const navigate = useNavigate();
  const propertyId = usePropertyIdParam();
  const configQuery = usePublicPageConfig('stay_guide');
  const saveConfig = useSavePublicPageConfig('stay_guide');
  const previewQuery = useGuestStayGuidePreview(propertySlug, propertyId ?? '');
  const templatesQuery = usePropertyTemplates();
  const { saveTemplate } = usePropertyTemplateMutations();

  const config = useStayGuideEditorStore((s) => s.config);
  const templateKey = useStayGuideEditorStore((s) => s.templateKey);
  const hydrated = useStayGuideEditorStore((s) => s.hydrated);
  const storeDirty = useStayGuideEditorStore((s) => s.isDirty);
  const historyIndex = useStayGuideEditorStore((s) => s.historyIndex);
  const historyLength = useStayGuideEditorStore((s) => s.history.length);
  const hydrate = useStayGuideEditorStore((s) => s.hydrate);
  const reset = useStayGuideEditorStore((s) => s.reset);
  const undo = useStayGuideEditorStore((s) => s.undo);
  const redo = useStayGuideEditorStore((s) => s.redo);
  const markClean = useStayGuideEditorStore((s) => s.markClean);

  const [contentDrafts, setContentDrafts] = useState<Record<string, StayGuideSectionDraft>>({});
  const [contentHydrated, setContentHydrated] = useState(false);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const entitlements = usePropertyEntitlements(propertyId);
  const canAutosave = entitlements.data
    ? isFeatureEnabled(entitlements.data, 'publicPagesAutosave')
    : false;
  const { open: openUpgradeModal } = useUpgradeModal();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isSavingBeforeLeave, setIsSavingBeforeLeave] = useState(false);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (!configQuery.data || hydrated) return;
    void (async () => {
      const key = propertyId ? await fetchStayGuideTemplateKey(propertyId) : 'showcase-aurora';
      hydrate(normalizeStayGuideConfigV2(configQuery.data.config), key);
      setTemplateLoaded(true);
    })();
  }, [configQuery.data, hydrated, hydrate, propertyId]);

  const templatesByKey = useMemo(() => {
    const map: Record<string, PropertyTemplateDto> = {};
    for (const template of templatesQuery.data?.templates ?? []) {
      if (template.category === 'standard') map[template.templateKey] = template;
    }
    return map;
  }, [templatesQuery.data?.templates]);

  useEffect(() => {
    if (!templatesQuery.data || contentHydrated) return;
    const next: Record<string, StayGuideSectionDraft> = {};
    for (const key of STAY_GUIDE_STANDARD_TEMPLATE_KEYS) {
      const template = templatesByKey[key];
      if (template) next[key] = draftFromTemplate(template);
    }
    if (Object.keys(next).length === 0) return;
    setContentDrafts(next);
    setContentHydrated(true);
  }, [templatesQuery.data, templatesByKey, contentHydrated]);

  const configSave = usePageEditorAutoSave({
    enabled: canAutosave && hydrated && Boolean(propertyId),
    suspended: !hydrated,
    contentFingerprint: hydrated ? JSON.stringify(config) : null,
    debounceMs: 1000,
    save: async () => {
      await saveConfig.mutateAsync(stayGuideConfigForSave(config));
      markClean();
    },
  });

  const templateSave = usePageEditorAutoSave({
    enabled: canAutosave && hydrated && templateLoaded && Boolean(propertyId),
    suspended: !hydrated,
    contentFingerprint: hydrated ? templateKey : null,
    debounceMs: 800,
    save: async () => {
      if (!propertyId) return;
      await patchStayGuideTemplate(propertyId, templateKey);
      markClean();
    },
  });

  const contentFingerprint = useMemo(() => {
    if (!contentHydrated) return null;
    return JSON.stringify(
      STAY_GUIDE_STANDARD_TEMPLATE_KEYS.map((key) => {
        const draft = contentDrafts[key];
        return draft
          ? { key, content: draft.content, sectionImageUrl: draft.sectionImageUrl }
          : { key };
      })
    );
  }, [contentDrafts, contentHydrated]);

  const contentSave = usePageEditorAutoSave({
    enabled: canAutosave && contentHydrated && Boolean(propertyId),
    suspended: !contentHydrated,
    contentFingerprint,
    debounceMs: 1200,
    save: async () => {
      const dirtyKeys = STAY_GUIDE_STANDARD_TEMPLATE_KEYS.filter((key) => {
        const draft = contentDrafts[key];
        const template = templatesByKey[key];
        return draft && template && isStayGuideSectionDraftDirty(draft, template);
      });
      for (const key of dirtyKeys) {
        const draft = contentDrafts[key];
        if (!draft) continue;
        await saveTemplate.mutateAsync({
          templateKey: key,
          content: draft.content,
          sectionImageUrl: draft.sectionImageUrl,
          silent: true,
          publicPagesAutosaveGate: true,
        });
      }
    },
  });

  const status = mergePageEditorAutoSaveStatuses([
    configSave.status,
    templateSave.status,
    contentSave.status,
  ]);
  const errorMessage = firstPageEditorAutoSaveError([configSave, templateSave, contentSave]);
  const contentDirty = STAY_GUIDE_STANDARD_TEMPLATE_KEYS.some((key) => {
    const draft = contentDrafts[key];
    const template = templatesByKey[key];
    return Boolean(draft && template && isStayGuideSectionDraftDirty(draft, template));
  });
  const isDirty = canAutosave
    ? status === 'pending' || status === 'error'
    : storeDirty || contentDirty;

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const mergedPreview = useMemo(() => {
    if (!previewQuery.data) return null;
    const sections = previewQuery.data.sections.map((section) => {
      const draft = contentDrafts[section.key];
      if (!draft) return section;
      const filled = applyPropertyTemplatePlaceholders(draft.content);
      const { heading, bodyHtml } = extractLeadingSectionHeading(filled);
      return {
        ...section,
        displayHeading: heading || section.label,
        html: heading ? bodyHtml : filled,
        imageUrl: draft.sectionImageUrl,
        imageUpdatedAt: draft.imageBust
          ? new Date(draft.imageBust).toISOString()
          : section.imageUpdatedAt,
      };
    });
    return {
      kind: 'stay-guide' as const,
      data: {
        ...previewQuery.data,
        sectionConfig: config,
        templateKey,
        sections,
      },
    };
  }, [previewQuery.data, config, templateKey, contentDrafts]);

  const backHref = propertySectionPath(orgSlug, propertySlug, 'public-pages');
  const publicLinks = useMemo(
    () =>
      propertyId ? resolvePageEditorPublicLinks('stay-guide', propertySlug, propertyId) : null,
    [propertyId, propertySlug]
  );

  const saveAll = async () => {
    await saveConfig.mutateAsync(stayGuideConfigForSave(config));
    if (propertyId) await patchStayGuideTemplate(propertyId, templateKey);
    await Promise.all([contentSave.saveNow()]);
    markClean();
  };

  const handleManualSaveClick = async () => {
    if (!canAutosave) {
      openUpgradeModal('publicPagesAutosave');
      return;
    }
    try {
      await saveAll();
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
      await saveAll();
      navigate(backHref);
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not save changes'));
    } finally {
      setIsSavingBeforeLeave(false);
      setShowLeaveConfirm(false);
    }
  };

  const handleDraftChange = (key: string, draft: StayGuideSectionDraft) => {
    setContentDrafts((current) => ({ ...current, [key]: draft }));
  };

  const handleResetSection = (key: string) => {
    const template = templatesByKey[key];
    if (!template) return;
    setContentDrafts((current) => ({
      ...current,
      [key]: {
        content: normalizeBlockLevelPlaceholdersInHtml(template.defaultContent),
        sectionImageUrl: null,
        imageBust: 0,
      },
    }));
  };

  const isBootstrapping =
    (configQuery.isLoading && !configQuery.data) ||
    (previewQuery.isLoading && !previewQuery.data) ||
    (templatesQuery.isLoading && !templatesQuery.data) ||
    !hydrated ||
    !contentHydrated;

  if (isBootstrapping) {
    return (
      <PageChrome>
        <SectionContentSkeleton rows={5} className="min-h-[50vh]" />
      </PageChrome>
    );
  }

  if (configQuery.isError || previewQuery.isError || templatesQuery.isError || !mergedPreview) {
    return (
      <PageChrome>
        <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center px-4 text-center text-sm">
          Could not load the Stay Guide editor.
        </div>
      </PageChrome>
    );
  }

  return (
    <PageChrome>
      <PageEditorShell
        canUndo={historyIndex > 0}
        canRedo={historyIndex < historyLength - 1}
        onUndo={undo}
        onRedo={redo}
        header={
          <PageEditorHeader
            pageLabel="Stay Guide"
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
          <StayGuideEditorPanel
            templatesByKey={templatesByKey}
            drafts={contentDrafts}
            onDraftChange={handleDraftChange}
            onResetSection={handleResetSection}
            contentBusy={saveTemplate.isPending}
            previewDto={mergedPreview.data}
            propertyImages={previewQuery.data?.property.galleryImages ?? []}
            propertyBrandColor={previewQuery.data?.property.brandColor}
          />
        }
        preview={
          <PageEditorPreviewPane>
            <PreviewOverrideProvider value={mergedPreview}>
              <StayGuidePage />
            </PreviewOverrideProvider>
          </PageEditorPreviewPane>
        }
      />
      <PageEditorLeaveConfirmDialog
        open={showLeaveConfirm}
        onOpenChange={setShowLeaveConfirm}
        isSaving={isSavingBeforeLeave}
        onSaveAndLeave={() => void handleSaveAndLeave()}
        onDiscardAndLeave={() => {
          setShowLeaveConfirm(false);
          navigate(backHref);
        }}
      />
    </PageChrome>
  );
}
