import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useNavigate } from 'react-router-dom';

import { formatDistanceToNow } from 'date-fns';
import { BellOff } from 'lucide-react';

import { PlatformLogo } from '@/features/dashboard/inbox/components/PlatformLogo';
import { NotificationInboxTitle } from '@/features/dashboard/notifications/components/NotificationInboxTitle';
import { useEnrichedNotifications } from '@/features/dashboard/notifications/hooks/useEnrichedNotifications';
import {
  useMarkNotificationRead,
  useNotificationsList,
  type NotificationsListMode,
} from '@/features/dashboard/notifications/hooks/useNotifications';
import type { NotificationRecord } from '@/features/dashboard/notifications/lib/notificationsApi';
import { collapseInboxNotifications } from '@/features/dashboard/notifications/lib/notificationsCollapse';
import {
  formatNotificationDisplayTitle,
  formatNotificationInboxPlatformLabel,
  formatNotificationStayLabel,
  notificationIconFor,
  notificationInboxPlatform,
} from '@/features/dashboard/notifications/lib/notificationsDisplay';
import {
  resolveNotificationPath,
  type NotificationPathScope,
} from '@/features/dashboard/notifications/lib/notificationsPaths';

import { ListRowsSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  mode: NotificationsListMode;
  pathScope: NotificationPathScope;
  className?: string;
  /** Sheet (bell panel), dropdown (legacy), or the hub page's full-height feed. */
  variant?: 'sheet' | 'dropdown' | 'feed';
  /**
   * Scrollport that owns pagination for `variant="feed"`. The feed does not
   * scroll itself — the hub view's scrollport does — so the sentinel has to be
   * observed against that element. Pagination starts once it resolves.
   */
  scrollRoot?: HTMLElement | null;
  onNavigate?: () => void;
};

export function InAppNotificationsPanel({
  mode,
  pathScope,
  className,
  variant = 'feed',
  scrollRoot,
  onNavigate,
}: Props) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useNotificationsList(mode);
  const markRead = useMarkNotificationRead();

  const rawNotifications = data?.pages.flatMap((page) => page.notifications) ?? [];
  const enrichedNotifications = useEnrichedNotifications(rawNotifications);
  const notifications = collapseInboxNotifications(enrichedNotifications);
  const hasMoreOnServer = Boolean(data?.pages[0]?.nextCursor);

  loadingMoreRef.current = isFetchingNextPage;

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || loadingMoreRef.current) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage]);

  useEffect(() => {
    if (variant !== 'feed' || !hasNextPage) return;

    const sentinel = sentinelRef.current;
    // The hub renders the feed inside the admin content scrollport; use it when
    // the caller did not hand a root in, so scroll paging keeps working there.
    const root = scrollRoot ?? sentinel?.closest<HTMLElement>('[data-admin-content-scroll]') ?? null;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMoreRef.current) {
          handleLoadMore();
        }
      },
      { root, rootMargin: '120px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [variant, hasNextPage, handleLoadMore, notifications.length, scrollRoot]);

  const handleRowClick = (notification: NotificationRecord) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const path = resolveNotificationPath(notification, pathScope);
    if (path) {
      onNavigate?.();
      navigate(path);
    }
  };

  const listScrollClassName = useMemo(() => {
    if (variant === 'sheet') {
      return 'min-h-0 flex-1 overflow-y-auto overscroll-contain';
    }
    if (variant === 'dropdown') {
      return 'max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain';
    }
    /* Feed: the hub view's scrollport owns scroll, so one scrollbar, not two. */
    return undefined;
  }, [variant]);

  if (isLoading) {
    return (
      <div className={cn('px-4 py-3', className)}>
        <ListRowsSkeleton rows={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3 px-4 py-6', className)}>
        <p className="text-muted-foreground text-sm">Could not load notifications.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 px-4 py-10 text-center',
          className
        )}
      >
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
          <BellOff className="size-4" aria-hidden />
        </span>
        <p className="text-muted-foreground text-sm">No notifications yet.</p>
      </div>
    );
  }

  return (
    <div
      className={cn('min-w-0', variant === 'sheet' && 'flex min-h-0 flex-1 flex-col', className)}
    >
      <div ref={scrollRef} className={listScrollClassName}>
        <ul className={variant === 'feed' ? 'divide-border/60 divide-y' : undefined}>
          {notifications.map((notification) => {
            const Icon = notificationIconFor(notification.type);
            const stayLabel = formatNotificationStayLabel(notification.metadata);
            const inboxPlatform = notificationInboxPlatform(notification.metadata);
            const platformLabel = formatNotificationInboxPlatformLabel(notification.metadata);
            return (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => handleRowClick(notification)}
                  className={cn(
                    'hover:bg-muted/60 flex min-h-[44px] w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors sm:gap-3 sm:px-4',
                    !notification.isRead && 'bg-primary/5',
                    variant === 'feed' && 'sm:py-3'
                  )}
                >
                  {notification.type === 'inbox_new_message' && inboxPlatform ? (
                    <PlatformLogo
                      platform={inboxPlatform}
                      size="xs"
                      className="mt-0.5 size-7 shrink-0 rounded-full sm:size-8"
                    />
                  ) : (
                    <span
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full sm:size-8',
                        notification.isRead
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      <Icon className="size-3.5 sm:size-4" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-1 items-start justify-between gap-2">
                      {notification.type === 'inbox_new_message' && platformLabel ? (
                        <NotificationInboxTitle
                          name={formatNotificationDisplayTitle(notification)}
                          platformLabel={platformLabel}
                          nameClassName={cn(
                            'text-[13px] sm:text-sm',
                            notification.isRead ? 'font-medium' : 'font-semibold'
                          )}
                        />
                      ) : (
                        <span
                          className={cn(
                            'truncate text-[13px] sm:text-sm',
                            notification.isRead ? 'font-medium' : 'font-semibold'
                          )}
                        >
                          {formatNotificationDisplayTitle(notification)}
                        </span>
                      )}
                      {!notification.isRead ? (
                        <span
                          className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                    {stayLabel ? (
                      <span className="text-muted-foreground mt-0.5 block text-[11px] tabular-nums sm:text-xs">
                        {stayLabel}
                      </span>
                    ) : null}
                    {notification.body ? (
                      <span className="text-muted-foreground mt-0.5 line-clamp-1 block text-[11px] sm:line-clamp-2 sm:text-xs">
                        {notification.body}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground mt-0.5 block text-[10px] sm:mt-1 sm:text-[11px]">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {variant === 'feed' && (hasNextPage || isFetchingNextPage) ? (
          <div ref={sentinelRef} role="status" aria-live="polite" aria-busy={isFetchingNextPage}>
            {isFetchingNextPage ? (
              <div className="px-4 pb-2 pt-1">
                <ListRowsSkeleton rows={2} />
              </div>
            ) : (
              <div className="min-h-[48px]" aria-hidden />
            )}
          </div>
        ) : null}
      </div>

      {(variant === 'sheet' || variant === 'dropdown') && mode === 'preview' && hasMoreOnServer ? (
        <span className="sr-only">More notifications available on the Notifications page.</span>
      ) : null}
    </div>
  );
}
