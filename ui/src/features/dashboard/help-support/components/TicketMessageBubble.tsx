import { Paperclip } from 'lucide-react';

import type { SupportTicketMessage } from '@/features/dashboard/help-support/lib/supportTicketApi';

import { cn } from '@/lib/utils';

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type TicketMessageBubbleProps = {
  message: SupportTicketMessage;
  /** When true, admin messages align right (host/guest thread). When false, admin aligns right (super-admin view). */
  perspective: 'submitter' | 'admin';
};

export function TicketMessageBubble({ message, perspective }: TicketMessageBubbleProps) {
  const isAdmin = message.sender_type === 'admin';
  const isOutbound = perspective === 'submitter' ? !isAdmin : isAdmin;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', isOutbound ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] sm:max-w-[70%]',
          isOutbound ? 'bg-primary-strong text-primary-foreground' : 'bg-muted text-foreground'
        )}
      >
        <p className="whitespace-pre-wrap">{message.body}</p>
        {message.attachments.length > 0 ? (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {message.attachments.map((attachment) => {
              if (attachment.url && attachment.mimeType.startsWith('image/')) {
                return (
                  <a
                    key={attachment.path}
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="aspect-square rounded-md object-cover"
                    />
                  </a>
                );
              }
              if (attachment.url && attachment.mimeType.startsWith('video/')) {
                return (
                  <video
                    key={attachment.path}
                    src={attachment.url}
                    controls
                    className="aspect-square rounded-md object-cover"
                  />
                );
              }
              return (
                <a
                  key={attachment.path}
                  href={attachment.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'flex min-h-[44px] items-center gap-1.5 rounded-md px-2 py-1.5 text-xs',
                    isOutbound ? 'bg-primary-foreground/15' : 'bg-background/80'
                  )}
                >
                  <Paperclip className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{attachment.name}</span>
                </a>
              );
            })}
          </div>
        ) : null}
      </div>
      <p className="text-muted-foreground px-1 text-[11px]">
        {message.sender_name}
        {perspective === 'admin' ? ' · ' : ', '}
        {formatMessageTime(message.created_at)}
      </p>
    </div>
  );
}
