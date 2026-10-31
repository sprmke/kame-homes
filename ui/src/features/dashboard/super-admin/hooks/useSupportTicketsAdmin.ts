import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  SupportTicket,
  SupportTicketMessage,
} from '@/features/dashboard/help-support/lib/supportTicketApi';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import { ADMIN_DEFAULT_PAGE_SIZE } from '@/lib/table/pagination';

export type AdminSupportTicket = SupportTicket & {
  organizationName: string;
  organizationSlug: string | null;
  channel?: 'host' | 'guest';
};

export type SupportTicketAdminFilters = {
  search: string | null;
  category: string | null;
  status: string | null;
  orgId: string | null;
};

export const SUPPORT_TICKETS_ADMIN_QUERY_KEY = ['super-admin', 'support-tickets'] as const;

function filtersToQuery(filters: SupportTicketAdminFilters, page: number, limit: number): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.status) params.set('status', filters.status);
  if (filters.orgId) params.set('org_id', filters.orgId);
  params.set('page', String(page));
  params.set('limit', String(limit));
  return `?${params.toString()}`;
}

export function useSupportTicketsAdmin(
  filters: SupportTicketAdminFilters,
  page: number = 1,
  limit: number = ADMIN_DEFAULT_PAGE_SIZE
) {
  return useQuery({
    queryKey: [...SUPPORT_TICKETS_ADMIN_QUERY_KEY, filters, page, limit],
    placeholderData: keepPreviousData,
    queryFn: () =>
      callEdgeFunction<{ tickets: AdminSupportTicket[]; total: number }>(
        `list-support-tickets-admin${filtersToQuery(filters, page, limit)}`
      ),
  });
}

export type SupportTicketsSummary = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
};

/** Platform-wide (or org-scoped) ticket counts for the summary cards — not page-scoped. */
export function useSupportTicketsSummary(orgId?: string | null) {
  return useQuery({
    queryKey: [...SUPPORT_TICKETS_ADMIN_QUERY_KEY, 'summary', orgId ?? null],
    queryFn: () => {
      const params = new URLSearchParams({ summary: 'true' });
      if (orgId) params.set('org_id', orgId);
      return callEdgeFunction<{ summary: SupportTicketsSummary }>(
        `list-support-tickets-admin?${params.toString()}`
      ).then((d) => d.summary);
    },
    staleTime: 30_000,
  });
}

export function useSupportTicketAdmin(ticketId: string | null) {
  return useQuery({
    queryKey: ['super-admin', 'support-ticket', ticketId],
    queryFn: () =>
      callEdgeFunction<{ ticket: AdminSupportTicket; messages: SupportTicketMessage[] }>(
        `get-support-ticket-admin?ticket_id=${encodeURIComponent(ticketId as string)}`
      ),
    enabled: Boolean(ticketId),
  });
}

export function useReplySupportTicketAdmin(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      callEdgeFunction<{ message: SupportTicketMessage }>('reply-support-ticket-admin', {
        method: 'POST',
        body: JSON.stringify({ ticketId, message }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['super-admin', 'support-ticket', ticketId] });
      await qc.invalidateQueries({ queryKey: SUPPORT_TICKETS_ADMIN_QUERY_KEY });
    },
  });
}

export function useUpdateSupportTicketStatus(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: { status?: string; priority?: string | null }) =>
      callEdgeFunction<{ ticket: AdminSupportTicket }>('update-support-ticket-status', {
        method: 'POST',
        body: JSON.stringify({ ticketId, ...updates }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['super-admin', 'support-ticket', ticketId] });
      await qc.invalidateQueries({ queryKey: SUPPORT_TICKETS_ADMIN_QUERY_KEY });
    },
  });
}
