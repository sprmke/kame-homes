import type { SupportTicketStatus } from '@/features/dashboard/help-support/lib/supportTicketApi';
import type { SupportTicketCategory } from '@/features/dashboard/help-support/lib/supportTicketSchema';
import type { AdminSupportTicket } from '@/features/dashboard/super-admin/hooks/useSupportTicketsAdmin';
import type { SuperAdminListViewMode } from '@/features/dashboard/super-admin/lib/superAdminListViewMode';

export type SuperAdminSupportFilters = {
  search: string;
  category: 'all' | SupportTicketCategory;
  status: 'all' | SupportTicketStatus;
};

export type SuperAdminSupportViewMode = SuperAdminListViewMode;

export const DEFAULT_SUPER_ADMIN_SUPPORT_FILTERS: SuperAdminSupportFilters = {
  search: '',
  category: 'all',
  status: 'all',
};

export const SUPPORT_TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const SUPPORT_TICKET_PRIORITY_LABELS: Record<'low' | 'medium' | 'high', string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export function filterSuperAdminSupportTickets(
  tickets: AdminSupportTicket[],
  filters: SuperAdminSupportFilters
): AdminSupportTicket[] {
  const term = filters.search.trim().toLowerCase();
  return tickets.filter((ticket) => {
    if (filters.category !== 'all' && ticket.category !== filters.category) return false;
    if (filters.status !== 'all' && ticket.status !== filters.status) return false;
    if (!term) return true;
    const haystack = [
      ticket.subject,
      ticket.organizationName,
      ticket.submitted_by_name,
      ticket.submitted_by_email,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });
}

export function superAdminSupportHasActiveFilters(filters: SuperAdminSupportFilters): boolean {
  return filters.search.trim() !== '' || filters.category !== 'all' || filters.status !== 'all';
}

export function superAdminSupportSummaryFromList(tickets: AdminSupportTicket[]) {
  const open = tickets.filter((ticket) => ticket.status === 'open').length;
  const inProgress = tickets.filter((ticket) => ticket.status === 'in_progress').length;
  const resolved = tickets.filter(
    (ticket) => ticket.status === 'resolved' || ticket.status === 'closed'
  ).length;

  return { total: tickets.length, open, inProgress, resolved };
}

export function formatSupportTicketDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
