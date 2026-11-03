import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Download,
  Frame,
  LayoutTemplate,
  Loader2,
  Maximize2,
  Minimize2,
  Music2,
  Redo2,
  RotateCcw,
  Scaling,
  Send,
  SlidersHorizontal,
  Sparkles,
  Star,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toast } from 'sonner';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import { MarketingTemplateBrowser } from '@/features/dashboard/marketing/components/library/MarketingTemplateBrowser';
import type { MarketingTemplatePick } from '@/features/dashboard/marketing/components/library/MarketingTemplateBrowser';
import { MarketingMediaLibrary } from '@/features/dashboard/marketing/components/media-library/MarketingMediaLibrary';
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
import type { InspectorActions } from '@/features/dashboard/marketing/components/video-editor/v2/inspector/InspectorShared';
import {
  VideoInspectorV2,
  inspectorTitle,
} from '@/features/dashboard/marketing/components/video-editor/v2/inspector/VideoInspectorV2';
import { VideoTimelineV2 } from '@/features/dashboard/marketing/components/video-editor/v2/timeline/VideoTimelineV2';
import { useVideoEditorShortcutsV2 } from '@/features/dashboard/marketing/components/video-editor/v2/useVideoEditorShortcutsV2';
import { useVideoTransportV2 } from '@/features/dashboard/marketing/components/video-editor/v2/useVideoTransportV2';
import {
  VideoExportDialog,
  type VideoExportState,
} from '@/features/dashboard/marketing/components/video-editor/v2/VideoExportDialog';
import { VideoMobileActionBar } from '@/features/dashboard/marketing/components/video-editor/v2/VideoMobileActionBar';
import {
  VideoPreviewV2,
  type VideoPreviewV2Handle,
} from '@/features/dashboard/marketing/components/video-editor/v2/VideoPreviewV2';
import {
  useResolveDefaultVideoMusic,
  type SetMusic,
} from '@/features/dashboard/marketing/hooks/useEnsureDefaultVideoMusic';
import { useGenerateMarketingTemplate } from '@/features/dashboard/marketing/hooks/useGenerateMarketingTemplate';
import { useMarketingBookedDates } from '@/features/dashboard/marketing/hooks/useMarketingBookedDates';
import { useMarketingDesignSession } from '@/features/dashboard/marketing/hooks/useMarketingDesignSession';
import { useDuplicateMarketingItem } from '@/features/dashboard/marketing/hooks/useMarketingLibrary';
import { useMarketingMediaLibrary } from '@/features/dashboard/marketing/hooks/useMarketingMedia';
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
import { blobToDataUrl } from '@/features/dashboard/marketing/lib/exportVideoMedia';
import { exportVideoV2, VideoExportError } from '@/features/dashboard/marketing/lib/exportVideoV2';
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
import { captureVideoProjectThumbnailV2 } from '@/features/dashboard/marketing/lib/marketingPresetThumbs';
import {
  holdMarketingRenders,
  releaseMarketingRenders,
} from '@/features/dashboard/marketing/lib/marketingRenderGate';
import { MARKETING_PUBLISH_META_LABEL } from '@/features/dashboard/marketing/lib/marketingStudioCopy';
import {
  formatTemplateRef,
  type MarketingTemplateRef,
} from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import { fetchMarketingMediaPage } from '@/features/dashboard/marketing/lib/media/marketingMediaApi';
import type { MediaDragPayload } from '@/features/dashboard/marketing/lib/media/mediaDrag';
import { hasMediaDrag, readMediaDrag } from '@/features/dashboard/marketing/lib/media/mediaDrag';
import {
  propertyGalleryMediaItems,
  propertyMediaItems,
} from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import {
  primaryBindingPhoto,
  resolveDesignBindingMedia,
} from '@/features/dashboard/marketing/lib/propertyBindingMedia';
import { marketingThemeHash } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { themeStampForSave } from '@/features/dashboard/marketing/lib/theme/marketingThemeItems';
import {
  bindingWithLibraryClips,
  libraryClipsForAi,
} from '@/features/dashboard/marketing/lib/video/aiLibraryMedia';
import { isReviewVideoTemplate } from '@/features/dashboard/marketing/lib/video/applyGuestReviewToVideoProject';
import { applyGuestReviewToVideoProjectV2 } from '@/features/dashboard/marketing/lib/video/v2/applyGuestReviewToVideoProjectV2';
import { applyCanvasPatch } from '@/features/dashboard/marketing/lib/video/v2/canvasPatch';
import {
  clipboardFor,
  duplicateItems,
  itemLabel,
  layerItemFromPreset,
  replaceItemMedia,
  insertPayload,
  TEXT_PRESETS,
  textPresetById,
  type TextPresetId,
} from '@/features/dashboard/marketing/lib/video/v2/editorCommands';
import {
  cacheJamendoAudioForExport,
  remapAudioUrls,
} from '@/features/dashboard/marketing/lib/video/v2/exportAudio';
import { migrateVideoProjectV1 } from '@/features/dashboard/marketing/lib/video/v2/migrateVideoProjectV1';
import {
  CLAMPED_NOTICE,
  noticeForFailure,
} from '@/features/dashboard/marketing/lib/video/v2/opNotices';
import {
  buildDefaultProjectV2,
  loadProjectV2,
  withResolvedMusic,
  type LoadedProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/projectLoad';
import type { ShortcutCommand } from '@/features/dashboard/marketing/lib/video/v2/shortcuts';
import {
  deleteItems,
  findItem,
  insertItem,
  moveItem,
  pasteItems,
  setPlaybackRate,
  setTransition,
  splitItems,
  trimItem,
  updateItem,
  type ClipboardEntry,
  type OpResult,
} from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  stepZoom,
} from '@/features/dashboard/marketing/lib/video/v2/timelineScale';
import {
  allItems,
  itemEnd,
  itemsActiveAt,
  projectDurationInFrames,
} from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  isAudioItem,
  isMediaItem,
  type VideoItem,
  type VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { resolveAiGeneratedVideoProjectsForAllFormats } from '@/features/dashboard/marketing/lib/video/videoAiProjectBuilder';
import {
  VIDEO_FORMAT_DIMENSIONS,
  VIDEO_MAX_RELATIVE_ZOOM,
  VIDEO_MIN_RELATIVE_ZOOM,
  stepVideoZoomIn,
  stepVideoZoomOut,
} from '@/features/dashboard/marketing/lib/video/videoFormatDimensions';
import { resolveVideoMotionProfile } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import type {
  VideoFormat,
  VideoProjectMusic,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
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

/** What the Publish flow needs from an export. */
type VideoExportPayloadV2 = {
  templateId: string;
  project: VideoProjectV2;
  blob: Blob;
  dataUrl: string;
};

type Props = {
  document: MarketingEditorDocument;
  nav: MarketingEditorNav;
  onPublish?: (payload: VideoExportPayloadV2) => void;
};

const DEFAULT_VIDEO_TEMPLATE = 'quiet-morning';
const VIDEO_FORMATS = new Set<string>(Object.keys(VIDEO_FORMAT_DIMENSIONS));
/** Below this width the library starts closed so the preview and timeline keep their room. */
const WIDE_LAYOUT_PX = 1536;
const PREVIEW_MIN_HEIGHT_CLASS = 'min-h-[220px] lg:min-h-[280px]';
const EDITOR_PANELS = new Set(['media', 'text', 'templates', 'reviews']);

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

/** Project stored on a saved design or template row (v1 rows are upgraded on open). */
function loadedFromRecord(
  record: MarketingTemplateRecord,
  binding: DesignBinding,
  format: VideoFormat
): LoadedProjectV2 {
  const json = record.designJson ?? {};
  const templateId = typeof json.templateId === 'string' ? json.templateId : DEFAULT_VIDEO_TEMPLATE;
  const category =
    (typeof json.categoryId === 'string' && json.categoryId) ||
    (typeof json.category === 'string' && json.category) ||
    getVideoCampaignTemplate(templateId)?.category ||
    'soft-stay';
  const loaded = loadProjectV2(json.project ?? json, templateId, category, binding, format);
  return { ...loaded, project: { ...loaded.project, format } };
}

export function VideoEditorV2({ document, nav, onPublish }: Props) {
  const { property, org } = useOrgContext();
  const propertyId = usePropertyIdParam();
  const { data: orgSettings } = useOrgSettings();
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

  const [ready, setReady] = useState(false);
  const [exportState, setExportState] = useState<VideoExportState | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
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
  } = useVideoProjectHistory<VideoProjectV2>();
  const projectRef = useRef<VideoProjectV2 | null>(null);
  projectRef.current = project;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [railPanel, setRailPanel] = useState<string | null>(
    isBelowLg || (typeof window !== 'undefined' && window.innerWidth < WIDE_LAYOUT_PX)
      ? null
      : 'media'
  );
  const [inspectorOpen, setInspectorOpen] = useState(!isBelowLg);
  const [mobilePanel, setMobilePanel] = useState<string | null>(null);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<
    (MarketingTemplatePick & { name: string }) | null
  >(null);
  const [relativeZoom, setRelativeZoom] = useState(100);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [pendingMusic, setPendingMusic] = useState<VideoProjectMusic | undefined>(undefined);
  const pendingMusicRef = useRef(pendingMusic);
  const [playerInstance, setPlayerInstance] = useState<PlayerRef | null>(null);
  const playerRef = useRef<PlayerRef>(null);
  const previewRef = useRef<VideoPreviewV2Handle>(null);
  const clipboardRef = useRef<ClipboardEntry[]>([]);

  const format: VideoFormat = project?.format ?? initialFormat;
  const durationInFrames = useMemo(
    () => (project ? projectDurationInFrames(project) : 150),
    [project]
  );
  // Only a format change rebuilds the Player; edits update it in place so the playhead stays put.
  const compositionKey = format;
  const transport = useVideoTransportV2({
    playerRef,
    playerInstance,
    durationInFrames,
    compositionKey,
  });
  const { currentFrame, isPlaying } = transport;
  const currentFrameRef = useRef(currentFrame);
  currentFrameRef.current = currentFrame;

  useVideoProjectHistoryShortcuts({ undo, redo, enabled: Boolean(project) });

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

  const propertyPhotoUrls = useMemo(
    () => propertyImages.filter((item) => item.type === 'image').map((item) => item.url),
    [propertyImages]
  );
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

  // ── Default music hand-off ─────────────────────────────────────────────
  const setMusic = useCallback<SetMusic>(
    (updater) => {
      const prev = pendingMusicRef.current;
      const next = updater(prev);
      if (next === prev) return;
      pendingMusicRef.current = next;
      setPendingMusic(next);
      // First file adds the clip; the cached copy later only updates it if it is still there.
      if (next?.url) {
        amendProject((p) => (p ? withResolvedMusic(p, next, { addIfMissing: !prev?.url }) : p));
      }
    },
    [amendProject]
  );
  useResolveDefaultVideoMusic(pendingMusic, ready && Boolean(pendingMusic), setMusic);

  const loadProject = useCallback(
    (loaded: LoadedProjectV2, options: { asEdit?: boolean } = {}) => {
      pendingMusicRef.current = loaded.pendingMusic;
      setPendingMusic(loaded.pendingMusic);
      if (options.asEdit) setProject(loaded.project);
      else replaceProject(loaded.project);
      setSelectedIds([]);
      setReplaceTargetId(null);
      playerRef.current?.pause();
      playerRef.current?.seekTo(0);
    },
    [replaceProject, setProject]
  );

  // ── Initial document ────────────────────────────────────────────────────
  const bindingReady = !propertyLoading || propertyError || Boolean(publicProperty);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (document.mode === 'saved') {
      loadProject(loadedFromRecord(document.record, binding, initialFormat));
    } else if (document.templateRecord) {
      loadProject(loadedFromRecord(document.templateRecord, binding, initialFormat));
    } else {
      if (!bindingReady) return;
      const templateId =
        document.from?.kind === 'preset' ? document.from.id : DEFAULT_VIDEO_TEMPLATE;
      const template = getVideoCampaignTemplate(templateId);
      loadProject(
        buildDefaultProjectV2(
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
      exportAbortRef.current?.abort();
    };
  }, []);

  // Heavy card renders wait while the host plays the preview.
  useEffect(() => {
    if (!isPlaying) return;
    holdMarketingRenders();
    return () => releaseMarketingRenders();
  }, [isPlaying]);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  useEffect(() => {
    return registerVideoThumbnailPlaybackPause(
      () => playerRef.current?.pause(),
      () => isPlayingRef.current
    );
  }, []);

  // Drop selections that no longer exist (deleted, undone, merged).
  useEffect(() => {
    if (!project) return;
    setSelectedIds((current) => {
      const next = current.filter((id) => findItem(project, id));
      return next.length === current.length ? current : next;
    });
    setReplaceTargetId((current) => (current && findItem(project, current) ? current : null));
  }, [project]);

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

  const exportInputProps = useMemo(
    () => ({
      brandColor: accentColor,
      theme: themeTokens,
      typography: templateTypography,
      motionProfile,
    }),
    [accentColor, themeTokens, templateTypography, motionProfile]
  );
  const inputProps = useMemo(
    () => (project ? { ...exportInputProps, project } : null),
    [exportInputProps, project]
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
    const current = projectRef.current;
    if (!current) return null;
    return captureVideoProjectThumbnailV2(current, accentColor, themeTokens);
  }, [accentColor, themeTokens]);

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
      loadProject(loadedFromRecord(fresh, binding, freshFormat));
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

  // ── Editing ─────────────────────────────────────────────────────────────
  /** Store a new project value (one undo step, coalesced for rapid edits). */
  const commit = useCallback(
    (next: VideoProjectV2) => {
      projectRef.current = next;
      setProject(next);
    },
    [setProject]
  );

  /** Run an op on the latest project. Refusals and cut-to-fit results tell the host why. */
  const apply = useCallback(
    (build: (current: VideoProjectV2) => OpResult) => {
      const current = projectRef.current;
      if (!current || !canEditContent) return;
      const result = build(current);
      if (!result.ok) {
        const notice = noticeForFailure(result.reason);
        if (notice) toast.message(notice);
        return;
      }
      if (result.project !== current) commit(result.project);
      if (result.clamped) toast.message(CLAMPED_NOTICE);
      if (result.itemIds?.length) setSelectedIds(result.itemIds);
    },
    [canEditContent, commit]
  );

  const changeProject = useCallback(
    (updater: (current: VideoProjectV2) => VideoProjectV2) => {
      const current = projectRef.current;
      if (!current || !canEditContent) return;
      const next = updater(current);
      if (next !== current) commit(next);
    },
    [canEditContent, commit]
  );

  const openEditPanel = useCallback(() => {
    if (isBelowLg) setMobilePanel('edit');
    else setInspectorOpen(true);
  }, [isBelowLg]);

  const openRailPanel = useCallback(
    (key: string) => {
      if (isBelowLg) setMobilePanel(key);
      else setRailPanel(key);
    },
    [isBelowLg]
  );

  const handleSelect = useCallback(
    (ids: string[]) => {
      setSelectedIds(ids);
      if (ids.length > 0 && !isBelowLg) setInspectorOpen(true);
    },
    [isBelowLg]
  );

  const handleCanvasSelect = useCallback(
    (ids: string[]) => {
      playerRef.current?.pause();
      handleSelect(ids);
    },
    [handleSelect]
  );

  const handleDropMedia = useCallback(
    (
      payload: MediaDragPayload,
      target: { frame: number; trackId: string | null; onMain: boolean }
    ) => apply((current) => insertPayload(current, payload, target)),
    [apply]
  );

  const handlePickMedia = useCallback(
    (payload: MediaDragPayload) => {
      const current = projectRef.current;
      if (!current) return;
      if (replaceTargetId) {
        const loc = findItem(current, replaceTargetId);
        if (loc && (isMediaItem(loc.item) || isAudioItem(loc.item))) {
          const wantsAudio = isAudioItem(loc.item);
          if (wantsAudio !== (payload.kind === 'audio')) {
            toast.message(wantsAudio ? 'Pick an audio file.' : 'Pick a photo or video.');
            return;
          }
          const replacement = replaceItemMedia(loc.item, payload, current.fps);
          apply((p) => updateItem(p, replaceTargetId, () => replacement));
          // Replacing can shorten a video to its new length; keep the playhead valid.
          setReplaceTargetId(null);
          return;
        }
        setReplaceTargetId(null);
      }
      handleDropMedia(payload, {
        frame: currentFrameRef.current,
        trackId: null,
        onMain: payload.kind !== 'audio',
      });
      if (isBelowLg) setMobilePanel(null);
    },
    [apply, handleDropMedia, isBelowLg, replaceTargetId]
  );

  const handleAddText = useCallback(
    (presetId: TextPresetId) => {
      const item = layerItemFromPreset(textPresetById(presetId), {
        from: currentFrameRef.current,
      });
      apply((current) =>
        insertItem(current, item, { kind: 'text', atFrame: currentFrameRef.current })
      );
      if (isBelowLg) setMobilePanel(null);
      openEditPanel();
    },
    [apply, isBelowLg, openEditPanel]
  );

  const startReplace = useCallback(
    (itemId: string) => {
      setReplaceTargetId(itemId);
      openRailPanel('media');
    },
    [openRailPanel]
  );

  const handleCommand = useCallback(
    (command: ShortcutCommand) => {
      const current = projectRef.current;
      if (!current) return;
      const frame = currentFrameRef.current;
      switch (command.type) {
        case 'toggle-play':
          transport.togglePlay();
          return;
        case 'step':
          transport.pause();
          transport.seek(frame + command.frames);
          return;
        case 'deselect':
          setSelectedIds([]);
          return;
        case 'select-all': {
          const first = selectedIds[0] ? findItem(current, selectedIds[0]) : null;
          const track = first?.track ?? current.tracks[0];
          setSelectedIds(track ? track.items.map((item) => item.id) : []);
          return;
        }
        case 'copy':
          clipboardRef.current = clipboardFor(current, selectedIds);
          if (clipboardRef.current.length > 0) toast.message('Copied');
          return;
        case 'paste':
          if (clipboardRef.current.length > 0) {
            apply((p) => pasteItems(p, clipboardRef.current, frame));
          }
          return;
        case 'duplicate':
          if (selectedIds.length > 0) apply((p) => duplicateItems(p, selectedIds));
          return;
        case 'delete':
          if (selectedIds.length > 0) {
            apply((p) => deleteItems(p, selectedIds, { ripple: command.ripple }));
          }
          return;
        case 'split': {
          const ids =
            selectedIds.length > 0
              ? selectedIds
              : itemsActiveAt(current, frame)
                  .filter(({ track }) => !track.locked)
                  .map(({ item }) => item.id);
          if (ids.length > 0) apply((p) => splitItems(p, ids, frame));
          return;
        }
      }
    },
    [apply, selectedIds, transport]
  );
  useVideoEditorShortcutsV2({
    enabled: Boolean(project) && canEditContent,
    fps: project?.fps ?? 30,
    onCommand: handleCommand,
  });

  const inspectorActions = useMemo<InspectorActions | null>(
    () =>
      project
        ? {
            project,
            typography: templateTypography,
            update: (id, fn) => apply((p) => updateItem(p, id, fn)),
            trim: (id, edge, frame) => apply((p) => trimItem(p, id, edge, frame)),
            moveTo: (id, frame) => apply((p) => moveItem(p, id, { frame })),
            setRate: (id, rate) => apply((p) => setPlaybackRate(p, id, rate)),
            setTransition: (id, type) => apply((p) => setTransition(p, id, type)),
            replaceMedia: startReplace,
            remove: (id) => apply((p) => deleteItems(p, [id])),
          }
        : null,
    [project, templateTypography, apply, startReplace]
  );

  // Waveforms come from the audio library's saved peaks.
  const hasLibraryAudio = useMemo(
    () => (project ? allItems(project).some((i) => isAudioItem(i) && i.media.assetId) : false),
    [project]
  );
  const audioLibrary = useMarketingMediaLibrary({ kind: 'audio' }, hasLibraryAudio);
  const peaksByAsset = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const page of audioLibrary.data?.pages ?? []) {
      for (const asset of page.items) if (asset.peaks) map.set(asset.id, asset.peaks);
    }
    return map;
  }, [audioLibrary.data]);
  const peaksFor = useCallback(
    (item: VideoItem) =>
      isAudioItem(item) && item.media.assetId
        ? (peaksByAsset.get(item.media.assetId) ?? null)
        : null,
    [peaksByAsset]
  );

  // ── Export ──────────────────────────────────────────────────────────────
  const runExport = useCallback(async (): Promise<Blob | null> => {
    const current = projectRef.current;
    if (!current) return null;
    playerRef.current?.pause();
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExportState({ phase: 'preparing', progress: 0 });
    try {
      const audio = await cacheJamendoAudioForExport(current, propertyId);
      if (controller.signal.aborted) throw new VideoExportError('cancelled', 'Export cancelled');
      if (audio.cached.size > 0) {
        // Keep the Storage copy on the saved project so the next export skips the download.
        amendProject((p) => (p ? remapAudioUrls(p, audio.cached) : p));
      }
      if (audio.dropped > 0)
        toast.message('Exporting without music. The track could not be cached.');
      return await exportVideoV2({
        project: audio.project,
        inputProps: exportInputProps,
        signal: controller.signal,
        onPhase: (phase) => setExportState({ phase, progress: 0 }),
        onProgress: (progress) => setExportState({ phase: 'rendering', progress }),
      });
    } catch (error) {
      if (error instanceof VideoExportError && error.code === 'cancelled') {
        toast.message('Export cancelled');
      } else {
        toast.error(error instanceof VideoExportError ? error.message : 'Video export failed');
      }
      return null;
    } finally {
      exportAbortRef.current = null;
      setExportState(null);
    }
  }, [amendProject, exportInputProps, propertyId]);

  const { canUse: canUseMarketingStudio, isLoading: marketingStudioLoading } =
    useFeatureGate('marketingStudio');
  const { canUse: canPublishToMeta, isLoading: publishEntitlementsLoading } = useFeatureGate(
    'marketingPublishLimitPerGroup'
  );
  const { open: openUpgradeModal } = useUpgradeModal();
  const exporting = exportState !== null;

  const handleDownload = useCallback(async () => {
    if (!canEditContent || exporting) return;
    if (!canUseMarketingStudio) {
      if (!marketingStudioLoading) openUpgradeModal('marketingStudio');
      return;
    }
    const blob = await runExport();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `video-${property.slug}-${slug(session.name) || 'campaign'}.mp4`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    canEditContent,
    canUseMarketingStudio,
    exporting,
    marketingStudioLoading,
    openUpgradeModal,
    property.slug,
    runExport,
    session.name,
  ]);

  const handlePublish = useCallback(async () => {
    if (!canPublish || exporting) return;
    if (!canPublishToMeta) {
      if (!publishEntitlementsLoading) openUpgradeModal('marketingPublishLimitPerGroup');
      return;
    }
    const current = projectRef.current;
    if (!onPublish || !current) return;
    const blob = await runExport();
    if (!blob) return;
    try {
      onPublish({
        templateId: current.templateId,
        project: current,
        blob,
        dataUrl: await blobToDataUrl(blob),
      });
    } catch {
      toast.error('Video export failed');
    }
  }, [
    canPublish,
    canPublishToMeta,
    exporting,
    onPublish,
    openUpgradeModal,
    publishEntitlementsLoading,
    runExport,
  ]);

  // ── Templates (Replace / Open as new) ──────────────────────────────────
  const loadedFromPick = useCallback(
    async (ref: MarketingTemplateRef): Promise<LoadedProjectV2 | null> => {
      if (ref.kind === 'template') {
        const templateRecord = await fetchMarketingTemplate(propertyId, ref.id);
        return loadedFromRecord(templateRecord, binding, format);
      }
      const templateId = ref.kind === 'preset' ? ref.id : DEFAULT_VIDEO_TEMPLATE;
      const template = getVideoCampaignTemplate(templateId);
      if (!template) return null;
      const loaded = buildDefaultProjectV2(template.id, template.category, binding, format);
      if (selectedReview && isReviewVideoTemplate(template.id)) {
        return {
          ...loaded,
          project: applyGuestReviewToVideoProjectV2(loaded.project, selectedReview, binding),
        };
      }
      return loaded;
    },
    [binding, format, propertyId, selectedReview]
  );

  const replaceWithTemplate = useCallback(
    async (ref: MarketingTemplateRef) => {
      try {
        const next = await loadedFromPick(ref);
        if (!next) return;
        // An edit (undoable), so autosave stores it on this design.
        loadProject(next, { asEdit: true });
      } catch {
        toast.error('Could not load that template');
      }
    },
    [loadProject, loadedFromPick]
  );

  const handleTemplatePick = useCallback(
    (pick: MarketingTemplatePick) => {
      setMobilePanel(null);
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
    loadProject(
      buildDefaultProjectV2(
        template?.id ?? DEFAULT_VIDEO_TEMPLATE,
        template?.category ?? 'soft-stay',
        binding,
        format
      ),
      { asEdit: true }
    );
    toast.success('Reset to template');
  }, [project?.templateId, binding, format, loadProject]);

  const handleSelectReview = useCallback(
    (review: MarketingGuestReview) => {
      setSelectedReview(review);
      changeProject((current) => applyGuestReviewToVideoProjectV2(current, review, binding));
      setMobilePanel(null);
    },
    [binding, changeProject]
  );

  // ── Sizes ───────────────────────────────────────────────────────────────
  const handleResize = useCallback(
    (size: string) => {
      const next = asVideoFormat(size, format);
      changeProject((current) => ({ ...current, format: next }));
      setRelativeZoom(100);
    },
    [format, changeProject]
  );

  const handleCopyToSize = useCallback(
    async (size: string) => {
      const id = session.itemId;
      const current = projectRef.current;
      if (!id || !current) return;
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
          project: { ...current, format: nextFormat },
        },
      });
      nav.openItem(copy.id, { replace: true });
    },
    [session, format, buildDesignJson, duplicate, nav]
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
        // The host's own uploads lead the scene media; the gallery follows. Best effort.
        let builderBinding = binding;
        try {
          if (!propertyId) throw new Error('No property');
          const [images, videos] = await Promise.all([
            fetchMarketingMediaPage(propertyId, { kind: 'image' }, null),
            fetchMarketingMediaPage(propertyId, { kind: 'video' }, null),
          ]);
          builderBinding = bindingWithLibraryClips(
            binding,
            libraryClipsForAi([...images.items, ...videos.items])
          );
        } catch {
          // Library unavailable: build from the property gallery alone.
        }
        const variants = resolveAiGeneratedVideoProjectsForAllFormats(tokens, builderBinding, {
          includePropertyPhoto: input.includeContext.propertyPhoto,
          orgLogoUrl,
          includeOrgLogo: input.includeContext.orgLogo ?? true,
          includeCta: input.includeContext.cta ?? true,
          includePropertyName: input.includeContext.propertyName ?? true,
        });
        const variant = variants.find((entry) => entry.format === format) ?? variants[0];
        if (!variant) throw new Error('Could not build the video');
        const aiGenerationId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `ai-${Date.now()}`;
        const thumbnailDataUrl = await captureVideoProjectThumbnailV2(
          migrateVideoProjectV1(variant.project),
          accentColor,
          themeTokens
        );
        // Saved as the builder's own scene project: opening it upgrades to tracks and resolves
        // the default music, so the AI path and the template path share one load route.
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

  // ── Rendering ───────────────────────────────────────────────────────────
  const hasProject = Boolean(project);
  const sizeSiblings = record?.groupMembers ?? [];
  const handleFitToView = useCallback(() => {
    setRelativeZoom(100);
    previewRef.current?.fitToView();
  }, []);
  const handleToggleFullscreen = useCallback(() => previewRef.current?.toggleFullscreen(), []);

  const selectedLocation = project && selectedIds[0] ? findItem(project, selectedIds[0]) : null;
  const canSplitSelection = Boolean(
    project &&
    selectedIds.some((id) => {
      const loc = findItem(project, id);
      return (
        loc && !loc.track.locked && currentFrame > loc.item.from && currentFrame < itemEnd(loc.item)
      );
    })
  );
  const canReplaceSelection = Boolean(
    selectedIds.length === 1 &&
    selectedLocation &&
    (isMediaItem(selectedLocation.item) || isAudioItem(selectedLocation.item))
  );
  const showClipActions = isBelowLg && selectedIds.length > 0 && !mobilePanel;

  const replaceTarget = replaceTargetId && project ? findItem(project, replaceTargetId) : null;
  const replaceKinds = replaceTarget
    ? isAudioItem(replaceTarget.item)
      ? (['audio'] as const)
      : (['image', 'video'] as const)
    : undefined;

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

  const mediaPanel = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {replaceTarget ? (
        <div className="bg-muted flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            Pick a file to replace {itemLabel(replaceTarget.item)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[44px] shrink-0"
            onClick={() => setReplaceTargetId(null)}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      <MarketingMediaLibrary
        allowedKinds={replaceKinds ? [...replaceKinds] : undefined}
        propertyItems={propertyImages}
        includeMusic
        onPick={handlePickMedia}
      />
    </div>
  );

  const textPanel = (
    <div className="grid gap-2">
      {TEXT_PRESETS.map((preset) => (
        <Button
          key={preset.id}
          type="button"
          variant="outline"
          className="min-h-[44px] justify-start"
          disabled={!canEditContent || !hasProject}
          onClick={() => handleAddText(preset.id)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
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
      selectedReviewId={selectedReview?.id ?? project?.sourceReviewId ?? null}
      onSelect={handleSelectReview}
      socialSeedOnly
    />
  );

  const railSections: MarketingRailSection[] = [
    { key: 'media', label: 'Media', icon: Music2, panel: mediaPanel, title: 'Media library' },
    { key: 'text', label: 'Text', icon: Type, panel: textPanel, title: 'Add text' },
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
    project && inspectorActions ? (
      <VideoInspectorV2
        actions={inspectorActions}
        selectedIds={selectedIds}
        onProjectChange={changeProject}
      />
    ) : null;

  const zoomTools = (
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={showSafeArea ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 min-h-[44px] w-9 min-w-[44px]"
              onClick={() => setShowSafeArea((value) => !value)}
              aria-label="Safe area guide"
              aria-pressed={showSafeArea}
            >
              <Frame className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Safe area guide</TooltipContent>
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
            active={mobilePanel && EDITOR_PANELS.has(mobilePanel) ? mobilePanel : null}
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

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain max-lg:pb-24 lg:overflow-hidden">
          {project && inputProps ? (
            <>
              <div
                className={cn(
                  'flex min-h-0 flex-1 flex-col overflow-hidden',
                  PREVIEW_MIN_HEIGHT_CLASS
                )}
                onDragOver={(event) => {
                  if (hasMediaDrag(event.dataTransfer)) event.preventDefault();
                }}
                onDrop={(event) => {
                  const payload = readMediaDrag(event.dataTransfer);
                  if (!payload) return;
                  event.preventDefault();
                  handleDropMedia(payload, {
                    frame: currentFrameRef.current,
                    trackId: null,
                    onMain: false,
                  });
                }}
              >
                {isBelowLg ? null : <MarketingPreviewHeader actions={zoomTools} />}
                <VideoPreviewV2
                  ref={previewRef}
                  playerRef={playerRef}
                  playerInstance={playerInstance}
                  onPlayerInstance={setPlayerInstance}
                  project={project}
                  durationInFrames={durationInFrames}
                  inputProps={inputProps}
                  compositionKey={compositionKey}
                  currentFrame={currentFrame}
                  isPlaying={isPlaying}
                  selectedIds={selectedIds}
                  relativeZoom={relativeZoom}
                  snap={snapEnabled}
                  showSafeArea={showSafeArea}
                  readOnly={!canEditContent}
                  onSelect={handleCanvasSelect}
                  onPatch={(patch) => changeProject((current) => applyCanvasPatch(current, patch))}
                  onGestureEnd={() => undefined}
                  onTogglePlay={transport.togglePlay}
                  onSeek={transport.seek}
                />
              </div>
              <VideoTimelineV2
                className="shrink-0"
                project={project}
                currentFrame={currentFrame}
                isPlaying={isPlaying}
                selectedIds={selectedIds}
                zoom={timelineZoom}
                snapEnabled={snapEnabled}
                canUndo={canUndo}
                canRedo={canRedo}
                readOnly={!canEditContent}
                mobile={isBelowLg}
                peaksFor={peaksFor}
                onSeek={(frame) => {
                  transport.pause();
                  transport.seek(frame);
                }}
                onSelect={handleSelect}
                onZoomChange={setTimelineZoom}
                onToggleSnap={() => setSnapEnabled((value) => !value)}
                onApply={apply}
                onDropMedia={handleDropMedia}
                handlers={{
                  undo,
                  redo,
                  duplicate: () => handleCommand({ type: 'duplicate' }),
                  remove: (ripple) => handleCommand({ type: 'delete', ripple }),
                  addText: () => openRailPanel('text'),
                  addMedia: () => openRailPanel('media'),
                  addAudio: () => openRailPanel('media'),
                }}
              />
            </>
          ) : (
            <div
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
          title={project ? inspectorTitle(project, selectedIds) : 'Edit'}
          open={isBelowLg ? mobilePanel === 'edit' : inspectorOpen}
          onOpenChange={(open) =>
            isBelowLg ? setMobilePanel(open ? 'edit' : null) : setInspectorOpen(open)
          }
        >
          {settingsPanel}
        </MarketingEditorInspector>
      </div>

      {/* Mobile editor dock (max-lg): sheets for Media / Text / Edit / Templates, AI, and ⋯. */}
      {showClipActions ? (
        <VideoMobileActionBar
          canSplit={canSplitSelection}
          canReplace={canReplaceSelection}
          readOnly={!canEditContent}
          onDone={() => setSelectedIds([])}
          onSplit={() => handleCommand({ type: 'split' })}
          onEdit={() => setMobilePanel('edit')}
          onReplace={() => selectedIds[0] && startReplace(selectedIds[0])}
          onDuplicate={() => handleCommand({ type: 'duplicate' })}
          onDelete={() => handleCommand({ type: 'delete', ripple: false })}
        />
      ) : (
        <MarketingEditorMobileToolbar
          panels={[
            { key: 'media', label: 'Media', icon: Music2 },
            { key: 'text', label: 'Text', icon: Type },
            { key: 'edit', label: 'Edit', icon: SlidersHorizontal },
            { key: 'templates', label: 'Templates', icon: LayoutTemplate },
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
              key: 'reviews',
              label: 'Guest reviews',
              icon: <Star className="size-5" aria-hidden />,
              onSelect: () => setMobilePanel('reviews'),
            },
            {
              key: 'zoom-in',
              label: 'Preview zoom in',
              icon: <ZoomIn className="size-5" aria-hidden />,
              disabled: relativeZoom >= VIDEO_MAX_RELATIVE_ZOOM,
              onSelect: () => setRelativeZoom((prev) => stepVideoZoomIn(prev)),
            },
            {
              key: 'zoom-out',
              label: 'Preview zoom out',
              icon: <ZoomOut className="size-5" aria-hidden />,
              disabled: relativeZoom <= VIDEO_MIN_RELATIVE_ZOOM,
              onSelect: () => setRelativeZoom((prev) => stepVideoZoomOut(prev)),
            },
            {
              key: 'timeline-zoom-in',
              label: 'Timeline zoom in',
              icon: <ZoomIn className="size-5" aria-hidden />,
              disabled: timelineZoom >= MAX_ZOOM,
              onSelect: () => setTimelineZoom((prev) => stepZoom(prev, 1)),
            },
            {
              key: 'timeline-zoom-out',
              label: 'Timeline zoom out',
              icon: <ZoomOut className="size-5" aria-hidden />,
              disabled: timelineZoom <= MIN_ZOOM,
              onSelect: () => setTimelineZoom((prev) => stepZoom(prev, -1)),
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
      )}

      <VideoExportDialog state={exportState} onCancel={() => exportAbortRef.current?.abort()} />

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
          { key: 'orgLogo', label: 'Org logo', available: Boolean(orgLogoUrl) },
          { key: 'propertyName', label: 'Property name', available: Boolean(property.name) },
          { key: 'cta', label: 'Call-to-action', available: true },
        ]}
        onGenerate={handleAiGenerate}
      />
    </div>
  );
}
