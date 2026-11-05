import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function NavRowSkeleton({ label, icon = true }: { label?: string; icon?: boolean }) {
  return (
    <div className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5">
      {icon ? <Skeleton className="size-4 shrink-0 rounded" /> : null}
      {label ? (
        <span className="text-muted-foreground truncate text-sm font-medium">{label}</span>
      ) : (
        <Skeleton className="h-3 w-24 max-w-[7rem]" />
      )}
    </div>
  );
}

/** Sidebar matching `AdminSectionNavLayout`'s grouped section list. */
function NotificationsNavSkeleton({
  moduleLabels,
  className,
}: {
  moduleLabels: string[];
  className?: string;
}) {
  return (
    <aside className={cn('hidden w-56 shrink-0 lg:block lg:self-start', className)} aria-hidden>
      <Card>
        <div className="space-y-1 p-2">
          <div className="px-3 py-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              In-app notifications
            </p>
          </div>
          <NavRowSkeleton label="Activity" />
          <div className="border-border/60 my-2 border-t" role="separator" />
          <div className="px-3 py-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Telegram notifications
            </p>
          </div>
          {moduleLabels.map((label) => (
            <NavRowSkeleton key={label} label={label} />
          ))}
        </div>
      </Card>
    </aside>
  );
}

function ToggleRowSkeleton() {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 py-2">
      <Skeleton className="h-3.5 w-1/2 max-w-[12rem]" />
      <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
    </div>
  );
}

function NotificationFeedRowSkeleton({ index }: { index: number }) {
  return (
    <div
      className="border-border/60 flex gap-3 rounded-lg border p-3"
      style={{ opacity: 1 - index * 0.08 }}
    >
      <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/3 max-w-full" />
        <Skeleton className="h-3 w-4/5 max-w-full" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </div>
  );
}

function TelegramCardSkeleton({ title, rows = 2 }: { title?: string; rows?: number }) {
  return (
    <Card aria-hidden>
      <div className="space-y-0 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="size-4 shrink-0 rounded" />
            {title ? (
              <h3 className="text-card-title">{title}</h3>
            ) : (
              <Skeleton className="h-4 w-28" />
            )}
          </div>
          <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
        </div>
        <div className="mt-1 space-y-1">
          <Skeleton className="h-3 w-full max-w-lg" />
          <Skeleton className="h-3 w-2/3 max-w-md" />
        </div>
      </div>
      <div className="space-y-3 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full max-w-xl rounded-lg" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * Property / parking Notifications hub: `AdminSectionNavLayout` sidebar (activity + Telegram
 * modules), then in-app cards, the activity feed, and one Telegram card per module.
 */
export function NotificationsPageBodySkeleton({
  moduleLabels = ['Chat', 'Marketing', 'Staff', 'Operations', 'Finance', 'Maintenance'],
  navClassName,
}: {
  moduleLabels?: string[];
  navClassName?: string;
}) {
  return (
    <div
      role="status"
      className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:gap-8 xl:gap-10"
      aria-busy="true"
      aria-label="Loading notifications"
    >
      <NotificationsNavSkeleton moduleLabels={moduleLabels} className={navClassName} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="mx-auto w-full max-w-4xl space-y-6">
            <div className="space-y-3 sm:space-y-4">
              <h2 className="text-section-title">In-app notifications</h2>

              {/* PushNotificationsCard */}
              <div className="border-border bg-card rounded-xl border px-3 py-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Skeleton className="size-8 shrink-0 rounded-lg" />
                    <div className="min-w-0 space-y-1.5">
                      <h3 className="text-[13px] font-semibold leading-tight sm:text-sm">
                        Notifications on this device
                      </h3>
                      <Skeleton className="h-3 w-64 max-w-full" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
                </div>
              </div>

              {/* NotificationPreferencesCard */}
              <div className="border-border bg-card rounded-xl border px-3 py-3 sm:p-4">
                <h3 className="text-[13px] font-semibold leading-tight sm:text-sm">
                  Push preferences
                </h3>
                <div className="divide-border/60 mt-2 divide-y">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <ToggleRowSkeleton key={index} />
                  ))}
                </div>
              </div>

              {/* Activity feed */}
              <Card>
                <div className="flex items-center justify-between gap-3 p-4 pb-2 sm:p-5 sm:pb-2">
                  <h3 className="text-card-title">Activity</h3>
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="space-y-2 p-4 pt-2 sm:p-5 sm:pt-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <NotificationFeedRowSkeleton key={index} index={index} />
                  ))}
                </div>
              </Card>

              {/* Telegram group heading */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-section-title">Telegram notifications</h2>
                  <span className="bg-muted text-muted-foreground inline-flex min-h-[22px] items-center rounded-full px-2 text-xs font-medium">
                    {moduleLabels.length}
                  </span>
                </div>
                <Skeleton className="h-9 w-20 rounded-md" />
              </div>

              {/* Shared bot token card */}
              <TelegramCardSkeleton title="Shared bot token" rows={1} />

              {/* One card per Telegram module */}
              {moduleLabels.map((label) => (
                <TelegramCardSkeleton key={label} title={label} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
