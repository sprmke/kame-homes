import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChevronLeft, Loader2, Play, Sparkles } from 'lucide-react';

import {
  AI_OUTPUT_ICON,
  AiSessionCard,
} from '@/features/dashboard/marketing/components/ai-studio/AiSessionCard';
import {
  MarketingLibraryToolbar,
  type LibraryFilterField,
} from '@/features/dashboard/marketing/components/library/MarketingLibraryToolbar';
import { PublishHistory } from '@/features/dashboard/marketing/components/publishing/PublishHistory';
import { MarketingNameDialog } from '@/features/dashboard/marketing/components/shared/MarketingNameDialog';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import {
  ThemePostArt,
  ThemeVideoArt,
} from '@/features/dashboard/marketing/components/themes/ThemePreview';
import {
  useAiSessionList,
  useDeleteAiSessions,
  useRenameAiSession,
  useRestoreAiSessions,
} from '@/features/dashboard/marketing/hooks/useMarketingAiSessions';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import type { AiSessionSummary } from '@/features/dashboard/marketing/lib/aiStudioSessions';
import {
  isAiStudioOutput,
  type AiStudioOutput,
} from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import type { ResolvedMarketingTheme } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { mixTowardWhite } from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { TierBadge, TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

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

export const AI_OUTPUT_START: Array<{
  value: AiStudioOutput;
  title: string;
  hint: string;
  feature: PlanFeatureKey;
}> = [
  {
    value: 'post',
    title: 'Post',
    hint: 'A ready-to-share design from your photos',
    feature: 'aiMarketingGeneration',
  },
  {
    value: 'image',
    title: 'Photo',
    hint: 'A new photo of your place',
    feature: 'aiMarketingImageGeneration',
  },
  {
    value: 'video',
    title: 'Clip',
    hint: 'An 8 second video from a photo',
    feature: 'aiMarketingVideoGeneration',
  },
];

const GRID_CLASS =
  'grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';
const ALL = 'all';

/** Which outputs this role may start (each has its own team permission). */
export function useAiOutputAccess(): Record<AiStudioOutput, boolean> {
  const { canGenerate, canGenerateImage, canGenerateVideo } = useMarketingPermissions();
  return { post: canGenerate, image: canGenerateImage, video: canGenerateVideo };
}

/**
 * AI Studio home, built like the other tabs' Libraries: start something new at the
 * top (step 1: Post, Photo or Clip), your conversations below. Opening one continues
 * it; every refinement is a new version inside it.
 */
export function AiStudioHome() {
  const { startAiSession, openItem, resolved, coverPhotoUrl } = useMarketingTheme();
  const { property } = useOrgContext();
  const access = useAiOutputAccess();
  const { canEditContent, canPublish } = useMarketingPermissions();
  const canChange = access.post || access.image || access.video;

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [outputFilter, setOutputFilter] = useState<AiStudioOutput | null>(null);
  const [view, setView] = useState<'live' | 'deleted' | 'publishes'>('live');
  const deleted = view === 'deleted';
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [renaming, setRenaming] = useState<AiSessionSummary | null>(null);
  const [confirm, setConfirm] = useState<{ ids: string[]; name: string } | null>(null);

  const list = useAiSessionList({ output: outputFilter, query: debouncedQuery, deleted });
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const loading = list.isLoading && !list.data;
  const filtered = Boolean(outputFilter) || debouncedQuery.trim().length > 0;
  const isFresh = !deleted && !filtered && !loading && !list.isError && items.length === 0;

  const rename = useRenameAiSession();
  const remove = useDeleteAiSessions();
  const restore = useRestoreAiSessions();

  useEffect(() => {
    setSelected(new Set());
    setSelectMode(false);
  }, [view]);

  const fields = useMemo<LibraryFilterField[]>(
    () => [
      {
        id: 'type',
        label: 'Type',
        value: outputFilter ?? ALL,
        defaultValue: ALL,
        options: [
          { value: ALL, label: 'All' },
          { value: 'post', label: 'Posts' },
          { value: 'image', label: 'Photos' },
          { value: 'video', label: 'Clips' },
        ],
        onChange: (value) => setOutputFilter(isAiStudioOutput(value) ? value : null),
      },
    ],
    [outputFilter]
  );

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
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

  const backToCreations = (
    <Button
      type="button"
      variant="ghost"
      className="-ml-2 min-h-[44px] gap-1.5"
      onClick={() => setView('live')}
    >
      <ChevronLeft className="size-4" aria-hidden />
      Your creations
    </Button>
  );

  if (view === 'publishes') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-[100rem] p-3 sm:p-4 lg:p-6">
          <PublishHistory onBack={() => setView('live')} />
        </div>
      </div>
    );
  }

  if (isFresh) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-5 p-4 py-8 sm:p-6 lg:py-12">
          <h2 className="text-admin-page-title text-center">What do you want to make?</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {AI_OUTPUT_START.map((option) => (
              <OutputStartCard
                key={option.value}
                option={option}
                theme={resolved}
                propertyName={property.name}
                photoUrl={coverPhotoUrl}
                disabled={!access[option.value]}
                onSelect={() => startAiSession(option.value)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[100rem] space-y-4 p-3 sm:p-4 lg:p-6">
        {deleted ? (
          backToCreations
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Create">
            {AI_OUTPUT_START.map((option) => {
              const Icon = AI_OUTPUT_ICON[option.value];
              return (
                <TierBadgeAnchor key={option.value} feature={option.feature}>
                  <Button
                    type="button"
                    variant={option.value === 'post' ? 'default' : 'outline'}
                    className="min-h-[44px] gap-2 lg:min-h-10"
                    disabled={!access[option.value]}
                    onClick={() => startAiSession(option.value)}
                  >
                    <Icon className="size-4" aria-hidden />
                    New {option.title.toLowerCase()}
                  </Button>
                </TierBadgeAnchor>
              );
            })}
          </div>
        )}

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
                  disabled={selected.size === 0 || restore.isPending}
                  onClick={() =>
                    restore.mutate([...selected], {
                      onSuccess: () => setSelectMode(false),
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
                disabled={selected.size === 0}
                onClick={() => {
                  if (deleted) {
                    setConfirm({ ids: [...selected], name: `${selected.size} creations` });
                    return;
                  }
                  remove.mutate({ ids: [...selected] }, { onSuccess: () => setSelectMode(false) });
                }}
              >
                {deleted ? 'Delete forever' : 'Delete'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <MarketingLibraryToolbar
              title={deleted ? 'Recently deleted' : 'Your creations'}
              count={!loading && !hasNextPage ? items.length : null}
              query={query}
              onQueryChange={setQuery}
              fields={fields}
              onReset={() => setOutputFilter(null)}
              canSelect={canChange && items.length > 0}
              onStartSelect={() => setSelectMode(true)}
              onOpenDeleted={!deleted && canChange ? () => setView('deleted') : undefined}
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
          <MarketingLibraryGridSkeleton label="Loading your creations" />
        ) : list.isError ? (
          <div className="border-border rounded-xl border border-dashed p-6 text-center">
            <p className="text-muted-foreground text-sm">Could not load your creations.</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-[44px]"
              onClick={() => void list.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="border-border rounded-xl border border-dashed p-6 text-center">
            <p className="text-muted-foreground text-sm">
              {deleted ? 'Nothing here.' : 'Nothing matches.'}
            </p>
            {filtered && !deleted ? (
              <Button
                type="button"
                variant="outline"
                className="mt-3 min-h-[44px]"
                onClick={() => {
                  setOutputFilter(null);
                  setQuery('');
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className={cn(GRID_CLASS, list.isFetching && !isFetchingNextPage && 'opacity-70')}>
            {items.map((session) => (
              <li key={session.id} className="min-w-0">
                <AiSessionCard
                  session={session}
                  selectable={selectMode}
                  selected={selected.has(session.id)}
                  onToggleSelect={() => toggle(session.id)}
                  actions={{
                    onOpen: () => openItem(session.id),
                    onRename: canChange ? () => setRenaming(session) : undefined,
                    onDelete: canChange ? () => remove.mutate({ ids: [session.id] }) : undefined,
                    onRestore: canChange ? () => restore.mutate([session.id]) : undefined,
                    onDeleteForever: canChange
                      ? () => setConfirm({ ids: [session.id], name: `"${session.title}"` })
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
        ) : null}
      </div>

      <MarketingNameDialog
        open={Boolean(renaming)}
        onOpenChange={(open) => !open && setRenaming(null)}
        title="Rename"
        defaultValue={renaming?.title ?? ''}
        confirmLabel="Save"
        onConfirm={async (title) => {
          if (!renaming) return;
          await rename.mutateAsync({ id: renaming.id, title });
        }}
      />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent className="max-w-[min(calc(100vw-1.5rem),24rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirm?.name} forever?</AlertDialogTitle>
            <AlertDialogDescription>
              Every version is removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirm) return;
                remove.mutate(
                  { ids: confirm.ids, permanent: true },
                  { onSuccess: () => setSelectMode(false) }
                );
                setConfirm(null);
              }}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** A single photo, full-bleed, with a corner badge hinting at AI regeneration. */
function PhotoOutputArt({ theme, photoUrl }: { theme: ResolvedMarketingTheme; photoUrl?: string }) {
  return (
    <div
      className="@container relative size-full overflow-hidden"
      style={{ backgroundColor: theme.secondary }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <span
        className="absolute bottom-[6cqw] right-[6cqw] flex size-[18cqw] items-center justify-center rounded-full"
        style={{ backgroundColor: theme.primary, color: theme.onPrimary }}
      >
        <Sparkles className="size-[9cqw]" aria-hidden />
      </span>
    </div>
  );
}

const PREVIEW_FRAME: Record<AiStudioOutput, string> = {
  post: 'aspect-[4/5]',
  image: 'aspect-square',
  video: 'aspect-[9/16]',
};

/** Showcase art for a start card, styled like a theme card: a frame on a tinted backdrop. */
function OutputPreview({
  output,
  theme,
  propertyName,
  photoUrl,
}: {
  output: AiStudioOutput;
  theme: ResolvedMarketingTheme | null;
  propertyName: string;
  photoUrl?: string;
}) {
  return (
    <div
      className="relative flex aspect-[16/9] items-center justify-center overflow-hidden"
      style={
        theme
          ? {
              background: `linear-gradient(135deg, ${mixTowardWhite(theme.primary, 0.8)} 0%, ${mixTowardWhite(theme.accent, 0.86)} 100%)`,
            }
          : undefined
      }
      aria-hidden
    >
      {theme ? (
        <div
          className={cn(
            'relative h-[78%] shrink-0 overflow-hidden rounded-[10px] bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.45)] ring-1 ring-black/5',
            PREVIEW_FRAME[output]
          )}
        >
          {output === 'post' ? (
            <ThemePostArt theme={theme} title={propertyName} photoUrl={photoUrl} />
          ) : output === 'image' ? (
            <PhotoOutputArt theme={theme} photoUrl={photoUrl} />
          ) : (
            <>
              <ThemeVideoArt theme={theme} photoUrl={photoUrl} />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm">
                  <Play className="size-5 fill-white text-white" aria-hidden />
                </span>
              </span>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Step 1 of a new creation: a big, plain choice of what to make. */
export function OutputStartCard({
  option,
  theme,
  propertyName,
  photoUrl,
  disabled,
  onSelect,
}: {
  option: (typeof AI_OUTPUT_START)[number];
  theme: ResolvedMarketingTheme | null;
  propertyName: string;
  photoUrl?: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const Icon = AI_OUTPUT_ICON[option.value];
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'border-border bg-card group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-[border-color,box-shadow,transform] duration-200',
        'hover:border-primary/50 focus-visible:ring-ring native-press hover:shadow-md focus-visible:outline-none focus-visible:ring-2',
        'disabled:pointer-events-none disabled:opacity-50'
      )}
    >
      <OutputPreview
        output={option.value}
        theme={theme}
        propertyName={propertyName}
        photoUrl={photoUrl}
      />
      <span className="flex items-start gap-3 p-4">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="text-foreground block text-[15px] font-semibold">{option.title}</span>
          <span className="text-muted-foreground mt-0.5 block text-[13px] leading-snug">
            {disabled ? 'Ask the owner for access' : option.hint}
          </span>
        </span>
      </span>
      <span className="absolute right-3 top-3">
        <TierBadge feature={option.feature} />
      </span>
    </button>
  );
}
