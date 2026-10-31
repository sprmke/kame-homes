import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';

/** Canonical support ticket statuses — keep in sync with UI `SupportTicketStatus`. */
export const SUPPORT_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

/** Submitter (host/guest) may post a new message. Closed tickets require explicit reopen. */
export function canSubmitterReply(status: string): boolean {
  return status !== 'closed';
}

/** Admin may always reply; replying to terminal statuses reopens the ticket. */
export function canAdminReply(_status: string): boolean {
  return true;
}

/** Status after a submitter reply when the ticket was resolved. */
export function statusAfterSubmitterReply(previousStatus: string): SupportTicketStatus | null {
  if (previousStatus === 'resolved') return 'in_progress';
  return null;
}

/** Status after an admin reply. */
export function statusAfterAdminReply(previousStatus: string): SupportTicketStatus | null {
  if (previousStatus === 'open') return 'in_progress';
  if (previousStatus === 'resolved' || previousStatus === 'closed') return 'in_progress';
  return null;
}

/** Status set by explicit reopen (submitter only, from closed). */
export function statusAfterReopen(): SupportTicketStatus {
  return 'open';
}

export function buildSupportTicketThreadUrl(args: {
  channel: 'host' | 'guest';
  ticketId: string;
  orgSlug: string | null;
  propertySlug?: string | null;
  parkingSlug?: string | null;
}): string {
  const origin = resolvePublicGuestAppOrigin(null);
  if (args.channel === 'guest' || !args.orgSlug) {
    return `${origin}/account/tickets/${args.ticketId}`;
  }
  if (args.parkingSlug) {
    return `${origin}/org/${args.orgSlug}/parking/${args.parkingSlug}/help-support/tickets/${args.ticketId}`;
  }
  if (args.propertySlug) {
    return `${origin}/org/${args.orgSlug}/property/${args.propertySlug}/help-support/tickets/${args.ticketId}`;
  }
  return `${origin}/org/${args.orgSlug}/help-support/tickets/${args.ticketId}`;
}
