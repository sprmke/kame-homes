import { AdminTableRowAffordance } from '@/features/dashboard/bookings/components/AdminDataTable';
import { SupportTicketStatusBadge } from '@/features/dashboard/help-support/components/SupportTicketStatusBadge';
import { SUPPORT_TICKET_CATEGORY_LABELS } from '@/features/dashboard/help-support/lib/supportTicketSchema';
import type { AdminSupportTicket } from '@/features/dashboard/super-admin/hooks/useSupportTicketsAdmin';
import {
  SUPPORT_TICKET_PRIORITY_LABELS,
  formatSupportTicketDate,
} from '@/features/dashboard/super-admin/lib/superAdminSupportFilters';

import { AdminCardGrid, AdminCardRow } from '@/components/mobile/AdminCardGrid';

type Props = {
  tickets: AdminSupportTicket[];
  onSelect: (ticketId: string) => void;
};

export function SuperAdminSupportCardGrid({ tickets, onSelect }: Props) {
  return (
    <AdminCardGrid denser={false}>
      {tickets.map((ticket) => {
        const submitter = ticket.submitted_by_name || ticket.submitted_by_email;
        const meta = [
          SUPPORT_TICKET_CATEGORY_LABELS[ticket.category],
          ticket.priority ? SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority] : null,
          formatSupportTicketDate(ticket.created_at),
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <AdminCardRow
            key={ticket.id}
            onOpen={() => onSelect(ticket.id)}
            aria-label={`Open ${ticket.subject}`}
            className="gap-1.5 px-3 py-2.5 sm:min-h-[132px] sm:gap-3 sm:p-4"
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-foreground min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight sm:text-sm">
                    {ticket.subject}
                  </p>
                  <SupportTicketStatusBadge status={ticket.status} />
                  <AdminTableRowAffordance />
                </div>
                <p className="text-muted-foreground mt-1 truncate text-[11px] leading-tight sm:text-xs">
                  <span className="sm:hidden">
                    {ticket.organizationName}
                    {submitter ? ` · ${submitter}` : ''}
                    {meta ? ` · ${meta}` : ''}
                  </span>
                  <span className="hidden sm:inline">{ticket.organizationName}</span>
                </p>
                <p className="text-muted-foreground hidden truncate text-xs sm:block">
                  {submitter}
                </p>
              </div>
            </div>

            <div className="border-border/50 mt-auto hidden flex-wrap items-center justify-between gap-2 border-t pt-3 sm:flex">
              <span className="text-muted-foreground text-xs">
                {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]}
                {ticket.priority ? ` · ${SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}` : ''}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatSupportTicketDate(ticket.created_at)}
              </span>
            </div>
          </AdminCardRow>
        );
      })}
    </AdminCardGrid>
  );
}
