import { useEffect, useState } from 'react';

import { CloudOff } from 'lucide-react';

import { useConnectivity } from '@/hooks/useConnectivity';
import { formatStaleAge } from '@/lib/pwa/staleData';
import { cn } from '@/lib/utils';

type StaleDataLabelProps = {
  /** `dataUpdatedAt` from the query that feeds the view. */
  updatedAt: number | undefined;
  className?: string;
};

/**
 * Only renders while the app is offline or degraded: online views are live, so
 * the age would be noise. Re-renders every minute so "2h ago" does not freeze.
 */
export function StaleDataLabel({ updatedAt, className }: StaleDataLabelProps) {
  const { status } = useConnectivity();
  const [, tick] = useState(0);

  useEffect(() => {
    if (status === 'online') return;
    const timer = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, [status]);

  if (status === 'online') return null;
  const label = formatStaleAge(updatedAt ?? 0);
  if (!label) return null;

  return (
    <p
      className={cn('text-muted-foreground flex items-center gap-1.5 text-xs', className)}
      role="status"
    >
      <CloudOff className="size-3.5 shrink-0" aria-hidden />
      <span>{label}</span>
    </p>
  );
}
