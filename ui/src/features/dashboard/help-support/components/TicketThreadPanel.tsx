import { useEffect, useRef, useState } from 'react';

import { ArrowLeft, Ticket } from 'lucide-react';
import { toast } from 'sonner';

import { HelpEmptyState } from '@/features/dashboard/help-support/components/HelpEmptyState';
import { SupportTicketStatusBadge } from '@/features/dashboard/help-support/components/SupportTicketStatusBadge';
import { TicketMessageBubble } from '@/features/dashboard/help-support/components/TicketMessageBubble';
import { TicketReplyComposer } from '@/features/dashboard/help-support/components/TicketReplyComposer';
import { TicketStatusBanner } from '@/features/dashboard/help-support/components/TicketStatusBanner';
import {
  useReopenSupportTicket,
  useReplySupportTicket,
  useSupportTicket,
} from '@/features/dashboard/help-support/hooks/useSupportTickets';
import {
  SUPPORT_TICKET_CATEGORY_LABELS,
  type SupportTicketAttachmentDraft,
} from '@/features/dashboard/help-support/lib/supportTicketSchema';
import {
  canSubmitterReply,
  submitterReplyPlaceholder,
} from '@/features/dashboard/help-support/lib/supportTicketStatus';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

export function TicketThreadPanel({ ticketId, onBack }: { ticketId: string; onBack?: () => void }) {
  const { data, isPending, isError, refetch } = useSupportTicket(ticketId);
  const replyMutation = useReplySupportTicket(ticketId);
  const reopenMutation = useReopenSupportTicket(ticketId);

  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<SupportTicketAttachmentDraft[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft('');
    setAttachments([]);
  }, [ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [data?.messages.length, ticketId, data?.ticket.status]);

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || replyMutation.isPending) return;
    try {
      await replyMutation.mutateAsync({ message: trimmed, attachments });
      setDraft('');
      setAttachments([]);
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not send reply'));
    }
  };

  const handleReopen = async () => {
    try {
      await reopenMutation.mutateAsync();
      toast.success('Ticket reopened');
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not reopen ticket'));
    }
  };

  if (isPending) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 p-4 sm:p-5">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-3/4" />
        <Skeleton className="ml-auto h-24 w-2/3" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4">
        <HelpEmptyState
          icon={Ticket}
          title="Couldn't load this ticket"
          action={
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const { ticket, messages } = data;
  const replyEnabled = canSubmitterReply(ticket.status);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-border/80 flex shrink-0 items-center gap-3 border-b px-3 py-3 sm:px-4">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] lg:hidden"
            onClick={onBack}
            aria-label="Back to list"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-semibold [overflow-wrap:anywhere]">
            {ticket.subject}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]}
          </p>
        </div>
        <SupportTicketStatusBadge status={ticket.status} />
      </div>

      <TicketStatusBanner
        status={ticket.status}
        variant="submitter"
        onReopen={() => void handleReopen()}
        reopening={reopenMutation.isPending}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
        {messages.map((message) => (
          <TicketMessageBubble key={message.id} message={message} perspective="submitter" />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {replyEnabled ? (
        <div className="border-border/80 bg-muted/20 shrink-0 border-t p-3 sm:p-4">
          <TicketReplyComposer
            draft={draft}
            onDraftChange={setDraft}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            onSend={() => void handleSend()}
            sending={replyMutation.isPending}
            placeholder={submitterReplyPlaceholder(ticket.status)}
          />
        </div>
      ) : null}
    </div>
  );
}
