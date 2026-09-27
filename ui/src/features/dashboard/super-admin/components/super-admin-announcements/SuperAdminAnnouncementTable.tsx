import { announcementScheduleSummary } from '@/features/dashboard/announcements/lib/hostAnnouncementSchedule';
import { HOST_ANNOUNCEMENT_SEVERITY_MARKER_CLASS } from '@/features/dashboard/announcements/lib/hostAnnouncementSeverity';
import {
  hostAnnouncementBodyPlainText,
  type HostAnnouncementDraft,
} from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';
import {
  AdminDataTable,
  AdminTableHeadRow,
  AdminTableRowAffordance,
  AdminTableTh,
  adminTableBodyText,
  adminTableCell,
  adminTableRowClass,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import { ANNOUNCEMENT_SEVERITY_LABELS } from '@/features/dashboard/super-admin/lib/superAdminAnnouncementFilters';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Props = {
  announcements: HostAnnouncementDraft[];
  onSelect: (announcementId: string) => void;
};

export function SuperAdminAnnouncementTable({ announcements, onSelect }: Props) {
  return (
    <AdminDataTable minWidth={720}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Announcement</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Severity</AdminTableTh>
        <AdminTableTh className="whitespace-nowrap px-3 sm:px-4">Status</AdminTableTh>
        <AdminTableTh className="hidden px-3 lg:table-cell lg:px-4">Schedule</AdminTableTh>
        <AdminTableTh className="pl-2 pr-3 sm:pl-3 sm:pr-4">
          <span className="sr-only">Open</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {announcements.map((announcement, index) => {
          const schedule = announcementScheduleSummary(announcement.startsAt, announcement.endsAt);
          return (
            <tr
              key={announcement.id}
              className={adminTableRowClass(index)}
              tabIndex={0}
              role="link"
              onClick={() => onSelect(announcement.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(announcement.id);
                }
              }}
              aria-label={`Open ${announcement.title}`}
            >
              <td className={adminTableCell.body}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      'h-8 w-0.5 shrink-0 rounded-full',
                      HOST_ANNOUNCEMENT_SEVERITY_MARKER_CLASS[announcement.severity]
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className={cn('truncate', adminTableBodyText.primary)}>
                      {announcement.title || 'Untitled announcement'}
                    </p>
                    <p className={cn('line-clamp-1', adminTableBodyText.secondary)}>
                      {hostAnnouncementBodyPlainText(announcement.body)}
                    </p>
                    <p className={cn('mt-1 truncate sm:hidden', adminTableBodyText.secondary)}>
                      {ANNOUNCEMENT_SEVERITY_LABELS[announcement.severity]}
                      {schedule ? ` · ${schedule}` : ''}
                    </p>
                  </div>
                </div>
              </td>
              <td className={cn(adminTableCell.body, 'hidden sm:table-cell')}>
                <span className={adminTableBodyText.secondary}>
                  {ANNOUNCEMENT_SEVERITY_LABELS[announcement.severity]}
                </span>
              </td>
              <td className={cn(adminTableCell.body, 'whitespace-nowrap')}>
                <Badge variant={announcement.active ? 'success' : 'secondary'}>
                  {announcement.active ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className={cn(adminTableCell.body, 'hidden lg:table-cell')}>
                <span className={adminTableBodyText.secondary}>{schedule ?? '-'}</span>
              </td>
              <td className={adminTableCell.action}>
                <AdminTableRowAffordance />
              </td>
            </tr>
          );
        })}
      </tbody>
    </AdminDataTable>
  );
}
