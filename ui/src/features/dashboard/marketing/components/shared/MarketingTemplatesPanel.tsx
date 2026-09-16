import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { CollageStartFromControl } from '@/features/dashboard/marketing/components/design-editor/collage/CollageStartFromControl';
import { MarketingCategoryChip } from '@/features/dashboard/marketing/components/shared/MarketingCategoryChip';
import {
  MarketingFormatPicker,
  type MarketingFormatOption,
} from '@/features/dashboard/marketing/components/shared/MarketingFormatPicker';
import { MarketingMoveTemplateDialog } from '@/features/dashboard/marketing/components/shared/MarketingMoveTemplateDialog';
import { MarketingNameDialog } from '@/features/dashboard/marketing/components/shared/MarketingNameDialog';
import { MarketingReviewSidebarSection } from '@/features/dashboard/marketing/components/shared/MarketingReviewSidebarSection';
import { MARKETING_SIDEBAR_GRID } from '@/features/dashboard/marketing/components/shared/marketingSidebarLayout';
import { MarketingSidebarSection } from '@/features/dashboard/marketing/components/shared/MarketingSidebarSection';
import type { MarketingSidebarMenuItem } from '@/features/dashboard/marketing/components/shared/MarketingSidebarSection';
import { MarketingTemplateCard } from '@/features/dashboard/marketing/components/shared/MarketingTemplateCard';
import {
  useMarketingCatalog,
  type MarketingCatalogTab,
} from '@/features/dashboard/marketing/hooks/useMarketingCatalog';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import {
  deleteMarketingTemplate,
  updateMarketingTemplate,
  useSaveMarketingTemplate,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { useMarketingTemplateThumbnails } from '@/features/dashboard/marketing/hooks/useMarketingTemplateThumbnails';
import type { CollageStartFrom } from '@/features/dashboard/marketing/lib/collage/collageTypes';
import { DESIGN_CUSTOM_SOURCE_PRESET_ID } from '@/features/dashboard/marketing/lib/designAutosave';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { isHiddenCategoryId } from '@/features/dashboard/marketing/lib/marketingCatalogHidden';
import { resolveFormatOptionDimensions } from '@/features/dashboard/marketing/lib/marketingFormats';
import type { MarketingGuestReview } from '@/features/dashboard/marketing/lib/marketingGuestReview';
import {
  isDesignCustomTemplate,
  isSavedCollageTemplate,
  marketingSavedTemplateCategoryId,
  marketingSavedTemplateMatchesFormat,
  marketingVideoSavedCategoryId,
  planSavedTemplateRelatedIds,
} from '@/features/dashboard/marketing/lib/marketingSavedTemplates';
import type { VideoFormat } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export type PresetTemplateItem = {
  id: string;
  name: string;
  category: string;
  swatchPrimary: string;
  swatchSecondary?: string;
  badge?: string;
};

type DialogState =
  | { kind: 'add-category' }
  | { kind: 'rename-category'; categoryId: string; defaultValue: string }
  | { kind: 'rename-preset'; templateId: string; defaultValue: string }
  | { kind: 'rename-saved'; recordId: string; defaultValue: string }
  | { kind: 'save-template' }
  | null;

type MoveTarget =
  | {
      kind: 'preset';
      templateId: string;
      templateName: string;
      currentCategoryId: string;
    }
  | {
      kind: 'saved';
      recordId: string;
      templateName: string;
      currentCategoryId: string;
    };

type DeleteTarget =
  | { kind: 'category'; categoryId: string }
  | { kind: 'saved-template'; recordId: string; name: string };

type Props = {
  tab: MarketingCatalogTab;
  contentType: 'design' | 'video';
  formatOptions: MarketingFormatOption[];
  format: string;
  onFormatChange: (format: string) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  presetTemplates: PresetTemplateItem[];
  selectedId: string;
  onSelectPreset: (templateId: string) => void;
  onCustomizePreset?: (templateId: string) => void;
  savedRecords?: MarketingTemplateRecord[];
  selectedSavedId?: string | null;
  onSelectSaved?: (record: MarketingTemplateRecord) => void;
  onSavedTemplate?: (record: MarketingTemplateRecord) => void;
  onOpenAiGenerate?: () => void;
  aiGenerateBusy?: boolean;
  /** When set, shows Reviews list under Templates (Reviews / Social proof categories). */
  selectedReviewId?: string | null;
  onSelectReview?: (review: MarketingGuestReview) => void;
  designJsonForSave?: Record<string, unknown> | (() => Record<string, unknown> | null);
  aspectPreset?: string;
  platform?: string;
  /** Video: hide rename/delete on template cards; use editor settings instead */
  videoTemplateMenus?: 'minimal' | 'full';
  brandColor?: string;
  binding?: DesignBinding;
  /** Capture a JPEG data URL when saving a custom template (stored in designJson.thumbnailDataUrl). */
  captureSaveThumbnail?: () => Promise<string | null>;
  getThumbnailUrl?: (id: string) => string | undefined;
  isThumbnailLoading?: (id: string) => boolean;
  /** Design-only "Start from" segmented control (Templates / Collage / Blank). */
  startFrom?: CollageStartFrom;
  onStartFromChange?: (value: CollageStartFrom) => void;
  collagePanelSlot?: ReactNode;
  blankPanelSlot?: ReactNode;
};

export function MarketingTemplatesPanel({
  tab,
  contentType,
  formatOptions,
  format,
  onFormatChange,
  category,
  onCategoryChange,
  presetTemplates,
  selectedId,
  onSelectPreset,
  onCustomizePreset,
  savedRecords = [],
  selectedSavedId = null,
  onSelectSaved,
  onSavedTemplate,
  onOpenAiGenerate,
  aiGenerateBusy = false,
  selectedReviewId = null,
  onSelectReview,
  designJsonForSave,
  aspectPreset,
  platform,
  videoTemplateMenus = tab === 'video' ? 'minimal' : 'full',
  brandColor,
  binding,
  captureSaveThumbnail,
  getThumbnailUrl: getThumbnailUrlProp,
  isThumbnailLoading: isThumbnailLoadingProp,
  startFrom,
  onStartFromChange,
  collagePanelSlot,
  blankPanelSlot,
}: Props) {
  const catalog = useMarketingCatalog(tab);
  const { canGenerate } = useMarketingPermissions();
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const saveTemplate = useSaveMarketingTemplate();

  useEffect(() => {
    if (!isHiddenCategoryId(category)) return;
    const fallback = catalog.movableCategories[0];
    if (fallback) onCategoryChange(fallback.id);
  }, [category, catalog.movableCategories, onCategoryChange]);

  const visibleSavedRecords = useMemo(() => {
    return savedRecords.filter((record) => {
      if (contentType === 'design' && !isDesignCustomTemplate(record)) return false;
      if (!marketingSavedTemplateMatchesFormat(record, format)) return false;
      const savedCategory =
        tab === 'video'
          ? marketingVideoSavedCategoryId(record)
          : marketingSavedTemplateCategoryId(record);
      return savedCategory === category;
    });
  }, [savedRecords, contentType, format, category, tab]);

  const visibleSavedIds = useMemo(
    () => visibleSavedRecords.map((record) => record.id),
    [visibleSavedRecords]
  );

  const visiblePresets = useMemo(() => {
    return presetTemplates.filter((template) => {
      const effectiveCategory = catalog.getPresetCategory(template.id, template.category);
      return effectiveCategory === category;
    });
  }, [presetTemplates, category, catalog]);

  const visiblePresetIds = useMemo(
    () => visiblePresets.map((template) => template.id),
    [visiblePresets]
  );

  const thumbnailOptions = useMemo(
    () =>
      contentType === 'video'
        ? {
            contentType: 'video' as const,
            presetIds: visiblePresetIds,
            format: format as VideoFormat,
            brandColor,
            binding,
            savedRecords: visibleSavedRecords,
          }
        : {
            contentType: 'design' as const,
            presetIds: visiblePresetIds,
            brandColor,
            savedRecords: visibleSavedRecords,
          },
    [contentType, visiblePresetIds, format, brandColor, binding, visibleSavedRecords]
  );

  const thumbnailHook = useMarketingTemplateThumbnails(thumbnailOptions);
  const { requestThumbnail, requestThumbnails } = thumbnailHook;

  const visiblePresetIdsKey = visiblePresetIds.join(',');

  useEffect(() => {
    if (visiblePresetIds.length === 0) return;
    requestThumbnails(visiblePresetIds);
  }, [visiblePresetIdsKey, visiblePresetIds, requestThumbnails]);

  const visibleSavedIdsKey = visibleSavedIds.join(',');

  useEffect(() => {
    if (visibleSavedIds.length === 0) return;
    requestThumbnails(visibleSavedIds.map((id) => `saved:${id}`));
  }, [visibleSavedIdsKey, visibleSavedIds, requestThumbnails]);

  useEffect(() => {
    if (selectedId && !selectedSavedId) requestThumbnail(selectedId);
  }, [selectedId, selectedSavedId, requestThumbnail]);

  useEffect(() => {
    if (selectedSavedId) requestThumbnail(`saved:${selectedSavedId}`);
  }, [selectedSavedId, requestThumbnail]);

  const getThumbnailUrl = getThumbnailUrlProp ?? thumbnailHook.getThumbnailUrl;
  const isThumbnailLoading = isThumbnailLoadingProp ?? thumbnailHook.isThumbnailLoading;

  const formatDims = useMemo(
    () => resolveFormatOptionDimensions(formatOptions, format),
    [formatOptions, format]
  );

  const [dialog, setDialog] = useState<DialogState>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const categoryMenuItems = (
    categoryId: string,
    kind: 'builtin' | 'custom'
  ): MarketingSidebarMenuItem[] => {
    const renameItem: MarketingSidebarMenuItem = {
      id: 'rename',
      label: 'Rename',
      onSelect: () => {
        const label =
          catalog.categories.find((item) => item.id === categoryId)?.label ?? categoryId;
        setDialog({ kind: 'rename-category', categoryId, defaultValue: label });
      },
    };

    if (kind === 'custom') {
      return [
        renameItem,
        {
          id: 'delete',
          label: 'Remove',
          destructive: true,
          onSelect: () => setDeleteTarget({ kind: 'category', categoryId }),
        },
      ];
    }

    return [renameItem];
  };

  const moveMenuItem = (target: MoveTarget): MarketingSidebarMenuItem | null => {
    const hasOtherCategories = catalog.movableCategories.some(
      (item) => item.id !== target.currentCategoryId
    );
    if (!hasOtherCategories) return null;
    return {
      id: 'move',
      label: 'Move',
      onSelect: () => setMoveTarget(target),
    };
  };

  const savedMenuItems = (record: MarketingTemplateRecord): MarketingSidebarMenuItem[] => {
    const currentCategoryId =
      (tab === 'video'
        ? marketingVideoSavedCategoryId(record)
        : marketingSavedTemplateCategoryId(record)) ?? category;
    const moveItem = moveMenuItem({
      kind: 'saved',
      recordId: record.id,
      templateName: record.name,
      currentCategoryId,
    });

    return [
      {
        id: 'rename',
        label: 'Rename',
        onSelect: () =>
          setDialog({ kind: 'rename-saved', recordId: record.id, defaultValue: record.name }),
      },
      ...(moveItem ? [moveItem] : []),
      {
        id: 'delete',
        label: 'Remove',
        destructive: true,
        onSelect: () =>
          setDeleteTarget({ kind: 'saved-template', recordId: record.id, name: record.name }),
      },
    ];
  };

  const presetMenuItems = (templateId: string, displayName: string, currentCategoryId: string) => {
    const moveItem = moveMenuItem({
      kind: 'preset',
      templateId,
      templateName: displayName,
      currentCategoryId,
    });
    if (videoTemplateMenus === 'minimal') {
      return moveItem ? [moveItem] : [];
    }
    return [
      {
        id: 'rename',
        label: 'Rename',
        onSelect: () => setDialog({ kind: 'rename-preset', templateId, defaultValue: displayName }),
      },
      ...(moveItem ? [moveItem] : []),
    ];
  };

  const handleMoveConfirm = (targetCategoryId: string) => {
    if (!moveTarget) return;

    if (moveTarget.kind === 'preset') {
      catalog.movePresetTemplate(moveTarget.templateId, targetCategoryId);
      toast.success('Template moved');
      setMoveTarget(null);
      if (category === moveTarget.currentCategoryId) {
        onCategoryChange(targetCategoryId);
      }
      return;
    }

    const ids = planSavedTemplateRelatedIds(savedRecords, moveTarget.recordId);
    void (async () => {
      try {
        await Promise.all(
          ids.map((id) => {
            const record = savedRecords.find((item) => item.id === id);
            if (!record) return Promise.resolve();
            return updateMarketingTemplate(propertyId, {
              id,
              designJson: {
                ...record.designJson,
                categoryId: targetCategoryId,
                category: targetCategoryId,
              },
            });
          })
        );
        void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });
        toast.success(ids.length > 1 ? `Moved ${ids.length} formats` : 'Template moved');
        setMoveTarget(null);
        if (category === moveTarget.currentCategoryId) {
          onCategoryChange(targetCategoryId);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Move failed');
      }
    })();
  };

  const handleDialogConfirm = async (value: string) => {
    if (!dialog) return;

    try {
      switch (dialog.kind) {
        case 'add-category': {
          const id = catalog.addCategory(value);
          if (id) onCategoryChange(id);
          break;
        }
        case 'rename-category':
          catalog.renameCategory(dialog.categoryId, value);
          break;
        case 'rename-preset':
          catalog.renamePresetTemplate(dialog.templateId, value);
          break;
        case 'rename-saved': {
          const trimmed = value.trim();
          if (!trimmed) return;
          const ids = planSavedTemplateRelatedIds(savedRecords, dialog.recordId);
          await Promise.all(
            ids.map((id) => updateMarketingTemplate(propertyId, { id, name: trimmed }))
          );
          void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });
          toast.success(ids.length > 1 ? `Renamed ${ids.length} formats` : 'Template renamed');
          break;
        }
        case 'save-template':
          {
            const designJsonPayload =
              typeof designJsonForSave === 'function' ? designJsonForSave() : designJsonForSave;
            if (!designJsonPayload) {
              toast.error('Nothing to save yet');
              return;
            }
            const thumbnailDataUrl = captureSaveThumbnail
              ? await captureSaveThumbnail()
              : undefined;
            const record = await saveTemplate.mutateAsync({
              name: value,
              contentType,
              platform,
              aspectPreset: aspectPreset ?? format,
              designJson: {
                ...designJsonPayload,
                ...(contentType === 'design'
                  ? { sourcePresetId: DESIGN_CUSTOM_SOURCE_PRESET_ID }
                  : {}),
                categoryId: category,
                ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
              },
            });
            onSavedTemplate?.(record);
          }
          break;
        default:
          break;
      }
      setDialog(null);
    } catch {
      // Mutation hook surfaces toast errors; keep dialog open.
      throw new Error('Dialog action failed');
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'category') {
      catalog.deleteCategory(deleteTarget.categoryId);
      if (category === deleteTarget.categoryId) {
        const fallback = catalog.movableCategories.find(
          (item) => item.id !== deleteTarget.categoryId
        );
        if (fallback) onCategoryChange(fallback.id);
      }
      setDeleteTarget(null);
      return;
    }

    const ids = planSavedTemplateRelatedIds(savedRecords, deleteTarget.recordId);
    void (async () => {
      try {
        await Promise.all(ids.map((id) => deleteMarketingTemplate(propertyId, id)));
        void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });
        toast.success(ids.length > 1 ? `Removed ${ids.length} formats` : 'Template removed');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Delete failed');
      } finally {
        setDeleteTarget(null);
      }
    })();
  };

  const dialogMeta = (() => {
    if (!dialog) return null;
    switch (dialog.kind) {
      case 'add-category':
        return { title: 'New category', confirmLabel: 'Add', defaultValue: '' };
      case 'rename-category':
        return {
          title: 'Rename category',
          confirmLabel: 'Save',
          defaultValue: dialog.defaultValue,
        };
      case 'rename-preset':
      case 'rename-saved':
        return {
          title: 'Rename template',
          confirmLabel: 'Save',
          defaultValue: dialog.defaultValue,
        };
      case 'save-template':
        return { title: 'Save template', confirmLabel: 'Save', defaultValue: 'My template' };
      default:
        return null;
    }
  })();

  const hasTemplates = visiblePresets.length > 0 || visibleSavedRecords.length > 0;
  const showGuestReviewsSection =
    Boolean(onSelectReview) &&
    ((contentType === 'design' && category === 'reviews') ||
      (contentType === 'video' && category === 'reviews'));
  const showStartFromControl = contentType === 'design' && Boolean(onStartFromChange);
  const effectiveStartFrom: CollageStartFrom = startFrom ?? 'templates';
  const isTemplatesMode = !showStartFromControl || effectiveStartFrom === 'templates';

  return (
    <>
      <div className="space-y-4">
        {showStartFromControl && onStartFromChange ? (
          <CollageStartFromControl value={effectiveStartFrom} onChange={onStartFromChange} />
        ) : null}
        {isTemplatesMode && onOpenAiGenerate && canGenerate ? (
          <TierBadgeAnchor feature="aiMarketingGeneration" className="w-full">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full gap-2"
              disabled={aiGenerateBusy}
              onClick={onOpenAiGenerate}
            >
              <Sparkles className="size-4" aria-hidden />
              {aiGenerateBusy ? 'Generating…' : 'Generate with AI'}
            </Button>
          </TierBadgeAnchor>
        ) : null}
        <MarketingFormatPicker options={formatOptions} value={format} onChange={onFormatChange} />

        {isTemplatesMode ? (
          <MarketingSidebarSection
            title="Category"
            collapsible={false}
            onAdd={() => setDialog({ kind: 'add-category' })}
            addLabel="Add category"
          >
            <div className={MARKETING_SIDEBAR_GRID}>
              {catalog.categories.map((item) => (
                <MarketingCategoryChip
                  key={item.id}
                  id={item.id}
                  label={item.label}
                  selected={category === item.id}
                  onClick={() => onCategoryChange(item.id)}
                  menuItems={categoryMenuItems(item.id, item.kind)}
                />
              ))}
            </div>
          </MarketingSidebarSection>
        ) : null}
      </div>

      {isTemplatesMode ? (
        <MarketingSidebarSection
          title="Templates"
          collapsible={false}
          onAdd={designJsonForSave ? () => setDialog({ kind: 'save-template' }) : undefined}
          addLabel="Save template"
        >
          {hasTemplates ? (
            <ul className={MARKETING_SIDEBAR_GRID}>
              {visibleSavedRecords.map((record) => (
                <li key={record.id} className="min-w-0">
                  <MarketingTemplateCard
                    name={record.name}
                    badge={isSavedCollageTemplate(record) ? 'Collage' : undefined}
                    thumbnailUrl={
                      getThumbnailUrl?.(record.id) ?? getThumbnailUrl?.(`saved:${record.id}`)
                    }
                    thumbnailLoading={
                      isThumbnailLoading?.(record.id) ?? isThumbnailLoading?.(`saved:${record.id}`)
                    }
                    onRequestThumbnail={() => requestThumbnail(`saved:${record.id}`)}
                    thumbnailWidth={formatDims.width}
                    thumbnailHeight={formatDims.height}
                    thumbnailOrientation={formatDims.orientation}
                    selected={selectedSavedId === record.id}
                    onClick={() => onSelectSaved?.(record)}
                    menuItems={savedMenuItems(record)}
                  />
                </li>
              ))}
              {visiblePresets.map((template) => {
                const displayName = catalog.getTemplateLabel(template.id, template.name);
                const currentCategoryId = catalog.getPresetCategory(template.id, template.category);
                return (
                  <li key={template.id} className="min-w-0">
                    <MarketingTemplateCard
                      name={displayName}
                      badge={template.badge}
                      thumbnailUrl={getThumbnailUrl?.(template.id)}
                      thumbnailLoading={isThumbnailLoading?.(template.id)}
                      onRequestThumbnail={() => requestThumbnail(template.id)}
                      thumbnailWidth={formatDims.width}
                      thumbnailHeight={formatDims.height}
                      thumbnailOrientation={formatDims.orientation}
                      selected={!selectedSavedId && selectedId === template.id}
                      onClick={() => onSelectPreset(template.id)}
                      onCustomize={
                        onCustomizePreset ? () => onCustomizePreset(template.id) : undefined
                      }
                      menuItems={presetMenuItems(template.id, displayName, currentCategoryId)}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">No templates in this category.</p>
          )}
        </MarketingSidebarSection>
      ) : effectiveStartFrom === 'collage' ? (
        collagePanelSlot
      ) : (
        blankPanelSlot
      )}

      {isTemplatesMode && showGuestReviewsSection && onSelectReview ? (
        <MarketingReviewSidebarSection
          selectedReviewId={selectedReviewId}
          onSelect={onSelectReview}
          socialSeedOnly
        />
      ) : null}

      {dialogMeta ? (
        <MarketingNameDialog
          open={Boolean(dialog)}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={dialogMeta.title}
          defaultValue={dialogMeta.defaultValue}
          confirmLabel={dialogMeta.confirmLabel}
          onConfirm={(value) => void handleDialogConfirm(value)}
        />
      ) : null}

      {moveTarget ? (
        <MarketingMoveTemplateDialog
          open={Boolean(moveTarget)}
          onOpenChange={(open) => {
            if (!open) setMoveTarget(null);
          }}
          templateName={moveTarget.templateName}
          categories={catalog.movableCategories}
          currentCategoryId={moveTarget.currentCategoryId}
          onSelectCategory={(categoryId) => handleMoveConfirm(categoryId)}
        />
      ) : null}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        {deleteTarget ? (
          <AlertDialogContent className="max-w-[min(calc(100vw-1.5rem),24rem)]">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget.kind === 'saved-template'
                  ? planSavedTemplateRelatedIds(savedRecords, deleteTarget.recordId).length > 1
                    ? `"${deleteTarget.name}" and its other formats will be deleted permanently.`
                    : `"${deleteTarget.name}" will be deleted permanently.`
                  : 'This cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteConfirm}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </>
  );
}
