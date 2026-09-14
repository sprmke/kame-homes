import { useCallback, useEffect, useRef } from 'react';

import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';


import { InboxFilterBar } from '@/features/dashboard/inbox/components/InboxFilterBar';
import { InboxThreadListEmpty } from '@/features/dashboard/inbox/components/InboxThreadListEmpty';
import { InboxThreadRow } from '@/features/dashboard/inbox/components/InboxThreadRow';
import type {
  InboxConversation,
  ThreadPlatformFilter,
  ThreadStatusFilter,
} from '@/features/dashboard/inbox/types/inbox';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

// Below this, plain rendering is simpler and cheaper than virtualizing (mirrors
// ActivityFeedList's threshold for the same tradeoff).
const VIRTUALIZE_THRESHOLD = 30;
const ESTIMATED_ROW_PX = 88;

function InboxThreadRowSkeleton({ opacity = 1 }: { opacity?: number }) {
  return (
    <div className="flex min-h-[44px] w-full gap-3 px-3 py-3" style={{ opacity }} aria-hidden>
      <Skeleton className="mt-0.5 size-9 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-3.5 w-1/3 max-w-[9rem]" />
          <Skeleton className="h-2.5 w-8 shrink-0" />
        </div>
        <div className="mt-0.5 space-y-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3 max-w-[70%]" />
        </div>
        <Skeleton className="mt-1.5 h-4 w-16 rounded-md" />
      </div>
    </div>
  );
}

type Props = {
  conversations: InboxConversation[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  platformFilter: ThreadPlatformFilter;
  statusFilter: ThreadStatusFilter;
  search: string;
  onStatusFilter: (v: ThreadStatusFilter) => void;
  onSearch: (v: string) => void;
  emptyVariant?:
    | 'not-connected'
    | 'syncing'
    | 'sync-error'
    | 'load-error'
    | 'empty'
    | 'search-not-loaded'
    | 'search-empty';
  syncError?: string | null;
  loadError?: string | null;
  canConnect?: boolean;
  onConnect?: () => void;
  onRetryLoad?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  canLoadOlderFromMeta?: boolean;
  onLoadOlderFromMeta?: () => void;
};

export function InboxThreadList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  platformFilter,
  statusFilter,
  search,
  onStatusFilter,
  onSearch,
  emptyVariant = 'empty',
  syncError = null,
  loadError = null,
  canConnect = false,
  onConnect,
  onRetryLoad,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  canLoadOlderFromMeta = false,
  onLoadOlderFromMeta,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(loadingMore);
  loadingMoreRef.current = loadingMore;

  const virtualize = conversations.length >= VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: virtualize ? conversations.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_PX,
    overscan: 10,
    getItemKey: (index) => conversations[index]?.id ?? index,
  });

  const handleLoadMore = useCallback(() => {
    if (!onLoadMore || loadingMoreRef.current) return;
    onLoadMore();
  }, [onLoadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollRoot = scrollRef.current;
    if (!sentinel || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMoreRef.current) {
          handleLoadMore();
        }
      },
      { root: scrollRoot, rootMargin: '120px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, handleLoadMore, conversations.length]);

  return (
    <div className="bg-card flex h-full min-h-0 flex-col">
      <div className="border-border/80 shrink-0 space-y-2.5 border-b p-3">
        <div className="relative">
          <Search
            className="text-muted-foreground/70 pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search messages"
            className="border-border/60 bg-background/80 h-10 pl-9 shadow-none focus-visible:ring-1"
            aria-label="Search messages"
          />
        </div>
        <InboxFilterBar statusFilter={statusFilter} onStatusFilter={onStatusFilter} />
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div className="py-1" aria-busy="true" aria-label="Loading conversations">
            {Array.from({ length: 6 }).map((_, i) => (
              <InboxThreadRowSkeleton key={i} opacity={1 - i * 0.08} />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <InboxThreadListEmpty
            variant={emptyVariant}
            syncError={syncError}
            loadError={loadError}
            canConnect={canConnect}
            onConnect={onConnect}
            onRetryLoad={onRetryLoad}
            canLoadOlderFromMeta={canLoadOlderFromMeta}
            onLoadOlderFromMeta={onLoadOlderFromMeta}
            loadingOlderFromMeta={loadingMore}
          />
        ) : (
          <div className="py-1">
            {virtualize ? (
              <div
                className="relative w-full"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualizer.getVirtualItems().map((item) => {
                  const c = conversations[item.index];
                  if (!c) return null;
                  return (
                    <div
                      key={item.key}
                      data-index={item.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <InboxThreadRow
                        conversation={c}
                        selected={c.id === selectedId}
                        showPlatform={platformFilter === 'all'}
                        onSelect={() => onSelect(c.id)}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              conversations.map((c) => (
                <InboxThreadRow
                  key={c.id}
                  conversation={c}
                  selected={c.id === selectedId}
                  showPlatform={platformFilter === 'all'}
                  onSelect={() => onSelect(c.id)}
                />
              ))
            )}
            {(hasMore || (loadingMore && !canLoadOlderFromMeta)) && (
              <div ref={sentinelRef} role="status" aria-live="polite" aria-busy={loadingMore}>
                {loadingMore ? (
                  <div>
                    <InboxThreadRowSkeleton />
                    <InboxThreadRowSkeleton opacity={0.6} />
                  </div>
                ) : (
                  <div className="min-h-[48px]" aria-hidden />
                )}
              </div>
            )}
            {canLoadOlderFromMeta ? (
              <div className="flex justify-center px-3 py-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 min-h-[44px] px-3"
                  loading={loadingMore}
                  onClick={onLoadOlderFromMeta}
                >
                  Load older from Meta
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
