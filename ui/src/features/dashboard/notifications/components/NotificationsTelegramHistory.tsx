import { useState } from 'react';

import { formatDistanceToNow } from 'date-fns';
import { Send } from 'lucide-react';

import { TelegramDeliverySwitchRow } from '@/features/dashboard/notifications/components/NotificationsChannelPanels';
import { useTelegramHistoryPage } from '@/features/dashboard/notifications/hooks/useTelegramHistory';
import {
  INITIAL_NOTIFICATION_PAGER,
  notificationPagerCanGoNewer,
  notificationPagerCursor,
  notificationPagerGoNewer,
  notificationPagerGoOlder,
  notificationPagerPageNumber,
  type NotificationPagerState,
} from '@/features/dashboard/notifications/lib/notificationPager';
import {
  telegramHistoryPreview,
  telegramModuleMeta,
} from '@/features/dashboard/notifications/lib/telegramHistory';

import { ListRowsSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Read-only copy of what each Telegram group received. One page at a time from a
 * 15-day window, so the list never grows without bound and nothing here calls
 * Telegram.
 */
export function NotificationsTelegramHistory() {
  const [pager, setPager] = useState<NotificationPagerState>(INITIAL_NOTIFICATION_PAGER);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const cursor = notificationPagerCursor(pager);
  const { data, isFetching, isError, refetch } = useTelegramHistoryPage(cursor);

  const messages = data?.messages ?? [];
  const hasOlder = Boolean(data?.nextCursor);
  const canGoNewer = notificationPagerCanGoNewer(pager);
  const showSkeleton = isFetching && data === undefined;

  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="w-full space-y-3 pb-2 sm:space-y-4">
      <TelegramDeliverySwitchRow className="bg-card" />

      <Card className="overflow-hidden">
        {showSkeleton ? (
          <div className="px-4 py-3">
            <ListRowsSkeleton rows={6} />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Could not load Telegram messages.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
              <Send className="size-4" aria-hidden />
            </span>
            <p className="text-muted-foreground text-sm">Nothing sent yet.</p>
            <p className="text-muted-foreground text-xs">
              Turn on a module in Manage. The last {data?.retentionDays ?? 15} days of messages show
              up here.
            </p>
          </div>
        ) : (
          <ul className="divide-border/60 divide-y">
            {messages.map((message) => {
              const meta = telegramModuleMeta(message.module);
              const Icon = meta.icon;
              const { preview, truncated } = telegramHistoryPreview(message.text);
              const isExpanded = expanded.has(message.id);
              const failed = message.status === 'failed';
              return (
                <li key={message.id} className="px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <span
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full sm:size-8',
                        failed ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                      )}
                    >
                      <Icon className="size-3.5 sm:size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-foreground text-[13px] font-semibold sm:text-sm">
                          {meta.label}
                        </span>
                        {failed ? (
                          <span className="bg-destructive/10 text-destructive rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                            Failed
                          </span>
                        ) : null}
                        <span className="text-muted-foreground text-[11px] sm:text-xs">
                          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                        </span>
                      </div>

                      <p
                        className={cn(
                          'text-muted-foreground mt-1 whitespace-pre-line text-[12px] leading-relaxed sm:text-[13px]',
                          !isExpanded && 'line-clamp-3'
                        )}
                      >
                        {isExpanded ? message.text : preview}
                      </p>

                      {failed && message.error ? (
                        <p className="text-destructive mt-1 text-[11px]">{message.error}</p>
                      ) : null}

                      {truncated || isExpanded ? (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(message.id)}
                          className="text-primary mt-1 min-h-[32px] text-xs font-semibold hover:underline"
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {messages.length > 0 ? (
          <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2 sm:px-4">
            <p className="text-muted-foreground text-xs" aria-live="polite">
              {pageSummary(pager, messages.length, hasOlder, isFetching, data?.retentionDays ?? 15)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setPager(notificationPagerGoNewer)}
                disabled={!canGoNewer}
              >
                Newer
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() =>
                  setPager((current) => notificationPagerGoOlder(current, data?.nextCursor))
                }
                disabled={!hasOlder || isFetching}
              >
                Older
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function pageSummary(
  pager: NotificationPagerState,
  rowCount: number,
  hasOlder: boolean,
  isFetching: boolean,
  retentionDays: number
): string {
  if (isFetching) return 'Loading…';
  const page = notificationPagerPageNumber(pager);
  const items = `${rowCount} ${rowCount === 1 ? 'message' : 'messages'}`;
  const range = `last ${retentionDays} days`;
  return hasOlder
    ? `Page ${page} · ${items} · ${range}`
    : `Page ${page} · ${items} · ${range} · end`;
}
