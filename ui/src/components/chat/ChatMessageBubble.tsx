import type { ReactNode } from 'react';

import { Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';

import { ChatDeliveryTicks } from '@/components/chat/ChatDeliveryTicks';
import { ChatHighlightedText } from '@/components/chat/ChatHighlightedText';
import { ChatReplyPreview } from '@/components/chat/ChatReplyPreview';
import { ChatRichBody } from '@/components/chat/ChatRichBody';
import type { OutboundDeliveryStatus } from '@/lib/chat/chatMessageFormat';
import { formatChatBubbleTime } from '@/lib/chat/chatMessageFormat';
import { cn } from '@/lib/utils';

export type ChatDeliveryStatus = OutboundDeliveryStatus;

type Props = {
  bodyText: string | null;
  outbound: boolean;
  sentAt: string;
  deliveryStatus?: OutboundDeliveryStatus | null;
  isAiGenerated?: boolean;
  edited?: boolean;
  unsent?: boolean;
  replyPreviewText?: string | null;
  highlightQuery?: string;
  activeHighlightRange?: { start: number; end: number } | null;
  onRetry?: () => void;
  className?: string;
  children?: ReactNode;
  /** Rendered beside the bubble (vertically centered), not below the timestamp. */
  actions?: ReactNode;
  /** When set, a tapped calendar link card opens the availability modal instead of navigating. */
  onCalendarLinkClick?: (href: string) => void;
  feedback?: {
    rating: 1 | -1 | 0;
    onRate: (rating: 1 | -1) => void;
  };
};

export function ChatMessageBubble({
  bodyText,
  outbound,
  sentAt,
  deliveryStatus = null,
  isAiGenerated = false,
  edited = false,
  unsent = false,
  replyPreviewText = null,
  highlightQuery = '',
  activeHighlightRange = null,
  onRetry,
  className,
  children,
  actions,
  onCalendarLinkClick,
  feedback,
}: Props) {
  const timeLabel = formatChatBubbleTime(sentAt);
  const trimmed = bodyText?.trim() || '-';
  const bubbleClass = cn(
    'max-w-[min(100%,28rem)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
    unsent
      ? 'bg-muted/45 text-muted-foreground border-border/50 border italic'
      : outbound
        ? 'bg-primary text-primary-foreground'
        : 'border-border/60 bg-background text-foreground border shadow-sm',
    deliveryStatus === 'failed' && outbound && !unsent && 'opacity-80'
  );

  const body = (() => {
    if (children) return children;
    if (unsent) {
      return <p className="whitespace-pre-wrap break-words text-[13px]">{trimmed}</p>;
    }
    // Search highlight stays plain so match offsets stay aligned with raw body_text.
    if (highlightQuery.trim()) {
      return (
        <ChatHighlightedText
          text={trimmed}
          query={highlightQuery}
          activeRange={activeHighlightRange}
          outbound={outbound}
        />
      );
    }
    return (
      <ChatRichBody text={trimmed} outbound={outbound} onCalendarLinkClick={onCalendarLinkClick} />
    );
  })();

  return (
    <div className={cn('flex max-w-[min(100%,28rem)] flex-col gap-1', className)}>
      <div
        className={cn(
          'group/msg flex max-w-full items-center gap-0.5',
          outbound ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        <div className={bubbleClass}>
          {!unsent && replyPreviewText ? (
            <ChatReplyPreview preview={replyPreviewText} outbound={outbound} />
          ) : null}
          {body}
          {!unsent && isAiGenerated ? (
            <span
              className={cn(
                'mt-1.5 inline-flex items-center gap-1 text-[10px]',
                outbound ? 'opacity-75' : 'text-muted-foreground'
              )}
            >
              <Sparkles className="size-3" aria-hidden />
              Automated
            </span>
          ) : null}
          {feedback ? (
            <div className="mt-1.5 hidden items-center gap-0.5 lg:flex">
              <button
                type="button"
                className={cn(
                  'inline-flex size-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full',
                  feedback.rating === 1 ? 'text-foreground' : 'text-muted-foreground'
                )}
                aria-label="Helpful"
                aria-pressed={feedback.rating === 1}
                onClick={() => feedback.onRate(1)}
              >
                <ThumbsUp className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                className={cn(
                  'inline-flex size-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full',
                  feedback.rating === -1 ? 'text-foreground' : 'text-muted-foreground'
                )}
                aria-label="Not helpful"
                aria-pressed={feedback.rating === -1}
                onClick={() => feedback.onRate(-1)}
              >
                <ThumbsDown className="size-3.5" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
        {actions}
      </div>
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-1',
          outbound ? 'justify-end' : 'justify-start'
        )}
      >
        {timeLabel ? (
          <time className="text-muted-foreground text-[11px] tabular-nums" dateTime={sentAt}>
            {timeLabel}
          </time>
        ) : null}
        {edited && !unsent ? (
          <span className="text-muted-foreground text-[11px]">Edited</span>
        ) : null}
        {!unsent && outbound ? (
          <ChatDeliveryTicks status={deliveryStatus ?? 'sent'} onRetry={onRetry} />
        ) : null}
      </div>
    </div>
  );
}
