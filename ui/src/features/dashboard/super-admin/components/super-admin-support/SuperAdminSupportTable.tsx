import {
  AdminDataTable,
  AdminTableHeadRow,
  AdminTableRowAffordance,
  AdminTableTh,
  adminTableBodyText,
  adminTableCell,
  adminTableRowClass,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import { SupportTicketStatusBadge } from '@/features/dashboard/help-support/components/SupportTicketStatusBadge';
import { SUPPORT_TICKET_CATEGORY_LABELS } from '@/features/dashboard/help-support/lib/supportTicketSchema';
import type { AdminSupportTicket } from '@/features/dashboard/super-admin/hooks/useSupportTicketsAdmin';
import {
  SUPPORT_TICKET_PRIORITY_LABELS,
  formatSupportTicketDate,
} from '@/features/dashboard/super-admin/lib/superAdminSupportFilters';

import { cn } from '@/lib/utils';

type Props = {
  tickets: AdminSupportTicket[];
  onSelect: (ticketId: string) => void;
};

export function SuperAdminSupportTable({ tickets, onSelect }: Props) {
  return (
    <AdminDataTable minWidth={720}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Ticket</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Organization</AdminTableTh>
        <AdminTableTh className="hidden px-3 md:table-cell md:px-4">Category</AdminTableTh>
        <AdminTableTh className="hidden px-3 lg:table-cell lg:px-4">Priority</AdminTableTh>
        <AdminTableTh className="whitespace-nowrap px-3 sm:px-4">Status</AdminTableTh>
        <AdminTableTh className="hidden px-3 xl:table-cell xl:px-4">Submitted</AdminTableTh>
        <AdminTableTh className="pl-2 pr-3 sm:pl-3 sm:pr-4">
          <span className="sr-only">Open</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {tickets.map((ticket, index) => (
          <tr
            key={ticket.id}
            className={adminTableRowClass(index)}
            tabIndex={0}
            role="link"
            onClick={() => onSelect(ticket.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(ticket.id);
              }
            }}
            aria-label={`Open ${ticket.subject}`}
          >
            <td className={adminTableCell.body}>
              <div className="min-w-0">
                <p className={cn('truncate', adminTableBodyText.primary)}>{ticket.subject}</p>
                <p className={cn('truncate', adminTableBodyText.secondary)}>
                  {ticket.submitted_by_name || ticket.submitted_by_email}
                </p>
                <p className={cn('mt-1 truncate sm:hidden', adminTableBodyText.secondary)}>
                  {ticket.organizationName} · {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]}
                </p>
              </div>
            </td>
            <td className={cn(adminTableCell.body, 'hidden sm:table-cell')}>
              <p className={cn('truncate', adminTableBodyText.primary)}>
                {ticket.organizationName}
              </p>
            </td>
            <td className={cn(adminTableCell.body, 'hidden md:table-cell')}>
              <span className={adminTableBodyText.secondary}>
                {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]}
              </span>
            </td>
            <td className={cn(adminTableCell.body, 'hidden lg:table-cell')}>
              <span className={cn('capitalize', adminTableBodyText.secondary)}>
                {ticket.priority ? SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority] : '-'}
              </span>
            </td>
            <td className={cn(adminTableCell.body, 'whitespace-nowrap')}>
              <SupportTicketStatusBadge status={ticket.status} />
            </td>
            <td className={cn(adminTableCell.body, 'hidden xl:table-cell')}>
              <span className={cn('tabular-nums', adminTableBodyText.secondary)}>
                {formatSupportTicketDate(ticket.created_at)}
              </span>
            </td>
            <td className={adminTableCell.action}>
              <AdminTableRowAffordance />
            </td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}
