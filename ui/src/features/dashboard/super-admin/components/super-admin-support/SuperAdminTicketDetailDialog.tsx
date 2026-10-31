import { useEffect, useRef, useState } from 'react';

import { toast } from 'sonner';

import { TicketMessageBubble } from '@/features/dashboard/help-support/components/TicketMessageBubble';
import { TicketReplyComposer } from '@/features/dashboard/help-support/components/TicketReplyComposer';
import { TicketStatusBanner } from '@/features/dashboard/help-support/components/TicketStatusBanner';
import { SUPPORT_TICKET_CATEGORY_LABELS } from '@/features/dashboard/help-support/lib/supportTicketSchema';
import {
  adminReplyPlaceholder,
  canAdminReply,
} from '@/features/dashboard/help-support/lib/supportTicketStatus';
import {
  superAdminApprovalDialogBodyClass,
  superAdminApprovalDialogContentClass,
  superAdminApprovalDialogFooterClass,
  superAdminApprovalDialogHeaderClass,
} from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalDialogLayout';
import {
  useReplySupportTicketAdmin,
  useSupportTicketAdmin,
  useUpdateSupportTicketStatus,
} from '@/features/dashboard/super-admin/hooks/useSupportTicketsAdmin';
import {
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
} from '@/features/dashboard/super-admin/lib/superAdminSupportFilters';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'] as const;
const PRIORITY_OPTIONS = ['low', 'medium', 'high'] as const;

export function SuperAdminTicketDetailDialog({
  ticketId,
  onOpenChange,
}: {
  ticketId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isPending, isError, refetch } = useSupportTicketAdmin(ticketId);
  const replyMutation = useReplySupportTicketAdmin(ticketId ?? '');
  const statusMutation = useUpdateSupportTicketStatus(ticketId ?? '');
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft('');
  }, [ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [data?.messages.length, ticketId, data?.ticket.status]);

  const ticket = data?.ticket;
  const channel = ticket?.channel ?? (ticket?.organizationSlug ? 'host' : 'guest');
  const replyEnabled = ticket ? canAdminReply(ticket.status) : false;

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || replyMutation.isPending) return;
    try {
      await replyMutation.mutateAsync(trimmed);
      setDraft('');
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not send reply'));
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await statusMutation.mutateAsync({ status });
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not update status'));
    }
  };

  const handlePriorityChange = async (value: string) => {
    try {
      await statusMutation.mutateAsync({ priority: value === 'none' ? null : value });
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not update priority'));
    }
  };

  return (
    <ResponsiveModal open={Boolean(ticketId)} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className={superAdminApprovalDialogContentClass} sheetLayout="split">
        <ResponsiveModalHeader className={superAdminApprovalDialogHeaderClass}>
          <ResponsiveModalTitle className="pr-8 [overflow-wrap:anywhere]">
            {ticket?.subject ?? 'Ticket'}
          </ResponsiveModalTitle>
          {ticket ? (
            <div className="space-y-3">
              <p className="text-muted-foreground min-w-0 truncate text-xs">
                {ticket.organizationName} · {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]}
              </p>
              <p className="text-muted-foreground min-w-0 truncate text-xs">
                {ticket.submitted_by_name}
                {ticket.submitted_by_email ? ` · ${ticket.submitted_by_email}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={ticket.status}
                  onValueChange={(value) => void handleStatusChange(value)}
                  disabled={statusMutation.isPending}
                >
                  <SelectTrigger className="h-9 w-[9.5rem]" aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SUPPORT_TICKET_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={ticket.priority ?? 'none'}
                  onValueChange={(value) => void handlePriorityChange(value)}
                  disabled={statusMutation.isPending}
                >
                  <SelectTrigger className="h-9 w-[9.5rem]" aria-label="Priority">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No priority</SelectItem>
                    {PRIORITY_OPTIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SUPPORT_TICKET_PRIORITY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </ResponsiveModalHeader>

        {ticket ? (
          <TicketStatusBanner
            status={ticket.status}
            variant="admin"
            className="mx-0 rounded-none"
          />
        ) : null}

        <div className={cn(superAdminApprovalDialogBodyClass, 'flex min-h-0 flex-1 flex-col')}>
          {isPending || (!data && !isError) ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-3/4" />
            </div>
          ) : isError || !data ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
              <p className="text-destructive text-sm">Could not load this ticket.</p>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => void refetch()}
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              {data.messages.map((message) => (
                <TicketMessageBubble key={message.id} message={message} perspective="admin" />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {ticket && replyEnabled ? (
          <div className={cn(superAdminApprovalDialogFooterClass, 'sm:flex-col')}>
            <TicketReplyComposer
              draft={draft}
              onDraftChange={setDraft}
              attachments={[]}
              onAttachmentsChange={() => {}}
              onSend={() => void handleSend()}
              sending={replyMutation.isPending}
              placeholder={adminReplyPlaceholder(channel)}
              showAttachments={false}
              inputId="admin-ticket-reply"
              className="w-full"
            />
          </div>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
