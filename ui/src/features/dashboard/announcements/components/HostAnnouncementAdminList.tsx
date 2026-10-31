import { Link } from 'react-router-dom';

import { ChevronRight, Megaphone } from 'lucide-react';

import { announcementScheduleSummary } from '@/features/dashboard/announcements/lib/hostAnnouncementSchedule';
import { HOST_ANNOUNCEMENT_SEVERITY_MARKER_CLASS } from '@/features/dashboard/announcements/lib/hostAnnouncementSeverity';
import {
  hostAnnouncementBodyPlainText,
  type HostAnnouncementDraft,
} from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type HostAnnouncementAdminListProps = {
  announcements: HostAnnouncementDraft[];
  emptyMessage: string;
  /** Platform page: navigate to a route. */
  toHref?: (announcement: HostAnnouncementDraft) => string;
  /** Development section: open the edit dialog in place. */
  onSelect?: (announcement: HostAnnouncementDraft) => void;
};

function HostAnnouncementAdminRowContent({
  announcement,
}: {
  announcement: HostAnnouncementDraft;
}) {
  const schedule = announcementScheduleSummary(announcement.startsAt, announcement.endsAt);
  const preview = hostAnnouncementBodyPlainText(announcement.body);

  return (
    <>
      <span
        className={cn(
          'h-10 w-0.5 shrink-0 rounded-full sm:h-11',
          HOST_ANNOUNCEMENT_SEVERITY_MARKER_CLASS[announcement.severity]
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-foreground truncate text-sm font-semibold leading-snug sm:text-[15px]">
            {announcement.title || 'Untitled announcement'}
          </h3>
          <Badge variant={announcement.active ? 'success' : 'secondary'}>
            {announcement.active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <p className="text-muted-foreground line-clamp-1 text-sm leading-relaxed">{preview}</p>
        {schedule ? <p className="text-muted-foreground/75 text-xs">{schedule}</p> : null}
      </div>
      <ChevronRight
        className="text-muted-foreground/45 group-hover:text-muted-foreground size-4 shrink-0 transition-colors"
        aria-hidden
      />
    </>
  );
}

const ROW_CLASS = cn(
  'group flex w-full items-center gap-3 px-4 py-4 text-left transition-colors sm:gap-4 sm:px-5 sm:py-[1.125rem]',
  'hover:bg-muted/50 focus-visible:bg-muted/50',
  'focus-visible:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset'
);

export function HostAnnouncementAdminList({
  announcements,
  emptyMessage,
  toHref,
  onSelect,
}: HostAnnouncementAdminListProps) {
  if (announcements.length === 0) {
    return (
      <div className="surface-card text-muted-foreground flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
        <Megaphone className="text-muted-foreground/50 size-8 stroke-[1.25]" aria-hidden />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="surface-card divide-border/50 divide-y overflow-hidden">
      {announcements.map((announcement) =>
        toHref ? (
          <Link key={announcement.id} to={toHref(announcement)} className={ROW_CLASS}>
            <HostAnnouncementAdminRowContent announcement={announcement} />
          </Link>
        ) : (
          <button
            key={announcement.id}
            type="button"
            className={ROW_CLASS}
            onClick={() => onSelect?.(announcement)}
          >
            <HostAnnouncementAdminRowContent announcement={announcement} />
          </button>
        )
      )}
    </div>
  );
}
