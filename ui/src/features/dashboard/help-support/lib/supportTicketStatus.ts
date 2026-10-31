import type { SupportTicketStatus } from '@/features/dashboard/help-support/lib/supportTicketApi';

/** Submitter may reply unless the ticket is closed. */
export function canSubmitterReply(status: SupportTicketStatus): boolean {
  return status !== 'closed';
}

/** Admin may always reply. */
export function canAdminReply(_status: SupportTicketStatus): boolean {
  return true;
}

export type TicketStatusBannerVariant = 'submitter' | 'admin';

export function ticketStatusBannerCopy(
  status: SupportTicketStatus,
  variant: TicketStatusBannerVariant
): { tone: 'info' | 'muted'; message: string; showReopen: boolean } | null {
  if (status === 'resolved') {
    if (variant === 'submitter') {
      return {
        tone: 'info',
        message: 'Marked resolved. Reply if you still need help and we will pick it back up.',
        showReopen: false,
      };
    }
    return {
      tone: 'info',
      message: 'Resolved. Replying will move this ticket back to In progress.',
      showReopen: false,
    };
  }

  if (status === 'closed') {
    if (variant === 'submitter') {
      return {
        tone: 'muted',
        message: 'This ticket is closed. Reopen it to send another message.',
        showReopen: true,
      };
    }
    return {
      tone: 'muted',
      message: 'Closed. Replying will reopen this ticket as In progress.',
      showReopen: false,
    };
  }

  return null;
}

export function submitterReplyPlaceholder(status: SupportTicketStatus): string {
  if (status === 'resolved') return 'Reply to reopen…';
  return 'Write a reply';
}

export function adminReplyPlaceholder(channel: 'host' | 'guest' | undefined): string {
  return channel === 'guest' ? 'Reply to the guest…' : 'Reply to the host…';
}
