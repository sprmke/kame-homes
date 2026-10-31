import { formatHostAnnouncementUpdatedAt } from '@/features/dashboard/announcements/lib/hostAnnouncementDetail';
import {
  HOST_ANNOUNCEMENT_SEVERITY_PRESENTATION,
  hostAnnouncementScopeLabel,
} from '@/features/dashboard/announcements/lib/hostAnnouncementPresentation';
import type { HostAnnouncement } from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';

import { cn } from '@/lib/utils';

type HostAnnouncementStatusCardProps = {
  announcement: HostAnnouncement;
  className?: string;
};

export function HostAnnouncementStatusCard({
  announcement,
  className,
}: HostAnnouncementStatusCardProps) {
  const presentation = HOST_ANNOUNCEMENT_SEVERITY_PRESENTATION[announcement.severity];
  const scopeLabel = hostAnnouncementScopeLabel(announcement);
  const updatedLabel = formatHostAnnouncementUpdatedAt(announcement.updatedAt);

  return (
    <div
      className={cn(
        'bg-muted/35 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-4 py-3 sm:px-5',
        className
      )}
    >
      <span
        className={cn(
          'text-xs font-semibold tracking-wide',
          announcement.severity === 'critical' && 'text-rose-600 dark:text-rose-400',
          announcement.severity === 'warning' && 'text-amber-700 dark:text-amber-400',
          announcement.severity === 'info' && 'text-muted-foreground'
        )}
      >
        {presentation.severityLabel}
      </span>
      <span className="bg-border/80 h-3.5 w-px shrink-0" aria-hidden />
      <span className="text-muted-foreground text-sm">{scopeLabel}</span>
      {updatedLabel ? (
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">{updatedLabel}</span>
      ) : null}
    </div>
  );
}
