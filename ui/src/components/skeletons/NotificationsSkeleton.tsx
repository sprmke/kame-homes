import { Bell, Link2, MessageCircle, Send } from 'lucide-react';

import { StatCardSkeleton } from '@/components/shared/StatCard';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function NotificationFeedRowSkeleton({ index }: { index: number }) {
  return (
    <div className="flex gap-3 px-3 py-2.5 sm:px-4 sm:py-3" style={{ opacity: 1 - index * 0.08 }}>
      <Skeleton className="mt-0.5 size-7 shrink-0 rounded-full sm:size-8" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/3 max-w-full" />
        <Skeleton className="h-3 w-4/5 max-w-full" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </div>
  );
}

/**
 * Property / parking Notifications hub: the four KPI cards, the Activity /
 * Telegram tab bar (static labels, so it is never a blank strip), and the first
 * page of activity rows. The Telegram view has its own skeletons on open.
 */
export function NotificationsPageBodySkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading notifications"
      className={cn('flex min-h-0 flex-1 flex-col gap-3 sm:gap-4', className)}
    >
      <div className="grid grid-cols-2 items-start gap-2 sm:gap-3 lg:grid-cols-2 lg:gap-4 xl:grid-cols-4">
        <StatCardSkeleton title="Unread" icon={Bell} />
        <StatCardSkeleton title="Messages" icon={MessageCircle} />
        <StatCardSkeleton
          title="Telegram on"
          icon={Send}
          titleAdornment={<span aria-hidden className="-my-1 size-6 shrink-0" />}
        />
        <StatCardSkeleton
          title="Connected"
          icon={Link2}
          titleAdornment={<span aria-hidden className="-my-1 size-6 shrink-0" />}
        />
      </div>

      <div className="bg-muted text-muted-foreground flex h-9 w-full items-stretch rounded-lg p-0.5">
        <span className="bg-card text-foreground flex flex-1 items-center justify-center rounded-md text-[13px] font-medium shadow">
          Activity
        </span>
        <span className="flex flex-1 items-center justify-center text-[13px] font-medium">
          Telegram
        </span>
      </div>

      <Card className="flex min-h-0 flex-auto flex-col overflow-hidden">
        <div className="px-3 pb-2 pt-3 sm:px-4">
          <h2 className="text-card-title">Activity</h2>
        </div>
        <div className="border-border/60 divide-border/60 divide-y border-t">
          {Array.from({ length: 6 }).map((_, index) => (
            <NotificationFeedRowSkeleton key={index} index={index} />
          ))}
        </div>
      </Card>
    </div>
  );
}
