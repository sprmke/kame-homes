import type { SupabaseClient } from './supabaseJs.ts';

import type { SupportTicketScope } from './supportTicketScope.ts';

type TicketQuery = ReturnType<SupabaseClient['from']>;

/** Host and guest tickets are visible only to the original submitter. */
export function applySubmitterSupportTicketFilters(
  query: TicketQuery,
  scope: SupportTicketScope
): TicketQuery {
  let scoped = query.eq('submitted_by_user_id', scope.user.id);
  if (scope.channel === 'guest') {
    return scoped.eq('channel', 'guest');
  }
  if (scope.org) {
    return scoped.eq('organization_id', scope.org.id).eq('channel', 'host');
  }
  return scoped;
}

/** Bump `updated_at` so list sort reflects latest activity. */
export async function touchSupportTicketActivity(
  sb: SupabaseClient,
  ticketId: string,
  status?: string
): Promise<void> {
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  const { error } = await sb.from('support_tickets').update(patch).eq('id', ticketId);
  if (error) throw new Error(error.message);
}

export type SupportTicketNotifyContext = {
  id: string;
  subject: string;
  submitted_by_email: string;
  submitted_by_name: string;
  channel: 'host' | 'guest';
  status: string;
  organizationSlug: string | null;
  propertySlug: string | null;
  parkingSlug: string | null;
};

/** Load org/property/parking slugs for email deep links. */
export async function loadSupportTicketNotifyContext(
  sb: SupabaseClient,
  ticketId: string
): Promise<SupportTicketNotifyContext | null> {
  const { data: row, error } = await sb
    .from('support_tickets')
    .select(
      'id, subject, submitted_by_email, submitted_by_name, channel, status, property_id, parking_id, organizations(slug), properties(slug), parkings(slug)'
    )
    .eq('id', ticketId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  const ticket = row as typeof row & {
    channel: 'host' | 'guest';
    organizations: { slug: string } | null;
    properties: { slug: string } | null;
    parkings: { slug: string } | null;
  };

  return {
    id: ticket.id,
    subject: ticket.subject,
    submitted_by_email: ticket.submitted_by_email,
    submitted_by_name: ticket.submitted_by_name,
    channel: ticket.channel ?? (ticket.organizations ? 'host' : 'guest'),
    status: ticket.status,
    organizationSlug: ticket.organizations?.slug ?? null,
    propertySlug: ticket.properties?.slug ?? null,
    parkingSlug: ticket.parkings?.slug ?? null,
  };
}
