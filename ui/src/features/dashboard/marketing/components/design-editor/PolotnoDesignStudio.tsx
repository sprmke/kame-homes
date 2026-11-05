import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import {
  Download,
  LayoutTemplate,
  Loader2,
  Redo2,
  RotateCcw,
  Scaling,
  Send,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { onSnapshot, type IAnyStateTreeNode } from 'mobx-state-tree';
import { toast } from 'sonner';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import { CollagePanel } from '@/features/dashboard/marketing/components/design-editor/collage/CollagePanel';
import { KamePolotnoEditor } from '@/features/dashboard/marketing/components/design-editor/polotno/KamePolotnoEditor';
import {
  KAME_COLLAGE_SECTION,
  KAME_TEMPLATES_SECTION,
  KameStudioSectionsProvider,
} from '@/features/dashboard/marketing/components/design-editor/polotno/KameStudioSections';
import { useMarketingUploads } from '@/features/dashboard/marketing/components/design-editor/polotno/useMarketingUploads';
import { MarketingTemplateBrowser } from '@/features/dashboard/marketing/components/library/MarketingTemplateBrowser';
import type { MarketingTemplatePick } from '@/features/dashboard/marketing/components/library/MarketingTemplateBrowser';
import {
  MarketingAiGeneratePanel,
  type MarketingAiGenerateInput,
} from '@/features/dashboard/marketing/components/shared/MarketingAiGeneratePanel';
import { MarketingEditorHistoryControls } from '@/features/dashboard/marketing/components/shared/MarketingEditorHistoryControls';
import type {
  MarketingEditorDocument,
  MarketingEditorNav,
} from '@/features/dashboard/marketing/components/shared/MarketingEditorHost';
import { MarketingEditorMobileToolbar } from '@/features/dashboard/marketing/components/shared/MarketingEditorMobileToolbar';
import { MarketingEditorTopBar } from '@/features/dashboard/marketing/components/shared/MarketingEditorTopBar';
import { MarketingReplaceTemplateDialog } from '@/features/dashboard/marketing/components/shared/MarketingReplaceTemplateDialog';
import { MarketingReviewSidebarSection } from '@/features/dashboard/marketing/components/shared/MarketingReviewSidebarSection';
import { MarketingSizeDialog } from '@/features/dashboard/marketing/components/shared/MarketingSizeDialog';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { useGenerateMarketingTemplate } from '@/features/dashboard/marketing/hooks/useGenerateMarketingTemplate';
import { useMarketingAutoSaveSuspension } from '@/features/dashboard/marketing/hooks/useMarketingAutoSaveSuspension';
import { useMarketingBookedDates } from '@/features/dashboard/marketing/hooks/useMarketingBookedDates';
import { useMarketingDesignSession } from '@/features/dashboard/marketing/hooks/useMarketingDesignSession';
import { useDuplicateMarketingItem } from '@/features/dashboard/marketing/hooks/useMarketingLibrary';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import {
  fetchMarketingTemplate,
  saveMarketingTemplate,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { usePolotnoHistoryState } from '@/features/dashboard/marketing/hooks/usePolotnoHistoryState';
import { usePolotnoStoreFingerprint } from '@/features/dashboard/marketing/hooks/usePolotnoStoreFingerprint';
import { usePropertyGuestReviews } from '@/features/dashboard/marketing/hooks/usePropertyGuestReviews';
import { readCollageSettings } from '@/features/dashboard/marketing/lib/collage/collageDocument';
import {
  applyCollageLayout,
  getCollageSettings,
  isStoreInCollageMode,
} from '@/features/dashboard/marketing/lib/collage/collageStoreOps';
import { applyDesignAiPreferencesToTokens } from '@/features/dashboard/marketing/lib/designAiGenerateOptions';
import {
  DESIGN_FORMAT_DIMENSIONS,
  getCampaignTemplate,
} from '@/features/dashboard/marketing/lib/designCampaignTemplates';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  availabilityTextForMonth,
  openSlotDatesForMonth,
} from '@/features/dashboard/marketing/lib/marketingBookedDates';
import { marketingEditorWorkspaceClassName } from '@/features/dashboard/marketing/lib/marketingEditorWorkspace';
import type { MarketingGuestReview } from '@/features/dashboard/marketing/lib/marketingGuestReview';
import {
  designPresetIdForSize,
  sizeOption,
  startSizesFor,
} from '@/features/dashboard/marketing/lib/marketingLibrary';
import { takePendingMarketingPhoto } from '@/features/dashboard/marketing/lib/marketingPhotoHandoff';
import {
  holdMarketingRenders,
  releaseMarketingRenders,
} from '@/features/dashboard/marketing/lib/marketingRenderGate';
import { bindingWithReview } from '@/features/dashboard/marketing/lib/marketingReviewDesignSeed';
import {
  setPendingMarketingReview,
  takePendingMarketingReview,
} from '@/features/dashboard/marketing/lib/marketingReviewHandoff';
import { MARKETING_PUBLISH_META_LABEL } from '@/features/dashboard/marketing/lib/marketingStudioCopy';
import {
  formatTemplateRef,
  type MarketingTemplateRef,
} from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import { ensurePolotnoConfigured } from '@/features/dashboard/marketing/lib/polotno/initPolotno';
import { polishOrgLogoElements } from '@/features/dashboard/marketing/lib/polotno/orgLogoCircle';
import {
  DESIGN_AI_FORMATS,
  resolveAiGeneratedDesignDocument,
} from '@/features/dashboard/marketing/lib/polotno/polotnoAiCampaignDocuments';
import {
  buildPolotnoCampaignDocument,
  themeCampaignFontMap,
} from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import {
  createPolotnoStore,
  exportPolotnoStoreImage,
  hasUnpersistedBlobSources,
  type PolotnoStore,
} from '@/features/dashboard/marketing/lib/polotno/polotnoStore';
import { pickRandomPropertyPhoto } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import { syncPolotnoTextBounds } from '@/features/dashboard/marketing/lib/polotno/syncPolotnoTextBounds';
import {
  renderDesignStoreSavedThumbnail,
  resizeDesignDocument,
} from '@/features/dashboard/marketing/lib/renderMarketingDesignThumbnail';
import {
  DESIGN_PRESET_FORMATS,
  type DesignTemplateFormat,
} from '@/features/dashboard/marketing/lib/templateRegistry';
import { themedAiDesignTokens } from '@/features/dashboard/marketing/lib/theme/aiThemeAdapter';
import {
  applyCampaignFontsToDocument,
  polotnoHandEditedIds,
  polotnoThemeBaseline,
  rethemePolotnoDocument,
} from '@/features/dashboard/marketing/lib/theme/designThemeAdapter';
import {
  marketingThemeHash,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  readTemplateThemeSnapshot,
  themeStampForSave,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeItems';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOrgSettings } from '@/features/dashboard/org/hooks/useOrgSettings';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { TierBadge, TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { formatMoneyCompact } from '@/utils/format/currency';

/* Blueprint CSS is scoped to .polotno-studio-root via postcss.config.js + vite plugin */
import '@/features/dashboard/marketing/styles/polotno-blueprint.css';
import './polotno-design-studio.css';

export type DesignExportPayload = {
  blob: Blob;
  format: DesignTemplateFormat;
  templateId: string;
};

type Props = {
  document: MarketingEditorDocument;
  nav: MarketingEditorNav;
  onPublish?: (payload: DesignExportPayload) => void;
};

const DESIGN_FORMATS = new Set<string>(Object.keys(DESIGN_FORMAT_DIMENSIONS));
const REVIEW_PRESET = 'review-quote';

function asDesignFormat(value: unknown, fallback: DesignTemplateFormat): DesignTemplateFormat {
  return typeof value === 'string' && DESIGN_FORMATS.has(value)
    ? (value as DesignTemplateFormat)
    : fallback;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function blankDocument(format: DesignTemplateFormat, surface: string) {
  const { width, height } = DESIGN_FORMAT_DIMENSIONS[format];
  return {
    width,
    height,
    schemaVersion: 2,
    fonts: [],
    pages: [{ id: 'blank-page', background: surface, children: [] }],
  };
}

/** Base preset id behind a saved / draft design (`promo-500-off`), if any. */
function presetBaseId(sourceTemplateId: string | null): string | null {
  return sourceTemplateId?.startsWith('preset:') ? sourceTemplateId.slice('preset:'.length) : null;
}

export function PolotnoDesignStudio({ document, nav, onPublish }: Props) {
  const { property, org } = useOrgContext();
  const { data: orgSettings } = useOrgSettings();
  // The studio only mounts editors once a theme is resolved.
  const { active: activeTheme, activeHash } = useMarketingTheme();
  const theme = activeTheme!;
  const themeTokens = theme.tokens;
  const themeHash = useMemo(() => marketingThemeHash(themeTokens), [themeTokens]);
  // The theme's main color stands in where the brand accent used to (swatches, AI default).
  const accentColor = themeTokens.palette.primary;
  const orgLogoUrl =
    orgSettings?.emailLogoUrl?.trim() ||
    org.logoUrl?.trim() ||
    (typeof org.settings?.emailLogoUrl === 'string' ? org.settings.emailLogoUrl.trim() : '') ||
    null;
  const storeRef = useRef<PolotnoStore | null>(null);
  const isBelowLg = useIsBelowLg();
  const propertyId = usePropertyIdParam();
  const generateTemplate = useGenerateMarketingTemplate();
  const duplicate = useDuplicateMarketingItem();

  const record = document.mode === 'saved' ? document.record : null;
  const initialFormat: DesignTemplateFormat =
    document.mode === 'saved'
      ? asDesignFormat(
          document.record.aspectPreset ?? document.record.designJson.format,
          'instagram-post'
        )
      : asDesignFormat(
          document.size,
          asDesignFormat(document.templateRecord?.aspectPreset, 'instagram-post')
        );

  const [storeReady, setStoreReady] = useState(false);
  const [format, setFormat] = useState<DesignTemplateFormat>(initialFormat);
  const [ready, setReady] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [edited, setEdited] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [aiGenerateBusy, setAiGenerateBusy] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<
    (MarketingTemplatePick & { name: string; review?: MarketingGuestReview }) | null
  >(null);
  const [selectedReview, setSelectedReview] = useState<MarketingGuestReview | null>(() =>
    document.mode === 'draft' ? takePendingMarketingReview() : null
  );
  const [searchParams] = useSearchParams();
  const deepLinkReviewId = searchParams.get('reviewId');
  const deepLinkReviews = usePropertyGuestReviews({
    minRating: 4,
    socialSeedOnly: true,
    limit: 50,
  });

  const {
    suspended: autoSaveSuspended,
    begin: beginAutoSaveSuspension,
    end: endAutoSaveSuspension,
  } = useMarketingAutoSaveSuspension();

  const {
    data: publicProperty,
    isLoading: propertyLoading,
    isError: propertyError,
  } = usePublicPropertyDetail(property.slug);

  useEffect(() => {
    if (!deepLinkReviewId || selectedReview) return;
    const match = (deepLinkReviews.data ?? []).find((review) => review.id === deepLinkReviewId);
    if (match) setSelectedReview(match);
  }, [deepLinkReviewId, deepLinkReviews.data, selectedReview]);

  const { data: bookedDates } = useMarketingBookedDates();
  const previewMonth = useMemo(() => new Date(), []);
  const bindingRef = useRef<DesignBinding | null>(null);

  const binding = useMemo<DesignBinding>(() => {
    const rate = publicProperty?.pricing.baseRate ?? 2799;
    const base: DesignBinding = {
      propertyName: property.name,
      propertyPhoto: publicProperty?.images[0] ?? null,
      nightlyRate: `${formatMoneyCompact(rate)} / night`,
      availabilityText: availabilityTextForMonth(bookedDates ?? [], previewMonth),
      monthLabel: previewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      monthShort: previewMonth.toLocaleDateString('en-US', { month: 'long' }),
      openSlots: openSlotDatesForMonth(bookedDates ?? [], previewMonth, 5),
    };
    return bindingWithReview(base, selectedReview);
  }, [property.name, publicProperty, bookedDates, previewMonth, selectedReview]);
  bindingRef.current = binding;

  const propertyPhotoUrls = useMemo(() => {
    if (publicProperty?.media?.length) {
      return publicProperty.media
        .filter((item) => item.type === 'image' && item.url)
        .map((item) => item.url);
    }
    return (
      publicProperty?.images?.filter(Boolean) ??
      (binding.propertyPhoto ? [binding.propertyPhoto] : [])
    );
  }, [publicProperty?.media, publicProperty?.images, binding.propertyPhoto]);

  const propertyImageUrls = useMemo(
    () => publicProperty?.images ?? (binding.propertyPhoto ? [binding.propertyPhoto] : []),
    [publicProperty?.images, binding.propertyPhoto]
  );

  const sourceTemplateId = useMemo(() => {
    if (document.mode === 'saved') return document.record.sourceTemplateId ?? null;
    if (!document.from || document.from.kind === 'blank' || document.from.kind === 'collage') {
      return null;
    }
    return formatTemplateRef(document.from);
  }, [document]);

  const draftName = useMemo(() => {
    if (document.mode === 'saved') return document.record.name;
    if (document.templateRecord) return document.templateRecord.name;
    if (document.from?.kind === 'preset') {
      return (
        getCampaignTemplate(designPresetIdForSize(document.from.id, initialFormat))?.name ??
        'Untitled post'
      );
    }
    if (document.from?.kind === 'collage') return 'Collage';
    return 'Untitled post';
  }, [document, initialFormat]);

  useEffect(() => {
    ensurePolotnoConfigured();
    if (!storeRef.current) {
      storeRef.current = createPolotnoStore();
      setStoreReady(true);
    }
    return () => {
      (storeRef.current as { destroy?: () => void } | null)?.destroy?.();
      storeRef.current = null;
    };
  }, []);

  // Theme bookkeeping: the look each element had right after a themed load, and the
  // elements the host has changed by hand (those keep their colors on theme edits).
  const themeBaselineRef = useRef<Map<string, string>>(new Map());
  const lockedElementIdsRef = useRef<string[]>([]);

  const recordThemeBaseline = useCallback((lockedIds: readonly string[] = []) => {
    const activeStore = storeRef.current;
    if (!activeStore) return;
    themeBaselineRef.current = polotnoThemeBaseline(activeStore.toJSON());
    lockedElementIdsRef.current = [...lockedIds];
  }, []);

  const currentLockedElementIds = useCallback((): string[] => {
    const activeStore = storeRef.current;
    if (!activeStore) return lockedElementIdsRef.current;
    return [
      ...new Set([
        ...lockedElementIdsRef.current,
        ...polotnoHandEditedIds(activeStore.toJSON(), themeBaselineRef.current),
      ]),
    ];
  }, []);

  /** A saved document in the current theme (re-themed from its snapshot when it differs). */
  const themedSavedDocument = useCallback(
    (saved: MarketingTemplateRecord) => {
      const polotno = saved.designJson.polotno as Record<string, unknown>;
      const snapshot = readTemplateThemeSnapshot(saved.designJson);
      const lockedIds = Array.isArray(saved.designJson.lockedElementIds)
        ? saved.designJson.lockedElementIds.filter((id): id is string => typeof id === 'string')
        : [];
      const doc = snapshot.tokens
        ? rethemePolotnoDocument(polotno, snapshot.tokens, themeTokens, lockedIds)
        : polotno;
      return { document: doc, lockedIds };
    },
    [themeTokens]
  );

  /**
   * Loads a document as the new starting point: normalizes it (logo, text bounds),
   * then clears undo so only the host's own changes count as edits.
   */
  const loadDocument = useCallback(
    async (doc: Record<string, unknown>, lockedIds: readonly string[] = []) => {
      const store = storeRef.current;
      if (!store) return;
      beginAutoSaveSuspension();
      setLoadingDoc(true);
      try {
        store.loadJSON(doc);
        await store.waitLoading();
        await polishOrgLogoElements(store);
        await syncPolotnoTextBounds(store);
        store.history.clear();
        recordThemeBaseline(lockedIds);
        setEdited(false);
      } finally {
        setLoadingDoc(false);
        endAutoSaveSuspension();
      }
    },
    [beginAutoSaveSuspension, endAutoSaveSuspension, recordThemeBaseline]
  );

  /** Polotno JSON for a template pick at the current size. */
  const documentForRef = useCallback(
    async (
      ref: MarketingTemplateRef,
      size: DesignTemplateFormat,
      review: MarketingGuestReview | null
    ): Promise<{ document: Record<string, unknown>; lockedIds: string[] } | null> => {
      if (ref.kind === 'template') {
        const templateRecord = await fetchMarketingTemplate(propertyId, ref.id);
        return themedSavedDocument(templateRecord);
      }
      if (ref.kind === 'blank' || ref.kind === 'collage') {
        return { document: blankDocument(size, themeTokens.palette.surface), lockedIds: [] };
      }
      const presetId = designPresetIdForSize(ref.id, size);
      const fallbackId = designPresetIdForSize(ref.id, 'instagram-post');
      const doc =
        buildPolotnoCampaignDocument(presetId, bindingWithReview(bindingRef.current!, review), {
          theme: themeTokens,
        }) ??
        buildPolotnoCampaignDocument(fallbackId, bindingWithReview(bindingRef.current!, review), {
          theme: themeTokens,
        });
      return doc ? { document: doc as Record<string, unknown>, lockedIds: [] } : null;
    },
    [propertyId, themedSavedDocument, themeTokens]
  );

  // ── Initial document ────────────────────────────────────────────────────
  const bindingReady = !propertyLoading || propertyError || Boolean(publicProperty);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || !storeReady) return;
    if (document.mode === 'draft' && !document.templateRecord && !bindingReady) return;
    initializedRef.current = true;

    void (async () => {
      try {
        if (document.mode === 'saved') {
          const { document: doc, lockedIds } = themedSavedDocument(document.record);
          await loadDocument(doc, lockedIds);
        } else if (document.templateRecord) {
          const { document: doc, lockedIds } = themedSavedDocument(document.templateRecord);
          await loadDocument(doc, lockedIds);
        } else {
          const ref: MarketingTemplateRef = document.from ?? { kind: 'blank' };
          const loaded = await documentForRef(ref, initialFormat, selectedReview);
          await loadDocument(
            loaded?.document ?? blankDocument(initialFormat, themeTokens.palette.surface),
            loaded?.lockedIds ?? []
          );
          if (ref.kind === 'collage') storeRef.current?.openSidePanel(KAME_COLLAGE_SECTION);
          // AI Studio "Use in a post": the photo becomes the blank post's background.
          const handoffPhoto = ref.kind === 'blank' ? takePendingMarketingPhoto() : null;
          if (handoffPhoto && storeRef.current) {
            const page = (storeRef.current as unknown as {
              activePage?: { set: (attrs: Record<string, unknown>) => void };
            }).activePage;
            page?.set({ background: handoffPhoto });
            setEdited(true);
          }
        }
      } catch {
        toast.error('Could not open this design');
      } finally {
        setReady(true);
      }
    })();
  }, [
    document,
    storeReady,
    bindingReady,
    themedSavedDocument,
    loadDocument,
    documentForRef,
    initialFormat,
    selectedReview,
    themeTokens.palette.surface,
  ]);

  useEffect(() => {
    if (ready && document.mode === 'draft' && document.openAi) setAiGenerateOpen(true);
    // Once, when the draft is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const store = storeRef.current;
  const history = usePolotnoHistoryState(storeReady ? store : null);

  // Any undoable change after load is the host's edit (loads clear history first).
  useEffect(() => {
    if (ready && history.canUndo) setEdited(true);
  }, [ready, history.canUndo]);

  // Heavy card renders pause while the host drags on the canvas.
  useEffect(() => {
    const node = storeReady ? window.document.querySelector('.polotno-studio-root') : null;
    if (!node) return;
    let held = false;
    const down = () => {
      if (held) return;
      held = true;
      holdMarketingRenders();
    };
    const up = () => {
      if (!held) return;
      held = false;
      releaseMarketingRenders();
    };
    node.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      node.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      up();
    };
  }, [storeReady]);

  // The open theme was edited: re-theme the canvas in place, keeping hand-edited elements.
  const lastThemeRef = useRef<{ hash: string | null; tokens: MarketingThemeTokens } | null>(null);
  useEffect(() => {
    const previous = lastThemeRef.current;
    lastThemeRef.current = { hash: activeHash, tokens: themeTokens };
    if (!previous || previous.hash === activeHash) return;
    const activeStore = storeRef.current;
    if (!activeStore || !ready) return;
    const lockedIds = currentLockedElementIds();
    activeStore.loadJSON(
      rethemePolotnoDocument(activeStore.toJSON(), previous.tokens, themeTokens, lockedIds)
    );
    recordThemeBaseline(lockedIds);
  }, [activeHash, currentLockedElementIds, recordThemeBaseline, ready, themeTokens]);

  // Single upload session shared by Polotno's Upload/Background panels and the
  // Collage Photos panel, so a session upload appears in both and its
  // `blob:` → persisted-URL swap only needs to happen once.
  const uploads = useMarketingUploads(store, {
    onUploadStart: beginAutoSaveSuspension,
    onUploadEnd: endAutoSaveSuspension,
  });

  const designFingerprint = usePolotnoStoreFingerprint(storeReady && ready ? store : null, {
    format,
  });

  const { canEditContent, canPublish, canAddTemplate, canEditTemplate, canGenerate } =
    useMarketingPermissions();
  const { canUse: canSaveDesigns } = useFeatureGate('customTemplates');
  const canSave = canEditContent && canSaveDesigns && (record ? canEditTemplate : canAddTemplate);

  const buildDesignJson = useCallback(() => {
    const activeStore = storeRef.current;
    if (!activeStore) return null;
    const base = presetBaseId(sourceTemplateId);
    return {
      templateId: base ? designPresetIdForSize(base, format) : '',
      format,
      binding: bindingRef.current!,
      polotno: activeStore.toJSON(),
      sourceReviewId: bindingRef.current?.sourceReviewId ?? null,
      ...(record?.designJson.aiGenerated === true
        ? {
            aiGenerated: true,
            aiGenerationId: record.designJson.aiGenerationId,
            aiTokens: record.designJson.aiTokens,
          }
        : {}),
      ...themeStampForSave(themeTokens),
      lockedElementIds: currentLockedElementIds(),
    };
  }, [sourceTemplateId, format, record, themeTokens, currentLockedElementIds]);

  const captureThumbnail = useCallback(async () => {
    const activeStore = storeRef.current;
    if (!activeStore || hasUnpersistedBlobSources(activeStore)) return null;
    return renderDesignStoreSavedThumbnail(activeStore);
  }, []);

  const session = useMarketingDesignSession({
    contentType: 'design',
    themeKey: theme.key,
    itemId: record?.id ?? null,
    record,
    draftName,
    sourceTemplateId,
    ready,
    hasUserEdits: edited,
    suspended: autoSaveSuspended || loadingDoc,
    contentFingerprint: designFingerprint,
    aspectPreset: format,
    platform: format.includes('facebook') ? 'facebook' : 'instagram',
    buildDesignJson,
    captureThumbnail,
    onCreated: nav.onCreated,
    themeHash,
    onReloadFromServer: (fresh) => {
      const freshFormat = asDesignFormat(fresh.aspectPreset, format);
      setFormat(freshFormat);
      const { document: doc, lockedIds } = themedSavedDocument(fresh);
      void loadDocument(doc, lockedIds).then(() => session.markBaseline());
    },
    canSave,
  });

  // A freshly loaded document is the baseline: nothing to save until the host edits.
  useEffect(() => {
    if (ready && designFingerprint) session.markBaseline();
    // Only once the first fingerprint of the loaded document exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, designFingerprint === null]);

  const handleBack = useCallback(async () => {
    await session.flush();
    nav.back();
  }, [nav, session]);

  // ── Templates (Replace / Open as new) ──────────────────────────────────
  const replaceWithTemplate = useCallback(
    async (ref: MarketingTemplateRef, review: MarketingGuestReview | null) => {
      const activeStore = storeRef.current;
      if (!activeStore) return;
      try {
        const loaded = await documentForRef(ref, format, review);
        if (!loaded) return;
        // Not cleared from undo: replacing is an edit the host can take back.
        activeStore.loadJSON(loaded.document);
        await activeStore.waitLoading();
        await polishOrgLogoElements(activeStore);
        await syncPolotnoTextBounds(activeStore);
        recordThemeBaseline(loaded.lockedIds);
        setEdited(true);
      } catch {
        toast.error('Could not load that template');
      }
    },
    [documentForRef, format, recordThemeBaseline]
  );

  const handleTemplatePick = useCallback(
    (pick: MarketingTemplatePick) => {
      // An untouched draft just switches template; real work asks first.
      if (session.isDraft && !edited) {
        nav.startDraft(pick.ref, { size: format, replace: true });
        return;
      }
      const name =
        pick.ref.kind === 'preset'
          ? (getCampaignTemplate(designPresetIdForSize(pick.ref.id, format))?.name ??
            'this template')
          : 'this template';
      setPendingTemplate({ ...pick, name });
    },
    [edited, format, nav, session.isDraft]
  );

  const handleSelectReview = useCallback(
    (review: MarketingGuestReview) => {
      const base = presetBaseId(sourceTemplateId);
      const isReviewLayout = Boolean(
        base && getCampaignTemplate(designPresetIdForSize(base, format))?.category === 'reviews'
      );
      setSelectedReview(review);
      if (isReviewLayout && base && (!edited || session.isDraft)) {
        void replaceWithTemplate({ kind: 'preset', id: base }, review);
        return;
      }
      if (session.isDraft && !edited) {
        setPendingMarketingReview(review);
        nav.startDraft(
          { kind: 'preset', id: base && isReviewLayout ? base : REVIEW_PRESET },
          {
            size: format,
            replace: true,
          }
        );
        return;
      }
      setPendingTemplate({
        ref: { kind: 'preset', id: isReviewLayout && base ? base : REVIEW_PRESET },
        size: format,
        name: 'Quote card',
        review,
      });
    },
    [edited, format, nav, replaceWithTemplate, session.isDraft, sourceTemplateId]
  );

  const handleResetDesign = useCallback(() => {
    const base = presetBaseId(sourceTemplateId);
    if (!base) return;
    void replaceWithTemplate({ kind: 'preset', id: base }, selectedReview);
    toast.success('Reset to template');
  }, [replaceWithTemplate, selectedReview, sourceTemplateId]);

  // ── Sizes ───────────────────────────────────────────────────────────────
  const handleResize = useCallback(
    async (size: string) => {
      const activeStore = storeRef.current;
      if (!activeStore) return;
      const next = asDesignFormat(size, format);
      const { width, height } = DESIGN_FORMAT_DIMENSIONS[next];
      (
        activeStore as unknown as { setSize: (w: number, h: number, magic?: boolean) => void }
      ).setSize(width, height, true);
      if (isStoreInCollageMode(activeStore)) {
        await applyCollageLayout(activeStore, getCollageSettings(activeStore).layoutId);
      }
      await syncPolotnoTextBounds(activeStore);
      setFormat(next);
      setEdited(true);
    },
    [format]
  );

  const handleCopyToSize = useCallback(
    async (size: string) => {
      const id = session.itemId;
      const activeStore = storeRef.current;
      if (!id || !activeStore) return;
      await session.flush();
      const next = asDesignFormat(size, format);
      const { width, height } = DESIGN_FORMAT_DIMENSIONS[next];
      const current = activeStore.toJSON() as Record<string, unknown>;
      const collage = readCollageSettings(current);
      const resized = await resizeDesignDocument(
        current,
        width,
        height,
        collage
          ? async (headless) => {
              await applyCollageLayout(headless, collage.layoutId);
            }
          : undefined
      );
      if (!resized) {
        toast.error('Could not make that size');
        return;
      }
      const designJson = buildDesignJson();
      if (!designJson) return;
      const copy = await duplicate.mutateAsync({
        id,
        sameGroup: true,
        aspectPreset: next,
        platform: next.includes('facebook') ? 'facebook' : 'instagram',
        designJson: {
          ...designJson,
          format: next,
          polotno: resized.document,
          ...(resized.thumbnail ? { thumbnailDataUrl: resized.thumbnail } : {}),
        },
      });
      nav.openItem(copy.id, { replace: true });
    },
    [session, format, buildDesignJson, duplicate, nav]
  );

  // ── AI (design wizard): one design at the current size, opened right away ──
  const handleAiGenerate = useCallback(
    async (input: MarketingAiGenerateInput) => {
      if (!('content' in input.preferences) || !('backgroundMood' in input.preferences)) return;
      setAiGenerateBusy(true);
      let aiSucceeded = false;
      try {
        const amenities = publicProperty?.amenities ?? [];
        const amenitiesText = amenities.slice(0, 8).join(', ') || undefined;
        const result = await generateTemplate.mutateAsync({
          contentType: 'design',
          prompt: input.prompt,
          includeContext: input.includeContext,
          amenitiesText: input.includeContext.amenities ? amenitiesText : undefined,
          availabilityText: input.includeContext.availability
            ? binding.availabilityText
            : undefined,
          content: input.preferences.content,
          preferences: {
            layoutArchetype: input.preferences.layoutArchetype,
            fontPairing: input.preferences.fontPairing,
            backgroundMood: input.preferences.backgroundMood,
            category: input.preferences.category,
          },
        });
        if (result.contentType !== 'design') {
          throw new Error('Unexpected content type from AI generation');
        }
        aiSucceeded = true;

        // AI picks layout, words and category; the theme sets colors, type and background.
        const tokens = themedAiDesignTokens(
          applyDesignAiPreferencesToTokens(result.tokens, input.preferences),
          themeTokens
        );
        const aiFormat = DESIGN_AI_FORMATS.includes(format) ? format : DESIGN_AI_FORMATS[0]!;
        const imageUrls =
          publicProperty?.images?.filter(Boolean) ??
          (binding.propertyPhoto ? [binding.propertyPhoto] : []);
        const doc = applyCampaignFontsToDocument(
          resolveAiGeneratedDesignDocument(binding, tokens, aiFormat, {
            brandColor: accentColor,
            propertyPhotoUrl: input.includeContext.propertyPhoto
              ? pickRandomPropertyPhoto(imageUrls)
              : null,
            orgLogoUrl,
            includeCta: input.includeContext.cta ?? true,
            includePropertyName: input.includeContext.propertyName ?? true,
            includeOrgLogo: input.includeContext.orgLogo ?? true,
          }),
          themeCampaignFontMap(themeTokens)
        );
        const resized = await resizeDesignDocument(
          doc as Record<string, unknown>,
          DESIGN_FORMAT_DIMENSIONS[aiFormat].width,
          DESIGN_FORMAT_DIMENSIONS[aiFormat].height
        );
        const aiGenerationId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `ai-${Date.now()}`;
        const saved = await saveMarketingTemplate(propertyId, {
          name: tokens.label,
          contentType: 'design',
          aspectPreset: aiFormat,
          platform: aiFormat.includes('facebook') ? 'facebook' : 'instagram',
          themeKey: theme.key,
          kind: 'design',
          designJson: {
            templateId: '',
            format: aiFormat,
            binding,
            aiGenerated: true,
            aiGenerationId,
            aiTokens: tokens,
            polotno: resized?.document ?? doc,
            ...themeStampForSave(themeTokens),
            ...(resized?.thumbnail ? { thumbnailDataUrl: resized.thumbnail } : {}),
          },
        });
        setAiGenerateOpen(false);
        toast.success('Post made with AI');
        nav.openItem(saved.id, { replace: session.isDraft && !edited });
      } catch (error) {
        if (aiSucceeded) {
          toast.error((error as Error).message || 'Could not save the post');
        }
      } finally {
        setAiGenerateBusy(false);
      }
    },
    [
      accentColor,
      binding,
      edited,
      format,
      generateTemplate,
      nav,
      orgLogoUrl,
      propertyId,
      publicProperty?.amenities,
      publicProperty?.images,
      session.isDraft,
      theme.key,
      themeTokens,
    ]
  );

  // ── Export ──────────────────────────────────────────────────────────────
  const { canUse: canUseMarketingStudio, isLoading: marketingStudioLoading } =
    useFeatureGate('marketingStudio');
  const { canUse: canPublishToMeta, isLoading: publishEntitlementsLoading } = useFeatureGate(
    'marketingPublishLimitPerGroup'
  );
  const { open: openUpgradeModal } = useUpgradeModal();

  const handleDownload = useCallback(async () => {
    if (!canEditContent) return;
    if (!canUseMarketingStudio) {
      if (!marketingStudioLoading) openUpgradeModal('marketingStudio');
      return;
    }
    const activeStore = storeRef.current;
    if (!activeStore) return;
    if (hasUnpersistedBlobSources(activeStore)) {
      toast.error('An upload is still saving. Try again in a moment');
      return;
    }
    setExporting(true);
    try {
      const blob = await exportPolotnoStoreImage(activeStore);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `post-${property.slug}-${slug(session.name) || 'design'}.jpg`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Post downloaded');
    } catch {
      toast.error('Failed to export the post');
    } finally {
      setExporting(false);
    }
  }, [
    canEditContent,
    property.slug,
    session.name,
    canUseMarketingStudio,
    marketingStudioLoading,
    openUpgradeModal,
  ]);

  const handlePublish = useCallback(async () => {
    if (!canPublish) return;
    if (!canPublishToMeta) {
      if (!publishEntitlementsLoading) openUpgradeModal('marketingPublishLimitPerGroup');
      return;
    }
    const activeStore = storeRef.current;
    if (!onPublish || !activeStore) return;
    if (hasUnpersistedBlobSources(activeStore)) {
      toast.error('An upload is still saving. Try again in a moment');
      return;
    }
    setExporting(true);
    try {
      const blob = await exportPolotnoStoreImage(activeStore);
      if (!blob) return;
      onPublish({ blob, format, templateId: presetBaseId(sourceTemplateId) ?? 'custom' });
    } catch {
      toast.error('Failed to prepare the post');
    } finally {
      setExporting(false);
    }
  }, [
    format,
    onPublish,
    sourceTemplateId,
    canPublish,
    canPublishToMeta,
    publishEntitlementsLoading,
    openUpgradeModal,
  ]);

  // ── Rail content ────────────────────────────────────────────────────────
  const [openedSection, setOpenedSection] = useState('');
  useEffect(() => {
    if (!store) return;
    const sync = () =>
      setOpenedSection((store as { openedSidePanel?: string }).openedSidePanel ?? '');
    sync();
    return onSnapshot(store as unknown as IAnyStateTreeNode, sync);
  }, [store]);

  const sectionContent = useMemo(
    () => ({
      templates: (
        <MarketingTemplateBrowser
          contentType="design"
          theme={themeTokens}
          themeHash={themeHash}
          themeKey={theme.key}
          size={format}
          onSizeChange={() => undefined}
          onPick={handleTemplatePick}
          variant="panel"
          lockSize
          showStarts={false}
          offerContinue={false}
          activeSourceId={sourceTemplateId}
        />
      ),
      collage: store ? (
        <CollagePanel
          store={store}
          format={format}
          propertyImages={propertyImageUrls.map((url) => ({
            url,
            preview: url,
            type: 'image' as const,
          }))}
          uploads={uploads}
          onCollageStarted={() => setEdited(true)}
        />
      ) : null,
      reviews: (
        <MarketingReviewSidebarSection
          selectedReviewId={selectedReview?.id ?? null}
          onSelect={handleSelectReview}
          socialSeedOnly
        />
      ),
      ai: canGenerate ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Describe the post and get a finished design in this size.
          </p>
          <TierBadgeAnchor feature="aiMarketingGeneration" className="w-full">
            <Button
              type="button"
              className="min-h-[44px] w-full gap-2"
              disabled={aiGenerateBusy || generateTemplate.isPending}
              onClick={() => setAiGenerateOpen(true)}
            >
              <Sparkles className="size-4" aria-hidden />
              {aiGenerateBusy ? 'Making…' : 'Describe a post'}
            </Button>
          </TierBadgeAnchor>
        </div>
      ) : null,
    }),
    [
      themeTokens,
      themeHash,
      theme.key,
      format,
      handleTemplatePick,
      sourceTemplateId,
      store,
      propertyImageUrls,
      uploads,
      selectedReview?.id,
      handleSelectReview,
      canGenerate,
      aiGenerateBusy,
      generateTemplate.isPending,
    ]
  );

  const hasDoc = storeReady && ready;
  const sizeSiblings = record?.groupMembers ?? [];
  const sizeOptions = useMemo(
    () =>
      DESIGN_PRESET_FORMATS.includes(format)
        ? startSizesFor('design')
        : [...startSizesFor('design'), sizeOption('design', format)!].filter(Boolean),
    [format]
  );

  const sizeDialog = (
    <MarketingSizeDialog
      contentType="design"
      size={format}
      siblings={sizeSiblings}
      onOpenSibling={(id) => {
        void session.flush().then(() => nav.openItem(id, { replace: true }));
      }}
      onCopyToSize={
        session.itemId && canAddTemplate && canSaveDesigns ? handleCopyToSize : undefined
      }
      onResize={canEditContent ? handleResize : undefined}
      sizes={sizeOptions}
      disabled={!hasDoc}
      open={isBelowLg ? sizeOpen : undefined}
      onOpenChange={isBelowLg ? setSizeOpen : undefined}
      hideTrigger={isBelowLg}
    />
  );

  const topBarActions = (
    <>
      {canEditContent ? (
        <TierBadgeAnchor feature="marketingStudio">
          <Button
            variant="outline"
            className="min-h-[44px] gap-2"
            disabled={!hasDoc || exporting || loadingDoc}
            onClick={() => void handleDownload()}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            <span className="max-xl:sr-only">Download</span>
          </Button>
        </TierBadgeAnchor>
      ) : null}
      {onPublish && canPublish ? (
        <TierBadgeAnchor feature="marketingPublishLimitPerGroup">
          <Button
            className="min-h-[44px] gap-2"
            disabled={!hasDoc || exporting || loadingDoc}
            onClick={() => void handlePublish()}
          >
            <Send className="size-4" aria-hidden />
            {MARKETING_PUBLISH_META_LABEL}
          </Button>
        </TierBadgeAnchor>
      ) : null}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MarketingEditorTopBar
        backLabel={nav.backLabel}
        onBack={handleBack}
        name={session.name}
        onRename={session.rename}
        status={session.status}
        errorMessage={session.errorMessage}
        canSave={canSave}
        onReload={() => void session.reloadFromServer()}
        onKeepMine={() => void session.keepMine()}
        history={
          <MarketingEditorHistoryControls
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={history.undo}
            onRedo={history.redo}
            onReset={presetBaseId(sourceTemplateId) ? handleResetDesign : undefined}
            resetDisabled={loadingDoc}
            resetTitle="Reset to template?"
            resetDescription="Your changes to this post are replaced by the template. You can undo this."
          />
        }
        size={sizeDialog}
        actions={topBarActions}
      />
      {isBelowLg ? sizeDialog : null}

      <div
        className={cn(
          'polotno-studio-root relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          marketingEditorWorkspaceClassName
        )}
        data-mobile={isBelowLg ? 'true' : undefined}
      >
        <div className="relative min-h-0 flex-1">
          {storeReady && store ? (
            <KameStudioSectionsProvider value={sectionContent}>
              <KamePolotnoEditor
                store={store}
                propertyImageUrls={propertyImageUrls}
                brandColor={accentColor}
                theme={themeTokens}
                logoUrl={orgLogoUrl}
                style={{ width: '100%', height: '100%' }}
                hideHistory
                sessionMedia={uploads}
                studioSections={{ ai: canGenerate }}
              />
            </KameStudioSectionsProvider>
          ) : null}
          {!hasDoc ? (
            <div
              className="bg-background/70 absolute inset-0 z-10 flex flex-col gap-3 p-3 sm:p-4"
              aria-busy="true"
              aria-label="Opening design"
            >
              <Skeleton className="min-h-0 w-full flex-1 rounded-xl" />
            </div>
          ) : null}
        </div>
      </div>

      {/* Mobile dock (max-lg): Polotno keeps its own icon rail (Templates, Text, Elements…);
          the dock adds quick Templates / AI and the ⋯ sheet. */}
      <MarketingEditorMobileToolbar
        panels={[
          { key: KAME_TEMPLATES_SECTION, label: 'Templates', icon: LayoutTemplate },
          ...(canGenerate ? [{ key: 'ai', label: 'AI', icon: Sparkles }] : []),
        ]}
        activePanel={openedSection === KAME_TEMPLATES_SECTION ? KAME_TEMPLATES_SECTION : null}
        onSelectPanel={(key) => {
          if (key === 'ai') {
            setAiGenerateOpen(true);
            return;
          }
          store?.openSidePanel(key ?? '');
        }}
        overflowItems={[
          {
            key: 'undo',
            label: 'Undo',
            icon: <Undo2 className="size-5" aria-hidden />,
            disabled: !history.canUndo,
            onSelect: history.undo,
          },
          {
            key: 'redo',
            label: 'Redo',
            icon: <Redo2 className="size-5" aria-hidden />,
            disabled: !history.canRedo,
            onSelect: history.redo,
          },
          {
            key: 'size',
            label: 'Size',
            icon: <Scaling className="size-5" aria-hidden />,
            disabled: !hasDoc,
            onSelect: () => setSizeOpen(true),
          },
          ...(presetBaseId(sourceTemplateId)
            ? [
                {
                  key: 'reset',
                  label: 'Reset to template',
                  icon: <RotateCcw className="size-5" aria-hidden />,
                  disabled: loadingDoc,
                  onSelect: handleResetDesign,
                },
              ]
            : []),
          ...(canEditContent
            ? [
                {
                  key: 'download',
                  label: exporting ? 'Exporting…' : 'Download',
                  icon: <Download className="size-5" aria-hidden />,
                  trailing: <TierBadge feature="marketingStudio" />,
                  disabled: !hasDoc || exporting || loadingDoc,
                  onSelect: () => void handleDownload(),
                },
              ]
            : []),
          ...(onPublish && canPublish
            ? [
                {
                  key: 'publish',
                  label: MARKETING_PUBLISH_META_LABEL,
                  icon: <Send className="size-5" aria-hidden />,
                  trailing: <TierBadge feature="marketingPublishLimitPerGroup" />,
                  disabled: !hasDoc || exporting || loadingDoc,
                  onSelect: () => void handlePublish(),
                },
              ]
            : []),
        ]}
      />

      <MarketingReplaceTemplateDialog
        open={Boolean(pendingTemplate)}
        onOpenChange={(open) => !open && setPendingTemplate(null)}
        templateName={pendingTemplate?.name ?? ''}
        onReplace={() => {
          if (pendingTemplate) {
            void replaceWithTemplate(pendingTemplate.ref, pendingTemplate.review ?? selectedReview);
          }
        }}
        onOpenAsNew={() => {
          if (!pendingTemplate) return;
          if (pendingTemplate.review) setPendingMarketingReview(pendingTemplate.review);
          const { ref } = pendingTemplate;
          void session.flush().then(() => nav.startDraft(ref, { size: format }));
        }}
      />

      <MarketingAiGeneratePanel
        open={aiGenerateOpen}
        onOpenChange={(open) => {
          if (aiGenerateBusy && !open) return;
          setAiGenerateOpen(open);
        }}
        contentType="design"
        theme={{ name: theme.name, tokens: themeTokens }}
        generating={aiGenerateBusy || generateTemplate.isPending}
        propertyPhotoUrls={propertyPhotoUrls}
        brandColor={accentColor}
        contextOptions={[
          {
            key: 'propertyPhoto',
            label: 'Property photo',
            available: Boolean(binding.propertyPhoto),
          },
          {
            key: 'orgLogo',
            label: 'Org logo',
            available: Boolean(orgLogoUrl),
          },
          {
            key: 'propertyName',
            label: 'Property name',
            available: Boolean(property.name),
          },
          {
            key: 'cta',
            label: 'Call-to-action',
            available: true,
          },
        ]}
        onGenerate={handleAiGenerate}
      />
    </div>
  );
}
