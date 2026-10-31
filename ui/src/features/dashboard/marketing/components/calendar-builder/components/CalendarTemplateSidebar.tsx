import { memo, useState } from 'react';

import { CalendarLayoutLivePreview } from '@/features/dashboard/marketing/components/calendar-builder/components/CalendarLayoutLivePreview';
import type { SavedCalendarTemplate } from '@/features/dashboard/marketing/components/calendar-builder/hooks/useCalendarTemplates';
import type {
  CalendarStyles,
  PreviewBooking,
} from '@/features/dashboard/marketing/components/calendar-builder/types';
import { MarketingNameDialog } from '@/features/dashboard/marketing/components/shared/MarketingNameDialog';
import { MARKETING_SIDEBAR_GRID } from '@/features/dashboard/marketing/components/shared/marketingSidebarLayout';
import type { MarketingSidebarMenuItem } from '@/features/dashboard/marketing/components/shared/MarketingSidebarSection';
import { MarketingSidebarSection } from '@/features/dashboard/marketing/components/shared/MarketingSidebarSection';
import { MarketingTemplateCard } from '@/features/dashboard/marketing/components/shared/MarketingTemplateCard';
import {
  CALENDAR_CANVAS_DIMENSIONS,
  type CalendarCanvasFormat,
} from '@/features/dashboard/marketing/lib/calendarCanvasFormats';

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

export type CalendarPresetCategory = {
  label: string;
  presets: Array<{
    value: string;
    label: string;
    description: string;
    color: string;
    secondary?: string;
  }>;
};

type Props = {
  categories: CalendarPresetCategory[];
  /** A layout in the active theme and format (card art). */
  layoutStyles: (layoutId: string) => CalendarStyles;
  propertyName: string;
  previewBookings: PreviewBooking[];
  previewMonth: Date;
  customTemplates: SavedCalendarTemplate[];
  selectedKey: string | null;
  canvasFormat?: CalendarCanvasFormat;
  onSelectPreset: (value: string) => void;
  onCustomizePreset: (value: string) => void;
  onSelectBlank: () => void;
  onCustomizeBlank: () => void;
  onSelectCustom: (id: string) => void;
  onCustomizeCustom: (id: string) => void;
  onRenameCustom: (id: string, name: string) => void | Promise<void>;
  onRemoveCustom: (id: string) => void | Promise<void>;
};

export const CalendarTemplateSidebar = memo(function CalendarTemplateSidebar({
  categories,
  layoutStyles,
  propertyName,
  previewBookings,
  previewMonth,
  customTemplates,
  selectedKey,
  canvasFormat = 'square',
  onSelectPreset,
  onCustomizePreset,
  onSelectBlank,
  onCustomizeBlank,
  onSelectCustom,
  onCustomizeCustom,
  onRenameCustom,
  onRemoveCustom,
}: Props) {
  const livePreview = (styles: CalendarStyles) => (
    <CalendarLayoutLivePreview
      styles={styles}
      propertyName={propertyName}
      bookings={previewBookings}
      month={previewMonth}
    />
  );
  const [removeTarget, setRemoveTarget] = useState<SavedCalendarTemplate | null>(null);
  const [renameTarget, setRenameTarget] = useState<SavedCalendarTemplate | null>(null);

  const dims = CALENDAR_CANVAS_DIMENSIONS[canvasFormat];
  const calendarThumbProps = {
    thumbnailWidth: dims.width,
    thumbnailHeight: dims.height,
    thumbnailOrientation:
      canvasFormat === 'portrait'
        ? ('portrait' as const)
        : canvasFormat === 'landscape'
          ? ('landscape' as const)
          : ('square' as const),
  };

  const customMenu = (template: SavedCalendarTemplate): MarketingSidebarMenuItem[] => [
    {
      id: 'rename',
      label: 'Rename',
      onSelect: () => setRenameTarget(template),
    },
    {
      id: 'remove',
      label: 'Remove',
      destructive: true,
      onSelect: () => setRemoveTarget(template),
    },
  ];

  const renderPresetCard = (preset: CalendarPresetCategory['presets'][number]) => {
    const thumbId = `preset:${preset.value}`;
    return (
      <li key={preset.value} className="min-w-0">
        <MarketingTemplateCard
          name={preset.label}
          meta={preset.description}
          thumbnail={livePreview(layoutStyles(preset.value))}
          selected={selectedKey === thumbId}
          onClick={() => onSelectPreset(preset.value)}
          onCustomize={() => onCustomizePreset(preset.value)}
          {...calendarThumbProps}
        />
      </li>
    );
  };

  const handleRemoveConfirm = async () => {
    if (!removeTarget) return;
    await onRemoveCustom(removeTarget.id);
    setRemoveTarget(null);
  };

  return (
    <>
      <MarketingSidebarSection title="Your calendars" collapsible={false}>
        <ul className={MARKETING_SIDEBAR_GRID}>
          <li className="min-w-0">
            <MarketingTemplateCard
              name="Blank calendar"
              meta="Simple layout"
              thumbnail={livePreview(layoutStyles('default'))}
              selected={selectedKey === 'preset:default'}
              onClick={onSelectBlank}
              onCustomize={onCustomizeBlank}
              {...calendarThumbProps}
            />
          </li>
          {customTemplates.map((template) => {
            const cardKey = `custom:${template.id}`;
            return (
              <li key={template.id} className="min-w-0">
                <MarketingTemplateCard
                  name={template.name}
                  thumbnail={livePreview(template.styles)}
                  selected={selectedKey === cardKey}
                  onClick={() => onSelectCustom(template.id)}
                  onCustomize={() => onCustomizeCustom(template.id)}
                  menuItems={customMenu(template)}
                  {...calendarThumbProps}
                />
              </li>
            );
          })}
        </ul>
      </MarketingSidebarSection>

      {categories.map((category) => (
        <MarketingSidebarSection key={category.label} title={category.label} collapsible={false}>
          <ul className={MARKETING_SIDEBAR_GRID}>
            {category.presets.map((preset) => renderPresetCard(preset))}
          </ul>
        </MarketingSidebarSection>
      ))}

      <MarketingNameDialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title="Rename template"
        defaultValue={renameTarget?.name ?? ''}
        confirmLabel="Save"
        onConfirm={async (name) => {
          if (!renameTarget) return;
          await onRenameCustom(renameTarget.id, name);
          setRenameTarget(null);
        }}
      />

      <AlertDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-[min(calc(100vw-1.5rem),24rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? removeTarget.aiGenerated
                  ? `"${removeTarget.name}" will be deleted for all formats (Square, Portrait, Landscape).`
                  : `"${removeTarget.name}" will be deleted permanently.`
                : 'This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleRemoveConfirm()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
