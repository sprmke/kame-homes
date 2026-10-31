import { announcementScheduleSummary } from '@/features/dashboard/announcements/lib/hostAnnouncementSchedule';
import { HOST_ANNOUNCEMENT_SEVERITY_MARKER_CLASS } from '@/features/dashboard/announcements/lib/hostAnnouncementSeverity';
import {
  hostAnnouncementBodyPlainText,
  type HostAnnouncementDraft,
} from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';
import { AdminTableRowAffordance } from '@/features/dashboard/bookings/components/AdminDataTable';
import { ANNOUNCEMENT_SEVERITY_LABELS } from '@/features/dashboard/super-admin/lib/superAdminAnnouncementFilters';

import { AdminCardGrid, AdminCardRow } from '@/components/mobile/AdminCardGrid';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Props = {
  announcements: HostAnnouncementDraft[];
  onSelect: (announcementId: string) => void;
};

export function SuperAdminAnnouncementCardGrid({ announcements, onSelect }: Props) {
  return (
    <AdminCardGrid denser={false}>
      {announcements.map((announcement) => {
        const schedule = announcementScheduleSummary(announcement.startsAt, announcement.endsAt);

        return (
          <AdminCardRow
            key={announcement.id}
            onOpen={() => onSelect(announcement.id)}
            aria-label={`Open ${announcement.title}`}
            className="gap-1.5 px-3 py-2.5 sm:min-h-[132px] sm:gap-3 sm:p-4"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-9 w-0.5 shrink-0 rounded-full',
                  HOST_ANNOUNCEMENT_SEVERITY_MARKER_CLASS[announcement.severity]
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-foreground min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight sm:text-sm">
                    {announcement.title || 'Untitled announcement'}
                  </p>
                  <Badge variant={announcement.active ? 'success' : 'secondary'}>
                    {announcement.active ? 'Active' : 'Inactive'}
                  </Badge>
                  <AdminTableRowAffordance />
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-1 text-[11px] leading-tight sm:text-xs">
                  {hostAnnouncementBodyPlainText(announcement.body)}
                </p>
              </div>
            </div>

            <div className="border-border/50 mt-auto hidden flex-wrap items-center justify-between gap-2 border-t pt-3 sm:flex">
              <span className="text-muted-foreground text-xs">
                {ANNOUNCEMENT_SEVERITY_LABELS[announcement.severity]}
              </span>
              <span className="text-muted-foreground text-xs">{schedule ?? '-'}</span>
            </div>
          </AdminCardRow>
        );
      })}
    </AdminCardGrid>
  );
}
