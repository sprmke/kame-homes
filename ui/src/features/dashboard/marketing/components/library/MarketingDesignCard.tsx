import { memo, useMemo, type ReactNode } from 'react';

import {
  Copy,
  FolderOpen,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import {
  normalizeCalendarStyles,
  type CalendarStyles,
} from '@/features/dashboard/marketing/components/calendar-builder/types';
import { CalendarMiniPreview } from '@/features/dashboard/marketing/components/shared/CalendarMiniPreview';
import {
  MarketingTemplateThumb,
  PresetWireframe,
} from '@/features/dashboard/marketing/components/shared/MarketingTemplateThumb';
import {
  MarketingTile,
  MarketingTileChip,
} from '@/features/dashboard/marketing/components/shared/MarketingTile';
import type { MarketingLibraryItem } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  daysUntilPurge,
  designPresetIdForSize,
  formatEditedAt,
  sizeLabel,
  sizeOption,
} from '@/features/dashboard/marketing/lib/marketingLibrary';
import { parseTemplateRef } from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';

import {
  ResponsiveOverflowMenu,
  type ResponsiveOverflowAction,
} from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';

export type MarketingDesignCardActions = {
  onOpen: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onSaveAsTemplate?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onDeleteForever?: () => void;
};

type Props = {
  item: MarketingLibraryItem;
  theme: MarketingThemeTokens;
  themeHash: string;
  /** Theme name when the Library shows every theme. */
  themeLabel?: string | null;
  actions: MarketingDesignCardActions;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onIntent?: () => void;
  binding?: DesignBinding;
  propertyPhotoUrl?: string;
};

/**
 * A saved design (or template) in the Library. Art is the stored thumbnail; items
 * saved before thumbnails existed show their starting template, never a live render.
 */
export const MarketingDesignCard = memo(function MarketingDesignCard({
  item,
  theme,
  themeHash,
  themeLabel,
  actions,
  selectable,
  selected,
  onToggleSelect,
  onIntent,
  binding,
  propertyPhotoUrl,
}: Props) {
  const deleted = Boolean(item.deletedAt);
  const size =
    item.aspectPreset ?? (item.contentType === 'video' ? 'instagram-story' : 'instagram-post');

  const menuGroups: ResponsiveOverflowAction[][] = deleted
    ? [
        [
          ...(actions.onRestore
            ? [
                {
                  key: 'restore',
                  label: 'Restore',
                  icon: <RotateCcw className="size-4" aria-hidden />,
                  onSelect: actions.onRestore,
                },
              ]
            : []),
        ],
        [
          ...(actions.onDeleteForever
            ? [
                {
                  key: 'delete-forever',
                  label: 'Delete forever',
                  destructive: true,
                  icon: <Trash2 className="size-4" aria-hidden />,
                  onSelect: actions.onDeleteForever,
                },
              ]
            : []),
        ],
      ]
    : [
        [
          {
            key: 'open',
            label: item.kind === 'template' ? 'Use template' : 'Open',
            icon: <FolderOpen className="size-4" aria-hidden />,
            onSelect: actions.onOpen,
          },
          ...(actions.onRename
            ? [
                {
                  key: 'rename',
                  label: 'Rename',
                  icon: <Pencil className="size-4" aria-hidden />,
                  onSelect: actions.onRename,
                },
              ]
            : []),
          ...(actions.onDuplicate
            ? [
                {
                  key: 'duplicate',
                  label: 'Duplicate',
                  icon: <Copy className="size-4" aria-hidden />,
                  onSelect: actions.onDuplicate,
                },
              ]
            : []),
          ...(actions.onSaveAsTemplate
            ? [
                {
                  key: 'save-template',
                  label: 'Save as template',
                  icon: <LayoutTemplate className="size-4" aria-hidden />,
                  onSelect: actions.onSaveAsTemplate,
                },
              ]
            : []),
        ],
        [
          ...(actions.onDelete
            ? [
                {
                  key: 'delete',
                  label: 'Delete',
                  destructive: true,
                  icon: <Trash2 className="size-4" aria-hidden />,
                  onSelect: actions.onDelete,
                },
              ]
            : []),
        ],
      ];

  const groups = menuGroups.filter((group) => group.length > 0);

  const meta: ReactNode = deleted
    ? `${daysUntilPurge(item.deletedAt!)} days left`
    : [sizeLabel(item.contentType, size), formatEditedAt(item.updatedAt), themeLabel]
        .filter(Boolean)
        .join(' · ');

  const badges = (
    <>
      {item.aiGenerated ? <MarketingTileChip>AI</MarketingTileChip> : null}
      {item.isCollage ? <MarketingTileChip>Collage</MarketingTileChip> : null}
    </>
  );

  return (
    <MarketingTile
      art={
        <DesignArt
          item={item}
          size={size}
          theme={theme}
          themeHash={themeHash}
          binding={binding}
          propertyPhotoUrl={propertyPhotoUrl}
        />
      }
      name={item.name}
      meta={meta}
      badges={item.aiGenerated || item.isCollage ? badges : undefined}
      corner={
        item.groupSize > 1 ? <MarketingTileChip>{item.groupSize} sizes</MarketingTileChip> : null
      }
      onOpen={deleted ? (actions.onRestore ?? (() => undefined)) : actions.onOpen}
      openLabel={deleted ? `Restore ${item.name}` : `Open ${item.name}`}
      selectable={selectable}
      selected={selected}
      onToggleSelect={onToggleSelect}
      onIntent={onIntent}
      menu={
        groups.length > 0 ? (
          <ResponsiveOverflowMenu
            label={`${item.name} options`}
            sheetTitle={item.name}
            actionGroups={groups}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="admin-overflow-trigger text-muted-foreground hover:text-foreground size-8"
                aria-label={`${item.name} options`}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            }
          />
        ) : null
      }
    />
  );
});

function DesignArt({
  item,
  size,
  theme,
  themeHash,
  binding,
  propertyPhotoUrl,
}: {
  item: MarketingLibraryItem;
  size: string;
  theme: MarketingThemeTokens;
  themeHash: string;
  binding?: DesignBinding;
  propertyPhotoUrl?: string;
}) {
  if (item.thumbnailUrl) {
    return (
      <img
        src={item.thumbnailUrl}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="size-full select-none object-contain"
      />
    );
  }
  if (item.contentType === 'calendar' && item.previewStyles) {
    return <CalendarItemArt styles={item.previewStyles} />;
  }
  const source = parseTemplateRef(item.sourceTemplateId);
  if (source?.kind === 'preset') {
    const presetId =
      item.contentType === 'design' ? designPresetIdForSize(source.id, size) : source.id;
    return (
      <MarketingTemplateThumb
        contentType={item.contentType}
        presetId={presetId}
        size={size}
        theme={theme}
        themeHash={themeHash}
        binding={binding}
        propertyPhotoUrl={propertyPhotoUrl}
      />
    );
  }
  const dims = sizeOption(item.contentType, size) ?? { width: 1080, height: 1080 };
  return (
    <PresetWireframe theme={theme} width={dims.width} height={dims.height} className="size-full" />
  );
}

function CalendarItemArt({ styles }: { styles: Record<string, unknown> }) {
  const normalized = useMemo(() => {
    try {
      return normalizeCalendarStyles(styles as unknown as CalendarStyles);
    } catch {
      return null;
    }
  }, [styles]);
  if (!normalized) return null;
  return <CalendarMiniPreview styles={normalized} className="size-full" />;
}
