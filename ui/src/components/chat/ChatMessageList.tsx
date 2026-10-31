import type { ReactNode } from 'react';

import { ChatDateSeparator } from '@/components/chat/ChatDateSeparator';
import { buildChatMessageRows } from '@/lib/chat/chatMessageFormat';
import { cn } from '@/lib/utils';

type Props<T extends { id: string; sent_at: string }> = {
  messages: T[];
  getOutbound: (message: T) => boolean;
  renderMessage: (message: T) => ReactNode;
  focusedMessageId?: string | null;
  className?: string;
};

export function ChatMessageList<T extends { id: string; sent_at: string }>({
  messages,
  getOutbound,
  renderMessage,
  focusedMessageId = null,
  className,
}: Props<T>) {
  const rows = buildChatMessageRows(messages);

  return (
    <div className={cn('space-y-4', className)}>
      {rows.map((row) => {
        if (row.type === 'date') {
          return <ChatDateSeparator key={row.key} label={row.label} />;
        }

        const message = row.message;
        return (
          <div
            key={row.key}
            data-chat-message-id={message.id}
            className={cn(
              'flex scroll-mt-24 flex-col gap-1.5',
              getOutbound(message) ? 'items-end' : 'items-start',
              focusedMessageId === message.id && 'ring-primary/20 rounded-2xl ring-2'
            )}
          >
            {renderMessage(message)}
          </div>
        );
      })}
    </div>
  );
}
