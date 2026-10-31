import { useId, useMemo, useState, type ReactNode } from 'react';

import { Check, ChevronDown, LayoutGrid, Plus, Search } from 'lucide-react';

import { SizeGlyph } from '@/features/dashboard/marketing/components/library/MarketingNewButton';
import { MarketingNameDialog } from '@/features/dashboard/marketing/components/shared/MarketingNameDialog';
import { MarketingOverflowMenu } from '@/features/dashboard/marketing/components/shared/MarketingOverflowMenu';
import { MarketingTemplateThumb } from '@/features/dashboard/marketing/components/shared/MarketingTemplateThumb';
import {
  MarketingTile,
  MarketingTileChip,
} from '@/features/dashboard/marketing/components/shared/MarketingTile';
import {
  useDeleteMarketingItems,
  useMarketingLibrary,
  useMarketingTemplateUsage,
  useRenameMarketingItem,
} from '@/features/dashboard/marketing/hooks/useMarketingLibrary';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import type {
  MarketingContentType,
  MarketingLibraryItem,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  builtinTemplateCatalog,
  filterTemplates,
  sizeOption,
  startSizesFor,
  type MarketingGalleryTemplate,
} from '@/features/dashboard/marketing/lib/marketingLibrary';
import type { MarketingTemplateRef } from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
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
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export type MarketingTemplatePick = {
  ref: MarketingTemplateRef;
  size: string;
  /** Continue an existing design made from this template instead of a new draft. */
  continueItemId?: string;
};

type Props = {
  contentType: MarketingContentType;
  theme: MarketingThemeTokens;
  themeHash: string;
  themeKey: string;
  size: string;
  onSizeChange: (size: string) => void;
  onPick: (pick: MarketingTemplatePick) => void;
  binding?: DesignBinding;
  propertyPhotoUrl?: string;
  /** Blank / Collage tiles (Library + gallery). Hidden in the editor rail. */
  showStarts?: boolean;
  /** Compact single-column layout for the editor rail. */
  variant?: 'full' | 'panel';
  /** Size picker hidden (editor rail: the open design fixes the size). */
  lockSize?: boolean;
  /** Highlight the template the open design came from. */
  activeSourceId?: string | null;
  /** Offer "Continue …" when a template was used recently (Library only). */
  offerContinue?: boolean;
  /** Sits on the toolbar row, left of search (the New / Create with AI actions). */
  leading?: ReactNode;
  /** Renders under the toolbar, above the tiles. */
  intro?: ReactNode;
  className?: string;
};

function MarketingSizeMenu({
  sizes,
  value,
  onChange,
}: {
  sizes: Array<{ value: string; label: string; width: number; height: number }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const isBelowLg = useIsBelowLg();
  const [open, setOpen] = useState(false);
  const current = sizes.find((size) => size.value === value) ?? sizes[0];
  if (!current) return null;

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const trigger = (
    <Button
      type="button"
      variant="outline"
      className="h-10 shrink-0 gap-2 px-3"
      aria-label={`Size, ${current.label}`}
      aria-expanded={open}
      aria-haspopup="listbox"
      onClick={isBelowLg ? () => setOpen(true) : undefined}
    >
      <SizeGlyph width={current.width} height={current.height} />
      {current.label}
      <ChevronDown className="size-4 opacity-60" aria-hidden />
    </Button>
  );

  if (isBelowLg) {
    return (
      <>
        {trigger}
        <MobileChoiceSheet open={open} onOpenChange={setOpen} title="Size">
          {sizes.map((size) => (
            <MobileChoiceItem
              key={size.value}
              label={size.label}
              icon={<SizeGlyph width={size.width} height={size.height} />}
              selected={size.value === value}
              onSelect={() => choose(size.value)}
            />
          ))}
        </MobileChoiceSheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1.5">
        <div role="listbox" aria-label="Size" className="flex flex-col">
          {sizes.map((size) => {
            const selected = size.value === value;
            return (
              <button
                key={size.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(size.value)}
                className={cn(
                  'flex h-10 items-center gap-2 rounded-md px-2.5 text-left text-sm',
                  selected ? 'bg-muted font-medium' : 'hover:bg-muted/60'
                )}
              >
                <SizeGlyph width={size.width} height={size.height} />
                <span className="min-w-0 flex-1">{size.label}</span>
                {selected ? <Check className="size-4 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function templateIds(item: MarketingLibraryItem): string[] {
  return item.groupMembers.length > 0 ? item.groupMembers.map((member) => member.id) : [item.id];
}

/**
 * Built-in templates by category, then the host's own templates above them.
 * Shared by the full template gallery and the Posts, Videos, and Calendar rails.
 * Built-in templates have no rename or delete. Saved templates do.
 */
export function MarketingTemplateBrowser({
  contentType,
  theme,
  themeHash,
  themeKey,
  size,
  onSizeChange,
  onPick,
  binding,
  propertyPhotoUrl,
  showStarts = true,
  variant = 'full',
  lockSize = false,
  activeSourceId = null,
  offerContinue = true,
  leading,
  intro,
  className,
}: Props) {
  const [query, setQuery] = useState('');
  const [renameTarget, setRenameTarget] = useState<MarketingLibraryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketingLibraryItem | null>(null);
  const [reuse, setReuse] = useState<{
    template: MarketingGalleryTemplate;
    count: number;
    latestId: string;
    latestName: string;
  } | null>(null);

  const { canEditTemplate, canDeleteTemplate } = useMarketingPermissions();
  const rename = useRenameMarketingItem();
  const remove = useDeleteMarketingItems();
  const saved = useMarketingLibrary({
    contentType,
    kind: 'template',
    themeKey,
    limit: 60,
  });

  const { canUse: canUseStudio, isLoading: studioLoading } = useFeatureGate('marketingStudio');
  const watermarked = studioLoading || !canUseStudio;

  const catalog = useMemo(() => builtinTemplateCatalog(contentType, size), [contentType, size]);
  const categoryLabels = useMemo(
    () => Object.fromEntries(catalog.map((entry) => [entry.id, entry.label])),
    [catalog]
  );
  const usage = useMarketingTemplateUsage(contentType, themeKey, offerContinue);
  const usageBySource = useMemo(
    () => new Map((usage.data ?? []).map((entry) => [entry.sourceTemplateId, entry])),
    [usage.data]
  );

  const userTemplates = useMemo(
    () => saved.data?.pages.flatMap((page) => page.items) ?? [],
    [saved.data]
  );

  const visibleUserTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return userTemplates.filter((item) => {
      if (needle && !item.name.toLowerCase().includes(needle)) return false;
      if (lockSize || contentType !== 'design') return true;
      return !item.aspectPreset || item.aspectPreset === size;
    });
  }, [query, userTemplates, contentType, size, lockSize]);

  const visibleCategories = useMemo(
    () =>
      catalog
        .map((entry) => ({
          ...entry,
          templates: filterTemplates(entry.templates, query, categoryLabels),
        }))
        .filter((entry) => entry.templates.length > 0),
    [catalog, query, categoryLabels]
  );

  const pickTemplate = (template: MarketingGalleryTemplate) => {
    const used = offerContinue ? usageBySource.get(template.sourceId) : undefined;
    if (used) {
      setReuse({
        template,
        count: used.count,
        latestId: used.latestId,
        latestName: used.latestName,
      });
      return;
    }
    onPick({ ref: template.ref, size });
  };

  const isPanel = variant === 'panel';
  const startSizes = startSizesFor(contentType);
  const frame = sizeOption(contentType, size) ?? { width: 1080, height: 1080 };
  const gridClass = cn(
    'grid gap-3',
    isPanel ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5'
  );
  const showStartTiles = showStarts && !query.trim();
  const nothingMatches =
    !showStartTiles && visibleUserTemplates.length === 0 && visibleCategories.length === 0;

  const customMenu = (item: MarketingLibraryItem) => {
    const items = [
      ...(canEditTemplate
        ? [{ id: 'rename', label: 'Rename', onSelect: () => setRenameTarget(item) }]
        : []),
      ...(canDeleteTemplate
        ? [
            {
              id: 'delete',
              label: 'Delete',
              destructive: true,
              onSelect: () => setDeleteTarget(item),
            },
          ]
        : []),
    ];
    if (items.length === 0) return null;
    return (
      <MarketingOverflowMenu
        label={`Actions for ${item.name}`}
        menuItems={items}
        triggerClassName="admin-overflow-trigger"
      />
    );
  };

  return (
    <div className={cn('flex min-h-0 flex-col gap-4', className)}>
      <div className={cn('flex flex-col gap-2', leading && 'lg:flex-row lg:items-center')}>
        {leading ? <div className="min-w-0 lg:mr-auto">{leading}</div> : null}
        <div className="flex min-w-0 items-center gap-2">
          <div className={cn('relative min-w-0 flex-1', leading && 'lg:w-60 lg:flex-none')}>
            <Search
              className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates"
              aria-label="Search templates"
              className="h-10 pl-9 text-[13px] lg:text-sm"
            />
          </div>
          {lockSize ? null : (
            <MarketingSizeMenu sizes={startSizes} value={size} onChange={onSizeChange} />
          )}
        </div>
      </div>
      {intro}

      {showStartTiles ? (
        <ul className={gridClass}>
          <li className="min-w-0">
            <MarketingTile
              art={<BlankArt width={frame.width} height={frame.height} />}
              name="Blank"
              meta="Start from nothing"
              onOpen={() => onPick({ ref: { kind: 'blank' }, size })}
            />
          </li>
          {contentType === 'design' ? (
            <li className="min-w-0">
              <MarketingTile
                art={<CollageArt width={frame.width} height={frame.height} />}
                name="Collage"
                meta="Grid of your photos"
                onOpen={() => onPick({ ref: { kind: 'collage' }, size })}
              />
            </li>
          ) : null}
        </ul>
      ) : null}

      {visibleUserTemplates.length > 0 ? (
        <TemplateGroup title="Your templates" gridClass={gridClass} compact={isPanel}>
          {visibleUserTemplates.map((item) => (
            <li key={item.id} className="min-w-0">
              <MarketingTile
                art={
                  item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <LayoutGrid className="text-muted-foreground size-8" aria-hidden />
                  )
                }
                name={item.name}
                meta={item.groupSize > 1 ? `${item.groupSize} sizes` : undefined}
                active={activeSourceId === `tpl:${item.id}` || activeSourceId === item.id}
                menu={customMenu(item)}
                onOpen={() =>
                  onPick({
                    ref: { kind: 'template', id: item.id },
                    size: item.aspectPreset ?? size,
                  })
                }
              />
            </li>
          ))}
        </TemplateGroup>
      ) : null}

      {userTemplates.length > 0 && saved.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] w-full"
          disabled={saved.isFetchingNextPage}
          onClick={() => void saved.fetchNextPage()}
        >
          {saved.isFetchingNextPage ? 'Loading…' : 'Show more'}
        </Button>
      ) : null}

      {visibleCategories.length > 0 ? (
        <div>
          {visibleCategories.map((entry, index) => (
            <TemplateGroup
              key={entry.id}
              title={entry.label}
              gridClass={gridClass}
              compact={isPanel}
              divided={index > 0 || visibleUserTemplates.length > 0}
            >
              {entry.templates.map((template) => {
                const used = usageBySource.get(template.sourceId);
                return (
                  <li key={template.presetId} className="min-w-0">
                    <MarketingTile
                      art={
                        <MarketingTemplateThumb
                          contentType={contentType}
                          presetId={template.presetId}
                          size={size}
                          theme={theme}
                          themeHash={themeHash}
                          binding={binding}
                          propertyPhotoUrl={propertyPhotoUrl}
                        />
                      }
                      name={template.name}
                      meta={isPanel ? undefined : template.description}
                      active={activeSourceId === template.sourceId}
                      watermarked={watermarked}
                      corner={
                        offerContinue && used ? (
                          <MarketingTileChip>Used {used.count}×</MarketingTileChip>
                        ) : undefined
                      }
                      onOpen={() => pickTemplate(template)}
                    />
                  </li>
                );
              })}
            </TemplateGroup>
          ))}
        </div>
      ) : null}

      {nothingMatches ? (
        <p className="text-muted-foreground py-6 text-center text-sm">No templates match.</p>
      ) : null}

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
          await rename.mutateAsync({ ids: templateIds(renameTarget), name });
          setRenameTarget(null);
        }}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-[min(calc(100vw-1.5rem),24rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && templateIds(deleteTarget).length > 1
                ? 'This removes every size. You can restore them from Recently deleted for 30 days.'
                : 'You can restore it from Recently deleted for 30 days.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return;
                remove.mutate({ ids: templateIds(deleteTarget) });
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ResponsiveModal open={Boolean(reuse)} onOpenChange={(open) => !open && setReuse(null)}>
        <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),26rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>You used this template before</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              {reuse && reuse.count > 1
                ? `${reuse.count} designs use "${reuse.template.name}". Pick up the latest or start fresh.`
                : `Pick up "${reuse?.latestName ?? ''}" or start fresh.`}
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => {
                if (reuse) onPick({ ref: reuse.template.ref, size });
                setReuse(null);
              }}
            >
              <Plus className="size-4" aria-hidden />
              Start new
            </Button>
            <Button
              type="button"
              className="min-h-[44px]"
              onClick={() => {
                if (reuse) {
                  onPick({ ref: reuse.template.ref, size, continueItemId: reuse.latestId });
                }
                setReuse(null);
              }}
            >
              Continue {reuse ? `"${truncate(reuse.latestName, 24)}"` : ''}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}

function TemplateGroup({
  title,
  gridClass,
  divided = false,
  compact = false,
  children,
}: {
  title: string;
  gridClass: string;
  /** Rule above this group so it does not run into the one before it. */
  divided?: boolean;
  /** Editor rail: same heading, slightly tighter gap. */
  compact?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        divided &&
          (compact ? 'border-border mt-5 border-t pt-4' : 'border-border mt-8 border-t pt-6')
      )}
    >
      <h3 id={titleId} className="text-section-title mb-3">
        {title}
      </h3>
      <ul className={gridClass}>{children}</ul>
    </section>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Fit a canvas inside the tile's 4:5 frame without cropping it. */
function canvasFrameStyle(
  width: number,
  height: number
): { width?: string; height?: string; aspectRatio: string } {
  const ratio = width / Math.max(height, 1);
  const tile = 4 / 5;
  return ratio >= tile
    ? { width: '100%', aspectRatio: `${width} / ${height}` }
    : { height: '100%', aspectRatio: `${width} / ${height}` };
}

function BlankArt({ width, height }: { width: number; height: number }) {
  return (
    <span
      className="border-border bg-card flex shrink-0 items-center justify-center rounded-md border-2 border-dashed"
      style={canvasFrameStyle(width, height)}
    >
      <Plus className="text-muted-foreground size-7" aria-hidden />
    </span>
  );
}

function CollageArt({ width, height }: { width: number; height: number }) {
  return (
    <span
      className="bg-card relative shrink-0 overflow-hidden rounded-md"
      style={canvasFrameStyle(width, height)}
      aria-hidden
    >
      <span className="bg-primary/30 absolute left-[6%] top-[6%] h-[54%] w-[54%] rounded-sm" />
      <span className="bg-primary/20 absolute right-[6%] top-[6%] h-[25%] w-[30%] rounded-sm" />
      <span className="bg-primary/40 absolute right-[6%] top-[35%] h-[25%] w-[30%] rounded-sm" />
      <span className="bg-primary/25 absolute bottom-[6%] left-[6%] right-[6%] h-[26%] rounded-sm" />
    </span>
  );
}
