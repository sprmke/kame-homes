import { AlertCircle, Check, Loader2 } from 'lucide-react';

import type { OutboundDeliveryStatus } from '@/lib/chat/chatMessageFormat';
import { cn } from '@/lib/utils';

function DoubleCheck({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center', className)} aria-hidden>
      <Check className="size-3 stroke-[2.5]" />
      <Check className="-ml-2 size-3 stroke-[2.5]" />
    </span>
  );
}

type Props = {
  status: OutboundDeliveryStatus;
  onRetry?: () => void;
};

export function ChatDeliveryTicks({ status, onRetry }: Props) {
  if (status === 'sending') {
    return <Loader2 className="text-muted-foreground size-3 animate-spin" aria-label="Sending" />;
  }

  if (status === 'failed') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="text-destructive inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 text-[11px] font-medium"
        aria-label="Failed to send. Tap to retry."
      >
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
        Retry
      </button>
    );
  }

  if (status === 'read') {
    return (
      <span className="inline-flex text-sky-600" aria-label="Read">
        <DoubleCheck />
      </span>
    );
  }

  if (status === 'delivered') {
    return (
      <span className="text-muted-foreground/85 inline-flex" aria-label="Delivered">
        <DoubleCheck />
      </span>
    );
  }

  return (
    <span className="text-muted-foreground/70 inline-flex" aria-label="Sent">
      <Check className="size-3 stroke-[2.5]" aria-hidden />
    </span>
  );
}
