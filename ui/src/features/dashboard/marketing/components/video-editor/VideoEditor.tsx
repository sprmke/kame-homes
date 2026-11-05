import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Download,
  LayoutTemplate,
  Loader2,
  Maximize2,
  Minimize2,
  Redo2,
  RotateCcw,
  Scaling,
  Send,
  SlidersHorizontal,
  Sparkles,
  Star,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toast } from 'sonner';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

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
import {
  MarketingEditorInspector,
  MarketingEditorRail,
  type MarketingRailSection,
} from '@/features/dashboard/marketing/components/shared/MarketingEditorRail';
import { MarketingEditorTopBar } from '@/features/dashboard/marketing/components/shared/MarketingEditorTopBar';
import { MarketingPreviewHeader } from '@/features/dashboard/marketing/components/shared/MarketingPreviewHeader';
import { MarketingReplaceTemplateDialog } from '@/features/dashboard/marketing/components/shared/MarketingReplaceTemplateDialog';
import { MarketingReviewSidebarSection } from '@/features/dashboard/marketing/components/shared/MarketingReviewSidebarSection';
import { MarketingSizeDialog } from '@/features/dashboard/marketing/components/shared/MarketingSizeDialog';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import type { VideoPreviewMode } from '@/features/dashboard/marketing/components/video-editor/useVideoPlayerTransport';
import {
  CampaignVideoComposition,
  type VideoCompositionProps,
} from '@/features/dashboard/marketing/components/video-editor/VideoCompositions';
import { VideoEditorSettings } from '@/features/dashboard/marketing/components/video-editor/VideoEditorSettings';
import {
  VideoPreviewWorkspace,
  type VideoPreviewWorkspaceHandle,
} from '@/features/dashboard/marketing/components/video-editor/VideoPreviewWorkspace';
import { VideoTimeline } from '@/features/dashboard/marketing/components/video-editor/VideoTimeline';
import { useEnsureDefaultVideoMusic } from '@/features/dashboard/marketing/hooks/useEnsureDefaultVideoMusic';
import { useGenerateMarketingTemplate } from '@/features/dashboard/marketing/hooks/useGenerateMarketingTemplate';
import { useMarketingBookedDates } from '@/features/dashboard/marketing/hooks/useMarketingBookedDates';
import { useMarketingDesignSession } from '@/features/dashboard/marketing/hooks/useMarketingDesignSession';
import { useDuplicateMarketingItem } from '@/features/dashboard/marketing/hooks/useMarketingLibrary';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import {
  fetchMarketingTemplate,
  saveMarketingTemplate,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import {
  useVideoProjectHistory,
  useVideoProjectHistoryShortcuts,
} from '@/features/dashboard/marketing/hooks/useVideoProjectHistory';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  blobToDataUrl,
  exportVideoToBlob,
} from '@/features/dashboard/marketing/lib/exportVideoMedia';
import {
  availabilityTextForMonth,
  openSlotDatesForMonth,
} from '@/features/dashboard/marketing/lib/marketingBookedDates';
import { marketingContentFingerprint } from '@/features/dashboard/marketing/lib/marketingContentFingerprint';
import type { MarketingGuestReview } from '@/features/dashboard/marketing/lib/marketingGuestReview';
import {
  normalizeStartSize,
  startSizesFor,
} from '@/features/dashboard/marketing/lib/marketingLibrary';
import { captureVideoProjectThumbnail } from '@/features/dashboard/marketing/lib/marketingPresetThumbs';
import {
  holdMarketingRenders,
  releaseMarketingRenders,
} from '@/features/dashboard/marketing/lib/marketingRenderGate';
import { MARKETING_PUBLISH_META_LABEL } from '@/features/dashboard/marketing/lib/marketingStudioCopy';
import {
  formatTemplateRef,
  type MarketingTemplateRef,
} from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import {
  propertyGalleryMediaItems,
  propertyMediaItems,
} from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import {
  pickBindingMediaAt,
  primaryBindingPhoto,
  resolveDesignBindingMedia,
} from '@/features/dashboard/marketing/lib/propertyBindingMedia';
import { marketingThemeHash } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { themeStampForSave } from '@/features/dashboard/marketing/lib/theme/marketingThemeItems';
import {
  applyGuestReviewToVideoProject,
  isReviewVideoTemplate,
} from '@/features/dashboard/marketing/lib/video/applyGuestReviewToVideoProject';
import { ensureVideoMusicForExport } from '@/features/dashboard/marketing/lib/video/importVideoMusic';
import { resolveAiGeneratedVideoProjectsForAllFormats } from '@/features/dashboard/marketing/lib/video/videoAiProjectBuilder';
import {
  VIDEO_FORMAT_DIMENSIONS,
  VIDEO_MAX_RELATIVE_ZOOM,
  VIDEO_MIN_RELATIVE_ZOOM,
  VIDEO_PREVIEW_CONTAINER_MIN_HEIGHT_CLASS,
  stepVideoZoomIn,
  stepVideoZoomOut,
} from '@/features/dashboard/marketing/lib/video/videoFormatDimensions';
import { resolveVideoMotionProfile } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import {
  buildDefaultVideoProject,
  parseVideoProject,
} from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';
import type {
  VideoFormat,
  VideoProject,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  addPhotoScene,
  sceneSettledPreviewFrame,
  videoProjectDurationInFrames,
} from '@/features/dashboard/marketing/lib/video/videoProjectUtils';
import { getSceneLayers } from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import { resolveVideoTypographyContext } from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';
import { applyVideoAiPreferencesToTokens } from '@/features/dashboard/marketing/lib/videoAiGenerateOptions';
import { getVideoCampaignTemplate } from '@/features/dashboard/marketing/lib/videoCampaignTemplates';
import { registerVideoThumbnailPlaybackPause } from '@/features/dashboard/marketing/lib/videoThumbnailCapture';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOrgSettings } from '@/features/dashboard/org/hooks/useOrgSettings';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { TierBadge, TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { formatMoneyCompact } from '@/utils/format/currency';

import type { PlayerRef } from '@remotion/player';

export type VideoExportPayload = {
  templateId: string;
  project: VideoProject;
  blob: Blob;
  dataUrl: string;
};

type Props = {
  document: MarketingEditorDocument;
  nav: MarketingEditorNav;
  onPublish?: (payload: VideoExportPayload) => void;
};

const DEFAULT_VIDEO_TEMPLATE = 'quiet-morning';
const VIDEO_FORMATS = new Set<string>(Object.keys(VIDEO_FORMAT_DIMENSIONS));

function asVideoFormat(value: unknown, fallback: VideoFormat): VideoFormat {
  return typeof value === 'string' && VIDEO_FORMATS.has(value) ? (value as VideoFormat) : fallback;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** Project stored on a saved design or template row. */
function projectFromRecord(
  record: MarketingTemplateRecord,
  binding: DesignBinding,
  format: VideoFormat
): VideoProject {
  const json = record.designJson ?? {};
  const templateId = typeof json.templateId === 'string' ? json.templateId : DEFAULT_VIDEO_TEMPLATE;
  const category =
    (typeof json.categoryId === 'string' && json.categoryId) ||
    (typeof json.category === 'string' && json.category) ||
    getVideoCampaignTemplate(templateId)?.category ||
    'soft-stay';
  const project = parseVideoProject(json.project ?? json, templateId, category, binding, format);
  return { ...project, format };
}

export function VideoEditor({ document, nav, onPublish }: Props) {
  const { property, org } = useOrgContext();
  const propertyId = usePropertyIdParam();
  const { data: orgSettings } = useOrgSettings();
  // The studio only mounts editors once a theme is resolved.
  const { active: activeTheme } = useMarketingTheme();
  const theme = activeTheme!;
  const themeTokens = theme.tokens;
  const themeHash = useMemo(() => marketingThemeHash(themeTokens), [themeTokens]);
  const generateTemplate = useGenerateMarketingTemplate();
  const duplicate = useDuplicateMarketingItem();
  const isBelowLg = useIsBelowLg();

  const record = document.mode === 'saved' ? document.record : null;
  const initialFormat: VideoFormat =
    document.mode === 'saved'
      ? asVideoFormat(
          document.record.aspectPreset ?? document.record.designJson.format,
          'instagram-story'
        )
      : asVideoFormat(
          normalizeStartSize('video', document.size),
          asVideoFormat(document.templateRecord?.aspectPreset, 'instagram-story')
        );

  const [format, setFormat] = useState<VideoFormat>(initialFormat);
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [aiGenerateBusy, setAiGenerateBusy] = useState(false);
  const [selectedReview, setSelectedReview] = useState<MarketingGuestReview | null>(null);
  const {
    project,
    setProject,
    amendProject,
    replaceProject,
    undo,
    redo,
    canUndo,
    canRedo,
    edited,
  } = useVideoProjectHistory();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [railPanel, setRailPanel] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(!isBelowLg);
  const [mobilePanel, setMobilePanel] = useState<string | null>(null);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<
    | (MarketingTemplatePick & {
        name: string;
      })
    | null
  >(null);
  const [previewMode, setPreviewMode] = useState<VideoPreviewMode>('all');
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewPlayingRef = useRef(previewPlaying);
  previewPlayingRef.current = previewPlaying;
  const [relativeZoom, setRelativeZoom] = useState(100);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [elementFocusRequest, setElementFocusRequest] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const previewWorkspaceRef = useRef<VideoPreviewWorkspaceHandle>(null);

  const handleFitToView = useCallback(() => {
    setRelativeZoom(100);
    previewWorkspaceRef.current?.fitToView();
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    previewWorkspaceRef.current?.toggleFullscreen();
  }, []);

  useVideoProjectHistoryShortcuts({ undo, redo, enabled: Boolean(project) });
  useEnsureDefaultVideoMusic(project, amendProject);

  const {
    data: publicProperty,
    isLoading: propertyLoading,
    isError: propertyError,
  } = usePublicPropertyDetail(property.slug);
  const { data: bookedDates } = useMarketingBookedDates();
  const previewMonth = useMemo(() => new Date(), []);

  const binding = useMemo<DesignBinding>(() => {
    const rate = publicProperty?.pricing.baseRate ?? 2799;
    const galleryMedia =
      publicProperty?.media?.map((item) => ({ url: item.url, type: item.type })) ?? [];
    const resolvedMedia = resolveDesignBindingMedia({
      propertyMedia: galleryMedia,
      images: publicProperty?.images,
      propertyPhoto: publicProperty?.images[0] ?? null,
    });

    return {
      propertyName: property.name,
      propertyPhoto: primaryBindingPhoto(resolvedMedia),
      propertyMedia: resolvedMedia,
      nightlyRate: `${formatMoneyCompact(rate)} / night`,
      availabilityText: availabilityTextForMonth(bookedDates ?? [], previewMonth),
      monthLabel: previewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      monthShort: previewMonth.toLocaleDateString('en-US', { month: 'long' }),
      openSlots: openSlotDatesForMonth(bookedDates ?? [], previewMonth, 5),
    };
  }, [property.name, publicProperty, bookedDates, previewMonth]);

  const propertyImages = useMemo(
    () =>
      publicProperty?.media?.length
        ? propertyGalleryMediaItems(
            publicProperty.media.map((item) => ({ url: item.url, type: item.type }))
          )
        : propertyMediaItems(
            publicProperty?.images ?? (binding.propertyPhoto ? [binding.propertyPhoto] : [])
          ),
    [publicProperty?.media, publicProperty?.images, binding.propertyPhoto]
  );

  const dimensions = VIDEO_FORMAT_DIMENSIONS[format];
  const propertyPhotoUrls = useMemo(
    () => propertyImages.filter((item) => item.type === 'image').map((item) => item.url),
    [propertyImages]
  );
  // The theme's main color stands in where the brand accent used to.
  const accentColor = themeTokens.palette.primary;
  const orgLogoUrl =
    orgSettings?.emailLogoUrl?.trim() ||
    org.logoUrl?.trim() ||
    (typeof org.settings?.emailLogoUrl === 'string' ? org.settings.emailLogoUrl.trim() : '') ||
    null;

  const sourceTemplateId = useMemo(() => {
    if (document.mode === 'saved') return document.record.sourceTemplateId ?? null;
    if (!document.from || document.from.kind === 'blank' || document.from.kind === 'collage') {
      return `preset:${DEFAULT_VIDEO_TEMPLATE}`;
    }
    return formatTemplateRef(document.from);
  }, [document]);

  const draftName = useMemo(() => {
    if (document.mode === 'saved') return document.record.name;
    if (document.templateRecord) return document.templateRecord.name;
    if (document.from?.kind === 'preset') {
      return getVideoCampaignTemplate(document.from.id)?.name ?? 'Untitled video';
    }
    return getVideoCampaignTemplate(DEFAULT_VIDEO_TEMPLATE)?.name ?? 'Untitled video';
  }, [document]);

  const loadProject = useCallback(
    (next: VideoProject) => {
      replaceProject(next);
      setSelectedSceneId(next.scenes[0]?.id ?? null);
      setPreviewMode('all');
      playerRef.current?.pause();
      playerRef.current?.seekTo(0);
    },
    [replaceProject]
  );

  // ── Initial document ────────────────────────────────────────────────────
  // Saved designs and saved templates load right away. Built-in templates wait for the
  // property's photos so the first frame is already the host's own place.
  const bindingReady = !propertyLoading || propertyError || Boolean(publicProperty);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (document.mode === 'saved') {
      loadProject(projectFromRecord(document.record, binding, initialFormat));
    } else if (document.templateRecord) {
      loadProject(projectFromRecord(document.templateRecord, binding, initialFormat));
    } else {
      if (!bindingReady) return;
      const templateId =
        document.from?.kind === 'preset' ? document.from.id : DEFAULT_VIDEO_TEMPLATE;
      const template = getVideoCampaignTemplate(templateId);
      loadProject(
        buildDefaultVideoProject(
          template?.id ?? DEFAULT_VIDEO_TEMPLATE,
          template?.category ?? 'soft-stay',
          binding,
          initialFormat
        )
      );
    }
    initializedRef.current = true;
    setReady(true);
  }, [document, binding, bindingReady, initialFormat, loadProject]);

  useEffect(() => {
    if (ready && document.mode === 'draft' && document.openAi) setAiGenerateOpen(true);
    // Once, when the draft is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    return () => {
      playerRef.current?.pause();
    };
  }, []);

  // Heavy card renders wait while the host plays the preview.
  useEffect(() => {
    if (!previewPlaying) return;
    holdMarketingRenders();
    return () => releaseMarketingRenders();
  }, [previewPlaying]);

  useEffect(() => {
    return registerVideoThumbnailPlaybackPause(
      () => {
        playerRef.current?.pause();
        setPreviewPlaying(false);
      },
      () => previewPlayingRef.current
    );
  }, []);

  const selectedScene = useMemo(
    () => project?.scenes.find((scene) => scene.id === selectedSceneId) ?? project?.scenes[0],
    [project, selectedSceneId]
  );

  const selectedSceneIndex = useMemo(() => {
    if (!project || !selectedScene) return 0;
    return project.scenes.findIndex((scene) => scene.id === selectedScene.id);
  }, [project, selectedScene]);

  useEffect(() => {
    if (!selectedScene) {
      setSelectedElementId(null);
      return;
    }
    const layerIds = getSceneLayers(selectedScene).map((layer) => layer.id);
    setSelectedElementId((current) =>
      current && layerIds.includes(current) ? current : (layerIds[0] ?? null)
    );
  }, [
    selectedScene?.id,
    selectedScene?.kind,
    selectedScene?.layers,
    selectedScene?.hiddenElements,
  ]);

  const templateTypography = useMemo(
    () =>
      resolveVideoTypographyContext(
        project?.templateId ?? DEFAULT_VIDEO_TEMPLATE,
        accentColor,
        project?.palette,
        themeTokens
      ),
    [project?.templateId, project?.palette, accentColor, themeTokens]
  );

  const motionProfile = useMemo(
    () => resolveVideoMotionProfile(project?.templateId ?? DEFAULT_VIDEO_TEMPLATE),
    [project?.templateId]
  );

  /** Preview, export, and the drag overlay all read the same resolved identity. */
  const inputProps = useMemo<VideoCompositionProps | null>(() => {
    if (!project) return null;
    return {
      project,
      brandColor: accentColor,
      theme: themeTokens,
      typography: templateTypography,
      motionProfile,
    };
  }, [project, accentColor, templateTypography, motionProfile, themeTokens]);

  const durationInFrames = useMemo(
    () => (project ? videoProjectDurationInFrames(project) : 150),
    [project]
  );

  const category = project?.campaignCategory ?? 'soft-stay';

  const videoFingerprint = useMemo(() => {
    if (!project) return null;
    return marketingContentFingerprint({ templateId: project.templateId, format, project });
  }, [project, format]);

  const { canEditContent, canPublish, canAddTemplate, canEditTemplate, canGenerate } =
    useMarketingPermissions();
  const { canUse: canSaveDesigns } = useFeatureGate('customTemplates');
  const canSave = canEditContent && canSaveDesigns && (record ? canEditTemplate : canAddTemplate);

  const buildDesignJson = useCallback(() => {
    if (!project) return null;
    return {
      templateId: project.templateId,
      format,
      category,
      categoryId: category,
      binding,
      project,
      ...(record?.designJson.aiGenerated === true
        ? {
            aiGenerated: true,
            aiGenerationId: record.designJson.aiGenerationId,
            aiTokens: record.designJson.aiTokens,
          }
        : {}),
      ...themeStampForSave(themeTokens),
    };
  }, [project, format, category, binding, record, themeTokens]);

  const captureThumbnail = useCallback(async () => {
    if (!project) return null;
    return captureVideoProjectThumbnail(project, accentColor, themeTokens);
  }, [project, accentColor, themeTokens]);

  const session = useMarketingDesignSession({
    contentType: 'video',
    themeKey: theme.key,
    itemId: record?.id ?? null,
    record,
    draftName,
    sourceTemplateId,
    ready,
    hasUserEdits: edited,
    contentFingerprint: videoFingerprint,
    aspectPreset: format,
    platform: format === 'landscape' ? 'facebook' : 'instagram',
    buildDesignJson,
    captureThumbnail,
    onCreated: nav.onCreated,
    themeHash,
    onReloadFromServer: (fresh) => {
      const freshFormat = asVideoFormat(fresh.aspectPreset, format);
      setFormat(freshFormat);
      loadProject(projectFromRecord(fresh, binding, freshFormat));
      session.markBaseline();
    },
    canSave,
  });

  // A freshly loaded document is the baseline: nothing to save until the host edits.
  useEffect(() => {
    if (ready) session.markBaseline();
    // Only right after the first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const handleBack = useCallback(async () => {
    playerRef.current?.pause();
    await session.flush();
    nav.back();
  }, [nav, session]);

  const handleExportVideo = useCallback(async () => {
    if (!project || !inputProps) throw new Error('No project');

    // Jamendo CDN URLs are CORS-blocked in Remotion web export — cache to Storage first.
    const { music: exportMusic, strippedJamendo } = await ensureVideoMusicForExport(
      project.music,
      propertyId
    );
    if (exportMusic?.url && project.music?.url !== exportMusic.url && !strippedJamendo) {
      amendProject((prev) => (prev ? { ...prev, music: exportMusic } : prev));
    }
    if (strippedJamendo) {
      toast.message('Exporting without music. Track could not be cached');
    }

    const blob = await exportVideoToBlob({
      templateId: project.templateId,
      component: CampaignVideoComposition,
      width: dimensions.width,
      height: dimensions.height,
      fps: project.fps,
      durationInFrames,
      inputProps: { ...inputProps, project: { ...project, music: exportMusic } },
    });
    const dataUrl = await blobToDataUrl(blob);
    return { blob, dataUrl };
  }, [project, inputProps, propertyId, dimensions, durationInFrames, amendProject]);

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
    setExporting(true);
    try {
      const { blob } = await handleExportVideo();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `video-${property.slug}-${slug(session.name) || 'campaign'}.mp4`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Video export failed');
    } finally {
      setExporting(false);
    }
  }, [
    handleExportVideo,
    property.slug,
    session.name,
    canEditContent,
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
    if (!onPublish || !project) return;

    setExporting(true);
    try {
      const { blob, dataUrl } = await handleExportVideo();
      onPublish({ templateId: project.templateId, project, blob, dataUrl });
    } catch {
      toast.error('Video export failed');
    } finally {
      setExporting(false);
    }
  }, [
    onPublish,
    project,
    handleExportVideo,
    canPublish,
    canPublishToMeta,
    publishEntitlementsLoading,
    openUpgradeModal,
  ]);

  const seekToSceneId = useCallback(
    (sceneId: string, options?: { play?: boolean; mode?: VideoPreviewMode }) => {
      setSelectedSceneId(sceneId);
      if (!project) return;
      const index = project.scenes.findIndex((scene) => scene.id === sceneId);
      if (index < 0) return;
      if (options?.mode) setPreviewMode(options.mode);
      playerRef.current?.seekTo(sceneSettledPreviewFrame(project, index));
      if (options?.play) void playerRef.current?.play();
      else playerRef.current?.pause();
    },
    [project]
  );

  const handleTimelineSelectScene = useCallback(
    (sceneId: string) => seekToSceneId(sceneId, { play: true, mode: 'clip' }),
    [seekToSceneId]
  );

  const openInspector = useCallback(() => {
    if (isBelowLg) setMobilePanel('edit');
    else setInspectorOpen(true);
  }, [isBelowLg]);

  const handleCanvasSelectElement = useCallback(
    (layerId: string, sceneId: string) => {
      playerRef.current?.pause();
      openInspector();
      setSelectedSceneId(sceneId);
      setSelectedElementId(layerId);
      setElementFocusRequest((count) => count + 1);
    },
    [openInspector]
  );

  // ── Templates (Replace / Open as new) ──────────────────────────────────
  const projectFromPick = useCallback(
    async (ref: MarketingTemplateRef): Promise<VideoProject | null> => {
      if (ref.kind === 'template') {
        const templateRecord = await fetchMarketingTemplate(propertyId, ref.id);
        return projectFromRecord(templateRecord, binding, format);
      }
      const templateId = ref.kind === 'preset' ? ref.id : DEFAULT_VIDEO_TEMPLATE;
      const template = getVideoCampaignTemplate(templateId);
      if (!template) return null;
      let next = buildDefaultVideoProject(template.id, template.category, binding, format);
      if (selectedReview && isReviewVideoTemplate(template.id)) {
        next = applyGuestReviewToVideoProject(next, selectedReview, binding);
      }
      return next;
    },
    [binding, format, propertyId, selectedReview]
  );

  const replaceWithTemplate = useCallback(
    async (ref: MarketingTemplateRef) => {
      try {
        const next = await projectFromPick(ref);
        if (!next) return;
        // An edit (undoable), so autosave stores it on this design.
        setProject(next);
        setSelectedSceneId(next.scenes[0]?.id ?? null);
        setPreviewMode('all');
        playerRef.current?.seekTo(0);
      } catch {
        toast.error('Could not load that template');
      }
    },
    [projectFromPick, setProject]
  );

  const handleTemplatePick = useCallback(
    (pick: MarketingTemplatePick) => {
      setMobilePanel(null);
      // An untouched draft just switches template; real work asks first.
      if (session.isDraft && !edited) {
        nav.startDraft(pick.ref, { size: format, replace: true });
        return;
      }
      const name =
        pick.ref.kind === 'preset'
          ? (getVideoCampaignTemplate(pick.ref.id)?.name ?? 'this template')
          : 'this template';
      setPendingTemplate({ ...pick, name });
    },
    [edited, format, nav, session.isDraft]
  );

  const handleResetProject = useCallback(() => {
    const templateId = project?.templateId ?? DEFAULT_VIDEO_TEMPLATE;
    const template = getVideoCampaignTemplate(templateId);
    const next = buildDefaultVideoProject(
      template?.id ?? DEFAULT_VIDEO_TEMPLATE,
      template?.category ?? 'soft-stay',
      binding,
      format
    );
    setProject(next);
    setSelectedSceneId(next.scenes[0]?.id ?? null);
    setSelectedElementId(null);
    setPreviewMode('all');
    playerRef.current?.pause();
    playerRef.current?.seekTo(0);
    toast.success('Reset to template');
  }, [project?.templateId, binding, format, setProject]);

  const handleAddScene = useCallback(() => {
    if (!project) return;
    const media = binding.propertyMedia ?? [];
    const { url, mediaType } = pickBindingMediaAt(media, project.scenes.length);
    const next = addPhotoScene(project, url, mediaType);
    setProject(next);
    const added = next.scenes[next.scenes.length - 1];
    if (added) {
      seekToSceneId(added.id, { play: true, mode: 'clip' });
      openInspector();
    }
  }, [project, binding.propertyMedia, seekToSceneId, setProject, openInspector]);

  const handleSelectReview = useCallback(
    (review: MarketingGuestReview) => {
      setSelectedReview(review);
      setProject((prev) => {
        if (!prev) return prev;
        if (!isReviewVideoTemplate(prev.templateId)) {
          const next = buildDefaultVideoProject('guest-love', 'reviews', binding, format);
          return applyGuestReviewToVideoProject(next, review, binding);
        }
        return applyGuestReviewToVideoProject(prev, review, binding);
      });
      setMobilePanel(null);
    },
    [binding, format, setProject]
  );

  // ── Sizes ───────────────────────────────────────────────────────────────
  const handleResize = useCallback(
    (size: string) => {
      const next = asVideoFormat(size, format);
      setFormat(next);
      setProject((prev) => (prev ? { ...prev, format: next } : prev));
      setRelativeZoom(100);
    },
    [format, setProject]
  );

  const handleCopyToSize = useCallback(
    async (size: string) => {
      const id = session.itemId;
      if (!id || !project) return;
      await session.flush();
      const nextFormat = asVideoFormat(size, format);
      const designJson = buildDesignJson();
      if (!designJson) return;
      const copy = await duplicate.mutateAsync({
        id,
        sameGroup: true,
        aspectPreset: nextFormat,
        platform: nextFormat === 'landscape' ? 'facebook' : 'instagram',
        designJson: {
          ...designJson,
          format: nextFormat,
          project: { ...project, format: nextFormat },
        },
      });
      nav.openItem(copy.id, { replace: true });
    },
    [session, project, format, buildDesignJson, duplicate, nav]
  );

  // ── AI ──────────────────────────────────────────────────────────────────
  const handleAiGenerate = useCallback(
    async (input: MarketingAiGenerateInput) => {
      if (!('duration' in input.preferences)) return;

      setAiGenerateBusy(true);
      let aiSucceeded = false;
      try {
        const amenities = publicProperty?.amenities ?? [];
        const amenitiesText = amenities.slice(0, 8).join(', ') || undefined;
        const result = await generateTemplate.mutateAsync({
          contentType: 'video',
          prompt: input.prompt,
          includeContext: input.includeContext,
          amenitiesText: input.includeContext.amenities ? amenitiesText : undefined,
          availabilityText: input.includeContext.availability
            ? binding.availabilityText
            : undefined,
          content: input.preferences.content,
          preferences: {
            // Reuses the shared preferences bag's `layoutArchetype` slot to carry the
            // duration-in-seconds hint (client enforces the real floor either way).
            layoutArchetype:
              input.preferences.duration === 'auto'
                ? undefined
                : String(input.preferences.duration),
            fontPairing:
              input.preferences.fontPairing === 'auto' ? undefined : input.preferences.fontPairing,
            backgroundMood:
              input.preferences.motionMood === 'auto' ? undefined : input.preferences.motionMood,
            category: input.preferences.category,
          },
        });
        if (result.contentType !== 'video') {
          throw new Error('Unexpected content type from AI generation');
        }
        aiSucceeded = true;

        const tokens = applyVideoAiPreferencesToTokens(result.tokens, input.preferences);
        const variants = resolveAiGeneratedVideoProjectsForAllFormats(tokens, binding, {
          includePropertyPhoto: input.includeContext.propertyPhoto,
          orgLogoUrl,
          includeOrgLogo: input.includeContext.orgLogo ?? true,
          includeCta: input.includeContext.cta ?? true,
          includePropertyName: input.includeContext.propertyName ?? true,
        });
        // One design in the size the host is working in; other sizes on request.
        const variant = variants.find((entry) => entry.format === format) ?? variants[0];
        if (!variant) throw new Error('Could not build the video');
        const aiGenerationId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `ai-${Date.now()}`;
        const thumbnailDataUrl = await captureVideoProjectThumbnail(
          variant.project,
          accentColor,
          themeTokens
        );
        const saved = await saveMarketingTemplate(propertyId, {
          name: tokens.label,
          contentType: 'video',
          aspectPreset: variant.format,
          platform: variant.format === 'landscape' ? 'facebook' : 'instagram',
          themeKey: theme.key,
          kind: 'design',
          designJson: {
            templateId: variant.project.templateId,
            format: variant.format,
            category: tokens.category,
            categoryId: tokens.category,
            binding,
            project: variant.project,
            aiGenerated: true,
            aiGenerationId,
            aiTokens: tokens,
            ...themeStampForSave(themeTokens),
            ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
          },
        });
        setAiGenerateOpen(false);
        toast.success('Video made with AI');
        nav.openItem(saved.id, { replace: session.isDraft && !edited });
      } catch (error) {
        if (aiSucceeded) {
          toast.error((error as Error).message || 'Could not save the video');
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
      session.isDraft,
      theme.key,
      themeTokens,
    ]
  );

  const compositionKey = useMemo(
    () =>
      project
        ? `${format}-${durationInFrames}-${project.scenes.map((scene) => scene.id).join('-')}`
        : 'empty',
    [project, format, durationInFrames]
  );

  const hasProject = Boolean(project);
  const sizeSiblings = record?.groupMembers ?? [];

  const sizeDialog = (
    <MarketingSizeDialog
      contentType="video"
      size={format}
      siblings={sizeSiblings}
      onOpenSibling={(id) => {
        void session.flush().then(() => nav.openItem(id, { replace: true }));
      }}
      onCopyToSize={
        session.itemId && canAddTemplate && canSaveDesigns ? handleCopyToSize : undefined
      }
      onResize={canEditContent ? handleResize : undefined}
      sizes={startSizesFor('video')}
      disabled={!hasProject}
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
            disabled={exporting || !hasProject}
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
            disabled={exporting || !hasProject}
            onClick={() => void handlePublish()}
          >
            <Send className="size-4" aria-hidden />
            {MARKETING_PUBLISH_META_LABEL}
          </Button>
        </TierBadgeAnchor>
      ) : null}
    </>
  );

  const templatesPanel = (
    <MarketingTemplateBrowser
      contentType="video"
      theme={themeTokens}
      themeHash={themeHash}
      themeKey={theme.key}
      size={format}
      onSizeChange={() => undefined}
      onPick={handleTemplatePick}
      binding={binding}
      variant="panel"
      lockSize
      showStarts={false}
      offerContinue={false}
      activeSourceId={sourceTemplateId}
    />
  );

  const reviewsPanel = (
    <MarketingReviewSidebarSection
      selectedReviewId={selectedReview?.id ?? null}
      onSelect={handleSelectReview}
      socialSeedOnly
    />
  );

  const railSections: MarketingRailSection[] = [
    { key: 'templates', label: 'Templates', icon: LayoutTemplate, panel: templatesPanel },
    { key: 'reviews', label: 'Reviews', icon: Star, panel: reviewsPanel, title: 'Guest reviews' },
    ...(canGenerate
      ? [
          {
            key: 'ai',
            label: 'AI',
            icon: Sparkles,
            panel: null,
            onActivate: () => setAiGenerateOpen(true),
          },
        ]
      : []),
  ];

  const settingsPanel =
    project && selectedScene ? (
      <VideoEditorSettings
        project={project}
        selectedScene={selectedScene}
        selectedSceneIndex={selectedSceneIndex}
        propertyImages={propertyImages}
        templateTypography={templateTypography}
        logoUrl={orgLogoUrl}
        onProjectChange={setProject}
        binding={binding}
        selectedElementId={selectedElementId}
        onSelectElement={setSelectedElementId}
        elementFocusRequest={elementFocusRequest}
      />
    ) : null;

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
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onReset={handleResetProject}
            resetTitle="Reset to template?"
            resetDescription="Your changes to this video are replaced by the template. You can undo this."
          />
        }
        size={sizeDialog}
        actions={topBarActions}
      />
      {isBelowLg ? sizeDialog : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {isBelowLg ? (
          <MarketingEditorRail
            layoutKey="video"
            sections={railSections}
            active={mobilePanel === 'templates' || mobilePanel === 'reviews' ? mobilePanel : null}
            onActiveChange={setMobilePanel}
          />
        ) : (
          <MarketingEditorRail
            layoutKey="video"
            sections={railSections}
            active={railPanel}
            onActiveChange={setRailPanel}
          />
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain max-lg:pb-1.5">
          {project && inputProps ? (
            <>
              <div
                className={cn(
                  'flex min-h-0 flex-1 flex-col overflow-hidden',
                  VIDEO_PREVIEW_CONTAINER_MIN_HEIGHT_CLASS
                )}
              >
                {isBelowLg ? null : (
                  <MarketingPreviewHeader
                    actions={
                      <TooltipProvider delayDuration={300}>
                        <div className="border-border bg-background flex items-center gap-1 rounded-md border px-1 py-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 min-h-[44px] w-9 min-w-[44px]"
                                onClick={() => setRelativeZoom((prev) => stepVideoZoomOut(prev))}
                                disabled={relativeZoom <= VIDEO_MIN_RELATIVE_ZOOM}
                                aria-label="Zoom out"
                              >
                                <ZoomOut className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Zoom out</TooltipContent>
                          </Tooltip>
                          <span className="min-w-[48px] text-center text-xs font-medium tabular-nums">
                            {relativeZoom}%
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 min-h-[44px] w-9 min-w-[44px]"
                                onClick={() => setRelativeZoom((prev) => stepVideoZoomIn(prev))}
                                disabled={relativeZoom >= VIDEO_MAX_RELATIVE_ZOOM}
                                aria-label="Zoom in"
                              >
                                <ZoomIn className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Zoom in</TooltipContent>
                          </Tooltip>
                          <div className="bg-border mx-1 h-4 w-px" />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 min-h-[44px] w-9 min-w-[44px]"
                                onClick={handleFitToView}
                                aria-label="Fit to view"
                              >
                                <Minimize2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Fit to view</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 min-h-[44px] w-9 min-w-[44px]"
                                onClick={handleToggleFullscreen}
                                aria-label="Fullscreen"
                              >
                                <Maximize2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Fullscreen</TooltipContent>
                          </Tooltip>
                          {!inspectorOpen ? (
                            <>
                              <div className="bg-border mx-1 h-4 w-px" />
                              <Button
                                type="button"
                                variant="ghost"
                                className="min-h-[44px] gap-1.5 px-2 text-xs"
                                onClick={() => setInspectorOpen(true)}
                              >
                                <SlidersHorizontal className="size-4" aria-hidden />
                                Edit
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TooltipProvider>
                    }
                  />
                )}
                <VideoPreviewWorkspace
                  ref={previewWorkspaceRef}
                  playerRef={playerRef}
                  project={project}
                  format={format}
                  durationInFrames={durationInFrames}
                  inputProps={inputProps}
                  selectedSceneIndex={selectedSceneIndex}
                  previewMode={previewMode}
                  onPreviewModeChange={setPreviewMode}
                  onPlayingChange={setPreviewPlaying}
                  onProjectChange={setProject}
                  compositionKey={compositionKey}
                  selectedElementId={selectedElementId}
                  onHighlightElement={setSelectedElementId}
                  onCanvasSelectElement={handleCanvasSelectElement}
                  relativeZoom={relativeZoom}
                />
              </div>
              <VideoTimeline
                project={project}
                selectedSceneId={selectedSceneId}
                onSelectScene={handleTimelineSelectScene}
                onProjectChange={setProject}
                onAddScene={handleAddScene}
                isPlaying={previewPlaying}
                brandColor={accentColor}
              />
            </>
          ) : (
            <div role="status"
              className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4"
              aria-busy="true"
              aria-label="Loading video editor"
            >
              <div className="bg-muted min-h-0 w-full flex-1 animate-pulse rounded-xl" />
              <div className="flex gap-2 overflow-hidden">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-muted h-14 w-20 shrink-0 animate-pulse rounded-lg sm:h-16 sm:w-24"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <MarketingEditorInspector
          title={selectedScene ? `Scene ${selectedSceneIndex + 1}` : 'Edit'}
          open={isBelowLg ? mobilePanel === 'edit' : inspectorOpen}
          onOpenChange={(open) =>
            isBelowLg ? setMobilePanel(open ? 'edit' : null) : setInspectorOpen(open)
          }
        >
          {settingsPanel}
        </MarketingEditorInspector>
      </div>

      {/* Mobile editor dock (max-lg): sheets for Templates / Edit / Reviews, AI, and ⋯. */}
      <MarketingEditorMobileToolbar
        panels={[
          { key: 'templates', label: 'Templates', icon: LayoutTemplate },
          { key: 'edit', label: 'Edit', icon: SlidersHorizontal },
          { key: 'reviews', label: 'Reviews', icon: Star },
          ...(canGenerate ? [{ key: 'ai', label: 'AI', icon: Sparkles }] : []),
        ]}
        activePanel={mobilePanel}
        onSelectPanel={(key) => {
          if (key === 'ai') {
            setAiGenerateOpen(true);
            return;
          }
          setMobilePanel(key);
        }}
        overflowItems={[
          {
            key: 'undo',
            label: 'Undo',
            icon: <Undo2 className="size-5" aria-hidden />,
            disabled: !canUndo,
            onSelect: undo,
          },
          {
            key: 'redo',
            label: 'Redo',
            icon: <Redo2 className="size-5" aria-hidden />,
            disabled: !canRedo,
            onSelect: redo,
          },
          {
            key: 'size',
            label: 'Size',
            icon: <Scaling className="size-5" aria-hidden />,
            disabled: !hasProject,
            onSelect: () => setSizeOpen(true),
          },
          {
            key: 'zoom-in',
            label: 'Zoom in',
            icon: <ZoomIn className="size-5" aria-hidden />,
            disabled: relativeZoom >= VIDEO_MAX_RELATIVE_ZOOM,
            onSelect: () => setRelativeZoom((prev) => stepVideoZoomIn(prev)),
          },
          {
            key: 'zoom-out',
            label: 'Zoom out',
            icon: <ZoomOut className="size-5" aria-hidden />,
            disabled: relativeZoom <= VIDEO_MIN_RELATIVE_ZOOM,
            onSelect: () => setRelativeZoom((prev) => stepVideoZoomOut(prev)),
          },
          {
            key: 'fit',
            label: 'Fit to view',
            icon: <Minimize2 className="size-5" aria-hidden />,
            onSelect: handleFitToView,
          },
          {
            key: 'fullscreen',
            label: 'Fullscreen preview',
            icon: <Maximize2 className="size-5" aria-hidden />,
            onSelect: handleToggleFullscreen,
          },
          {
            key: 'reset',
            label: 'Reset to template',
            icon: <RotateCcw className="size-5" aria-hidden />,
            onSelect: handleResetProject,
          },
          ...(canEditContent
            ? [
                {
                  key: 'download',
                  label: exporting ? 'Exporting…' : 'Download MP4',
                  icon: <Download className="size-5" aria-hidden />,
                  trailing: <TierBadge feature="marketingStudio" />,
                  disabled: exporting || !hasProject,
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
                  disabled: exporting || !hasProject,
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
          if (pendingTemplate) void replaceWithTemplate(pendingTemplate.ref);
        }}
        onOpenAsNew={() => {
          if (!pendingTemplate) return;
          void session.flush().then(() => nav.startDraft(pendingTemplate.ref, { size: format }));
        }}
      />

      <MarketingAiGeneratePanel
        open={aiGenerateOpen}
        onOpenChange={(open) => {
          if (aiGenerateBusy && !open) return;
          setAiGenerateOpen(open);
        }}
        contentType="video"
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
