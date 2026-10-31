import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { MarketingDesignCard } from '@/features/dashboard/marketing/components/library/MarketingDesignCard';
import {
  MarketingLibraryToolbar,
  activeFilterCount,
  type LibraryFilterField,
} from '@/features/dashboard/marketing/components/library/MarketingLibraryToolbar';
import {
  MarketingNewButton,
  SizeGlyph,
} from '@/features/dashboard/marketing/components/library/MarketingNewButton';
import { MarketingTemplateBrowser } from '@/features/dashboard/marketing/components/library/MarketingTemplateBrowser';
import type { MarketingTemplatePick } from '@/features/dashboard/marketing/components/library/MarketingTemplateBrowser';
import { MarketingTemplateGallery } from '@/features/dashboard/marketing/components/library/MarketingTemplateGallery';
import { PublishHistory } from '@/features/dashboard/marketing/components/publishing/PublishHistory';
import { MarketingNameDialog } from '@/features/dashboard/marketing/components/shared/MarketingNameDialog';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import {
  useDeleteMarketingItems,
  useDuplicateMarketingItem,
  useMarketingLibrary,
  usePrefetchMarketingItem,
  useRenameMarketingItem,
  useRestoreMarketingItems,
} from '@/features/dashboard/marketing/hooks/useMarketingLibrary';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import type {
  MarketingContentType,
  MarketingLibraryItem,
  MarketingLibrarySort,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { DEFAULT_MARKETING_THUMB_BINDING } from '@/features/dashboard/marketing/lib/marketingDefaultBinding';
import { preloadMarketingEditor } from '@/features/dashboard/marketing/lib/marketingEditorPreload';
import {
  CONTENT_NOUN,
  MARKETING_SIZES,
  defaultSizeFor,
  startSizesFor,
} from '@/features/dashboard/marketing/lib/marketingLibrary';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { MarketingLibraryGridSkeleton } from '@/components/skeletons/AdminSkeletons';
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
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';

type Props = {
  contentType: Exclude<MarketingContentType, never>;
};

type MarketingLibraryFilterState = {
  query: string;
  size: string | null;
  sort: MarketingLibrarySort;
  allThemes: boolean;
};

const SORT_LABELS: Record<MarketingLibrarySort, string> = {
  updated: 'Last edited',
  created: 'Newest',
  name: 'Name',
};

const ALL = 'all';

const DEFAULT_FILTERS: MarketingLibraryFilterState = {
  query: '',
  size: null,
  sort: 'updated',
  allThemes: false,
};

/** What the tab is showing: its own grid, or one of the two history views. */
type LibraryView = 'designs' | 'deleted' | 'publishes';

type NameDialog =
  | { kind: 'rename'; item: MarketingLibraryItem }
  | { kind: 'save-template'; item: MarketingLibraryItem };

const GRID_CLASS =
  'grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';

function groupIds(item: MarketingLibraryItem): string[] {
  return item.groupMembers.length > 0 ? item.groupMembers.map((member) => member.id) : [item.id];
}

/**
 * Home of the Posts / Videos / Calendar tabs. First visit: a start screen (AI, sizes,
 * templates). After that: the host's own designs first, templates one tap away.
 */
export function MarketingLibraryHome({ contentType }: Props) {
  const {
    active,
    activeHash,
    library,
    startDraft,
    startAiSession,
    openItem,
    coverPhotoUrl,
    photoUrls,
  } = useMarketingTheme();
  const theme = active!;
  const themeHash = activeHash ?? '';
  const noun = CONTENT_NOUN[contentType];
  const { property } = useOrgContext();

  const {
    canAddTemplate,
    canEditTemplate,
    canDeleteTemplate,
    canEditContent,
    canGenerate,
    canPublish,
  } = useMarketingPermissions();
  const { canUse: canSaveDesigns } = useFeatureGate('customTemplates');
  const { open: openUpgradeModal } = useUpgradeModal();

  const [filters, setFilters] = useState<MarketingLibraryFilterState>(DEFAULT_FILTERS);
  const debouncedQuery = useDebouncedValue(filters.query, 250);
  const [view, setView] = useState<LibraryView>('designs');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [gallerySize, setGallerySize] = useState(defaultSizeFor(contentType));
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: 'bulk-delete'; ids: string[] }
    | { kind: 'delete-forever'; ids: string[]; name: string }
    | null
  >(null);

  const deleted = view === 'deleted';
  const themeKeyFilter = filters.allThemes || deleted ? null : theme.key;
  const libraryFilters = useMemo(
    () => ({
      contentType,
      kind: 'design' as const,
      themeKey: themeKeyFilter,
      query: debouncedQuery,
      size: filters.size,
      sort: filters.sort,
      deleted,
    }),
    [contentType, themeKeyFilter, debouncedQuery, filters.size, filters.sort, deleted]
  );
  const designs = useMarketingLibrary(libraryFilters);
  const templates = useMarketingLibrary(
    { contentType, kind: 'template', themeKey: theme.key, limit: 24 },
    !deleted
  );

  const items = useMemo(
    () => designs.data?.pages.flatMap((page) => page.items) ?? [],
    [designs.data]
  );
  const userTemplates = useMemo(
    () => templates.data?.pages.flatMap((page) => page.items) ?? [],
    [templates.data]
  );

  const filterFields = useMemo<LibraryFilterField[]>(
    () => [
      {
        id: 'size',
        label: 'Size',
        value: filters.size ?? ALL,
        defaultValue: ALL,
        options: [
          { value: ALL, label: 'All sizes' },
          ...MARKETING_SIZES[contentType].map((size) => ({
            value: size.value,
            label: size.label,
            icon: <SizeGlyph width={size.width} height={size.height} />,
          })),
        ],
        onChange: (value) =>
          setFilters((prev) => ({ ...prev, size: value === ALL ? null : value })),
      },
      {
        id: 'sort',
        label: 'Sort by',
        value: filters.sort,
        defaultValue: 'updated',
        options: (Object.keys(SORT_LABELS) as MarketingLibrarySort[]).map((value) => ({
          value,
          label: SORT_LABELS[value],
        })),
        onChange: (value) =>
          setFilters((prev) => ({ ...prev, sort: value as MarketingLibrarySort })),
      },
      {
        id: 'theme',
        label: 'Theme',
        value: filters.allThemes ? ALL : 'this',
        defaultValue: 'this',
        options: [
          { value: 'this', label: 'This theme' },
          { value: ALL, label: 'All themes' },
        ],
        onChange: (value) => setFilters((prev) => ({ ...prev, allThemes: value === ALL })),
      },
    ],
    [contentType, filters.size, filters.sort, filters.allThemes]
  );
  const filtersActive = activeFilterCount(filterFields) > 0 || debouncedQuery.trim().length > 0;
  const loading = designs.isLoading && !designs.data;
  const isFresh = !deleted && !filtersActive && !loading && !designs.isError && items.length === 0;

  const duplicate = useDuplicateMarketingItem();
  const rename = useRenameMarketingItem();
  const remove = useDeleteMarketingItems();
  const restore = useRestoreMarketingItems();
  const prefetchItem = usePrefetchMarketingItem();

  const binding = useMemo<DesignBinding>(
    () =>
      photoUrls.length > 0 || coverPhotoUrl
        ? {
            ...DEFAULT_MARKETING_THUMB_BINDING,
            propertyName: property.name,
            propertyPhoto: coverPhotoUrl ?? photoUrls[0] ?? null,
            propertyMedia: photoUrls.map((url) => ({ url, type: 'image' as const })),
          }
        : { ...DEFAULT_MARKETING_THUMB_BINDING, propertyName: property.name },
    [coverPhotoUrl, photoUrls, property.name]
  );

  const themeNames = useMemo(
    () => new Map([...library.byKey.values()].map((entry) => [entry.key, entry.name])),
    [library.byKey]
  );

  // Leaving the tab or switching views drops a half-made selection.
  useEffect(() => {
    setSelected(new Set());
    setSelectMode(false);
  }, [view, contentType, theme.key]);

  const gatedCreate = useCallback(
    (run: () => void) => {
      if (!canAddTemplate) return;
      if (!canSaveDesigns) {
        openUpgradeModal('customTemplates');
        return;
      }
      run();
    },
    [canAddTemplate, canSaveDesigns, openUpgradeModal]
  );

  const handlePick = useCallback(
    (pick: MarketingTemplatePick) => {
      if (pick.continueItemId) {
        openItem(pick.continueItemId);
        return;
      }
      startDraft(pick.ref, { size: pick.size });
    },
    [openItem, startDraft]
  );

  const openGallery = useCallback((size?: string) => {
    if (size) setGallerySize(size);
    setGalleryOpen(true);
  }, []);

  const startWithAi = useCallback(() => {
    if (contentType === 'design') {
      startAiSession('post');
      return;
    }
    startDraft({ kind: 'blank' }, { size: defaultSizeFor(contentType), openAi: true });
  }, [contentType, startAiSession, startDraft]);

  const handleDuplicate = useCallback(
    (item: MarketingLibraryItem) =>
      gatedCreate(() => {
        duplicate.mutate(
          { id: item.id },
          {
            onSuccess: (record) =>
              toast.success('Copy made', {
                action: { label: 'Open', onClick: () => openItem(record.id) },
              }),
          }
        );
      }),
    [duplicate, gatedCreate, openItem]
  );

  const handleDelete = useCallback(
    (item: MarketingLibraryItem) => remove.mutate({ ids: groupIds(item) }),
    [remove]
  );

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of items) {
      if (selected.has(item.id)) ids.push(...groupIds(item));
    }
    return ids;
  }, [items, selected]);

  // Infinite scroll: load the next page as the sentinel nears the viewport.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = designs;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  const sharedBrowserProps = {
    contentType,
    theme: theme.tokens,
    themeHash,
    themeKey: theme.key,
    binding,
    propertyPhotoUrl: coverPhotoUrl,
  };

  const startSizes = startSizesFor(contentType);

  const startRow = canAddTemplate ? (
    <MarketingNewButton
      noun={noun.one}
      sizes={startSizes}
      onNew={openGallery}
      onCreateWithAi={canGenerate ? startWithAi : undefined}
    />
  ) : null;

  const gallery = (
    <MarketingTemplateGallery
      open={galleryOpen}
      onOpenChange={setGalleryOpen}
      size={gallerySize}
      onSizeChange={setGallerySize}
      onPick={handlePick}
      {...sharedBrowserProps}
    />
  );

  const backToLibrary = (
    <Button
      type="button"
      variant="ghost"
      className="-ml-2 min-h-[44px] gap-1.5"
      onClick={() => setView('designs')}
    >
      <ChevronLeft className="size-4" aria-hidden />
      Your {noun.many}
    </Button>
  );

  if (view === 'publishes') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-[100rem] p-3 sm:p-4 lg:p-6">
          <PublishHistory onBack={() => setView('designs')} />
        </div>
      </div>
    );
  }

  if (isFresh) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-[100rem] p-3 sm:p-4 lg:p-6">
          <MarketingTemplateBrowser
            leading={startRow}
            intro={
              <h2 id="library-fresh-title" className="text-section-title">
                Make your first {noun.one}
              </h2>
            }
            size={gallerySize}
            onSizeChange={setGallerySize}
            onPick={handlePick}
            showStarts={canAddTemplate}
            offerContinue={false}
            {...sharedBrowserProps}
          />
        </div>
        {gallery}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[100rem] space-y-4 p-3 sm:p-4 lg:p-6">
        {deleted ? backToLibrary : null}

        {selectMode ? (
          <div className="border-border bg-card sticky top-0 z-10 flex min-h-[52px] items-center gap-2 rounded-xl border px-3 py-2 shadow-sm">
            <span className="text-sm font-medium tabular-nums">{selected.size} selected</span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px]"
                onClick={() => {
                  setSelectMode(false);
                  setSelected(new Set());
                }}
              >
                Cancel
              </Button>
              {deleted ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  disabled={selectedIds.length === 0 || restore.isPending}
                  onClick={() =>
                    restore.mutate(selectedIds, {
                      onSuccess: () => {
                        setSelectMode(false);
                        setSelected(new Set());
                      },
                    })
                  }
                >
                  Restore
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                className="min-h-[44px]"
                disabled={selectedIds.length === 0}
                onClick={() =>
                  setConfirm(
                    deleted
                      ? { kind: 'delete-forever', ids: selectedIds, name: `${selected.size} items` }
                      : { kind: 'bulk-delete', ids: selectedIds }
                  )
                }
              >
                {deleted ? 'Delete forever' : 'Delete'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <MarketingLibraryToolbar
              title={deleted ? 'Recently deleted' : `Your ${noun.many}`}
              count={!loading && !hasNextPage ? items.length : null}
              startActions={deleted ? undefined : startRow}
              query={filters.query}
              onQueryChange={(query) => setFilters((prev) => ({ ...prev, query }))}
              fields={deleted ? [] : filterFields}
              onReset={() => setFilters((prev) => ({ ...DEFAULT_FILTERS, query: prev.query }))}
              canSelect={canDeleteTemplate && items.length > 0}
              onStartSelect={() => setSelectMode(true)}
              onOpenDeleted={!deleted && canDeleteTemplate ? () => setView('deleted') : undefined}
              onOpenPublishes={
                !deleted && (canPublish || canEditContent) ? () => setView('publishes') : undefined
              }
            />
            {deleted ? (
              <p className="text-muted-foreground text-xs">
                Items here are deleted for good after 30 days.
              </p>
            ) : null}
          </div>
        )}

        {loading ? (
          <MarketingLibraryGridSkeleton label={`Loading ${noun.many}`} />
        ) : designs.isError ? (
          <div className="border-border rounded-xl border border-dashed p-6 text-center">
            <p className="text-muted-foreground text-sm">Could not load your {noun.many}.</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-[44px]"
              onClick={() => void designs.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="border-border rounded-xl border border-dashed p-6 text-center">
            <p className="text-muted-foreground text-sm">
              {deleted ? 'Nothing here. Deleted items stay for 30 days.' : `No ${noun.many} match.`}
            </p>
            {filtersActive && !deleted ? (
              <Button
                type="button"
                variant="outline"
                className="mt-3 min-h-[44px]"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className={cn(GRID_CLASS, designs.isFetching && !isFetchingNextPage && 'opacity-70')}>
            {items.map((item) => (
              <li key={item.id} className="min-w-0">
                <MarketingDesignCard
                  item={item}
                  theme={theme.tokens}
                  themeHash={themeHash}
                  themeLabel={
                    filters.allThemes || deleted
                      ? (themeNames.get(item.themeKey ?? '') ?? null)
                      : null
                  }
                  binding={binding}
                  propertyPhotoUrl={coverPhotoUrl}
                  selectable={selectMode}
                  selected={selected.has(item.id)}
                  onToggleSelect={() => toggleSelected(item.id)}
                  onIntent={() => {
                    if (deleted) return;
                    prefetchItem(item.id);
                    preloadMarketingEditor(contentType);
                  }}
                  actions={{
                    onOpen: () => openItem(item.id),
                    onRename:
                      canEditTemplate && canSaveDesigns
                        ? () => setNameDialog({ kind: 'rename', item })
                        : undefined,
                    onDuplicate: canAddTemplate ? () => handleDuplicate(item) : undefined,
                    onSaveAsTemplate: canAddTemplate
                      ? () => gatedCreate(() => setNameDialog({ kind: 'save-template', item }))
                      : undefined,
                    onDelete: canDeleteTemplate ? () => handleDelete(item) : undefined,
                    onRestore: canDeleteTemplate ? () => restore.mutate(groupIds(item)) : undefined,
                    onDeleteForever: canDeleteTemplate
                      ? () =>
                          setConfirm({
                            kind: 'delete-forever',
                            ids: groupIds(item),
                            name: `"${item.name}"`,
                          })
                      : undefined,
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        <div ref={sentinelRef} aria-hidden />
        {isFetchingNextPage ? (
          <div className="flex justify-center py-2">
            <Loader2
              className="text-muted-foreground size-5 animate-spin"
              aria-label="Loading more"
            />
          </div>
        ) : hasNextPage ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => void fetchNextPage()}
            >
              Show more
            </Button>
          </div>
        ) : null}

        {!deleted && userTemplates.length > 0 ? (
          <section className="space-y-3 pt-2" aria-label="Your templates">
            <h2 className="text-section-title">Your templates</h2>
            <ul className={GRID_CLASS}>
              {userTemplates.map((item) => (
                <li key={item.id} className="min-w-0">
                  <MarketingDesignCard
                    item={item}
                    theme={theme.tokens}
                    themeHash={themeHash}
                    binding={binding}
                    propertyPhotoUrl={coverPhotoUrl}
                    actions={{
                      onOpen: () =>
                        canAddTemplate
                          ? startDraft(
                              { kind: 'template', id: item.id },
                              { size: item.aspectPreset }
                            )
                          : undefined,
                      onRename: canEditTemplate
                        ? () => setNameDialog({ kind: 'rename', item })
                        : undefined,
                      onDelete: canDeleteTemplate ? () => handleDelete(item) : undefined,
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {gallery}

      <MarketingNameDialog
        open={Boolean(nameDialog)}
        onOpenChange={(open) => !open && setNameDialog(null)}
        title={nameDialog?.kind === 'save-template' ? 'Save as template' : 'Rename'}
        defaultValue={nameDialog?.item.name ?? ''}
        confirmLabel="Save"
        onConfirm={async (name) => {
          if (!nameDialog) return;
          if (nameDialog.kind === 'rename') {
            await rename.mutateAsync({ ids: groupIds(nameDialog.item), name });
            return;
          }
          await duplicate.mutateAsync({ id: nameDialog.item.id, kind: 'template', name });
          toast.success('Saved to Your templates');
        }}
      />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent className="max-w-[min(calc(100vw-1.5rem),24rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'delete-forever'
                ? `Delete ${confirm.name} forever?`
                : `Delete ${selected.size} ${selected.size === 1 ? noun.one : noun.many}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'delete-forever'
                ? 'This cannot be undone.'
                : 'You can restore them from Recently deleted for 30 days.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirm) return;
                remove.mutate(
                  { ids: confirm.ids, permanent: confirm.kind === 'delete-forever' },
                  {
                    onSuccess: () => {
                      setSelectMode(false);
                      setSelected(new Set());
                    },
                  }
                );
                setConfirm(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
