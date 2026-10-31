import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { cn } from '@/lib/utils';

type Props = Extract<ChatBlock, { type: 'kpi' }>;

export function KpiBlock({ label, value, delta }: Props) {
  return (
    <div className="border-border/60 bg-card rounded-xl border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-foreground text-xl font-semibold tabular-nums">{value}</p>
      {delta ? (
        <p
          className={cn(
            'text-xs tabular-nums',
            delta.direction === 'up' && 'text-success',
            delta.direction === 'down' && 'text-destructive',
            delta.direction === 'flat' && 'text-muted-foreground'
          )}
        >
          {delta.value}
          {delta.label ? ` ${delta.label}` : ''}
        </p>
      ) : null}
    </div>
  );
}
