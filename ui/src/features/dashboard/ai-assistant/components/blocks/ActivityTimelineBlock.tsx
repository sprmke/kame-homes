import { useState } from 'react';

import { Check, ChevronRight, ListTree, X } from 'lucide-react';

import { StepFailureHint } from '@/features/dashboard/ai-assistant/components/StepFailureHint';
import type { ActivityTimelineEntry } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { cn } from '@/lib/utils';

type Props = {
  entries: ActivityTimelineEntry[];
  /** Standalone card vs header inside {@link AssistantMessageCard}. */
  variant?: 'standalone' | 'embedded';
  defaultOpen?: boolean;
};

function formatDuration(ms: number | undefined): string | null {
  if (ms == null || ms < 50) return null;
  if (ms < 1000) return `${Math.round(ms / 100) / 10}s`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ActivityTimelineBlock({
  entries,
  variant = 'standalone',
  defaultOpen = false,
}: Props) {
  const safeEntries = entries ?? [];
  const [open, setOpen] = useState(defaultOpen);
  if (safeEntries.length === 0) return null;

  const embedded = variant === 'embedded';

  return (
    <div
      className={cn(
        embedded ? 'border-border/60 border-b' : 'border-border/60 bg-muted/30 rounded-xl border'
      )}
    >
      <button
        type="button"
        className={cn(
          'text-muted-foreground hover:text-foreground flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium',
          embedded && 'bg-muted/20'
        )}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="inline-flex items-center gap-1.5">
          <ListTree className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          Steps
          <span className="text-muted-foreground/80 font-normal">({safeEntries.length})</span>
        </span>
        <ChevronRight
          className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')}
          aria-hidden
        />
      </button>
      {open ? (
        <ol
          className={cn(
            'space-y-0 px-3 py-2',
            embedded ? 'bg-muted/10' : 'border-border/60 border-t'
          )}
        >
          {safeEntries.map((entry) => {
            const duration = formatDuration(entry.durationMs);
            return (
              <li
                key={entry.id}
                className="flex min-h-[32px] items-start gap-2 py-1.5 text-xs first:pt-0 last:pb-0"
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  {entry.status === 'failed' ? (
                    <X className="text-destructive size-3.5" aria-hidden />
                  ) : (
                    <Check className="text-primary size-3.5" aria-hidden />
                  )}
                </span>
                <span className="text-muted-foreground min-w-0 leading-snug">{entry.label}</span>
                {entry.status === 'failed' ? (
                  <StepFailureHint reason={entry.reason} className="-my-0.5" />
                ) : null}
                {duration ? (
                  <span className="text-muted-foreground/80 ml-auto shrink-0 tabular-nums">
                    {duration}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
