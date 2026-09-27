import { useRef, useCallback, useState, useEffect, useMemo } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  Send,
  ChevronLeft as ChevronLeftIcon,
  Sparkles,
  Redo2,
  RotateCcw,
  Undo2,
  LayoutTemplate,
} from 'lucide-react';
import { toast } from 'sonner';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { CalendarPropertyMediaProvider } from '@/features/dashboard/marketing/components/calendar-builder/components/CalendarPropertyMediaProvider';
import { CalendarThumbnailsProvider } from '@/features/dashboard/marketing/components/calendar-builder/components/CalendarThumbnailsProvider';
import {
  MarketingAiGeneratePanel,
  type MarketingAiGenerateInput,
} from '@/features/dashboard/marketing/components/shared/MarketingAiGeneratePanel';
import { MarketingAutoSaveStatus } from '@/features/dashboard/marketing/components/shared/MarketingAutoSaveStatus';
import { MarketingEditorHistoryControls } from '@/features/dashboard/marketing/components/shared/MarketingEditorHistoryControls';
import { MarketingEditorMobileToolbar } from '@/features/dashboard/marketing/components/shared/MarketingEditorMobileToolbar';
import { MarketingEditorSidebar } from '@/features/dashboard/marketing/components/shared/MarketingEditorSidebar';
import { MarketingPreviewHeader } from '@/features/dashboard/marketing/components/shared/MarketingPreviewHeader';
import { useMarketingStudioHeaderActions } from '@/features/dashboard/marketing/components/shared/MarketingStudioHeaderActions';
import { SaveMarketingTemplateButton } from '@/features/dashboard/marketing/components/shared/SaveMarketingTemplateButton';
import { useCalendarTemplateDedupe } from '@/features/dashboard/marketing/hooks/useCalendarTemplateDedupe';
import { useGenerateMarketingTemplate } from '@/features/dashboard/marketing/hooks/useGenerateMarketingTemplate';
import { useMarketingAutoSave } from '@/features/dashboard/marketing/hooks/useMarketingAutoSave';
import { useMarketingAutoSaveSuspension } from '@/features/dashboard/marketing/hooks/useMarketingAutoSaveSuspension';
import { useMarketingBookedDates } from '@/features/dashboard/marketing/hooks/useMarketingBookedDates';
import { useMarketingMediaAccent } from '@/features/dashboard/marketing/hooks/useMarketingMediaAccent';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import { saveMarketingTemplate } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import {
  applyCalendarAiElementsToStyles,
  applyCalendarAiPreferencesToTokens,
  type CalendarAiGeneratePreferences,
} from '@/features/dashboard/marketing/lib/calendarAiGenerateOptions';
import {
  CALENDAR_AI_FORMATS,
  resolveAiGeneratedCalendarStyles,
} from '@/features/dashboard/marketing/lib/calendarAiTokens';
import {
  aspectPresetForCalendarFormat,
  calendarTemplateMatchesAspectPreset,
  findCalendarAutosaveTemplate,
  isCalendarBlankPreset,
  isCalendarCustomPreset,
  isCalendarPresetAutosave,
  planCalendarRelatedCustomIds,
  planCalendarRelatedCustomRemoval,
  CALENDAR_CUSTOM_PRESET_ID,
} from '@/features/dashboard/marketing/lib/calendarAutosave';
import { applyBrandAccentToCalendarStyles } from '@/features/dashboard/marketing/lib/calendarBrandColors';
import {
  CALENDAR_MIN_RELATIVE_ZOOM,
  CALENDAR_PREVIEW_ZOOM_LEVELS,
  calendarFormatToAspectPreset,
  calendarPreviewDisplayLayout,
  canvasFrameDefaultsForFormat,
  normalizeCalendarCanvasFrame,
  type CalendarCanvasFormat,
} from '@/features/dashboard/marketing/lib/calendarCanvasFormats';
import {
  CALENDAR_DESIGNER_PRESET_IDS,
  CALENDAR_PRESET_CATEGORIES,
} from '@/features/dashboard/marketing/lib/calendarPresets';
import { marketingContentFingerprint } from '@/features/dashboard/marketing/lib/marketingContentFingerprint';
import { marketingEditorWorkspaceClassName } from '@/features/dashboard/marketing/lib/marketingEditorWorkspace';
import { MARKETING_PUBLISH_META_LABEL } from '@/features/dashboard/marketing/lib/marketingStudioCopy';
import {
  pickRandomPropertyPhoto,
  propertyGalleryMediaItems,
  propertyMediaItems,
} from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { PlanGateWatermarkOverlay } from '@/features/dashboard/plans/components/PlanGateWatermarkOverlay';
import { TierBadge, TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { cn } from '@/lib/utils';

import { CalendarFormatPicker } from './CalendarFormatPicker';
import { CalendarPreview } from './CalendarPreview';
import { CalendarPreviewScaledFrame } from './CalendarPreviewScaledFrame';
import { CalendarTemplateSidebar } from './CalendarTemplateSidebar';
import {
  ContainerPanel,
  CanvasFramePanel,
  HeaderPanel,
  DayNamesPanel,
  GridPanel,
  CellPanel,
  TodayPanel,
  BookedPanel,
  AvailablePanel,
  BlockedPanel,
  LegendPanel,
  WatermarkPanel,
} from './panels';
import { useCalendarTemplates } from '../hooks/useCalendarTemplates';
import {
  MOCK_BLOCKED_DAYS,
  MOCK_PREVIEW_BOOKINGS,
  useCalendarBuilderStore,
} from '../stores/calendarBuilderStore';
import { normalizeCalendarStyles, type CalendarStyles, type PreviewBooking } from '../types';

interface CalendarBuilderProps {
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

export function CalendarBuilder({
  propertyName = 'Beach Villa',
  propertySlug = '',
  bookings,
  blockedDays,
  exportContainerRef,
  onExport,
  onPublish,
  isExporting = false,
}: CalendarBuilderProps) {
  const { canGenerate } = useMarketingPermissions();
  const isBelowLg = useIsBelowLg();
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  // Picking a template from the mobile sheet should drop the user straight back
  // to the canvas — close the panel so the editor is visible.
  const closeMobilePanel = useCallback(() => setMobilePanelOpen(false), []);
  const { data: appSettings } = useAppSettings();
  const { data: publicProperty } = usePublicPropertyDetail(propertySlug);
  const orgBrandColor = useOrgBrandColor();
  const brandColor = appSettings?.resolvedBrandColor ?? orgBrandColor;

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
  const { accentColor } = useMarketingMediaAccent(propertyPhotoUrls, brandColor);

  const propertyPhotoUrl = calendarPropertyImages[0]?.url;

  const calendarRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [relativeZoom, setRelativeZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenRelativeZoom, setFullscreenRelativeZoom] = useState(100);
  const previewContainerSize = useContainerSize(previewContainerRef);
  const fullscreenContainerSize = useContainerSize(fullscreenContainerRef, isFullscreen);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [activeAutosaveTemplateId, setActiveAutosaveTemplateId] = useState<string | null>(null);
  const [activeCustomTemplateId, setActiveCustomTemplateId] = useState<string | null>(null);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [aiGenerateBusy, setAiGenerateBusy] = useState(false);

  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const generateTemplate = useGenerateMarketingTemplate();
  const { data: bookedDates = [] } = useMarketingBookedDates();

  const { apiTemplates, savedTemplates, deleteTemplate, renameTemplate } =
    useCalendarTemplates(propertySlug);
  useCalendarTemplateDedupe(true);

  const calendarPresetIds = useMemo(() => ['default', ...CALENDAR_DESIGNER_PRESET_IDS], []);

  const styles = useCalendarBuilderStore((state) => state.styles);
  const setStyles = useCalendarBuilderStore((state) => state.setStyles);
  const setIsDirty = useCalendarBuilderStore((state) => state.setIsDirty);
  const isDirty = useCalendarBuilderStore((state) => state.isDirty);
  const undo = useCalendarBuilderStore((state) => state.undo);
  const redo = useCalendarBuilderStore((state) => state.redo);
  const canUndo = useCalendarBuilderStore((state) => state.canUndo);
  const canRedo = useCalendarBuilderStore((state) => state.canRedo);
  const resetStyles = useCalendarBuilderStore((state) => state.resetStyles);
  const applyPreset = useCalendarBuilderStore((state) => state.applyPreset);
  const saveToHistory = useCalendarBuilderStore((state) => state.saveToHistory);
  const previewMonth = useCalendarBuilderStore((state) => state.previewMonth);
  const nextMonth = useCalendarBuilderStore((state) => state.nextMonth);
  const prevMonth = useCalendarBuilderStore((state) => state.prevMonth);

  const canvasFrame = normalizeCalendarCanvasFrame(styles.canvasFrame, accentColor);

  const activeSourcePresetId = useMemo(() => {
    if (selectedTemplateKey?.startsWith('preset:')) {
      return selectedTemplateKey.slice('preset:'.length);
    }
    if (selectedTemplateKey?.startsWith('custom:')) {
      return CALENDAR_CUSTOM_PRESET_ID;
    }
    return null;
  }, [selectedTemplateKey]);

  const customTemplates = useMemo(
    () =>
      savedTemplates.filter(
        (template) =>
          isCalendarCustomPreset(template.sourcePresetId) &&
          calendarTemplateMatchesAspectPreset(template.aspectPreset, canvasFrame.format)
      ),
    [savedTemplates, canvasFrame.format]
  );

  const designerAutosaveEnabled = isCalendarPresetAutosave(activeSourcePresetId);
  const customAutosaveEnabled = Boolean(activeCustomTemplateId);
  const calendarAutosaveEnabled = designerAutosaveEnabled || customAutosaveEnabled;
  const manualSaveEnabled = isCalendarBlankPreset(activeSourcePresetId) && isDirty;

  const calendarTemplateName = useMemo(() => {
    if (activeCustomTemplateId) {
      return (
        savedTemplates.find((template) => template.id === activeCustomTemplateId)?.name ??
        'Custom calendar'
      );
    }
    if (!activeSourcePresetId || isCalendarBlankPreset(activeSourcePresetId))
      return 'Blank calendar';
    for (const category of CALENDAR_PRESET_CATEGORIES) {
      const preset = category.presets.find((item) => item.value === activeSourcePresetId);
      if (preset) return preset.label;
    }
    return 'Calendar';
  }, [activeCustomTemplateId, activeSourcePresetId, savedTemplates]);

  const calendarAspectPreset = useMemo(
    () => aspectPresetForCalendarFormat(canvasFrame.format),
    [canvasFrame.format]
  );

  const calendarFingerprint = useMemo(
    () => marketingContentFingerprint(normalizeCalendarStyles(styles)),
    [styles]
  );

  const {
    suspended: autoSaveSuspended,
    begin: beginAutoSaveSuspension,
    end: endAutoSaveSuspension,
  } = useMarketingAutoSaveSuspension();

  const {
    status: autoSaveStatus,
    errorMessage: autoSaveError,
    markBaseline,
    saveNow: saveAutoSaveNow,
  } = useMarketingAutoSave({
    enabled: calendarAutosaveEnabled,
    suspended: autoSaveSuspended,
    contentFingerprint: calendarFingerprint,
    templateId: activeAutosaveTemplateId,
    resolveTemplateId: () => {
      if (activeAutosaveTemplateId) return activeAutosaveTemplateId;
      if (activeCustomTemplateId) return activeCustomTemplateId;
      if (!designerAutosaveEnabled || !activeSourcePresetId) return null;
      return (
        findCalendarAutosaveTemplate(apiTemplates, activeSourcePresetId, calendarAspectPreset)
          ?.id ?? null
      );
    },
    onTemplateIdChange: (id) => {
      setActiveAutosaveTemplateId(id);
      setIsDirty(false);
    },
    onSaved: () => setIsDirty(false),
    buildSavePayload: () => {
      const normalized = normalizeCalendarStyles(styles);

      if (activeCustomTemplateId) {
        return {
          name: calendarTemplateName,
          contentType: 'calendar',
          aspectPreset: calendarFormatToAspectPreset(normalized.canvasFrame.format),
          designJson: {
            styles: JSON.parse(JSON.stringify(normalized)),
            sourcePresetId: CALENDAR_CUSTOM_PRESET_ID,
          },
        };
      }

      if (!designerAutosaveEnabled || !activeSourcePresetId) return null;

      return {
        name: calendarTemplateName,
        contentType: 'calendar',
        aspectPreset: calendarFormatToAspectPreset(normalized.canvasFrame.format),
        designJson: {
          styles: JSON.parse(JSON.stringify(normalized)),
          sourcePresetId: activeSourcePresetId,
        },
      };
    },
  });

  const customDesignJson = useMemo(() => {
    const normalized = normalizeCalendarStyles(styles);
    return {
      styles: JSON.parse(JSON.stringify(normalized)),
      sourcePresetId: CALENDAR_CUSTOM_PRESET_ID,
    };
  }, [styles]);

  // Autosave presets: only the pending / error window can lose edits. Blank canvas has a
  // manual Save (name dialog), so leaving offers Discard only.
  useUnsavedChangesGuard({
    isDirty: calendarAutosaveEnabled
      ? autoSaveStatus === 'pending' || autoSaveStatus === 'error'
      : manualSaveEnabled,
    onSave: calendarAutosaveEnabled ? saveAutoSaveNow : undefined,
  });

  const handleCustomTemplateSaved = useCallback(
    (record: { id: string }) => {
      setActiveCustomTemplateId(record.id);
      setActiveAutosaveTemplateId(record.id);
      setSelectedTemplateKey(`custom:${record.id}`);
      setIsDirty(false);
      markBaseline();
    },
    [markBaseline, setIsDirty]
  );

  const mergeCanvasFormat = useCallback(
    (format: CalendarCanvasFormat) => {
      const defaults = canvasFrameDefaultsForFormat(format, accentColor);
      const current = normalizeCalendarStyles(useCalendarBuilderStore.getState().styles);
      return normalizeCalendarStyles({
        ...current,
        canvasFrame: {
          ...current.canvasFrame,
          format,
          padding: defaults.padding,
          calendarScale: defaults.calendarScale,
          background: defaults.background,
        },
      });
    },
    [accentColor]
  );

  const handleCanvasFormatChange = useCallback(
    (format: CalendarCanvasFormat) => {
      beginAutoSaveSuspension();
      try {
        const aspectPreset = aspectPresetForCalendarFormat(format);

        if (designerAutosaveEnabled && activeSourcePresetId) {
          const autosave = findCalendarAutosaveTemplate(
            apiTemplates,
            activeSourcePresetId,
            aspectPreset
          );
          if (autosave?.designJson?.styles && typeof autosave.designJson.styles === 'object') {
            setStyles(
              normalizeCalendarStyles(
                JSON.parse(JSON.stringify(autosave.designJson.styles)) as CalendarStyles
              ),
              { markDirty: false }
            );
            setActiveAutosaveTemplateId(autosave.id);
            setIsDirty(false);
            saveToHistory();
            return;
          }
          setStyles(mergeCanvasFormat(format), { markDirty: false });
          setActiveAutosaveTemplateId(null);
          setIsDirty(false);
          saveToHistory();
          return;
        }

        if (customAutosaveEnabled && activeCustomTemplateId) {
          const current = savedTemplates.find((template) => template.id === activeCustomTemplateId);
          if (!current || !calendarTemplateMatchesAspectPreset(current.aspectPreset, format)) {
            setActiveCustomTemplateId(null);
            setActiveAutosaveTemplateId(null);
            setSelectedTemplateKey('preset:default');
            setStyles(mergeCanvasFormat(format), { markDirty: false });
            applyPreset('default', accentColor, propertyPhotoUrl);
            setIsDirty(false);
            saveToHistory();
            return;
          }
        }

        setStyles(mergeCanvasFormat(format), { markDirty: false });
        setIsDirty(false);
        saveToHistory();
      } finally {
        endAutoSaveSuspension();
      }
    },
    [
      activeCustomTemplateId,
      activeSourcePresetId,
      apiTemplates,
      applyPreset,
      beginAutoSaveSuspension,
      accentColor,
      customAutosaveEnabled,
      designerAutosaveEnabled,
      endAutoSaveSuspension,
      mergeCanvasFormat,
      propertyPhotoUrl,
      saveToHistory,
      savedTemplates,
      setIsDirty,
      setStyles,
    ]
  );

  const loadPresetEditorState = useCallback(
    (presetId: string, options?: { openAdvanced?: boolean }) => {
      beginAutoSaveSuspension();
      try {
        setActiveCustomTemplateId(null);

        if (isCalendarBlankPreset(presetId)) {
          applyPreset(presetId, accentColor, propertyPhotoUrl);
          setActiveAutosaveTemplateId(null);
          setSelectedTemplateKey(`preset:${presetId}`);
          setShowAdvancedSettings(options?.openAdvanced ?? false);
          setIsDirty(false);
          return;
        }

        const aspectPreset = aspectPresetForCalendarFormat(canvasFrame.format);
        const autosave = findCalendarAutosaveTemplate(apiTemplates, presetId, aspectPreset);
        const savedStyles = autosave?.designJson?.styles;

        if (savedStyles && typeof savedStyles === 'object') {
          setStyles(
            normalizeCalendarStyles(JSON.parse(JSON.stringify(savedStyles)) as CalendarStyles),
            { markDirty: false }
          );
          setActiveAutosaveTemplateId(autosave!.id);
        } else {
          applyPreset(presetId, accentColor, propertyPhotoUrl);
          setActiveAutosaveTemplateId(null);
        }

        setSelectedTemplateKey(`preset:${presetId}`);
        setShowAdvancedSettings(options?.openAdvanced ?? false);
        setIsDirty(false);
      } finally {
        endAutoSaveSuspension();
      }
    },
    [
      apiTemplates,
      applyPreset,
      beginAutoSaveSuspension,
      accentColor,
      canvasFrame.format,
      endAutoSaveSuspension,
      propertyPhotoUrl,
      setIsDirty,
      setStyles,
    ]
  );

  const loadCustomTemplateState = useCallback(
    (templateId: string, options?: { openAdvanced?: boolean }) => {
      const template = savedTemplates.find((item) => item.id === templateId);
      if (!template) return;
      if (!calendarTemplateMatchesAspectPreset(template.aspectPreset, canvasFrame.format)) return;

      beginAutoSaveSuspension();
      try {
        setStyles(
          normalizeCalendarStyles(JSON.parse(JSON.stringify(template.styles)) as CalendarStyles),
          { markDirty: false }
        );
        setActiveCustomTemplateId(templateId);
        setActiveAutosaveTemplateId(templateId);
        setSelectedTemplateKey(`custom:${templateId}`);
        setShowAdvancedSettings(options?.openAdvanced ?? false);
        setIsDirty(false);
      } finally {
        endAutoSaveSuspension();
      }
    },
    [
      beginAutoSaveSuspension,
      canvasFrame.format,
      endAutoSaveSuspension,
      savedTemplates,
      setIsDirty,
      setStyles,
    ]
  );

  const savedCalendarTemplatesForThumbs = useMemo(
    () =>
      savedTemplates.map((template) => ({
        id: template.id,
        sourcePresetId: template.sourcePresetId,
        aspectPreset: template.aspectPreset,
        styles: template.styles,
        updatedAt: template.createdAt,
        thumbnailDataUrl: template.thumbnailDataUrl,
      })),
    [savedTemplates]
  );

  useEffect(() => {
    if (selectedTemplateKey) return;
    loadPresetEditorState('default');
  }, [selectedTemplateKey, loadPresetEditorState]);

  useEffect(() => {
    if (!activeCustomTemplateId) return;
    const template = savedTemplates.find((item) => item.id === activeCustomTemplateId);
    if (
      template &&
      calendarTemplateMatchesAspectPreset(template.aspectPreset, canvasFrame.format)
    ) {
      return;
    }
    setActiveCustomTemplateId(null);
    setActiveAutosaveTemplateId(null);
    if (selectedTemplateKey?.startsWith('custom:')) {
      loadPresetEditorState('default');
    }
  }, [
    activeCustomTemplateId,
    canvasFrame.format,
    loadPresetEditorState,
    savedTemplates,
    selectedTemplateKey,
  ]);

  useEffect(() => {
    if (!designerAutosaveEnabled || !activeSourcePresetId || activeAutosaveTemplateId) return;
    const autosave = findCalendarAutosaveTemplate(
      apiTemplates,
      activeSourcePresetId,
      calendarAspectPreset
    );
    const savedStyles = autosave?.designJson?.styles;
    if (!autosave || !savedStyles || typeof savedStyles !== 'object') return;

    beginAutoSaveSuspension();
    try {
      setStyles(
        normalizeCalendarStyles(JSON.parse(JSON.stringify(savedStyles)) as CalendarStyles),
        { markDirty: false }
      );
      setActiveAutosaveTemplateId(autosave.id);
      setIsDirty(false);
    } finally {
      endAutoSaveSuspension();
    }
  }, [
    activeAutosaveTemplateId,
    activeSourcePresetId,
    apiTemplates,
    beginAutoSaveSuspension,
    calendarAspectPreset,
    designerAutosaveEnabled,
    endAutoSaveSuspension,
    setIsDirty,
    setStyles,
  ]);

  const previewBookingsForDisplay = useMemo(
    () => (bookings?.length ? bookings : MOCK_PREVIEW_BOOKINGS),
    [bookings]
  );
  const previewBlockedDaysForDisplay = useMemo(
    () => (blockedDays?.length ? blockedDays : MOCK_BLOCKED_DAYS),
    [blockedDays]
  );

  const thumbnailOptions = useMemo(
    () => ({
      contentType: 'calendar' as const,
      presetIds: calendarPresetIds,
      canvasFormat: canvasFrame.format,
      brandColor: accentColor,
      propertyPhotoUrl,
      previewMonth,
      previewBookings: previewBookingsForDisplay,
      savedCalendarTemplates: savedCalendarTemplatesForThumbs,
    }),
    [
      calendarPresetIds,
      canvasFrame.format,
      accentColor,
      propertyPhotoUrl,
      previewMonth,
      previewBookingsForDisplay,
      savedCalendarTemplatesForThumbs,
    ]
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

  const previewRef = exportContainerRef ?? calendarRef;

  const lastAppliedBrandRef = useRef<string | null>(null);

  useEffect(() => {
    const normalized = accentColor.toLowerCase();
    if (lastAppliedBrandRef.current === normalized) return;
    lastAppliedBrandRef.current = normalized;
    beginAutoSaveSuspension();
    try {
      const current = useCalendarBuilderStore.getState().styles;
      const preservePresetPalette = Boolean(
        activeSourcePresetId && !isCalendarBlankPreset(activeSourcePresetId)
      );
      setStyles(applyBrandAccentToCalendarStyles(current, accentColor, { preservePresetPalette }), {
        markDirty: false,
      });
    } finally {
      endAutoSaveSuspension();
    }
  }, [
    activeSourcePresetId,
    beginAutoSaveSuspension,
    accentColor,
    endAutoSaveSuspension,
    setStyles,
  ]);

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

  // Fullscreen handlers
  const handleOpenFullscreen = useCallback(() => {
    setFullscreenRelativeZoom(100);
    setIsFullscreen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreen(false);
    document.body.style.overflow = '';
  }, []);

  const handleFullscreenZoomIn = useCallback(() => {
    setFullscreenRelativeZoom((prev) =>
      stepCalendarZoomIn(prev, fullscreenLayout.maxRelativeZoomPercent)
    );
  }, [fullscreenLayout.maxRelativeZoomPercent]);

  const handleFullscreenZoomOut = useCallback(() => {
    setFullscreenRelativeZoom((prev) => stepCalendarZoomOut(prev));
  }, []);

  const handleFullscreenFitToScreen = useCallback(() => {
    setFullscreenRelativeZoom(100);
  }, []);

  // Handle Escape key to close fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        handleCloseFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, handleCloseFullscreen]);

  const handleReset = () => {
    if (selectedTemplateKey?.startsWith('custom:') && activeCustomTemplateId) {
      loadCustomTemplateState(activeCustomTemplateId);
      toast.success('Reset to saved');
      return;
    }
    beginAutoSaveSuspension();
    try {
      if (activeSourcePresetId && !isCalendarBlankPreset(activeSourcePresetId)) {
        applyPreset(activeSourcePresetId, accentColor, propertyPhotoUrl);
      } else {
        resetStyles(accentColor);
      }
      setIsDirty(false);
    } finally {
      endAutoSaveSuspension();
    }
    toast.success('Reset to default');
  };

  const handleSelectBlank = () => {
    loadPresetEditorState('default');
  };

  const handleCustomizeBlank = () => {
    loadPresetEditorState('default', { openAdvanced: true });
  };

  const handleApplyPreset = (value: string) => {
    loadPresetEditorState(value);
  };

  const handleCustomizePreset = (value: string) => {
    loadPresetEditorState(value, { openAdvanced: true });
  };

  const handleSelectCustom = (id: string) => {
    loadCustomTemplateState(id);
  };

  const handleCustomizeCustom = (id: string) => {
    loadCustomTemplateState(id, { openAdvanced: true });
  };

  const handleRemoveCustom = useCallback(
    async (id: string) => {
      const removeIds = planCalendarRelatedCustomRemoval(apiTemplates, id);
      const results = await Promise.all(removeIds.map((templateId) => deleteTemplate(templateId)));
      if (!results.some(Boolean)) return;

      const removedActive = removeIds.some(
        (templateId) =>
          activeCustomTemplateId === templateId || selectedTemplateKey === `custom:${templateId}`
      );
      if (removedActive) {
        loadPresetEditorState('default');
      }

      const removedCount = results.filter(Boolean).length;
      toast.success(
        removedCount > 1
          ? `Removed ${removedCount} formats (Square, Portrait, Landscape)`
          : 'Template removed'
      );
    },
    [
      activeCustomTemplateId,
      apiTemplates,
      deleteTemplate,
      loadPresetEditorState,
      selectedTemplateKey,
    ]
  );

  const handleRenameCustom = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const renameIds = planCalendarRelatedCustomIds(apiTemplates, id);
      const results = await Promise.all(
        renameIds.map((templateId) => renameTemplate(templateId, trimmed))
      );
      if (!results.some(Boolean)) return;

      const renamedCount = results.filter(Boolean).length;
      toast.success(
        renamedCount > 1
          ? `Renamed ${renamedCount} formats (Square, Portrait, Landscape)`
          : 'Template renamed'
      );
    },
    [apiTemplates, renameTemplate]
  );

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
      beginAutoSaveSuspension();
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
        const imageUrls = calendarPropertyImages.map((item) => item.url);
        const variants = CALENDAR_AI_FORMATS.map((format) => {
          const randomPhoto = input.includeContext.propertyPhoto
            ? pickRandomPropertyPhoto(imageUrls)
            : null;
          const photoUrl = randomPhoto ?? undefined;
          const styles = resolveAiGeneratedCalendarStyles(tokens, {
            format,
            brandColor: accentColor,
            propertyPhotoUrl: photoUrl,
          });
          return {
            format,
            aspectPreset: calendarFormatToAspectPreset(format),
            styles: applyCalendarAiElementsToStyles(styles, calendarPreferences.elements),
          };
        });
        const aiGenerationId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `ai-${Date.now()}`;

        const settled = await Promise.allSettled(
          variants.map((variant) =>
            saveMarketingTemplate(propertyId, {
              name: tokens.label,
              contentType: 'calendar',
              aspectPreset: variant.aspectPreset,
              designJson: {
                styles: JSON.parse(JSON.stringify(variant.styles)),
                sourcePresetId: CALENDAR_CUSTOM_PRESET_ID,
                aiGenerated: true,
                aiGenerationId,
                aiTokens: tokens,
              },
            })
          )
        );

        const savedRecords = settled
          .filter(
            (
              entry
            ): entry is PromiseFulfilledResult<Awaited<ReturnType<typeof saveMarketingTemplate>>> =>
              entry.status === 'fulfilled'
          )
          .map((entry) => entry.value);
        const failedCount = settled.filter((entry) => entry.status === 'rejected').length;

        void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });

        if (savedRecords.length === 0) {
          const firstReject = settled.find((entry) => entry.status === 'rejected') as
            PromiseRejectedResult | undefined;
          throw firstReject?.reason instanceof Error
            ? firstReject.reason
            : new Error('Could not save generated templates');
        }

        const currentAspect = aspectPresetForCalendarFormat(canvasFrame.format);
        const preferred =
          savedRecords.find((record) => record.aspectPreset === currentAspect) ?? savedRecords[0];
        const preferredStyles =
          variants.find((variant) => variant.aspectPreset === preferred?.aspectPreset)?.styles ??
          variants[0]?.styles;

        if (preferred && preferredStyles) {
          saveToHistory();
          setStyles(preferredStyles, { markDirty: false });
          setActiveCustomTemplateId(preferred.id);
          setActiveAutosaveTemplateId(preferred.id);
          setSelectedTemplateKey(`custom:${preferred.id}`);
          setShowAdvancedSettings(false);
          setIsDirty(false);
          markBaseline();
        }

        setAiGenerateOpen(false);
        if (failedCount > 0) {
          toast.warning(`Saved ${savedRecords.length} of 3 formats. Retry Generate for the rest`);
        } else {
          toast.success('Custom templates added for Square, Portrait, and Landscape');
        }
      } catch (error) {
        // AI failures already toast via useGenerateMarketingTemplate.onError
        if (aiSucceeded) {
          toast.error((error as Error).message || 'Could not save generated templates');
        }
      } finally {
        endAutoSaveSuspension();
        setAiGenerateBusy(false);
      }
    },
    [
      amenitiesText,
      availabilityText,
      beginAutoSaveSuspension,
      accentColor,
      calendarPropertyImages,
      canvasFrame.format,
      endAutoSaveSuspension,
      generateTemplate,
      markBaseline,
      propertyId,
      queryClient,
      saveToHistory,
      setIsDirty,
      setStyles,
    ]
  );

  const headerActions = useMemo(
    () => (
      <>
        {calendarAutosaveEnabled ? (
          <MarketingAutoSaveStatus status={autoSaveStatus} errorMessage={autoSaveError} />
        ) : null}
        {/* Below lg the builder header would wrap these into a tall second row and eat
            canvas height — Download / Publish / Save move into MarketingEditorMobileToolbar. */}
        {isBelowLg ? null : (
          <>
            {manualSaveEnabled ? (
              <SaveMarketingTemplateButton
                contentType="calendar"
                designJson={customDesignJson}
                defaultName="Custom calendar"
                aspectPreset={calendarAspectPreset}
                buttonLabel="Save Template"
                updateLabel="Save Template"
                onSaved={handleCustomTemplateSaved}
              />
            ) : null}
            {onExport ? (
              <TierBadgeAnchor feature="marketingStudio">
                <Button
                  variant="outline"
                  className="min-h-[44px] gap-2"
                  onClick={onExport}
                  disabled={isExporting}
                >
                  <Download className="size-4" aria-hidden />
                  {isExporting ? 'Exporting…' : 'Download PNG'}
                </Button>
              </TierBadgeAnchor>
            ) : null}
            {onPublish ? (
              <TierBadgeAnchor feature="marketingPublishLimitPerGroup">
                <Button className="min-h-[44px] gap-2" onClick={onPublish} disabled={isExporting}>
                  <Send className="size-4" aria-hidden />
                  {MARKETING_PUBLISH_META_LABEL}
                </Button>
              </TierBadgeAnchor>
            ) : null}
          </>
        )}
      </>
    ),
    [
      autoSaveError,
      autoSaveStatus,
      calendarAspectPreset,
      calendarAutosaveEnabled,
      customDesignJson,
      handleCustomTemplateSaved,
      isBelowLg,
      isExporting,
      manualSaveEnabled,
      onExport,
      onPublish,
    ]
  );

  useMarketingStudioHeaderActions(headerActions);

  return (
    <TooltipProvider>
      <CalendarPropertyMediaProvider images={calendarPropertyImages}>
        <CalendarThumbnailsProvider
          options={thumbnailOptions}
          propertyName={propertyName}
          liveCaptureRef={previewRef as React.RefObject<HTMLDivElement | null>}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            <MarketingEditorSidebar
              layoutKey="calendar"
              mobileVariant="sheet"
              mobileOpen={mobilePanelOpen}
              onMobileOpenChange={setMobilePanelOpen}
              mobileTitle={showAdvancedSettings ? 'Calendar settings' : 'Templates'}
              header={
                showAdvancedSettings ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] gap-2"
                      onClick={() => setShowAdvancedSettings(false)}
                    >
                      <ChevronLeftIcon className="size-4" aria-hidden />
                      Templates
                    </Button>
                    <span className="text-sm font-medium">Settings</span>
                  </div>
                ) : (
                  <p className="text-sm font-medium">Templates</p>
                )
              }
            >
              {showAdvancedSettings ? (
                <div className="space-y-4 pb-4">
                  <CalendarFormatPicker
                    brandColor={accentColor}
                    onFormatChange={handleCanvasFormatChange}
                  />
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
              ) : (
                <div className="space-y-4 pb-4">
                  {canGenerate ? (
                    <TierBadgeAnchor feature="aiMarketingGeneration" className="w-full">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px] w-full gap-2"
                        disabled={aiGenerateBusy || generateTemplate.isPending}
                        onClick={() => setAiGenerateOpen(true)}
                      >
                        <Sparkles className="size-4" aria-hidden />
                        {aiGenerateBusy || generateTemplate.isPending
                          ? 'Generating…'
                          : 'Generate with AI'}
                      </Button>
                    </TierBadgeAnchor>
                  ) : null}
                  <CalendarFormatPicker
                    brandColor={accentColor}
                    onFormatChange={handleCanvasFormatChange}
                  />
                  <CalendarTemplateSidebar
                    categories={CALENDAR_PRESET_CATEGORIES}
                    customTemplates={customTemplates}
                    selectedKey={selectedTemplateKey}
                    canvasFormat={canvasFrame.format}
                    onSelectPreset={(value) => {
                      handleApplyPreset(value);
                      closeMobilePanel();
                    }}
                    onCustomizePreset={handleCustomizePreset}
                    onSelectBlank={() => {
                      handleSelectBlank();
                      closeMobilePanel();
                    }}
                    onCustomizeBlank={handleCustomizeBlank}
                    onSelectCustom={(id) => {
                      handleSelectCustom(id);
                      closeMobilePanel();
                    }}
                    onCustomizeCustom={handleCustomizeCustom}
                    onRenameCustom={handleRenameCustom}
                    onRemoveCustom={handleRemoveCustom}
                  />
                </div>
              )}
            </MarketingEditorSidebar>

            {/* Right Side - Preview */}
            <div
              className={cn(
                marketingEditorWorkspaceClassName,
                'flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden'
              )}
            >
              <MarketingPreviewHeader
                leading={
                  isBelowLg ? (
                    // Mobile: a full-width month stepper sits at the top of the canvas,
                    // consistent with the app's other date navigators (no cramped
                    // right-floated pill).
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
                        {previewMonth.toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })}
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
                    <MarketingEditorHistoryControls
                      canUndo={canUndo()}
                      canRedo={canRedo()}
                      onUndo={undo}
                      onRedo={redo}
                      onReset={handleReset}
                    />
                  )
                }
                actions={
                  isBelowLg ? undefined : (
                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
                      {/* Month Navigation */}
                      <div className="border-border bg-background flex items-center gap-1 rounded-md border px-1 py-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 min-h-[44px] w-9 min-w-[44px]"
                              onClick={prevMonth}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Previous Month</TooltipContent>
                        </Tooltip>
                        <span className="min-w-[100px] text-center text-xs font-medium">
                          {previewMonth.toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 min-h-[44px] w-9 min-w-[44px]"
                              onClick={nextMonth}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Next Month</TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="bg-border hidden h-5 w-px lg:block" />

                      {/* Zoom Controls — desktop only; mobile uses MarketingEditorMobileToolbar */}
                      <div className="border-border bg-background flex items-center gap-1 rounded-md border px-1 py-0.5 max-lg:hidden">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 min-h-[44px] w-9 min-w-[44px]"
                              onClick={handleZoomOut}
                              disabled={relativeZoom <= CALENDAR_MIN_RELATIVE_ZOOM}
                            >
                              <ZoomOut className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Zoom Out</TooltipContent>
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
                              variant="ghost"
                              size="icon"
                              className="h-9 min-h-[44px] w-9 min-w-[44px]"
                              onClick={handleFitToScreen}
                            >
                              <Minimize2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Fit to View</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 min-h-[44px] w-9 min-w-[44px]"
                              onClick={handleOpenFullscreen}
                            >
                              <Maximize2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Fullscreen</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  )
                }
              />

              {/* Preview Area — the studio shell ends just above the floating editor dock
                  on mobile, so only a small bottom gutter is needed here. */}
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
          </div>

          {/* Mobile editor dock (max-lg) — panel toggle + zoom + overflow. Replaces the
              app bottom tab bar while the Calendar editor is open. */}
          {!isFullscreen ? (
            <MarketingEditorMobileToolbar
              panelLabel={showAdvancedSettings ? 'Settings' : 'Templates'}
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
                    onClick={handleZoomOut}
                    disabled={relativeZoom <= CALENDAR_MIN_RELATIVE_ZOOM}
                  >
                    <ZoomOut className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 min-h-[44px] min-w-[44px]"
                    aria-label="Zoom in"
                    onClick={handleZoomIn}
                    disabled={relativeZoom >= previewLayout.maxRelativeZoomPercent}
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
                  key: 'fit',
                  label: 'Fit to view',
                  icon: <Minimize2 className="size-5" aria-hidden />,
                  onSelect: handleFitToScreen,
                },
                {
                  key: 'fullscreen',
                  label: 'Fullscreen preview',
                  icon: <Maximize2 className="size-5" aria-hidden />,
                  onSelect: handleOpenFullscreen,
                },
                {
                  key: 'reset',
                  label: 'Reset changes',
                  icon: <RotateCcw className="size-5" aria-hidden />,
                  onSelect: handleReset,
                },
                ...(canGenerate
                  ? [
                      {
                        key: 'ai',
                        label: 'Generate with AI',
                        icon: <Sparkles className="size-5" aria-hidden />,
                        trailing: <TierBadge feature="aiMarketingGeneration" />,
                        disabled: aiGenerateBusy || generateTemplate.isPending,
                        onSelect: () => setAiGenerateOpen(true),
                      },
                    ]
                  : []),
                ...(onExport
                  ? [
                      {
                        key: 'download',
                        label: isExporting ? 'Exporting…' : 'Download PNG',
                        icon: <Download className="size-5" aria-hidden />,
                        trailing: <TierBadge feature="marketingStudio" />,
                        disabled: isExporting,
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
                        disabled: isExporting,
                        onSelect: onPublish,
                      },
                    ]
                  : []),
              ]}
            />
          ) : null}

          {/* Fullscreen Overlay */}
          {isFullscreen && (
            <div className="bg-background/95 fixed inset-0 z-50 flex flex-col backdrop-blur-sm">
              {/* Fullscreen Header — wraps + tightens on mobile so the pill clusters
                  never overflow a 375px viewport. */}
              <div className="border-border bg-background flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-3 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                  <h2 className="text-base font-semibold sm:text-lg">Calendar Preview</h2>
                  <span className="text-muted-foreground hidden truncate text-sm sm:inline">
                    {propertyName} •{' '}
                    {previewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
                  {/* Month Navigation */}
                  <div className="border-border bg-muted/50 flex items-center gap-1 rounded-md border px-1 py-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 min-h-[44px] min-w-[44px]"
                          onClick={prevMonth}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Previous Month</TooltipContent>
                    </Tooltip>
                    <span className="min-w-[100px] text-center text-sm font-medium">
                      {previewMonth.toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 min-h-[44px] min-w-[44px]"
                          onClick={nextMonth}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Next Month</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Zoom Controls */}
                  <div className="border-border bg-muted/50 flex items-center gap-1 rounded-md border px-1 py-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 min-h-[44px] min-w-[44px]"
                          onClick={handleFullscreenZoomOut}
                          disabled={fullscreenRelativeZoom <= CALENDAR_MIN_RELATIVE_ZOOM}
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Zoom Out</TooltipContent>
                    </Tooltip>
                    <span className="min-w-[56px] text-center text-sm font-medium">
                      {fullscreenRelativeZoom}%
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 min-h-[44px] min-w-[44px]"
                          onClick={handleFullscreenZoomIn}
                          disabled={
                            fullscreenRelativeZoom >= fullscreenLayout.maxRelativeZoomPercent
                          }
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Zoom In</TooltipContent>
                    </Tooltip>
                    <div className="bg-border mx-1 h-5 w-px" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 min-h-[44px] min-w-[44px]"
                          onClick={handleFullscreenFitToScreen}
                        >
                          <Minimize2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Fit to Screen</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Close Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 min-h-[44px] min-w-[44px]"
                        onClick={handleCloseFullscreen}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Close Fullscreen (Esc)</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Fullscreen Preview Area */}
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
          )}
        </CalendarThumbnailsProvider>
      </CalendarPropertyMediaProvider>

      <MarketingAiGeneratePanel
        open={aiGenerateOpen}
        onOpenChange={(open) => {
          if (aiGenerateBusy && !open) return;
          setAiGenerateOpen(open);
        }}
        contentType="calendar"
        generating={aiGenerateBusy || generateTemplate.isPending}
        propertyPhotoUrls={propertyPhotoUrls}
        brandColor={brandColor}
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
