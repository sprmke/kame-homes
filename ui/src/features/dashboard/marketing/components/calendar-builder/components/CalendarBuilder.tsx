import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toBlob } from 'html-to-image';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  LayoutTemplate,
  Maximize2,
  Minimize2,
  Paintbrush,
  Redo2,
  RotateCcw,
  Scaling,
  Send,
  Sparkles,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toast } from 'sonner';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import { CalendarPropertyMediaProvider } from '@/features/dashboard/marketing/components/calendar-builder/components/CalendarPropertyMediaProvider';
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
import { MarketingSizeDialog } from '@/features/dashboard/marketing/components/shared/MarketingSizeDialog';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { useGenerateMarketingTemplate } from '@/features/dashboard/marketing/hooks/useGenerateMarketingTemplate';
import { useMarketingBookedDates } from '@/features/dashboard/marketing/hooks/useMarketingBookedDates';
import { useMarketingDesignSession } from '@/features/dashboard/marketing/hooks/useMarketingDesignSession';
import {
  useDuplicateMarketingItem,
  useMarketingLibrary,
} from '@/features/dashboard/marketing/hooks/useMarketingLibrary';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import {
  fetchMarketingTemplate,
  saveMarketingTemplate,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import {
  applyCalendarAiElementsToStyles,
  applyCalendarAiPreferencesToTokens,
  type CalendarAiGeneratePreferences,
} from '@/features/dashboard/marketing/lib/calendarAiGenerateOptions';
import {
  CALENDAR_MIN_RELATIVE_ZOOM,
  CALENDAR_PREVIEW_ZOOM_LEVELS,
  calendarFormatToAspectPreset,
  calendarPreviewDisplayLayout,
  canvasFrameDefaultsForFormat,
  normalizeCalendarCanvasFrame,
  type CalendarCanvasFormat,
} from '@/features/dashboard/marketing/lib/calendarCanvasFormats';
import { CALENDAR_PRESET_CATEGORIES } from '@/features/dashboard/marketing/lib/calendarPresetCatalog';
import { blobToDataUrl } from '@/features/dashboard/marketing/lib/exportVideoMedia';
import { marketingContentFingerprint } from '@/features/dashboard/marketing/lib/marketingContentFingerprint';
import { marketingEditorWorkspaceClassName } from '@/features/dashboard/marketing/lib/marketingEditorWorkspace';
import { marketingHtmlToImageOptions } from '@/features/dashboard/marketing/lib/marketingHtmlToImageOptions';
import {
  calendarNameFromTheme,
  nextSequencedName,
  startSizesFor,
} from '@/features/dashboard/marketing/lib/marketingLibrary';
import { MARKETING_PUBLISH_META_LABEL } from '@/features/dashboard/marketing/lib/marketingStudioCopy';
import {
  formatTemplateRef,
  type MarketingTemplateRef,
} from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import { savedThumbnailPixelRatio } from '@/features/dashboard/marketing/lib/marketingThumbSizing';
import {
  pickRandomPropertyPhoto,
  propertyGalleryMediaItems,
  propertyMediaItems,
} from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import { themedAiCalendarStyles } from '@/features/dashboard/marketing/lib/theme/aiThemeAdapter';
import {
  resolveThemedCalendarLayout,
  rethemeCalendarStyles,
  themedSavedCalendarStyles,
} from '@/features/dashboard/marketing/lib/theme/calendarThemeAdapter';
import {
  marketingThemeHash,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { themeStampForSave } from '@/features/dashboard/marketing/lib/theme/marketingThemeItems';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { PlanGateWatermarkOverlay } from '@/features/dashboard/plans/components/PlanGateWatermarkOverlay';
import { TierBadge, TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { CalendarPreview } from './CalendarPreview';
import { CalendarPreviewScaledFrame } from './CalendarPreviewScaledFrame';
import { CalendarQuickSettings } from './CalendarQuickSettings';
import {
  AvailablePanel,
  BlockedPanel,
  BookedPanel,
  CanvasFramePanel,
  CellPanel,
  ContainerPanel,
  DayNamesPanel,
  GridPanel,
  HeaderPanel,
  LegendPanel,
  TodayPanel,
  WatermarkPanel,
} from './panels';
import {
  MOCK_BLOCKED_DAYS,
  MOCK_PREVIEW_BOOKINGS,
  useCalendarBuilderStore,
} from '../stores/calendarBuilderStore';
import { normalizeCalendarStyles, type CalendarStyles, type PreviewBooking } from '../types';

interface CalendarBuilderProps {
  document: MarketingEditorDocument;
  nav: MarketingEditorNav;
  propertyName?: string;
  propertySlug?: string;
  bookings?: PreviewBooking[];
  blockedDays?: number[];
  exportContainerRef?: React.Ref<HTMLDivElement>;
  onExport?: () => void;
  onPublish?: () => void;
  isExporting?: boolean;
}

function useContainerSize(ref: React.RefObject<HTMLElement | null>, watchKey?: unknown) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => {
      const rect = node.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, watchKey]);

  return size;
}

function stepCalendarZoomIn(current: number, max: number): number {
  const next = CALENDAR_PREVIEW_ZOOM_LEVELS.find((level) => level > current);
  if (!next) return current;
  return Math.min(next, max);
}

function stepCalendarZoomOut(current: number): number {
  return (
    [...CALENDAR_PREVIEW_ZOOM_LEVELS].reverse().find((level) => level < current) ??
    CALENDAR_MIN_RELATIVE_ZOOM
  );
}

const CALENDAR_SIZE_TO_FORMAT: Record<string, CalendarCanvasFormat> = {
  'instagram-post': 'square',
  'instagram-story': 'portrait',
  landscape: 'landscape',
};

function formatForSize(size: string | null | undefined): CalendarCanvasFormat {
  return CALENDAR_SIZE_TO_FORMAT[size ?? ''] ?? 'square';
}

function layoutName(layoutId: string): string {
  for (const category of CALENDAR_PRESET_CATEGORIES) {
    const preset = category.presets.find((item) => item.value === layoutId);
    if (preset) return preset.label;
  }
  return layoutId === 'default' ? 'Calendar' : 'Calendar';
}

export function CalendarBuilder({
  document,
  nav,
  propertyName = 'Beach Villa',
  propertySlug = '',
  bookings,
  blockedDays,
  exportContainerRef,
  onExport,
  onPublish,
  isExporting = false,
}: CalendarBuilderProps) {
  const isBelowLg = useIsBelowLg();
  const {
    data: publicProperty,
    isLoading: propertyLoading,
    isError: propertyError,
  } = usePublicPropertyDetail(propertySlug);
  // The studio only mounts editors once a theme is resolved.
  const { active: activeTheme, activeHash } = useMarketingTheme();
  const theme = activeTheme!;
  const themeTokens = theme.tokens;
  const themeHash = useMemo(() => marketingThemeHash(themeTokens), [themeTokens]);
  const propertyId = usePropertyIdParam();
  const generateTemplate = useGenerateMarketingTemplate();
  const duplicate = useDuplicateMarketingItem();
  const { data: bookedDates = [] } = useMarketingBookedDates();

  const calendarPropertyImages = useMemo(() => {
    const gallery = publicProperty?.media?.length
      ? propertyGalleryMediaItems(
          publicProperty.media.map((item) => ({ url: item.url, type: item.type }))
        )
      : propertyMediaItems(publicProperty?.images ?? []);
    return gallery.filter((item) => item.type === 'image');
  }, [publicProperty?.media, publicProperty?.images]);

  const propertyPhotoUrls = useMemo(
    () => calendarPropertyImages.map((item) => item.url),
    [calendarPropertyImages]
  );
  const propertyPhotoUrl = calendarPropertyImages[0]?.url;
  // Portrait / landscape canvas color: the theme's main color (was the brand accent).
  const accentColor = themeTokens.palette.primary;

  const calendarRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [relativeZoom, setRelativeZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenRelativeZoom, setFullscreenRelativeZoom] = useState(100);
  const previewContainerSize = useContainerSize(previewContainerRef);
  const fullscreenContainerSize = useContainerSize(fullscreenContainerRef, isFullscreen);
  const [ready, setReady] = useState(false);
  const [edited, setEdited] = useState(false);
  const [railPanel, setRailPanel] = useState<string | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<string | null>(null);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [aiGenerateBusy, setAiGenerateBusy] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<
    (MarketingTemplatePick & { name: string }) | null
  >(null);

  const styles = useCalendarBuilderStore((state) => state.styles);
  const setStyles = useCalendarBuilderStore((state) => state.setStyles);
  const loadStyles = useCalendarBuilderStore((state) => state.loadStyles);
  const isDirty = useCalendarBuilderStore((state) => state.isDirty);
  const undo = useCalendarBuilderStore((state) => state.undo);
  const redo = useCalendarBuilderStore((state) => state.redo);
  const canUndo = useCalendarBuilderStore((state) => state.canUndo);
  const canRedo = useCalendarBuilderStore((state) => state.canRedo);
  const saveToHistory = useCalendarBuilderStore((state) => state.saveToHistory);
  const previewMonth = useCalendarBuilderStore((state) => state.previewMonth);
  const nextMonth = useCalendarBuilderStore((state) => state.nextMonth);
  const prevMonth = useCalendarBuilderStore((state) => state.prevMonth);

  // Any change the host makes after a load marks the document as edited.
  useEffect(() => {
    if (ready && isDirty) setEdited(true);
  }, [ready, isDirty]);

  const record = document.mode === 'saved' ? document.record : null;
  const canvasFrame = normalizeCalendarCanvasFrame(styles.canvasFrame, accentColor);
  const calendarAspectPreset = calendarFormatToAspectPreset(canvasFrame.format);

  const sourceTemplateId = useMemo(() => {
    if (document.mode === 'saved') return document.record.sourceTemplateId ?? null;
    if (!document.from) {
      // A new calendar in a starter look starts on that look's own layout.
      return theme.calendarLayoutId ? `preset:${theme.calendarLayoutId}` : null;
    }
    if (document.from.kind === 'blank' || document.from.kind === 'collage') return null;
    return formatTemplateRef(document.from);
  }, [document, theme.calendarLayoutId]);

  const namingNewCalendar = document.mode === 'draft' && !document.templateRecord;
  const themeCalendarBase = calendarNameFromTheme(theme.name);
  const themeCalendars = useMarketingLibrary(
    {
      contentType: 'calendar',
      kind: 'design',
      themeKey: theme.key,
      query: themeCalendarBase,
      limit: 60,
    },
    namingNewCalendar
  );
  const takenCalendarNames = useMemo(
    () => themeCalendars.data?.pages.flatMap((page) => page.items.map((item) => item.name)) ?? [],
    [themeCalendars.data]
  );

  const draftName = useMemo(() => {
    if (document.mode === 'saved') return document.record.name;
    if (document.templateRecord) return document.templateRecord.name;
    return nextSequencedName(themeCalendarBase, takenCalendarNames);
  }, [document, themeCalendarBase, takenCalendarNames]);

  /** A layout (or Blank) dressed in the theme at a format. */
  const themedLayout = useCallback(
    (layoutId: string, format: CalendarCanvasFormat): CalendarStyles =>
      resolveThemedCalendarLayout({ layoutId, theme: themeTokens, format, propertyPhotoUrl }),
    [themeTokens, propertyPhotoUrl]
  );

  /** A saved design / template row in the current theme, with its hand-set locks. */
  const themedRecord = useCallback(
    (row: MarketingTemplateRecord) => {
      const rawStyles = row.designJson?.styles;
      if (!rawStyles || typeof rawStyles !== 'object') return null;
      return themedSavedCalendarStyles(
        row.designJson,
        rawStyles as CalendarStyles,
        themeTokens,
        propertyPhotoUrl
      );
    },
    [themeTokens, propertyPhotoUrl]
  );

  const stylesForRef = useCallback(
    async (
      ref: MarketingTemplateRef,
      format: CalendarCanvasFormat
    ): Promise<{ styles: CalendarStyles; lockedPaths: string[] } | null> => {
      if (ref.kind === 'template') {
        const row = await fetchMarketingTemplate(propertyId, ref.id);
        const themed = themedRecord(row);
        return themed ? { styles: themed.styles, lockedPaths: themed.lockedPaths } : null;
      }
      const layoutId = ref.kind === 'preset' ? ref.id : 'default';
      return { styles: themedLayout(layoutId, format), lockedPaths: [] };
    },
    [propertyId, themedLayout, themedRecord]
  );

  // ── Initial document ────────────────────────────────────────────────────
  // Photo layouts need the property's photos, so built-in layouts wait for them.
  const bindingReady = !propertyLoading || propertyError || Boolean(publicProperty);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (document.mode === 'saved') {
      const themed = themedRecord(document.record);
      loadStyles(
        themed?.styles ?? themedLayout('default', formatForSize(document.record.aspectPreset)),
        themed?.lockedPaths ?? []
      );
    } else if (document.templateRecord) {
      const themed = themedRecord(document.templateRecord);
      loadStyles(
        themed?.styles ?? themedLayout('default', formatForSize(document.size)),
        themed?.lockedPaths ?? []
      );
    } else {
      if (!bindingReady) return;
      const layoutId =
        document.from?.kind === 'preset' ? document.from.id : (theme.calendarLayoutId ?? 'default');
      loadStyles(themedLayout(layoutId, formatForSize(document.size)));
    }
    initializedRef.current = true;
    setEdited(false);
    setReady(true);
  }, [document, bindingReady, loadStyles, themedLayout, themedRecord, theme.calendarLayoutId]);

  useEffect(() => {
    if (ready && document.mode === 'draft' && document.openAi) setAiGenerateOpen(true);
    // Once, when the draft is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const calendarFingerprint = useMemo(
    () => marketingContentFingerprint(normalizeCalendarStyles(styles)),
    [styles]
  );

  const { canEditContent, canAddTemplate, canEditTemplate, canGenerate } =
    useMarketingPermissions();
  const { canUse: canSaveDesigns } = useFeatureGate('customTemplates');
  const canSave = canEditContent && canSaveDesigns && (record ? canEditTemplate : canAddTemplate);

  const buildDesignJson = useCallback(() => {
    const normalized = normalizeCalendarStyles(useCalendarBuilderStore.getState().styles);
    const presetId = sourceTemplateId?.startsWith('preset:')
      ? sourceTemplateId.slice('preset:'.length)
      : 'custom';
    return {
      styles: JSON.parse(JSON.stringify(normalized)),
      sourcePresetId: presetId,
      ...(record?.designJson.aiGenerated === true
        ? {
            aiGenerated: true,
            aiGenerationId: record.designJson.aiGenerationId,
            aiTokens: record.designJson.aiTokens,
          }
        : {}),
      ...themeStampForSave(themeTokens, useCalendarBuilderStore.getState().lockedPaths),
    };
  }, [sourceTemplateId, record, themeTokens]);

  const previewRef = exportContainerRef ?? calendarRef;

  const captureThumbnail = useCallback(async () => {
    const node =
      typeof previewRef === 'object' && previewRef && 'current' in previewRef
        ? previewRef.current
        : null;
    if (!node) return null;
    try {
      const blob = await toBlob(
        node,
        marketingHtmlToImageOptions({
          pixelRatio: savedThumbnailPixelRatio(node.offsetWidth, node.offsetHeight),
          type: 'image/jpeg',
          quality: 0.82,
        })
      );
      return blob && blob.size >= 64 ? blobToDataUrl(blob) : null;
    } catch {
      return null;
    }
  }, [previewRef]);

  const session = useMarketingDesignSession({
    contentType: 'calendar',
    themeKey: theme.key,
    itemId: record?.id ?? null,
    record,
    draftName,
    sourceTemplateId,
    ready,
    hasUserEdits: edited,
    contentFingerprint: calendarFingerprint,
    aspectPreset: calendarAspectPreset,
    buildDesignJson,
    captureThumbnail,
    onCreated: nav.onCreated,
    themeHash,
    onReloadFromServer: (fresh) => {
      const themed = themedRecord(fresh);
      if (themed) loadStyles(themed.styles, themed.lockedPaths);
      setEdited(false);
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
    await session.flush();
    nav.back();
  }, [nav, session]);

  // The open theme was edited (same theme, new tokens): move the open calendar to the
  // new look, keeping anything set by hand. Autosave then stores it with the new snapshot.
  const lastThemeRef = useRef<{ hash: string | null; tokens: MarketingThemeTokens } | null>(null);
  useEffect(() => {
    const previous = lastThemeRef.current;
    lastThemeRef.current = { hash: activeHash, tokens: themeTokens };
    if (!previous || previous.hash === activeHash || !ready) return;
    const state = useCalendarBuilderStore.getState();
    const next = rethemeCalendarStyles(state.styles, previous.tokens, themeTokens, {
      lockedPaths: state.lockedPaths,
      propertyPhotoUrl,
    });
    if (next !== state.styles) {
      setStyles(next, { markDirty: true });
      saveToHistory();
    }
  }, [activeHash, propertyPhotoUrl, ready, saveToHistory, setStyles, themeTokens]);

  // ── Preview layout ──────────────────────────────────────────────────────
  const previewBookingsForDisplay = useMemo(
    () => (bookings?.length ? bookings : MOCK_PREVIEW_BOOKINGS),
    [bookings]
  );
  const previewBlockedDaysForDisplay = useMemo(
    () => (blockedDays?.length ? blockedDays : MOCK_BLOCKED_DAYS),
    [blockedDays]
  );

  const previewLayout = useMemo(() => {
    const width = previewContainerSize.width || 640;
    const height = previewContainerSize.height || 480;
    return calendarPreviewDisplayLayout(canvasFrame.format, width, height, relativeZoom);
  }, [canvasFrame.format, previewContainerSize, relativeZoom]);

  const fullscreenLayout = useMemo(() => {
    const width = fullscreenContainerSize.width || 960;
    const height = fullscreenContainerSize.height || 720;
    return calendarPreviewDisplayLayout(
      canvasFrame.format,
      width,
      height,
      fullscreenRelativeZoom,
      96
    );
  }, [canvasFrame.format, fullscreenContainerSize, fullscreenRelativeZoom]);

  useEffect(() => {
    setRelativeZoom(100);
  }, [canvasFrame.format]);

  const handleZoomIn = useCallback(() => {
    setRelativeZoom((prev) => stepCalendarZoomIn(prev, previewLayout.maxRelativeZoomPercent));
  }, [previewLayout.maxRelativeZoomPercent]);

  const handleZoomOut = useCallback(() => {
    setRelativeZoom((prev) => stepCalendarZoomOut(prev));
  }, []);

  const handleFitToScreen = useCallback(() => {
    setRelativeZoom(100);
  }, []);

  const handleOpenFullscreen = useCallback(() => {
    setFullscreenRelativeZoom(100);
    setIsFullscreen(true);
    window.document.body.style.overflow = 'hidden';
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreen(false);
    window.document.body.style.overflow = '';
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) handleCloseFullscreen();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, handleCloseFullscreen]);

  useEffect(
    () => () => {
      window.document.body.style.overflow = '';
    },
    []
  );

  // ── Templates (Replace / Open as new) ──────────────────────────────────
  const replaceWithTemplate = useCallback(
    async (ref: MarketingTemplateRef) => {
      try {
        const next = await stylesForRef(ref, canvasFrame.format);
        if (!next) return;
        // An edit (undoable), so autosave stores it on this calendar.
        saveToHistory();
        setStyles(next.styles, { markDirty: true });
        useCalendarBuilderStore.getState().setLockedPaths(next.lockedPaths);
        saveToHistory();
      } catch {
        toast.error('Could not load that layout');
      }
    },
    [stylesForRef, canvasFrame.format, saveToHistory, setStyles]
  );

  const handleTemplatePick = useCallback(
    (pick: MarketingTemplatePick) => {
      setMobilePanel(null);
      // An untouched draft just switches layout; real work asks first.
      if (session.isDraft && !edited) {
        nav.startDraft(pick.ref, { size: calendarAspectPreset, replace: true });
        return;
      }
      const name = pick.ref.kind === 'preset' ? layoutName(pick.ref.id) : 'this layout';
      setPendingTemplate({ ...pick, name });
    },
    [calendarAspectPreset, edited, nav, session.isDraft]
  );

  const handleReset = useCallback(() => {
    const layoutId = sourceTemplateId?.startsWith('preset:')
      ? sourceTemplateId.slice('preset:'.length)
      : 'default';
    void replaceWithTemplate({ kind: 'preset', id: layoutId });
    toast.success('Reset to layout');
  }, [replaceWithTemplate, sourceTemplateId]);

  // ── Sizes ───────────────────────────────────────────────────────────────
  const stylesAtFormat = useCallback(
    (current: CalendarStyles, format: CalendarCanvasFormat) => {
      const defaults = canvasFrameDefaultsForFormat(format, accentColor);
      const normalized = normalizeCalendarStyles(current);
      return normalizeCalendarStyles({
        ...normalized,
        canvasFrame: {
          ...normalized.canvasFrame,
          format,
          padding: defaults.padding,
          calendarScale: defaults.calendarScale,
          background: defaults.background,
        },
      });
    },
    [accentColor]
  );

  const handleResize = useCallback(
    (size: string) => {
      const format = formatForSize(size);
      saveToHistory();
      setStyles(stylesAtFormat(useCalendarBuilderStore.getState().styles, format), {
        markDirty: true,
      });
      saveToHistory();
    },
    [saveToHistory, setStyles, stylesAtFormat]
  );

  const handleCopyToSize = useCallback(
    async (size: string) => {
      const id = session.itemId;
      if (!id) return;
      await session.flush();
      const designJson = buildDesignJson();
      const nextStyles = stylesAtFormat(
        useCalendarBuilderStore.getState().styles,
        formatForSize(size)
      );
      const copy = await duplicate.mutateAsync({
        id,
        sameGroup: true,
        aspectPreset: size,
        designJson: { ...designJson, styles: JSON.parse(JSON.stringify(nextStyles)) },
      });
      nav.openItem(copy.id, { replace: true });
    },
    [session, buildDesignJson, stylesAtFormat, duplicate, nav]
  );

  // ── AI: one calendar in the current size, opened right away ────────────
  const availabilityText = useMemo(() => {
    if (bookedDates.length === 0) return 'Open nights this month';
    return `${bookedDates.length} booked range${bookedDates.length === 1 ? '' : 's'} on file`;
  }, [bookedDates.length]);

  const amenitiesText = useMemo(() => {
    const amenities = publicProperty?.amenities ?? [];
    return amenities.slice(0, 8).join(', ') || undefined;
  }, [publicProperty?.amenities]);

  const handleAiGenerate = useCallback(
    async (input: MarketingAiGenerateInput) => {
      if (!('elements' in input.preferences)) return;
      const calendarPreferences = input.preferences as CalendarAiGeneratePreferences;
      setAiGenerateBusy(true);
      let aiSucceeded = false;
      try {
        const result = await generateTemplate.mutateAsync({
          contentType: 'calendar',
          prompt: input.prompt,
          includeContext: input.includeContext,
          amenitiesText: input.includeContext.amenities ? amenitiesText : undefined,
          availabilityText: input.includeContext.availability ? availabilityText : undefined,
          preferences: {
            layoutArchetype: calendarPreferences.layoutArchetype,
            fontPairing: calendarPreferences.fontPairing,
            backgroundMood: calendarPreferences.backgroundMood,
          },
        });
        aiSucceeded = true;
        if (result.contentType !== 'calendar') {
          throw new Error('Unexpected content type from AI generation');
        }

        const tokens = applyCalendarAiPreferencesToTokens(result.tokens, calendarPreferences);
        const photoUrl = input.includeContext.propertyPhoto
          ? (pickRandomPropertyPhoto(propertyPhotoUrls) ?? undefined)
          : undefined;
        // AI picks the layout and words; the theme dresses it.
        const aiStyles = applyCalendarAiElementsToStyles(
          themedAiCalendarStyles(tokens, themeTokens, canvasFrame.format, photoUrl),
          calendarPreferences.elements
        );
        const aiGenerationId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `ai-${Date.now()}`;
        const saved = await saveMarketingTemplate(propertyId, {
          name: tokens.label,
          contentType: 'calendar',
          aspectPreset: calendarAspectPreset,
          themeKey: theme.key,
          kind: 'design',
          designJson: {
            styles: JSON.parse(JSON.stringify(aiStyles)),
            sourcePresetId: 'custom',
            aiGenerated: true,
            aiGenerationId,
            aiTokens: tokens,
            ...themeStampForSave(themeTokens),
          },
        });
        setAiGenerateOpen(false);
        toast.success('Calendar made with AI');
        nav.openItem(saved.id, { replace: session.isDraft && !edited });
      } catch (error) {
        // AI failures already toast via useGenerateMarketingTemplate.onError
        if (aiSucceeded) {
          toast.error((error as Error).message || 'Could not save the calendar');
        }
      } finally {
        setAiGenerateBusy(false);
      }
    },
    [
      amenitiesText,
      availabilityText,
      calendarAspectPreset,
      canvasFrame.format,
      edited,
      generateTemplate,
      nav,
      propertyId,
      propertyPhotoUrls,
      session.isDraft,
      theme.key,
      themeTokens,
    ]
  );

  // ── Chrome ──────────────────────────────────────────────────────────────
  const sizeDialog = (
    <MarketingSizeDialog
      contentType="calendar"
      size={calendarAspectPreset}
      siblings={record?.groupMembers ?? []}
      onOpenSibling={(id) => {
        void session.flush().then(() => nav.openItem(id, { replace: true }));
      }}
      onCopyToSize={
        session.itemId && canAddTemplate && canSaveDesigns ? handleCopyToSize : undefined
      }
      onResize={canEditContent ? handleResize : undefined}
      sizes={startSizesFor('calendar')}
      disabled={!ready}
      open={isBelowLg ? sizeOpen : undefined}
      onOpenChange={isBelowLg ? setSizeOpen : undefined}
      hideTrigger={isBelowLg}
    />
  );

  const topBarActions = (
    <>
      {onExport ? (
        <TierBadgeAnchor feature="marketingStudio">
          <Button
            variant="outline"
            className="min-h-[44px] gap-2"
            onClick={onExport}
            disabled={isExporting || !ready}
          >
            <Download className="size-4" aria-hidden />
            <span className="max-xl:sr-only">{isExporting ? 'Exporting…' : 'Download'}</span>
          </Button>
        </TierBadgeAnchor>
      ) : null}
      {onPublish ? (
        <TierBadgeAnchor feature="marketingPublishLimitPerGroup">
          <Button
            className="min-h-[44px] gap-2"
            onClick={onPublish}
            disabled={isExporting || !ready}
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
      contentType="calendar"
      theme={themeTokens}
      themeHash={themeHash}
      themeKey={theme.key}
      size={calendarAspectPreset}
      onSizeChange={() => undefined}
      onPick={handleTemplatePick}
      propertyPhotoUrl={propertyPhotoUrl}
      variant="panel"
      lockSize
      showStarts={false}
      offerContinue={false}
      activeSourceId={sourceTemplateId}
    />
  );

  const railSections: MarketingRailSection[] = [
    { key: 'templates', label: 'Layouts', icon: LayoutTemplate, panel: templatesPanel },
    {
      key: 'show',
      label: 'Show',
      icon: Eye,
      title: 'Show on calendar',
      panel: <CalendarQuickSettings bare />,
    },
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

  const stylePanels = (
    <div className="space-y-4 pb-4">
      {canvasFrame.format !== 'square' ? <CanvasFramePanel /> : null}
      <ContainerPanel />
      <HeaderPanel />
      <DayNamesPanel />
      <GridPanel />
      <CellPanel />
      <TodayPanel />
      <BookedPanel />
      <AvailablePanel />
      <BlockedPanel />
      <LegendPanel />
      <WatermarkPanel />
    </div>
  );

  const monthLabelLong = previewMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const monthLabelShort = previewMonth.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <TooltipProvider>
      <CalendarPropertyMediaProvider images={calendarPropertyImages}>
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
                canUndo={canUndo()}
                canRedo={canRedo()}
                onUndo={undo}
                onRedo={redo}
                onReset={handleReset}
                resetTitle="Reset to layout?"
                resetDescription="Your changes to this calendar are replaced by its layout. You can undo this."
              />
            }
            size={sizeDialog}
            actions={topBarActions}
          />
          {isBelowLg ? sizeDialog : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            <MarketingEditorRail
              layoutKey="calendar"
              sections={railSections}
              active={
                isBelowLg
                  ? mobilePanel === 'templates' || mobilePanel === 'show'
                    ? mobilePanel
                    : null
                  : railPanel
              }
              onActiveChange={isBelowLg ? setMobilePanel : setRailPanel}
            />

            <div
              className={cn(
                marketingEditorWorkspaceClassName,
                'flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden'
              )}
            >
              <MarketingPreviewHeader
                leading={
                  isBelowLg ? (
                    // Mobile: a full-width month stepper at the top of the canvas.
                    <div className="flex w-full items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10 min-h-[44px] min-w-[44px] shrink-0"
                        aria-label="Previous month"
                        onClick={prevMonth}
                      >
                        <ChevronLeft className="size-4" aria-hidden />
                      </Button>
                      <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
                        {monthLabelLong}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10 min-h-[44px] min-w-[44px] shrink-0"
                        aria-label="Next month"
                        onClick={nextMonth}
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-border bg-background flex items-center gap-1 rounded-md border px-1 py-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 min-h-[44px] w-9 min-w-[44px]"
                        onClick={prevMonth}
                        aria-label="Previous month"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="min-w-[100px] text-center text-xs font-medium">
                        {monthLabelShort}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 min-h-[44px] w-9 min-w-[44px]"
                        onClick={nextMonth}
                        aria-label="Next month"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                }
                actions={
                  isBelowLg ? undefined : (
                    <div className="flex items-center gap-2">
                      <div className="border-border bg-background flex items-center gap-1 rounded-md border px-1 py-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 min-h-[44px] w-9 min-w-[44px]"
                              onClick={handleZoomOut}
                              disabled={relativeZoom <= CALENDAR_MIN_RELATIVE_ZOOM}
                              aria-label="Zoom out"
                            >
                              <ZoomOut className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Zoom out</TooltipContent>
                        </Tooltip>
                        <span className="min-w-[48px] text-center text-xs font-medium">
                          {relativeZoom}%
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 min-h-[44px] w-9 min-w-[44px]"
                              onClick={handleZoomIn}
                              disabled={relativeZoom >= previewLayout.maxRelativeZoomPercent}
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
                              variant="ghost"
                              size="icon"
                              className="h-9 min-h-[44px] w-9 min-w-[44px]"
                              onClick={handleFitToScreen}
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
                              variant="ghost"
                              size="icon"
                              className="h-9 min-h-[44px] w-9 min-w-[44px]"
                              onClick={handleOpenFullscreen}
                              aria-label="Fullscreen"
                            >
                              <Maximize2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Fullscreen</TooltipContent>
                        </Tooltip>
                      </div>
                      {!styleOpen ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-[44px] gap-1.5"
                          onClick={() => setStyleOpen(true)}
                        >
                          <Paintbrush className="size-4" aria-hidden />
                          Style
                        </Button>
                      ) : null}
                    </div>
                  )
                }
              />

              {/* The studio shell ends just above the floating editor dock on mobile. */}
              <div
                ref={previewContainerRef}
                className="flex-1 overflow-auto p-4 max-lg:pb-3 sm:p-6"
              >
                <div className="flex min-h-full items-center justify-center">
                  <PlanGateWatermarkOverlay fit="content">
                    <CalendarPreviewScaledFrame
                      ref={previewRef}
                      styles={styles}
                      displayScale={previewLayout.displayScale}
                      nativeWidth={previewLayout.nativeWidth}
                      nativeHeight={previewLayout.nativeHeight}
                    >
                      {(calendarSize) => (
                        <CalendarPreview
                          styles={styles}
                          propertyName={propertyName}
                          bookings={previewBookingsForDisplay}
                          blockedDays={previewBlockedDaysForDisplay}
                          displayMonth={previewMonth}
                          layoutMaxWidth={calendarSize}
                        />
                      )}
                    </CalendarPreviewScaledFrame>
                  </PlanGateWatermarkOverlay>
                </div>
              </div>
            </div>

            <MarketingEditorInspector
              title="Style"
              open={isBelowLg ? mobilePanel === 'style' : styleOpen}
              onOpenChange={(open) =>
                isBelowLg ? setMobilePanel(open ? 'style' : null) : setStyleOpen(open)
              }
            >
              {stylePanels}
            </MarketingEditorInspector>
          </div>
        </div>

        {!isFullscreen ? (
          <MarketingEditorMobileToolbar
            panels={[
              { key: 'templates', label: 'Layouts', icon: LayoutTemplate },
              { key: 'show', label: 'Show', icon: Eye },
              { key: 'style', label: 'Style', icon: Paintbrush },
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
                disabled: !canUndo(),
                onSelect: undo,
              },
              {
                key: 'redo',
                label: 'Redo',
                icon: <Redo2 className="size-5" aria-hidden />,
                disabled: !canRedo(),
                onSelect: redo,
              },
              {
                key: 'size',
                label: 'Size',
                icon: <Scaling className="size-5" aria-hidden />,
                disabled: !ready,
                onSelect: () => setSizeOpen(true),
              },
              {
                key: 'zoom-in',
                label: 'Zoom in',
                icon: <ZoomIn className="size-5" aria-hidden />,
                disabled: relativeZoom >= previewLayout.maxRelativeZoomPercent,
                onSelect: handleZoomIn,
              },
              {
                key: 'zoom-out',
                label: 'Zoom out',
                icon: <ZoomOut className="size-5" aria-hidden />,
                disabled: relativeZoom <= CALENDAR_MIN_RELATIVE_ZOOM,
                onSelect: handleZoomOut,
              },
              {
                key: 'fullscreen',
                label: 'Fullscreen preview',
                icon: <Maximize2 className="size-5" aria-hidden />,
                onSelect: handleOpenFullscreen,
              },
              {
                key: 'reset',
                label: 'Reset to layout',
                icon: <RotateCcw className="size-5" aria-hidden />,
                onSelect: handleReset,
              },
              ...(onExport
                ? [
                    {
                      key: 'download',
                      label: isExporting ? 'Exporting…' : 'Download PNG',
                      icon: <Download className="size-5" aria-hidden />,
                      trailing: <TierBadge feature="marketingStudio" />,
                      disabled: isExporting || !ready,
                      onSelect: onExport,
                    },
                  ]
                : []),
              ...(onPublish
                ? [
                    {
                      key: 'publish',
                      label: MARKETING_PUBLISH_META_LABEL,
                      icon: <Send className="size-5" aria-hidden />,
                      trailing: <TierBadge feature="marketingPublishLimitPerGroup" />,
                      disabled: isExporting || !ready,
                      onSelect: onPublish,
                    },
                  ]
                : []),
            ]}
          />
        ) : null}

        {isFullscreen ? (
          <div className="bg-background/95 fixed inset-0 z-50 flex flex-col backdrop-blur-sm">
            <div className="border-border bg-background flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-3 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                <h2 className="text-base font-semibold sm:text-lg">Calendar preview</h2>
                <span className="text-muted-foreground hidden truncate text-sm sm:inline">
                  {propertyName} · {monthLabelLong}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
                <div className="border-border bg-muted/50 flex items-center gap-1 rounded-md border px-1 py-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 min-h-[44px] min-w-[44px]"
                    onClick={prevMonth}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[100px] text-center text-sm font-medium">
                    {monthLabelShort}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 min-h-[44px] min-w-[44px]"
                    onClick={nextMonth}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="border-border bg-muted/50 flex items-center gap-1 rounded-md border px-1 py-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 min-h-[44px] min-w-[44px]"
                    onClick={() => setFullscreenRelativeZoom((prev) => stepCalendarZoomOut(prev))}
                    disabled={fullscreenRelativeZoom <= CALENDAR_MIN_RELATIVE_ZOOM}
                    aria-label="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[56px] text-center text-sm font-medium">
                    {fullscreenRelativeZoom}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 min-h-[44px] min-w-[44px]"
                    onClick={() =>
                      setFullscreenRelativeZoom((prev) =>
                        stepCalendarZoomIn(prev, fullscreenLayout.maxRelativeZoomPercent)
                      )
                    }
                    disabled={fullscreenRelativeZoom >= fullscreenLayout.maxRelativeZoomPercent}
                    aria-label="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <div className="bg-border mx-1 h-5 w-px" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 min-h-[44px] min-w-[44px]"
                    onClick={() => setFullscreenRelativeZoom(100)}
                    aria-label="Fit to screen"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 min-h-[44px] min-w-[44px]"
                  onClick={handleCloseFullscreen}
                  aria-label="Close fullscreen"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div
              ref={fullscreenContainerRef}
              className={cn(
                marketingEditorWorkspaceClassName,
                'flex flex-1 items-center justify-center overflow-auto p-6 sm:p-8'
              )}
            >
              <PlanGateWatermarkOverlay fit="content">
                <CalendarPreviewScaledFrame
                  styles={styles}
                  displayScale={fullscreenLayout.displayScale}
                  nativeWidth={fullscreenLayout.nativeWidth}
                  nativeHeight={fullscreenLayout.nativeHeight}
                >
                  {(calendarSize) => (
                    <CalendarPreview
                      styles={styles}
                      propertyName={propertyName}
                      bookings={previewBookingsForDisplay}
                      blockedDays={previewBlockedDaysForDisplay}
                      displayMonth={previewMonth}
                      layoutMaxWidth={calendarSize}
                    />
                  )}
                </CalendarPreviewScaledFrame>
              </PlanGateWatermarkOverlay>
            </div>
          </div>
        ) : null}
      </CalendarPropertyMediaProvider>

      <MarketingReplaceTemplateDialog
        open={Boolean(pendingTemplate)}
        onOpenChange={(open) => !open && setPendingTemplate(null)}
        templateName={pendingTemplate?.name ?? ''}
        onReplace={() => {
          if (pendingTemplate) void replaceWithTemplate(pendingTemplate.ref);
        }}
        onOpenAsNew={() => {
          if (!pendingTemplate) return;
          const { ref } = pendingTemplate;
          void session.flush().then(() => nav.startDraft(ref, { size: calendarAspectPreset }));
        }}
      />

      <MarketingAiGeneratePanel
        open={aiGenerateOpen}
        onOpenChange={(open) => {
          if (aiGenerateBusy && !open) return;
          setAiGenerateOpen(open);
        }}
        contentType="calendar"
        theme={{ name: theme.name, tokens: themeTokens }}
        generating={aiGenerateBusy || generateTemplate.isPending}
        propertyPhotoUrls={propertyPhotoUrls}
        brandColor={accentColor}
        contextOptions={[
          {
            key: 'propertyPhoto',
            label: 'Property photo',
            available: Boolean(propertyPhotoUrl),
          },
          {
            key: 'amenities',
            label: 'Amenities',
            available: Boolean(amenitiesText),
          },
          {
            key: 'availability',
            label: 'Availability',
            available: true,
          },
        ]}
        onGenerate={handleAiGenerate}
      />
    </TooltipProvider>
  );
}
