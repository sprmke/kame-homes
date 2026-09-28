import { useState } from 'react';

import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';

import type { AssistantFeedbackRating } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  copyText: string;
  /** Persisted assistant row id; feedback needs it. */
  messageId: string | null;
  rating: AssistantFeedbackRating | undefined;
  onRate: (messageId: string, rating: AssistantFeedbackRating) => Promise<void>;
  onRegenerate?: () => void;
  disabled?: boolean;
};

const iconButton = 'text-muted-foreground hover:text-foreground size-9 min-h-[36px] min-w-[36px]';

/** Hover row under an assistant turn: copy, regenerate (last turn), thumbs up / down. */
export function ChatMessageActions({
  copyText,
  messageId,
  rating,
  onRate,
  onRegenerate,
  disabled,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const rate = (value: AssistantFeedbackRating) => {
    if (!messageId) return;
    onRate(messageId, value).catch(() => toast.error("Couldn't save feedback"));
  };

  return (
    <div
      className={cn(
        'mt-1 flex items-center gap-0.5',
        // Always visible on touch; hover / focus reveal on pointer devices.
        '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100'
      )}
    >
      {copyText ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={iconButton}
          onClick={() => void copy()}
          aria-label={copied ? 'Copied' : 'Copy response'}
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
        </Button>
      ) : null}
      {onRegenerate ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={iconButton}
          onClick={onRegenerate}
          disabled={disabled}
          aria-label="Regenerate response"
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      ) : null}
      {messageId ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(iconButton, rating === 1 && 'text-primary')}
            onClick={() => rate(1)}
            aria-label="Good response"
            aria-pressed={rating === 1}
          >
            <ThumbsUp className={cn('size-4', rating === 1 && 'fill-current')} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(iconButton, rating === -1 && 'text-destructive')}
            onClick={() => rate(-1)}
            aria-label="Bad response"
            aria-pressed={rating === -1}
          >
            <ThumbsDown className={cn('size-4', rating === -1 && 'fill-current')} aria-hidden />
          </Button>
        </>
      ) : null}
    </div>
  );
}
