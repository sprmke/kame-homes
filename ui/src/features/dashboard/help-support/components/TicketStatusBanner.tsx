import { Loader2, RotateCcw } from 'lucide-react';

import type { SupportTicketStatus } from '@/features/dashboard/help-support/lib/supportTicketApi';
import {
  ticketStatusBannerCopy,
  type TicketStatusBannerVariant,
} from '@/features/dashboard/help-support/lib/supportTicketStatus';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TicketStatusBannerProps = {
  status: SupportTicketStatus;
  variant: TicketStatusBannerVariant;
  onReopen?: () => void;
  reopening?: boolean;
  className?: string;
};

export function TicketStatusBanner({
  status,
  variant,
  onReopen,
  reopening = false,
  className,
}: TicketStatusBannerProps) {
  const copy = ticketStatusBannerCopy(status, variant);
  if (!copy) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex shrink-0 flex-col gap-2 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4',
        copy.tone === 'info' ? 'border-primary/20 bg-primary/5' : 'border-border/80 bg-muted/30',
        className
      )}
    >
      <p
        className={cn(
          'text-xs leading-relaxed sm:text-[13px]',
          copy.tone === 'info' ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {copy.message}
      </p>
      {copy.showReopen && onReopen ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9 shrink-0 gap-1.5 self-start sm:self-auto"
          disabled={reopening}
          onClick={onReopen}
        >
          {reopening ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RotateCcw className="size-4" aria-hidden />
          )}
          Reopen ticket
        </Button>
      ) : null}
    </div>
  );
}
