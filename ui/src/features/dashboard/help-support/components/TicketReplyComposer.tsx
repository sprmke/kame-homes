import { useState } from 'react';

import { Loader2, SendHorizontal } from 'lucide-react';

import { TicketAttachmentDropzone } from '@/features/dashboard/help-support/components/TicketAttachmentDropzone';
import type { SupportTicketAttachmentDraft } from '@/features/dashboard/help-support/lib/supportTicketSchema';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type TicketReplyComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  attachments: SupportTicketAttachmentDraft[];
  onAttachmentsChange: (value: SupportTicketAttachmentDraft[]) => void;
  onSend: () => void;
  sending: boolean;
  placeholder?: string;
  disabled?: boolean;
  showAttachments?: boolean;
  inputId?: string;
  className?: string;
};

export function TicketReplyComposer({
  draft,
  onDraftChange,
  attachments,
  onAttachmentsChange,
  onSend,
  sending,
  placeholder = 'Write a reply',
  disabled = false,
  showAttachments = true,
  inputId = 'ticket-reply',
  className,
}: TicketReplyComposerProps) {
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  const canSend =
    draft.trim().length > 0 && !sending && !disabled && (!showAttachments || !attachmentsBusy);

  const textarea = (
    <Textarea
      id={inputId}
      value={draft}
      onChange={(event) => onDraftChange(event.target.value)}
      placeholder={placeholder}
      rows={2}
      maxLength={5000}
      disabled={sending || disabled}
      aria-label="Reply"
      className="min-h-[72px] resize-none border-0 bg-transparent px-3.5 py-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          if (canSend) onSend();
        }
      }}
    />
  );

  const sendButton = (busy = false) => (
    <Button
      type="button"
      size="sm"
      className="h-9 min-h-[44px] min-w-[44px] gap-1.5 rounded-lg px-3"
      disabled={!canSend || busy}
      aria-label="Send reply"
      onClick={onSend}
    >
      {sending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <>
          Send
          <SendHorizontal className="size-4" aria-hidden />
        </>
      )}
    </Button>
  );

  if (!showAttachments) {
    return (
      <div
        className={cn(
          'border-border/80 bg-background overflow-hidden rounded-xl border shadow-sm',
          'focus-within:border-primary/40 focus-within:ring-primary/10 focus-within:ring-2',
          disabled && 'opacity-60',
          className
        )}
      >
        {textarea}
        <div className="border-border/60 flex items-center justify-end border-t px-2 py-1.5">
          {sendButton()}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <TicketAttachmentDropzone
        variant="composer"
        value={attachments}
        onChange={onAttachmentsChange}
        disabled={sending || disabled}
        onBusyChange={setAttachmentsBusy}
      >
        {({ trigger, chips, busy }) => (
          <div
            className={cn(
              'border-border/80 bg-background overflow-hidden rounded-xl border shadow-sm',
              'focus-within:border-primary/40 focus-within:ring-primary/10 focus-within:ring-2',
              disabled && 'opacity-60'
            )}
          >
            {chips ? <div className="border-border/60 border-b px-3 py-2.5">{chips}</div> : null}
            {textarea}
            <div className="border-border/60 flex items-center justify-between gap-2 border-t px-2 py-1.5">
              {trigger}
              {sendButton(busy)}
            </div>
          </div>
        )}
      </TicketAttachmentDropzone>
    </div>
  );
}
