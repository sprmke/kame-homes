import { CloudOff } from 'lucide-react';

import { cn } from '@/lib/utils';

type NeedsConnectionHintProps = {
  /** Reason from `useConnectivity().reason`, when already known. */
  reason?: string | null;
  className?: string;
};

/**
 * Inline "needs a connection" line shown next to a disabled online-only action.
 * One short sentence; the action itself stays visible so the layout does not jump.
 */
export function NeedsConnectionHint({ reason, className }: NeedsConnectionHintProps) {
  if (!reason) return null;
  return (
    <p
      className={cn('text-muted-foreground flex items-center gap-1.5 text-xs', className)}
      role="status"
    >
      <CloudOff className="size-3.5 shrink-0" aria-hidden />
      <span>{reason}</span>
    </p>
  );
}
