import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import {
  Download,
  LayoutTemplate,
  Loader2,
  Redo2,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { CollagePanel } from '@/features/dashboard/marketing/components/design-editor/collage/CollagePanel';
import { KamePolotnoEditor } from '@/features/dashboard/marketing/components/design-editor/polotno/KamePolotnoEditor';
import { useMarketingUploads } from '@/features/dashboard/marketing/components/design-editor/polotno/useMarketingUploads';
import {
  MarketingAiGeneratePanel,
  type MarketingAiGenerateInput,
} from '@/features/dashboard/marketing/components/shared/MarketingAiGeneratePanel';
import { MarketingAutoSaveStatus } from '@/features/dashboard/marketing/components/shared/MarketingAutoSaveStatus';
import { MarketingEditorMobileToolbar } from '@/features/dashboard/marketing/components/shared/MarketingEditorMobileToolbar';
import { MarketingEditorSidebar } from '@/features/dashboard/marketing/components/shared/MarketingEditorSidebar';
import type { MarketingFormatOption } from '@/features/dashboard/marketing/components/shared/MarketingFormatPicker';
import { useMarketingStudioHeaderActions } from '@/features/dashboard/marketing/components/shared/MarketingStudioHeaderActions';
import {
  MarketingTemplatesPanel,
  type PresetTemplateItem,
} from '@/features/dashboard/marketing/components/shared/MarketingTemplatesPanel';
import { useDesignTemplateCleanup } from '@/features/dashboard/marketing/hooks/useDesignTemplateCleanup';
import { useGenerateMarketingTemplate } from '@/features/dashboard/marketing/hooks/useGenerateMarketingTemplate';
import { useMarketingAutoSave } from '@/features/dashboard/marketing/hooks/useMarketingAutoSave';
import { useMarketingAutoSaveSuspension } from '@/features/dashboard/marketing/hooks/useMarketingAutoSaveSuspension';
import { useMarketingBookedDates } from '@/features/dashboard/marketing/hooks/useMarketingBookedDates';
import { useMarketingCatalog } from '@/features/dashboard/marketing/hooks/useMarketingCatalog';
import { useMarketingMediaAccent } from '@/features/dashboard/marketing/hooks/useMarketingMediaAccent';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import {
  saveMarketingTemplate,
  useMarketingTemplates,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { usePolotnoStoreFingerprint } from '@/features/dashboard/marketing/hooks/usePolotnoStoreFingerprint';
import { readCollageSettings } from '@/features/dashboard/marketing/lib/collage/collageDocument';
import {
  applyCollageLayout,
  getCollageSettings,
  isStoreInCollageMode,
} from '@/features/dashboard/marketing/lib/collage/collageStoreOps';
import type { CollageStartFrom } from '@/features/dashboard/marketing/lib/collage/collageTypes';
import { applyDesignAiPreferencesToTokens } from '@/features/dashboard/marketing/lib/designAiGenerateOptions';
import {
  DESIGN_CUSTOM_SOURCE_PRESET_ID,
  findDesignAutosaveTemplate,
} from '@/features/dashboard/marketing/lib/designAutosave';
import {
  campaignTemplatesForFormat,
  DESIGN_FORMAT_DIMENSIONS,
} from '@/features/dashboard/marketing/lib/designCampaignTemplates';
import {
  type CampaignCategory,
  type DesignBinding,
} from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  availabilityTextForMonth,
  openSlotDatesForMonth,
} from '@/features/dashboard/marketing/lib/marketingBookedDates';
import { marketingEditorWorkspaceClassName } from '@/features/dashboard/marketing/lib/marketingEditorWorkspace';
import type { MarketingGuestReview } from '@/features/dashboard/marketing/lib/marketingGuestReview';
import { bindingWithReview } from '@/features/dashboard/marketing/lib/marketingReviewDesignSeed';
import {
  marketingDesignSidebarRecords,
  marketingSavedTemplateCategoryId,
} from '@/features/dashboard/marketing/lib/marketingSavedTemplates';
import { MARKETING_PUBLISH_META_LABEL } from '@/features/dashboard/marketing/lib/marketingStudioCopy';
import {
  publishMarketingPresetThumbnail,
  savedDesignThumbnailKey,
} from '@/features/dashboard/marketing/lib/marketingTemplateThumbnailCache';
import { ensurePolotnoConfigured } from '@/features/dashboard/marketing/lib/polotno/initPolotno';
import { polishOrgLogoElements } from '@/features/dashboard/marketing/lib/polotno/orgLogoCircle';
import {
  DESIGN_AI_FORMATS,
  resolveAiGeneratedDesignDocument,
} from '@/features/dashboard/marketing/lib/polotno/polotnoAiCampaignDocuments';
import { buildPolotnoCampaignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import {
  createPolotnoStore,
  exportPolotnoStoreImage,
  hasUnpersistedBlobSources,
  type PolotnoStore,
} from '@/features/dashboard/marketing/lib/polotno/polotnoStore';
import { pickRandomPropertyPhoto } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import { syncPolotnoTextBounds } from '@/features/dashboard/marketing/lib/polotno/syncPolotnoTextBounds';
import {
  renderDesignStoreThumbnail,
  waitForThumbnailPaint,
} from '@/features/dashboard/marketing/lib/renderMarketingDesignThumbnail';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';
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
  onPublish?: (payload: DesignExportPayload) => void;
};

const CATEGORIES: CampaignCategory[] = ['promo', 'slots', 'giveaway', 'fully-booked', 'reviews'];

export function PolotnoDesignStudio({ onPublish }: Props) {
  const { property, org } = useOrgContext();
  const catalog = useMarketingCatalog('design');
  const { data: appSettings } = useAppSettings();
  const { data: orgSettings } = useOrgSettings();
  const orgBrandColor = useOrgBrandColor();
  const brandColor = appSettings?.resolvedBrandColor ?? orgBrandColor;
  const orgLogoUrl =
    orgSettings?.emailLogoUrl?.trim() ||
    org.logoUrl?.trim() ||
    (typeof org.settings?.emailLogoUrl === 'string' ? org.settings.emailLogoUrl.trim() : '') ||
    null;
  const storeRef = useRef<PolotnoStore | null>(null);
  const isBelowLg = useIsBelowLg();
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  // Choosing a template on mobile drops the user back to the canvas.
  const closeMobilePanel = useCallback(() => setMobilePanelOpen(false), []);
  const [storeReady, setStoreReady] = useState(false);
  const [format, setFormat] = useState<DesignTemplateFormat>('instagram-post');
  const [category, setCategory] = useState<string>('promo');
  const [selectedId, setSelectedId] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [aiGenerateBusy, setAiGenerateBusy] = useState(false);
  const [selectedReview, setSelectedReview] = useState<MarketingGuestReview | null>(null);
  const [startFrom, setStartFrom] = useState<CollageStartFrom>('templates');

  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const generateTemplate = useGenerateMarketingTemplate();
  const { data: savedTemplates = [] } = useMarketingTemplates('design');
  useDesignTemplateCleanup(true);
  const customSavedTemplates = useMemo(
    () => marketingDesignSidebarRecords(savedTemplates),
    [savedTemplates]
  );
  const savedTemplatesRef = useRef(savedTemplates);
  savedTemplatesRef.current = savedTemplates;

  const {
    suspended: autoSaveSuspended,
    begin: beginAutoSaveSuspension,
    end: endAutoSaveSuspension,
  } = useMarketingAutoSaveSuspension();

  const { data: publicProperty } = usePublicPropertyDetail(property.slug);
  const { data: bookedDates } = useMarketingBookedDates();
  const previewMonth = useMemo(() => new Date(), []);
  const bindingRef = useRef<DesignBinding | null>(null);
  const skipPresetApplyRef = useRef(false);
  const appliedDocumentKeyRef = useRef<string | null>(null);

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
  const { accentColor } = useMarketingMediaAccent(propertyPhotoUrls, brandColor);

  const showPresetTemplates = catalog.isBuiltinCategory(category);
  const templates = useMemo(
    () =>
      showPresetTemplates ? campaignTemplatesForFormat(format, category as CampaignCategory) : [],
    [format, category, showPresetTemplates]
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? templates[0],
    [templates, selectedId]
  );

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

  useEffect(() => {
    // Never steal the canvas from an in-progress collage or blank canvas.
    if (startFrom !== 'templates') return;
    const first = templates[0];
    if (first && !templates.some((t) => t.id === selectedId)) {
      setSelectedId(first.id);
    }
  }, [templates, selectedId, startFrom]);

  const applyTemplate = useCallback(
    async (templateId: string) => {
      const store = storeRef.current;
      if (!store || !templateId) return;

      beginAutoSaveSuspension();
      setLoadingTemplate(true);
      try {
        const autosave = findDesignAutosaveTemplate(savedTemplatesRef.current, templateId, format);
        if (autosave?.designJson?.polotno && typeof autosave.designJson.polotno === 'object') {
          setSavedTemplateId(autosave.id);
          store.loadJSON(autosave.designJson.polotno as Record<string, unknown>);
          store.history.clear();
          await store.waitLoading();
          await polishOrgLogoElements(store);
          await syncPolotnoTextBounds(store);
          return;
        }

        const doc = buildPolotnoCampaignDocument(templateId, bindingRef.current!, {
          brandColor: accentColor,
        });
        if (!doc) return;

        setSavedTemplateId(null);
        store.loadJSON(doc);
        store.history.clear();
        await store.waitLoading();
        await polishOrgLogoElements(store);
        await syncPolotnoTextBounds(store);
      } catch {
        toast.error('Could not load template');
      } finally {
        setLoadingTemplate(false);
        endAutoSaveSuspension();
      }
    },
    [beginAutoSaveSuspension, accentColor, endAutoSaveSuspension, format]
  );

  const applyTemplateRef = useRef(applyTemplate);
  applyTemplateRef.current = applyTemplate;

  // Re-seed Reviews presets when the host picks a different guest review.
  useEffect(() => {
    if (!selectedReview || category !== 'reviews' || !selectedId || savedTemplateId) return;
    void applyTemplateRef.current(selectedId);
  }, [selectedReview?.id, category, selectedId, savedTemplateId]);

  const lastAppliedAccentRef = useRef<string | null>(null);
  useEffect(() => {
    const normalized = accentColor.toLowerCase();
    if (lastAppliedAccentRef.current === null) {
      lastAppliedAccentRef.current = normalized;
      return;
    }
    if (lastAppliedAccentRef.current === normalized) return;
    lastAppliedAccentRef.current = normalized;
    // Live-retint builtin presets only — leave saved/AI custom canvases alone.
    if (!selectedId || savedTemplateId) return;
    void applyTemplateRef.current(selectedId);
  }, [accentColor, selectedId, savedTemplateId]);

  const applySavedTemplate = useCallback(
    async (record: MarketingTemplateRecord) => {
      const store = storeRef.current;
      if (!store) return;

      const polotno = record.designJson.polotno;
      if (!polotno || typeof polotno !== 'object') {
        toast.error('Could not load template');
        return;
      }

      const savedFormat =
        record.aspectPreset ??
        (typeof record.designJson.format === 'string'
          ? (record.designJson.format as DesignTemplateFormat)
          : null);
      const savedCategory = marketingSavedTemplateCategoryId(record);

      skipPresetApplyRef.current = true;
      appliedDocumentKeyRef.current = `saved:${record.id}`;
      beginAutoSaveSuspension();
      setLoadingTemplate(true);

      try {
        if (savedFormat && savedFormat !== format) {
          setFormat(savedFormat as DesignTemplateFormat);
        }
        if (savedCategory && savedCategory !== category) {
          setCategory(savedCategory);
        }

        setSavedTemplateId(record.id);
        const baseTemplateId =
          typeof record.designJson.templateId === 'string' ? record.designJson.templateId : '';
        setSelectedId(baseTemplateId);
        setStartFrom(readCollageSettings(polotno) != null ? 'collage' : 'templates');

        store.loadJSON(polotno);
        store.history.clear();
        await store.waitLoading();
        await polishOrgLogoElements(store);
        await syncPolotnoTextBounds(store);
        await waitForThumbnailPaint();
        const thumbnailDataUrl = await renderDesignStoreThumbnail(store);
        if (thumbnailDataUrl) {
          publishMarketingPresetThumbnail(
            record.id,
            savedDesignThumbnailKey(record.id, record.updatedAt),
            thumbnailDataUrl
          );
        }
      } catch {
        toast.error('Could not load template');
      } finally {
        setLoadingTemplate(false);
        endAutoSaveSuspension();
      }
    },
    [beginAutoSaveSuspension, category, endAutoSaveSuspension, format]
  );

  useEffect(() => {
    if (startFrom !== 'templates') return;
    if (skipPresetApplyRef.current) {
      skipPresetApplyRef.current = false;
      return;
    }
    if (savedTemplateId) return;
    if (!storeReady || !selectedId) return;
    if (!templates.some((template) => template.id === selectedId)) return;

    const applyKey = `${selectedId}:${format}`;
    if (appliedDocumentKeyRef.current === applyKey) return;

    appliedDocumentKeyRef.current = applyKey;
    void applyTemplateRef.current(selectedId);
  }, [selectedId, storeReady, format, templates, savedTemplateId, startFrom]);

  const store = storeRef.current;

  // Single upload session shared by Polotno's Upload/Background panels and the
  // Collage Photos panel, so a session upload appears in both and its
  // `blob:` → persisted-URL swap only needs to happen once.
  const uploads = useMarketingUploads(store, {
    onUploadStart: beginAutoSaveSuspension,
    onUploadEnd: endAutoSaveSuspension,
  });

  const designFingerprint = usePolotnoStoreFingerprint(store, {
    templateId: selectedId,
    format,
  });

  const designTemplateName = useMemo(() => {
    if (savedTemplateId) {
      return savedTemplates.find((record) => record.id === savedTemplateId)?.name ?? 'Design';
    }
    return selectedTemplate?.name ?? 'Design';
  }, [savedTemplateId, savedTemplates, selectedTemplate?.name]);

  const {
    status: autoSaveStatus,
    errorMessage: autoSaveError,
    markBaseline,
  } = useMarketingAutoSave({
    contentFingerprint: storeReady ? designFingerprint : null,
    templateId: savedTemplateId,
    suspended: loadingTemplate || autoSaveSuspended,
    resolveTemplateId: () => {
      if (savedTemplateId) return savedTemplateId;
      if (!selectedId) return null;
      return findDesignAutosaveTemplate(savedTemplates, selectedId, format)?.id ?? null;
    },
    onTemplateIdChange: setSavedTemplateId,
    buildSavePayload: () => {
      if (!store) return null;
      const editingCustom = Boolean(
        savedTemplateId && customSavedTemplates.some((record) => record.id === savedTemplateId)
      );
      return {
        name: designTemplateName,
        contentType: 'design',
        aspectPreset: format,
        platform: format.includes('facebook') ? 'facebook' : 'instagram',
        designJson: {
          templateId: selectedId,
          sourcePresetId: editingCustom ? DESIGN_CUSTOM_SOURCE_PRESET_ID : selectedId,
          format,
          categoryId: category,
          category,
          binding,
          polotno: store.toJSON(),
        },
      };
    },
  });

  const handleSavedTemplateCreated = useCallback(
    (record: MarketingTemplateRecord) => {
      skipPresetApplyRef.current = true;
      appliedDocumentKeyRef.current = `saved:${record.id}`;
      setSavedTemplateId(record.id);
      markBaseline();
    },
    [markBaseline]
  );

  const handleAiGenerate = useCallback(
    async (input: MarketingAiGenerateInput) => {
      if (!('content' in input.preferences) || !('backgroundMood' in input.preferences)) return;
      const store = storeRef.current;
      if (!store) return;

      setAiGenerateBusy(true);
      beginAutoSaveSuspension();
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

        const tokens = applyDesignAiPreferencesToTokens(result.tokens, input.preferences);
        // "Custom" is a content flavor, not a real sidebar folder — find or create one so the
        // generated design lands somewhere the host can find it again.
        const sidebarCategoryId =
          tokens.category === 'custom'
            ? (catalog.findOrCreateCategoryByLabel('Custom') ?? 'custom')
            : tokens.category;
        const imageUrls =
          publicProperty?.images?.filter(Boolean) ??
          (binding.propertyPhoto ? [binding.propertyPhoto] : []);
        const variants = DESIGN_AI_FORMATS.map((format) => {
          const photoUrl = input.includeContext.propertyPhoto
            ? pickRandomPropertyPhoto(imageUrls)
            : null;
          return {
            format,
            document: resolveAiGeneratedDesignDocument(binding, tokens, format, {
              brandColor: accentColor,
              propertyPhotoUrl: photoUrl,
              orgLogoUrl,
              includeCta: input.includeContext.cta ?? true,
              includePropertyName: input.includeContext.propertyName ?? true,
              includeOrgLogo: input.includeContext.orgLogo ?? true,
            }),
          };
        });

        const aiGenerationId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `ai-${Date.now()}`;

        // Capture each format against the mounted Workspace. Headless toBlob
        // resolves Konva stages by pageId and would snapshot the live canvas.
        const savedRecords: Awaited<ReturnType<typeof saveMarketingTemplate>>[] = [];
        let failedCount = 0;
        for (const variant of variants) {
          try {
            store.loadJSON(variant.document);
            store.history.clear();
            await store.waitLoading();
            await polishOrgLogoElements(store);
            await syncPolotnoTextBounds(store);
            await waitForThumbnailPaint();
            const thumbnailDataUrl = await renderDesignStoreThumbnail(store);
            const polishedDocument = store.toJSON() as Record<string, unknown>;
            const record = await saveMarketingTemplate(propertyId, {
              name: tokens.label,
              contentType: 'design',
              aspectPreset: variant.format,
              platform: variant.format.includes('facebook') ? 'facebook' : 'instagram',
              designJson: {
                templateId: '',
                sourcePresetId: DESIGN_CUSTOM_SOURCE_PRESET_ID,
                format: variant.format,
                categoryId: sidebarCategoryId,
                category: sidebarCategoryId,
                binding,
                aiGenerated: true,
                aiGenerationId,
                aiTokens: tokens,
                polotno: polishedDocument,
                ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
              },
            });
            savedRecords.push(record);
            if (thumbnailDataUrl) {
              publishMarketingPresetThumbnail(
                record.id,
                savedDesignThumbnailKey(record.id, record.updatedAt),
                thumbnailDataUrl
              );
            }
          } catch {
            failedCount += 1;
          }
        }

        void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });

        if (savedRecords.length === 0) {
          throw new Error('Could not save generated designs');
        }

        const current =
          savedRecords.find((record) => record.aspectPreset === format) ?? savedRecords[0];
        const currentDoc = variants.find(
          (variant) => variant.format === current?.aspectPreset
        )?.document;

        if (current && currentDoc) {
          setSavedTemplateId(current.id);
          setSelectedId('');
          setCategory(sidebarCategoryId);
          skipPresetApplyRef.current = true;
          appliedDocumentKeyRef.current = `saved:${current.id}`;
          store.loadJSON(currentDoc);
          store.history.clear();
          await syncPolotnoTextBounds(store);
          markBaseline();
        }

        setAiGenerateOpen(false);
        if (failedCount > 0) {
          toast.warning(`Saved ${savedRecords.length} of 3 formats. Retry Generate for the rest`);
        } else {
          toast.success('Custom designs added for Instagram Post, Story, and Facebook Post');
        }
      } catch (error) {
        if (aiSucceeded) {
          toast.error((error as Error).message || 'Could not save generated designs');
        }
      } finally {
        endAutoSaveSuspension();
        setAiGenerateBusy(false);
      }
    },
    [
      beginAutoSaveSuspension,
      binding,
      accentColor,
      catalog,
      endAutoSaveSuspension,
      format,
      generateTemplate,
      markBaseline,
      orgLogoUrl,
      propertyId,
      publicProperty?.amenities,
      publicProperty?.images,
      queryClient,
    ]
  );

  const handleResetDesign = useCallback(() => {
    if (!selectedId) return;
    appliedDocumentKeyRef.current = null;
    void applyTemplate(selectedId).then(() => {
      appliedDocumentKeyRef.current = `${selectedId}:${format}`;
      markBaseline();
    });
    toast.success('Reset to default');
  }, [applyTemplate, selectedId, format, markBaseline]);

  const handleStartBlank = useCallback(() => {
    const activeStore = storeRef.current;
    if (!activeStore) return;
    const { width, height } = DESIGN_FORMAT_DIMENSIONS[format];
    skipPresetApplyRef.current = true;
    appliedDocumentKeyRef.current = 'blank';
    setSavedTemplateId(null);
    setSelectedId('');
    activeStore.loadJSON({
      width,
      height,
      schemaVersion: 2,
      fonts: [],
      pages: [{ id: 'blank-page', background: '#ffffff', children: [] }],
    });
    activeStore.history.clear();
  }, [format]);

  // Called once by CollagePanel when it turns the current (non-collage) canvas
  // into a fresh collage document — clears the preset/saved-template identity
  // so autosave starts a new "custom" row instead of overwriting the old one.
  const handleCollageStarted = useCallback(() => {
    skipPresetApplyRef.current = true;
    appliedDocumentKeyRef.current = 'collage';
    setSavedTemplateId(null);
    setSelectedId('');
  }, []);

  const handleStartFromChange = useCallback(
    (next: CollageStartFrom) => {
      if (next === startFrom) return;
      if (next === 'blank') {
        handleStartBlank();
      } else if (next === 'templates') {
        // Returning from Collage/Blank: re-apply whatever the sidebar still
        // shows as selected so the canvas matches it again.
        if (savedTemplateId) {
          const record = savedTemplatesRef.current.find((item) => item.id === savedTemplateId);
          if (record) void applySavedTemplate(record);
        } else if (selectedId) {
          appliedDocumentKeyRef.current = null;
          void applyTemplate(selectedId);
        } else {
          handleStartBlank();
        }
      }
      setStartFrom(next);
    },
    [startFrom, savedTemplateId, selectedId, applySavedTemplate, applyTemplate, handleStartBlank]
  );

  const handleCollageFormatResize = useCallback(
    (nextFormat: DesignTemplateFormat, layoutId: string) => {
      const activeStore = storeRef.current;
      if (!activeStore) return;
      const { width, height } = DESIGN_FORMAT_DIMENSIONS[nextFormat];
      (activeStore as unknown as { setSize: (w: number, h: number) => void }).setSize(
        width,
        height
      );
      void applyCollageLayout(activeStore, layoutId);
    },
    []
  );

  // Capture polotno JSON only when Save runs — avoid store.toJSON() every render.
  const designJsonForSave = useCallback(() => {
    const activeStore = storeRef.current;
    if (!activeStore) return null;
    return {
      templateId: selectedId,
      format,
      binding: bindingRef.current!,
      polotno: activeStore.toJSON(),
      sourceReviewId: bindingRef.current?.sourceReviewId ?? null,
    };
  }, [selectedId, format]);

  const { canEditContent, canPublish } = useMarketingPermissions();
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
    const template = selectedTemplate;
    if (!activeStore || !template) return;
    if (hasUnpersistedBlobSources(activeStore)) {
      toast.error('An upload is still saving. Try again in a moment');
      return;
    }
    setExporting(true);
    try {
      const blob = await exportPolotnoStoreImage(activeStore);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `design-${property.slug}-${template.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Design downloaded');
    } catch {
      toast.error('Failed to export design');
    } finally {
      setExporting(false);
    }
  }, [
    canEditContent,
    property.slug,
    selectedTemplate,
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
    const template = selectedTemplate;
    if (!onPublish || !activeStore || !template) return;
    if (hasUnpersistedBlobSources(activeStore)) {
      toast.error('An upload is still saving. Try again in a moment');
      return;
    }
    setExporting(true);
    try {
      const blob = await exportPolotnoStoreImage(activeStore);
      if (!blob) return;
      onPublish({ blob, format, templateId: template.id });
    } catch {
      toast.error('Failed to prepare design');
    } finally {
      setExporting(false);
    }
  }, [
    format,
    onPublish,
    selectedTemplate,
    canPublish,
    canPublishToMeta,
    publishEntitlementsLoading,
    openUpgradeModal,
  ]);

  const propertyImageUrls = useMemo(
    () => publicProperty?.images ?? (binding.propertyPhoto ? [binding.propertyPhoto] : []),
    [publicProperty?.images, binding.propertyPhoto]
  );

  const builderActions = useMemo(
    () => (
      <>
        <MarketingAutoSaveStatus status={autoSaveStatus} errorMessage={autoSaveError} />
        {/* Below lg these move into MarketingEditorMobileToolbar so the builder header
            stays a single compact row. */}
        {isBelowLg ? null : (
          <>
            {canEditContent ? (
              <TierBadgeAnchor feature="marketingStudio">
                <Button
                  variant="outline"
                  className="min-h-[44px] gap-2"
                  disabled={!storeReady || exporting || loadingTemplate}
                  onClick={() => void handleDownload()}
                >
                  {exporting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="size-4" aria-hidden />
                  )}
                  Download
                </Button>
              </TierBadgeAnchor>
            ) : null}
            {onPublish && canPublish ? (
              <TierBadgeAnchor feature="marketingPublishLimitPerGroup">
                <Button
                  className="min-h-[44px] gap-2"
                  disabled={!storeReady || exporting || loadingTemplate}
                  onClick={() => void handlePublish()}
                >
                  {exporting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="size-4" aria-hidden />
                  )}
                  {MARKETING_PUBLISH_META_LABEL}
                </Button>
              </TierBadgeAnchor>
            ) : null}
          </>
        )}
      </>
    ),
    [
      autoSaveStatus,
      autoSaveError,
      isBelowLg,
      storeReady,
      exporting,
      loadingTemplate,
      onPublish,
      canEditContent,
      canPublish,
      handleDownload,
      handlePublish,
    ]
  );

  const builderStatus = useMemo(
    () =>
      loadingTemplate ? (
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Loading…
        </span>
      ) : null,
    [loadingTemplate]
  );

  const headerActions = useMemo(
    () => (
      <>
        {builderStatus}
        {builderActions}
      </>
    ),
    [builderActions, builderStatus]
  );

  useMarketingStudioHeaderActions(headerActions);

  const formatOptions = useMemo<MarketingFormatOption[]>(
    () =>
      (Object.keys(DESIGN_FORMAT_DIMENSIONS) as DesignTemplateFormat[]).map((key) => ({
        value: key,
        width: DESIGN_FORMAT_DIMENSIONS[key].width,
        height: DESIGN_FORMAT_DIMENSIONS[key].height,
      })),
    []
  );

  const presetTemplates = useMemo<PresetTemplateItem[]>(
    () =>
      CATEGORIES.flatMap((cat) =>
        campaignTemplatesForFormat(format, cat).map((template) => ({
          id: template.id,
          name: template.name,
          category: cat,
          swatchPrimary: template.preview.primary,
          swatchSecondary: template.preview.secondary,
        }))
      ),
    [format]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <MarketingEditorSidebar
        layoutKey="design"
        mobileVariant="sheet"
        mobileOpen={mobilePanelOpen}
        onMobileOpenChange={setMobilePanelOpen}
        mobileTitle="Templates"
        header={<p className="text-sm font-medium">Templates</p>}
      >
        <MarketingTemplatesPanel
          tab="design"
          contentType="design"
          brandColor={accentColor}
          formatOptions={formatOptions}
          format={format}
          onFormatChange={(value) => {
            const nextFormat = value as DesignTemplateFormat;
            if (startFrom === 'collage' && store && isStoreInCollageMode(store)) {
              // Resize the collage in place instead of clearing it like a preset switch would.
              handleCollageFormatResize(nextFormat, getCollageSettings(store).layoutId);
              setFormat(nextFormat);
              return;
            }
            setSavedTemplateId(null);
            appliedDocumentKeyRef.current = null;
            setFormat(nextFormat);
          }}
          category={category}
          onCategoryChange={setCategory}
          presetTemplates={presetTemplates}
          selectedId={selectedId}
          onSelectPreset={(templateId) => {
            setSavedTemplateId(null);
            appliedDocumentKeyRef.current = null;
            setSelectedId(templateId);
            closeMobilePanel();
          }}
          savedRecords={customSavedTemplates}
          selectedSavedId={
            savedTemplateId && customSavedTemplates.some((record) => record.id === savedTemplateId)
              ? savedTemplateId
              : null
          }
          onSelectSaved={(record) => {
            void applySavedTemplate(record);
            closeMobilePanel();
          }}
          onSavedTemplate={handleSavedTemplateCreated}
          onOpenAiGenerate={() => setAiGenerateOpen(true)}
          aiGenerateBusy={aiGenerateBusy || generateTemplate.isPending}
          selectedReviewId={selectedReview?.id ?? null}
          onSelectReview={(review) => {
            setSelectedReview(review);
            closeMobilePanel();
          }}
          designJsonForSave={designJsonForSave}
          aspectPreset={format}
          platform={format.includes('facebook') ? 'facebook' : 'instagram'}
          captureSaveThumbnail={async () => {
            const activeStore = storeRef.current;
            if (!activeStore) return null;
            return renderDesignStoreThumbnail(activeStore);
          }}
          startFrom={startFrom}
          onStartFromChange={handleStartFromChange}
          collagePanelSlot={
            store ? (
              <CollagePanel
                store={store}
                format={format}
                propertyImages={propertyImageUrls.map((url) => ({
                  url,
                  preview: url,
                  type: 'image' as const,
                }))}
                uploads={uploads}
                onCollageStarted={handleCollageStarted}
              />
            ) : null
          }
          blankPanelSlot={
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Blank canvas at the selected format. Add photos, text, and shapes from the canvas
                toolbar.
              </p>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full"
                onClick={handleStartBlank}
              >
                Reset to blank
              </Button>
            </div>
          }
        />
      </MarketingEditorSidebar>

      <div
        className={cn(
          'polotno-studio-root relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          marketingEditorWorkspaceClassName
        )}
        data-mobile={isBelowLg ? 'true' : undefined}
      >
        <div className="relative min-h-0 flex-1">
          {storeReady && store ? (
            <KamePolotnoEditor
              store={store}
              propertyImageUrls={propertyImageUrls}
              brandColor={accentColor}
              logoUrl={orgLogoUrl}
              style={{
                width: '100%',
                // The studio shell already ends just above the floating editor dock on mobile.
                height: '100%',
              }}
              onResetDesign={handleResetDesign}
              resetDisabled={loadingTemplate || (!selectedId && !savedTemplateId)}
              hideHistory={isBelowLg}
              sessionMedia={uploads}
            />
          ) : (
            <div
              className="flex h-full min-h-[16rem] flex-col gap-3 p-3 sm:p-4"
              aria-busy="true"
              aria-label="Starting editor"
            >
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-8 w-28 rounded-md" />
                <div className="flex gap-2">
                  <Skeleton className="size-8 rounded-md" />
                  <Skeleton className="size-8 rounded-md" />
                </div>
              </div>
              <Skeleton className="min-h-0 w-full flex-1 rounded-xl" />
            </div>
          )}
        </div>
      </div>

      {/* Mobile editor dock (max-lg). Polotno keeps its own side rail for Text/Elements/
          Uploads/Background/Layers (panels dock as a bottom sheet via CSS); this bar adds
          the template browser + export actions. */}
      <MarketingEditorMobileToolbar
        panelLabel="Templates"
        panelIcon={LayoutTemplate}
        panelOpen={mobilePanelOpen}
        onTogglePanel={() => setMobilePanelOpen((open) => !open)}
        overflowItems={[
          {
            key: 'undo',
            label: 'Undo',
            icon: <Undo2 className="size-5" aria-hidden />,
            disabled: !store?.history.canUndo,
            onSelect: () => store?.history.undo(),
          },
          {
            key: 'redo',
            label: 'Redo',
            icon: <Redo2 className="size-5" aria-hidden />,
            disabled: !store?.history.canRedo,
            onSelect: () => store?.history.redo(),
          },
          {
            key: 'reset',
            label: 'Reset design',
            icon: <RotateCcw className="size-5" aria-hidden />,
            disabled: loadingTemplate || (!selectedId && !savedTemplateId),
            onSelect: handleResetDesign,
          },
          {
            key: 'ai',
            label: 'Generate with AI',
            icon: <Sparkles className="size-5" aria-hidden />,
            trailing: <TierBadge feature="aiMarketingGeneration" />,
            disabled: aiGenerateBusy || generateTemplate.isPending,
            onSelect: () => setAiGenerateOpen(true),
          },
          ...(canEditContent
            ? [
                {
                  key: 'download',
                  label: exporting ? 'Exporting…' : 'Download',
                  icon: <Download className="size-5" aria-hidden />,
                  trailing: <TierBadge feature="marketingStudio" />,
                  disabled: !storeReady || exporting || loadingTemplate,
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
                  disabled: !storeReady || exporting || loadingTemplate,
                  onSelect: () => void handlePublish(),
                },
              ]
            : []),
        ]}
      />

      <MarketingAiGeneratePanel
        open={aiGenerateOpen}
        onOpenChange={(open) => {
          if (aiGenerateBusy && !open) return;
          setAiGenerateOpen(open);
        }}
        contentType="design"
        generating={aiGenerateBusy || generateTemplate.isPending}
        propertyPhotoUrls={propertyPhotoUrls}
        brandColor={brandColor}
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
