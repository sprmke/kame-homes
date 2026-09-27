import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Download,
  LayoutTemplate,
  Loader2,
  Maximize2,
  Minimize2,
  Redo2,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toast } from 'sonner';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import {
  MarketingAiGeneratePanel,
  type MarketingAiGenerateInput,
} from '@/features/dashboard/marketing/components/shared/MarketingAiGeneratePanel';
import { MarketingAutoSaveStatus } from '@/features/dashboard/marketing/components/shared/MarketingAutoSaveStatus';
import { MarketingEditorHistoryControls } from '@/features/dashboard/marketing/components/shared/MarketingEditorHistoryControls';
import { MarketingEditorMobileToolbar } from '@/features/dashboard/marketing/components/shared/MarketingEditorMobileToolbar';
import { MarketingEditorSidebar } from '@/features/dashboard/marketing/components/shared/MarketingEditorSidebar';
import type { MarketingFormatOption } from '@/features/dashboard/marketing/components/shared/MarketingFormatPicker';
import { MarketingPreviewHeader } from '@/features/dashboard/marketing/components/shared/MarketingPreviewHeader';
import { useMarketingStudioHeaderActions } from '@/features/dashboard/marketing/components/shared/MarketingStudioHeaderActions';
import {
  MarketingTemplatesPanel,
  type PresetTemplateItem,
} from '@/features/dashboard/marketing/components/shared/MarketingTemplatesPanel';
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
import { useMarketingAutoSave } from '@/features/dashboard/marketing/hooks/useMarketingAutoSave';
import { useMarketingBookedDates } from '@/features/dashboard/marketing/hooks/useMarketingBookedDates';
import { useMarketingCatalog } from '@/features/dashboard/marketing/hooks/useMarketingCatalog';
import { useMarketingMediaAccent } from '@/features/dashboard/marketing/hooks/useMarketingMediaAccent';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import { useMarketingSidebarLayout } from '@/features/dashboard/marketing/hooks/useMarketingSidebarLayout';
import {
  saveMarketingTemplate,
  useDeleteMarketingTemplate,
  useMarketingTemplates,
  useUpdateMarketingTemplate,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { captureLiveVideoProjectThumbnail } from '@/features/dashboard/marketing/hooks/useMarketingTemplateThumbnails';
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
import { resolveMarketingThumbBinding } from '@/features/dashboard/marketing/lib/marketingDefaultBinding';
import type { MarketingGuestReview } from '@/features/dashboard/marketing/lib/marketingGuestReview';
import {
  waitForMarketingIdle,
  yieldToMainThread,
} from '@/features/dashboard/marketing/lib/marketingIdle';
import { setPersistedPresetThumbnail } from '@/features/dashboard/marketing/lib/marketingPresetThumbnailStore';
import { MARKETING_PUBLISH_META_LABEL } from '@/features/dashboard/marketing/lib/marketingStudioCopy';
import {
  getCachedMarketingThumbnail,
  marketingBindingCacheKey,
  publishMarketingPresetThumbnail,
  savedVideoThumbnailKey,
  videoPresetThumbnailKey,
} from '@/features/dashboard/marketing/lib/marketingTemplateThumbnailCache';
import { withGlobalRenderSlot } from '@/features/dashboard/marketing/lib/marketingThumbnailQueue';
import {
  propertyMediaItems,
  propertyGalleryMediaItems,
} from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import {
  pickBindingMediaAt,
  primaryBindingPhoto,
  resolveDesignBindingMedia,
} from '@/features/dashboard/marketing/lib/propertyBindingMedia';
import {
  renderVideoPresetThumbnail,
  renderVideoProjectThumbnail,
} from '@/features/dashboard/marketing/lib/renderMarketingVideoThumbnail';
import {
  applyGuestReviewToVideoProject,
  isReviewVideoTemplate,
} from '@/features/dashboard/marketing/lib/video/applyGuestReviewToVideoProject';
import { ensureVideoMusicForExport } from '@/features/dashboard/marketing/lib/video/importVideoMusic';
import { resolveAiGeneratedVideoProjectsForAllFormats } from '@/features/dashboard/marketing/lib/video/videoAiProjectBuilder';
import { VIDEO_CATEGORIES } from '@/features/dashboard/marketing/lib/video/videoCategories';
import {
  VIDEO_FORMAT_DIMENSIONS,
  VIDEO_MAX_RELATIVE_ZOOM,
  VIDEO_MIN_RELATIVE_ZOOM,
  VIDEO_PREVIEW_CONTAINER_MIN_HEIGHT_CLASS,
  stepVideoZoomIn,
  stepVideoZoomOut,
} from '@/features/dashboard/marketing/lib/video/videoFormatDimensions';
import { resolveVideoMotionProfile } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import { buildDefaultVideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';
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
import {
  applyVideoAiPreferencesToTokens,
  campaignPaletteFromLookMood,
} from '@/features/dashboard/marketing/lib/videoAiGenerateOptions';
import {
  getVideoCampaignTemplate,
  videoTemplatePalette,
  videoTemplatesForCategory,
} from '@/features/dashboard/marketing/lib/videoCampaignTemplates';
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
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
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
  onPublish?: (payload: VideoExportPayload) => void;
};

export function VideoEditor({ onPublish }: Props) {
  const { property, org } = useOrgContext();
  const propertyId = usePropertyIdParam();
  const { data: orgSettings } = useOrgSettings();
  const catalog = useMarketingCatalog('video');
  const { data: savedTemplates = [] } = useMarketingTemplates('video');
  const updateTemplate = useUpdateMarketingTemplate();
  const deleteTemplate = useDeleteMarketingTemplate();
  const queryClient = useQueryClient();
  const generateTemplate = useGenerateMarketingTemplate();

  const isBelowLg = useIsBelowLg();
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  // Picking a template on mobile drops the user back to the preview.
  const closeMobilePanel = useCallback(() => setMobilePanelOpen(false), []);
  const [category, setCategory] = useState<string>('soft-stay');
  const [selectedId, setSelectedId] = useState('quiet-morning');
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [autoSaveSuspended, setAutoSaveSuspended] = useState(false);
  const [format, setFormat] = useState<VideoFormat>('instagram-story');
  const [exporting, setExporting] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [aiGenerateBusy, setAiGenerateBusy] = useState(false);
  const [selectedReview, setSelectedReview] = useState<MarketingGuestReview | null>(null);
  const { project, setProject, replaceProject, undo, redo, canUndo, canRedo } =
    useVideoProjectHistory();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [showEditorSettings, setShowEditorSettings] = useState(false);
  const [previewMode, setPreviewMode] = useState<VideoPreviewMode>('all');
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewPlayingRef = useRef(previewPlaying);
  previewPlayingRef.current = previewPlaying;
  const [relativeZoom, setRelativeZoom] = useState(100);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [elementFocusRequest, setElementFocusRequest] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const previewWorkspaceRef = useRef<VideoPreviewWorkspaceHandle>(null);
  const { expandSidebar } = useMarketingSidebarLayout('video');

  const handleFitToView = useCallback(() => {
    setRelativeZoom(100);
    previewWorkspaceRef.current?.fitToView();
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    previewWorkspaceRef.current?.toggleFullscreen();
  }, []);

  useVideoProjectHistoryShortcuts({ undo, redo, enabled: Boolean(project) });

  useEnsureDefaultVideoMusic(project, setProject);

  const { data: publicProperty } = usePublicPropertyDetail(property.slug);
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

  const templates = useMemo(
    () => (catalog.isBuiltinCategory(category) ? videoTemplatesForCategory(category) : []),
    [category, catalog]
  );

  const selected = useMemo(
    () => getVideoCampaignTemplate(selectedId) ?? templates[0],
    [selectedId, templates]
  );

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
  const brandColor = (org.settings?.brandColor as string | undefined) ?? '#e8752a';
  const propertyPhotoUrls = useMemo(
    () => propertyImages.filter((item) => item.type === 'image').map((item) => item.url),
    [propertyImages]
  );
  const { accentColor } = useMarketingMediaAccent(propertyPhotoUrls, brandColor);
  const orgLogoUrl =
    orgSettings?.emailLogoUrl?.trim() ||
    org.logoUrl?.trim() ||
    (typeof org.settings?.emailLogoUrl === 'string' ? org.settings.emailLogoUrl.trim() : '') ||
    null;

  const applyTemplate = useCallback(
    (templateId: string, openEditor: boolean) => {
      const template = getVideoCampaignTemplate(templateId) ?? templates[0];
      if (!template) return;

      setAutoSaveSuspended(true);
      setSavedTemplateId(null);
      setSelectedId(template.id);
      setCategory(template.category);
      let next = buildDefaultVideoProject(template.id, template.category, binding, format);
      if (selectedReview && isReviewVideoTemplate(template.id)) {
        next = applyGuestReviewToVideoProject(next, selectedReview, binding);
      }
      replaceProject(next);
      setSelectedSceneId(next.scenes[0]?.id ?? null);
      // New template → always preview the full storyboard, not a leftover clip mode.
      setPreviewMode('all');
      playerRef.current?.pause();
      playerRef.current?.seekTo(0);
      if (openEditor) setShowEditorSettings(true);
      window.setTimeout(() => setAutoSaveSuspended(false), 0);
    },
    [templates, binding, format, replaceProject, selectedReview]
  );

  const applySavedVideoTemplate = useCallback(
    (record: MarketingTemplateRecord) => {
      const savedProject = record.designJson.project as VideoProject | undefined;
      if (!savedProject) {
        toast.error('Could not load template');
        return;
      }

      const savedFormat: VideoFormat =
        (record.aspectPreset as VideoFormat | null) ??
        (typeof record.designJson.format === 'string'
          ? (record.designJson.format as VideoFormat)
          : format);
      const savedCategory =
        (typeof record.designJson.categoryId === 'string' && record.designJson.categoryId) ||
        (typeof record.designJson.category === 'string' && record.designJson.category) ||
        category;

      setAutoSaveSuspended(true);
      if (savedFormat !== format) setFormat(savedFormat);
      if (savedCategory !== category) setCategory(savedCategory);
      setSavedTemplateId(record.id);
      replaceProject({ ...savedProject, format: savedFormat });
      setSelectedSceneId(savedProject.scenes[0]?.id ?? null);
      setPreviewMode('all');
      playerRef.current?.pause();
      playerRef.current?.seekTo(0);
      window.setTimeout(() => setAutoSaveSuspended(false), 0);
    },
    [category, format, replaceProject]
  );

  const propertyMediaKey = useMemo(
    () =>
      binding.propertyMedia?.map((item) => `${item.type}:${item.url}`).join('|') ??
      binding.propertyPhoto ??
      '',
    [binding.propertyMedia, binding.propertyPhoto]
  );

  const projectTemplateSeed = useMemo(
    () => `${selected?.id ?? ''}:${category}:${format}:${propertyMediaKey}`,
    [selected?.id, category, format, propertyMediaKey]
  );

  const projectTemplateSeedRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      playerRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const first = templates[0];
    if (first && !templates.some((template) => template.id === selectedId) && !savedTemplateId) {
      setSelectedId(first.id);
    }
  }, [templates, selectedId, savedTemplateId]);

  useEffect(() => {
    if (savedTemplateId) return;
    if (!selected) return;
    if (projectTemplateSeedRef.current === projectTemplateSeed && project) return;

    projectTemplateSeedRef.current = projectTemplateSeed;
    setAutoSaveSuspended(true);
    const next = buildDefaultVideoProject(selected.id, category, binding, format);
    replaceProject(next);
    setSelectedSceneId(next.scenes[0]?.id ?? null);
    window.setTimeout(() => setAutoSaveSuspended(false), 0);
  }, [
    selected,
    category,
    savedTemplateId,
    binding,
    format,
    projectTemplateSeed,
    project,
    replaceProject,
  ]);

  useEffect(() => {
    setProject((prev) => (prev && prev.format !== format ? { ...prev, format } : prev));
  }, [format]);

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
    const layers = getSceneLayers(selectedScene);
    const layerIds = layers.map((layer) => layer.id);
    setSelectedElementId((current) =>
      current && layerIds.includes(current) ? current : (layerIds[0] ?? null)
    );
  }, [
    selectedScene?.id,
    selectedScene?.kind,
    selectedScene?.layers,
    selectedScene?.hiddenElements,
  ]);

  useEffect(() => {
    if (!showEditorSettings || !project || !playerRef.current) return;
    const frame = sceneSettledPreviewFrame(project, selectedSceneIndex);
    playerRef.current.seekTo(frame);
  }, [showEditorSettings, project, selectedSceneIndex, selectedScene?.id]);

  const templateTypography = useMemo(
    () =>
      resolveVideoTypographyContext(
        project?.templateId ?? selected?.id,
        accentColor,
        project?.palette
      ),
    [project?.templateId, project?.palette, selected?.id, accentColor]
  );

  const motionProfile = useMemo(
    () => resolveVideoMotionProfile(project?.templateId ?? selected?.id),
    [project?.templateId, selected?.id]
  );

  /** Preview, export, and the drag overlay all read the same resolved identity. */
  const inputProps = useMemo<VideoCompositionProps>(() => {
    const resolvedBrandColor = typeof accentColor === 'string' ? accentColor : '#e8752a';
    if (!project) {
      // Placeholder while the project loads — let the composition resolve from its
      // own template id so the skeleton stays internally consistent.
      return {
        project: buildDefaultVideoProject('quiet-morning', 'soft-stay', binding, format),
        brandColor: resolvedBrandColor,
      };
    }
    return {
      project,
      brandColor: resolvedBrandColor,
      typography: templateTypography,
      motionProfile,
    };
  }, [project, accentColor, binding, format, templateTypography, motionProfile]);

  const durationInFrames = useMemo(
    () => (project ? videoProjectDurationInFrames(project) : 150),
    [project]
  );

  const designJson = useMemo(
    () => ({
      templateId: project?.templateId ?? selected?.id ?? selectedId,
      format,
      category,
      categoryId: category,
      binding,
      project,
    }),
    [project, selected?.id, selectedId, format, category, binding]
  );

  const templateDisplayName = useMemo(() => {
    if (savedTemplateId) {
      return savedTemplates.find((record) => record.id === savedTemplateId)?.name ?? 'Video';
    }
    if (selected) {
      return catalog.getTemplateLabel(selected.id, selected.name);
    }
    return 'Video';
  }, [savedTemplateId, savedTemplates, selected, catalog]);

  const videoFingerprint = useMemo(() => {
    if (!project || autoSaveSuspended) return null;
    return marketingContentFingerprint({
      templateId: project.templateId,
      format,
      category,
      project,
    });
  }, [project, format, category, autoSaveSuspended]);

  const {
    status: autoSaveStatus,
    errorMessage: autoSaveError,
    markBaseline,
    saveNow: saveAutoSaveNow,
  } = useMarketingAutoSave({
    contentFingerprint: videoFingerprint,
    templateId: savedTemplateId,
    suspended: autoSaveSuspended,
    onTemplateIdChange: setSavedTemplateId,
    buildSavePayload: () => {
      if (!project) return null;
      return {
        name: templateDisplayName,
        contentType: 'video',
        aspectPreset: format,
        platform: format === 'landscape' ? 'facebook' : 'instagram',
        designJson: {
          templateId: project.templateId,
          format,
          category,
          categoryId: category,
          binding,
          project,
        },
      };
    },
  });

  // Autosave is debounced: only the pending / error window can lose edits.
  useUnsavedChangesGuard({
    isDirty: autoSaveStatus === 'pending' || autoSaveStatus === 'error',
    onSave: saveAutoSaveNow,
  });

  const autoSaveResumeRef = useRef(false);
  useEffect(() => {
    if (autoSaveSuspended) {
      autoSaveResumeRef.current = true;
      return;
    }
    if (autoSaveResumeRef.current) {
      autoSaveResumeRef.current = false;
      window.setTimeout(() => markBaseline(), 0);
    }
  }, [autoSaveSuspended, markBaseline]);

  const handleSavedVideoTemplateCreated = useCallback(
    (record: MarketingTemplateRecord) => {
      setSavedTemplateId(record.id);
      markBaseline();
    },
    [markBaseline]
  );

  const formatOptions = useMemo<MarketingFormatOption[]>(
    () =>
      (Object.keys(VIDEO_FORMAT_DIMENSIONS) as VideoFormat[]).map((key) => ({
        value: key,
        width: VIDEO_FORMAT_DIMENSIONS[key].width,
        height: VIDEO_FORMAT_DIMENSIONS[key].height,
      })),
    []
  );

  const presetTemplates = useMemo<PresetTemplateItem[]>(
    () =>
      VIDEO_CATEGORIES.flatMap((cat) =>
        videoTemplatesForCategory(cat).map((template) => {
          // Same resolver the renderer uses, so the picker can't promise a colour
          // the video never shows.
          const palette = videoTemplatePalette(template.id, accentColor);
          return {
            id: template.id,
            name: template.name,
            category: cat,
            swatchPrimary: palette.accent,
            swatchSecondary: palette.cream,
            badge: VIDEO_FORMAT_DIMENSIONS[format].aspect,
          };
        })
      ),
    [format, accentColor]
  );

  // Background pre-warm order: current category first, so it never sits
  // queued behind off-screen categories the host isn't looking at — the
  // panel's own on-demand queue already covers the current category, this
  // just avoids this loop's (redundant, cache-checked) pass wasting the
  // shared render slot on hidden categories first.
  const formatPresetIdsForWarm = useMemo(() => {
    const current = presetTemplates.filter((template) => template.category === category);
    const rest = presetTemplates.filter((template) => template.category !== category);
    return [...current, ...rest].map((template) => template.id);
  }, [presetTemplates, category]);

  useEffect(() => {
    return registerVideoThumbnailPlaybackPause(
      () => {
        playerRef.current?.pause();
        setPreviewPlaying(false);
      },
      () => previewPlayingRef.current
    );
  }, []);

  const hasProjectForThumbWarm = Boolean(project);

  useEffect(() => {
    if (!hasProjectForThumbWarm) return;

    let cancelled = false;

    void (async () => {
      await waitForMarketingIdle(500);
      if (cancelled) return;

      for (const templateId of formatPresetIdsForWarm) {
        if (cancelled) break;

        const thumbBinding = resolveMarketingThumbBinding(binding);
        const cacheKey = videoPresetThumbnailKey(
          templateId,
          format,
          accentColor,
          marketingBindingCacheKey(thumbBinding)
        );
        if (getCachedMarketingThumbnail(cacheKey)) continue;

        // Shares the same global render slot as the visible template grid's
        // own thumbnail queue — this background pre-warm must never run a
        // heavy Remotion capture at the same time as the one the host is
        // actually looking at, or both stall each other.
        const dataUrl = await withGlobalRenderSlot(() =>
          renderVideoPresetThumbnail(templateId, format, thumbBinding, accentColor)
        );
        if (cancelled || !dataUrl) continue;

        publishMarketingPresetThumbnail(templateId, cacheKey, dataUrl);
        void setPersistedPresetThumbnail(`video:${cacheKey}`, dataUrl);
        await yieldToMainThread();
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally excludes `project` — this only warms sidebar preset thumbnails
    // and must not restart on every edit (autosave changes `project`'s reference
    // on every keystroke, which previously retriggered this full async
    // scan-and-render loop continuously while editing, causing jank). `binding`
    // is a stable useMemo that only changes for real property/photo changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProjectForThumbWarm, format, formatPresetIdsForWarm, accentColor, binding]);

  const handleExportVideo = useCallback(async () => {
    if (!project) throw new Error('No project');

    // Jamendo CDN URLs are CORS-blocked in Remotion web export — cache to Storage first.
    const { music: exportMusic, strippedJamendo } = await ensureVideoMusicForExport(
      project.music,
      propertyId
    );
    if (exportMusic?.url && project.music?.url !== exportMusic.url && !strippedJamendo) {
      setProject((prev) => (prev ? { ...prev, music: exportMusic } : prev));
    }
    if (strippedJamendo) {
      toast.message('Exporting without music. Track could not be cached');
    }

    const exportProps: VideoCompositionProps = {
      ...inputProps,
      project: { ...project, music: exportMusic },
    };

    const blob = await exportVideoToBlob({
      templateId: project.templateId,
      component: CampaignVideoComposition,
      width: dimensions.width,
      height: dimensions.height,
      fps: project.fps,
      durationInFrames,
      inputProps: exportProps,
    });
    const dataUrl = await blobToDataUrl(blob);
    return { blob, dataUrl };
  }, [
    project,
    propertyId,
    dimensions.width,
    dimensions.height,
    durationInFrames,
    inputProps,
    setProject,
  ]);

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
    setExporting(true);
    try {
      const { blob } = await handleExportVideo();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `video-${property.slug}-${selected?.id ?? savedTemplateId ?? 'campaign'}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Video export failed');
    } finally {
      setExporting(false);
    }
  }, [
    handleExportVideo,
    property.slug,
    selected?.id,
    savedTemplateId,
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
      onPublish({
        templateId: selected?.id ?? selectedId,
        project,
        blob,
        dataUrl,
      });
    } catch {
      toast.error('Video export failed');
    } finally {
      setExporting(false);
    }
  }, [
    onPublish,
    project,
    handleExportVideo,
    selected?.id,
    selectedId,
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

      if (options?.mode) {
        setPreviewMode(options.mode);
      }

      const frame = sceneSettledPreviewFrame(project, index);
      playerRef.current?.seekTo(frame);

      if (options?.play) {
        void playerRef.current?.play();
      } else {
        playerRef.current?.pause();
      }
    },
    [project]
  );

  const handleTimelineSelectScene = useCallback(
    (sceneId: string) => {
      seekToSceneId(sceneId, { play: true, mode: 'clip' });
    },
    [seekToSceneId]
  );

  const handleCanvasSelectElement = useCallback(
    (layerId: string, sceneId: string) => {
      playerRef.current?.pause();
      expandSidebar();
      setShowEditorSettings(true);
      setSelectedSceneId(sceneId);
      setSelectedElementId(layerId);
      setElementFocusRequest((count) => count + 1);
    },
    [expandSidebar]
  );

  const handleAiGenerate = useCallback(
    async (input: MarketingAiGenerateInput) => {
      if (!('duration' in input.preferences)) return;

      setAiGenerateBusy(true);
      setAutoSaveSuspended(true);
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
        // "Custom" is a content flavor, not a real sidebar folder — find or create one so the
        // generated video lands somewhere the host can find it again.
        const sidebarCategoryId =
          tokens.category === 'custom'
            ? (catalog.findOrCreateCategoryByLabel('Custom') ?? 'custom')
            : tokens.category;
        const lookPalette = input.preferences.lookMood
          ? campaignPaletteFromLookMood(input.preferences.lookMood)
          : undefined;
        const variants = resolveAiGeneratedVideoProjectsForAllFormats(tokens, binding, {
          includePropertyPhoto: input.includeContext.propertyPhoto,
          orgLogoUrl,
          includeOrgLogo: input.includeContext.orgLogo ?? true,
          includeCta: input.includeContext.cta ?? true,
          includePropertyName: input.includeContext.propertyName ?? true,
          palette: lookPalette,
        });

        const aiGenerationId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `ai-${Date.now()}`;

        const savedRecords: MarketingTemplateRecord[] = [];
        let failedCount = 0;
        for (const variant of variants) {
          try {
            const thumbnailDataUrl = await renderVideoProjectThumbnail(
              variant.project,
              accentColor
            );
            const record = await saveMarketingTemplate(propertyId, {
              name: tokens.label,
              contentType: 'video',
              aspectPreset: variant.format,
              platform: variant.format === 'landscape' ? 'facebook' : 'instagram',
              designJson: {
                templateId: variant.project.templateId,
                format: variant.format,
                category: sidebarCategoryId,
                categoryId: sidebarCategoryId,
                binding,
                project: variant.project,
                aiGenerated: true,
                aiGenerationId,
                aiTokens: tokens,
                ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
              },
            });
            savedRecords.push(record);
            if (thumbnailDataUrl) {
              publishMarketingPresetThumbnail(
                record.id,
                savedVideoThumbnailKey(record.id, record.updatedAt),
                thumbnailDataUrl
              );
            }
          } catch {
            failedCount += 1;
          }
        }

        void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });

        if (savedRecords.length === 0) {
          throw new Error('Could not save generated videos');
        }

        const current =
          savedRecords.find((record) => record.aspectPreset === format) ?? savedRecords[0];
        const currentVariant = variants.find((variant) => variant.format === current?.aspectPreset);

        if (current && currentVariant) {
          setSavedTemplateId(current.id);
          setCategory(sidebarCategoryId);
          replaceProject(currentVariant.project);
          setSelectedSceneId(currentVariant.project.scenes[0]?.id ?? null);
          setPreviewMode('all');
          playerRef.current?.pause();
          playerRef.current?.seekTo(0);
          markBaseline();
        }

        setAiGenerateOpen(false);
        if (failedCount > 0) {
          toast.warning(`Saved ${savedRecords.length} of 3 formats. Retry Generate for the rest`);
        } else {
          toast.success('Custom videos added for Story, Post, and Landscape');
        }
      } catch (error) {
        if (aiSucceeded) {
          toast.error((error as Error).message || 'Could not save generated videos');
        }
      } finally {
        setAutoSaveSuspended(false);
        setAiGenerateBusy(false);
      }
    },
    [
      binding,
      accentColor,
      catalog,
      format,
      generateTemplate,
      markBaseline,
      orgLogoUrl,
      propertyId,
      publicProperty?.amenities,
      queryClient,
      replaceProject,
    ]
  );

  const handleResetProject = useCallback(() => {
    const templateId = project?.templateId ?? selected?.id ?? selectedId;
    const template = getVideoCampaignTemplate(templateId);
    const resetCategory = template?.category ?? category;
    if (template?.category) setCategory(template.category);
    setAutoSaveSuspended(true);
    const next = buildDefaultVideoProject(templateId, resetCategory, binding, format);
    replaceProject(next);
    setSelectedSceneId(next.scenes[0]?.id ?? null);
    setSelectedElementId(null);
    setPreviewMode('all');
    playerRef.current?.pause();
    playerRef.current?.seekTo(0);
    window.setTimeout(() => setAutoSaveSuspended(false), 0);
    toast.success('Reset to default');
  }, [project?.templateId, selected?.id, selectedId, category, binding, format, replaceProject]);

  const handleAddScene = useCallback(() => {
    if (!project) return;
    const media = binding.propertyMedia ?? [];
    const { url, mediaType } = pickBindingMediaAt(media, project.scenes.length);
    const next = addPhotoScene(project, url, mediaType);
    setProject(next);
    const added = next.scenes[next.scenes.length - 1];
    if (added) {
      seekToSceneId(added.id, { play: true, mode: 'clip' });
      setShowEditorSettings(true);
    }
  }, [project, binding.propertyMedia, seekToSceneId]);

  const handleRenameTemplate = async (name: string) => {
    if (savedTemplateId) {
      await updateTemplate.mutateAsync({ id: savedTemplateId, name });
      return;
    }
    if (selected) {
      catalog.renamePresetTemplate(selected.id, name);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!savedTemplateId) return;
    await deleteTemplate.mutateAsync(savedTemplateId);
    setSavedTemplateId(null);
    setShowEditorSettings(false);
    const first = templates[0];
    if (first) {
      applyTemplate(first.id, false);
    }
  };

  const compositionKey = useMemo(
    () =>
      project
        ? `${format}-${durationInFrames}-${project.scenes.map((scene) => scene.id).join('-')}`
        : 'empty',
    [project, format, durationInFrames]
  );

  const hasProject = Boolean(project);
  const builderActions = useMemo(
    () => (
      <>
        <MarketingAutoSaveStatus status={autoSaveStatus} errorMessage={autoSaveError} />
        {/* Below lg these move into MarketingEditorMobileToolbar. */}
        {isBelowLg ? null : (
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
                  Download MP4
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
      exporting,
      hasProject,
      onPublish,
      canEditContent,
      canPublish,
      handleDownload,
      handlePublish,
    ]
  );

  useMarketingStudioHeaderActions(builderActions);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <MarketingEditorSidebar
        layoutKey="video"
        mobileVariant="sheet"
        mobileOpen={mobilePanelOpen}
        onMobileOpenChange={setMobilePanelOpen}
        mobileTitle={showEditorSettings ? templateDisplayName || 'Scene settings' : 'Templates'}
        header={
          showEditorSettings ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-[44px] gap-2"
                onClick={() => setShowEditorSettings(false)}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Templates
              </Button>
              <span className="truncate text-sm font-medium">{templateDisplayName}</span>
            </div>
          ) : (
            <p className="text-sm font-medium">Templates</p>
          )
        }
      >
        {showEditorSettings && project && selectedScene ? (
          <VideoEditorSettings
            project={project}
            selectedScene={selectedScene}
            selectedSceneIndex={selectedSceneIndex}
            propertyImages={propertyImages}
            templateTypography={templateTypography}
            logoUrl={orgLogoUrl}
            templateName={templateDisplayName}
            savedTemplateId={savedTemplateId}
            onRenameSavedTemplate={handleRenameTemplate}
            onDeleteSavedTemplate={savedTemplateId ? handleDeleteTemplate : undefined}
            onRenameDisplayName={(name) => {
              if (selected) catalog.renamePresetTemplate(selected.id, name);
            }}
            onProjectChange={setProject}
            binding={binding}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
            elementFocusRequest={elementFocusRequest}
          />
        ) : (
          <MarketingTemplatesPanel
            tab="video"
            contentType="video"
            formatOptions={formatOptions}
            format={format}
            onFormatChange={(value) => setFormat(value as VideoFormat)}
            category={category}
            onCategoryChange={setCategory}
            presetTemplates={presetTemplates}
            selectedId={selectedId}
            onSelectPreset={(templateId) => {
              applyTemplate(templateId, false);
              closeMobilePanel();
            }}
            onCustomizePreset={(templateId) => applyTemplate(templateId, true)}
            savedRecords={savedTemplates}
            selectedSavedId={
              savedTemplateId && savedTemplates.some((record) => record.id === savedTemplateId)
                ? savedTemplateId
                : null
            }
            onSelectSaved={(record) => {
              applySavedVideoTemplate(record);
              closeMobilePanel();
            }}
            onSavedTemplate={handleSavedVideoTemplateCreated}
            designJsonForSave={designJson}
            aspectPreset={format}
            platform={format === 'landscape' ? 'facebook' : 'instagram'}
            videoTemplateMenus="minimal"
            brandColor={accentColor}
            binding={binding}
            onOpenAiGenerate={() => setAiGenerateOpen(true)}
            aiGenerateBusy={aiGenerateBusy || generateTemplate.isPending}
            selectedReviewId={selectedReview?.id ?? null}
            onSelectReview={(review) => {
              setSelectedReview(review);
              setCategory('reviews');
              setProject((prev) => {
                if (!prev) return prev;
                if (!isReviewVideoTemplate(prev.templateId)) {
                  const next = buildDefaultVideoProject('guest-love', 'reviews', binding, format);
                  setSelectedId(next.templateId);
                  return applyGuestReviewToVideoProject(next, review, binding);
                }
                return applyGuestReviewToVideoProject(prev, review, binding);
              });
              closeMobilePanel();
            }}
            captureSaveThumbnail={async () => {
              if (!project) return null;
              return captureLiveVideoProjectThumbnail(project, accentColor);
            }}
          />
        )}
      </MarketingEditorSidebar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain max-lg:pb-1.5">
        {project ? (
          <>
            <div
              className={cn(
                'flex min-h-0 flex-1 flex-col overflow-hidden',
                VIDEO_PREVIEW_CONTAINER_MIN_HEIGHT_CLASS
              )}
            >
              <MarketingPreviewHeader
                leading={
                  isBelowLg ? undefined : (
                    <MarketingEditorHistoryControls
                      canUndo={canUndo}
                      canRedo={canRedo}
                      onUndo={undo}
                      onRedo={redo}
                      onReset={handleResetProject}
                    />
                  )
                }
                actions={
                  isBelowLg ? undefined : (
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
                          <TooltipContent>Zoom Out</TooltipContent>
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
                          <TooltipContent>Zoom In</TooltipContent>
                        </Tooltip>
                        <div className="bg-border mx-1 hidden h-4 w-px sm:block" />
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
                          <TooltipContent>Fit to View</TooltipContent>
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
                      </div>
                    </TooltipProvider>
                  )
                }
              />
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
          <div
            className="flex min-h-0 flex-1 flex-col"
            aria-busy="true"
            aria-label="Loading video editor"
          >
            {/* Inline to avoid circular import; mirrors MarketingStudioSkeleton canvas */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="bg-muted h-8 w-32 animate-pulse rounded-md" />
                <div className="flex gap-2">
                  <div className="bg-muted size-8 animate-pulse rounded-md" />
                  <div className="bg-muted size-8 animate-pulse rounded-md" />
                  <div className="bg-muted h-8 w-20 animate-pulse rounded-md" />
                </div>
              </div>
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
          </div>
        )}
      </div>

      {/* Mobile editor dock (max-lg) — Templates/Scene panel toggle + zoom + overflow.
          Hidden while the OS fullscreen preview is active. */}
      <MarketingEditorMobileToolbar
        panelLabel={showEditorSettings ? 'Scene' : 'Templates'}
        panelIcon={LayoutTemplate}
        panelOpen={mobilePanelOpen}
        onTogglePanel={() => setMobilePanelOpen((open) => !open)}
        controls={
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 min-h-[44px] min-w-[44px]"
              aria-label="Zoom out"
              onClick={() => setRelativeZoom((prev) => stepVideoZoomOut(prev))}
              disabled={relativeZoom <= VIDEO_MIN_RELATIVE_ZOOM}
            >
              <ZoomOut className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 min-h-[44px] min-w-[44px]"
              aria-label="Zoom in"
              onClick={() => setRelativeZoom((prev) => stepVideoZoomIn(prev))}
              disabled={relativeZoom >= VIDEO_MAX_RELATIVE_ZOOM}
            >
              <ZoomIn className="size-4" aria-hidden />
            </Button>
          </>
        }
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
            label: 'Reset project',
            icon: <RotateCcw className="size-5" aria-hidden />,
            onSelect: handleResetProject,
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

      <MarketingAiGeneratePanel
        open={aiGenerateOpen}
        onOpenChange={(open) => {
          if (aiGenerateBusy && !open) return;
          setAiGenerateOpen(open);
        }}
        contentType="video"
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
