import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { ChevronRight, Megaphone } from 'lucide-react';

import { PublicListingPagination } from '@/features/guest/marketing/shared/components/PublicListingPagination';

import { useHostAnnouncementReadState } from '@/features/dashboard/announcements/hooks/useHostAnnouncementReadState';
import { isLongHostAnnouncementBody } from '@/features/dashboard/announcements/lib/hostAnnouncementDetail';
import {
  groupHostAnnouncementsForFeed,
  HOST_ANNOUNCEMENT_FEED_PAGE_SIZE,
  hostAnnouncementIdentityKey,
  type HostAnnouncementFeedGroup,
} from '@/features/dashboard/announcements/lib/hostAnnouncementPresentation';
import { HOST_ANNOUNCEMENT_SEVERITY_MARKER_CLASS } from '@/features/dashboard/announcements/lib/hostAnnouncementSeverity';
import { hostAnnouncementDetailPath } from '@/features/dashboard/announcements/lib/hostAnnouncementsPaths';
import {
  hostAnnouncementBodyPlainText,
  type HostAnnouncement,
} from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';
import { AdminSectionGroupHeading } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { useNotificationsOrgScope } from '@/features/dashboard/notifications/lib/notificationsScope';

import { StatCardSkeleton } from '@/components/shared/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type HostAnnouncementListRowProps = {
  announcement: HostAnnouncement;
  detailPath: string;
  unread: boolean;
};

function HostAnnouncementListRow({
  announcement,
  detailPath,
  unread,
}: HostAnnouncementListRowProps) {
  const showReadMore =
    isLongHostAnnouncementBody(announcement.body) || Boolean(announcement.linkUrl);

  return (
    <Link
      to={detailPath}
      aria-label={unread ? `${announcement.title}, unread` : announcement.title}
      className={cn(
        'group flex items-center gap-3 px-4 py-4 transition-colors sm:gap-4 sm:px-5 sm:py-[1.125rem]',
        'hover:bg-muted/50 focus-visible:bg-muted/50',
        'focus-visible:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
        unread ? 'bg-primary/5 dark:bg-primary/10' : 'bg-transparent'
      )}
    >
      <span
        className={cn(
          'h-10 w-0.5 shrink-0 rounded-full sm:h-11',
          HOST_ANNOUNCEMENT_SEVERITY_MARKER_CLASS[announcement.severity],
          !unread && 'opacity-55'
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <h3
          className={cn(
            'text-sm leading-snug tracking-tight sm:text-[15px]',
            unread ? 'text-foreground font-semibold' : 'text-foreground/75 font-medium'
          )}
        >
          {announcement.title}
          {unread ? (
            <span
              className="bg-destructive ml-1.5 inline-block size-1.5 shrink-0 rounded-full align-middle"
              aria-hidden
            />
          ) : null}
        </h3>
        <p
          className={cn(
            'line-clamp-2 text-sm leading-relaxed',
            unread ? 'text-muted-foreground' : 'text-muted-foreground/75'
          )}
        >
          {hostAnnouncementBodyPlainText(announcement.body)}
        </p>
        {showReadMore ? (
          <span className="text-primary inline-flex items-center gap-0.5 text-sm font-semibold">
            Read more
            <ChevronRight className="size-3.5 shrink-0 opacity-90" aria-hidden />
          </span>
        ) : null}
      </div>
      <ChevronRight
        className="text-muted-foreground/45 group-hover:text-muted-foreground size-4 shrink-0 transition-colors"
        aria-hidden
      />
    </Link>
  );
}

function HostAnnouncementGroupSection({
  group,
  basePath,
  isUnread,
}: {
  group: HostAnnouncementFeedGroup;
  basePath: string | null;
  isUnread: (identityKey: string) => boolean;
}) {
  const [page, setPage] = useState(1);
  const count = group.announcements.length;
  const pageCount = Math.max(1, Math.ceil(count / HOST_ANNOUNCEMENT_FEED_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pageAnnouncements = useMemo(() => {
    const start = (safePage - 1) * HOST_ANNOUNCEMENT_FEED_PAGE_SIZE;
    return group.announcements.slice(start, start + HOST_ANNOUNCEMENT_FEED_PAGE_SIZE);
  }, [group.announcements, safePage]);

  if (count === 0) return null;

  return (
    <section aria-label={group.label}>
      <AdminSectionGroupHeading
        className="mb-3 px-0.5"
        title={group.label}
        action={
          <PublicListingPagination
            variant="inline"
            compact
            showPageIndicator={false}
            page={safePage}
            totalPages={pageCount}
            onPageChange={setPage}
          />
        }
      />

      <div className="surface-card divide-border/50 divide-y overflow-hidden">
        {pageAnnouncements.map((announcement) => {
          const identityKey = hostAnnouncementIdentityKey(announcement);
          return basePath ? (
            <HostAnnouncementListRow
              key={identityKey}
              announcement={announcement}
              detailPath={hostAnnouncementDetailPath(basePath, announcement.id)}
              unread={isUnread(identityKey)}
            />
          ) : (
            <div key={identityKey} className="flex gap-3 px-4 py-4 sm:px-5">
              <span
                className={cn(
                  'h-10 w-0.5 shrink-0 rounded-full',
                  HOST_ANNOUNCEMENT_SEVERITY_MARKER_CLASS[announcement.severity]
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <h3 className="text-foreground text-sm font-semibold leading-snug sm:text-[15px]">
                  {announcement.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {hostAnnouncementBodyPlainText(announcement.body)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function HostAnnouncementsBodySkeleton({ detail = false }: { detail?: boolean } = {}) {
  return (
    <div
      className="flex flex-col gap-4 sm:gap-5"
      role="status"
      aria-live="polite"
      aria-label="Loading announcements"
    >
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      {detail ? <Skeleton className="h-8 w-36 rounded-lg" aria-hidden /> : null}
      <div className="surface-card divide-border/50 divide-y overflow-hidden" aria-hidden>
        {Array.from({ length: detail ? 1 : 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5">
            <Skeleton className="h-10 w-0.5 shrink-0 rounded-full sm:h-11" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5 max-w-xs" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              {detail ? <Skeleton className="h-3 w-3/5" /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HostAnnouncementFeed({
  announcements,
  basePath,
}: {
  announcements: HostAnnouncement[];
  basePath?: string | null;
}) {
  const { orgId } = useNotificationsOrgScope();
  const activeIdentityKeys = useMemo(
    () => announcements.map((entry) => hostAnnouncementIdentityKey(entry)),
    [announcements]
  );
  const { isUnread } = useHostAnnouncementReadState(orgId, activeIdentityKeys);

  if (announcements.length === 0) {
    return (
      <div className="surface-card text-muted-foreground flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
        <Megaphone className="text-muted-foreground/50 size-8 stroke-[1.25]" aria-hidden />
        <p className="text-sm">No active announcements.</p>
      </div>
    );
  }

  const groups = groupHostAnnouncementsForFeed(announcements);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <HostAnnouncementGroupSection
          key={group.key}
          group={group}
          basePath={basePath ?? null}
          isUnread={isUnread}
        />
      ))}
    </div>
  );
}
