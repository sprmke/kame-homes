import { AlertCircle, AlertTriangle, ChevronRight, Info, type LucideIcon } from 'lucide-react';

import type {
  AssistantBriefingCard,
  AssistantBriefingDelta,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { formatBriefingDelta } from '@/features/dashboard/ai-assistant/lib/briefingDelta';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const SEVERITY_ICON: Record<AssistantBriefingCard['severity'], LucideIcon> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_TONE: Record<AssistantBriefingCard['severity'], string> = {
  critical: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/15 text-warning-foreground',
  info: 'bg-primary/10 text-primary',
};

type Props = {
  cards: AssistantBriefingCard[];
  loading?: boolean;
  disabled?: boolean;
  onPick: (prompt: string) => void;
  sinceYesterday?: AssistantBriefingDelta | null;
};

export function BriefingAttentionCards({
  cards,
  loading,
  disabled,
  onPick,
  sinceYesterday,
}: Props) {
  const deltaLine = formatBriefingDelta(sinceYesterday);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (cards.length === 0 && !deltaLine) return null;

  return (
    <div className="flex flex-col gap-2">
      {deltaLine ? <p className="text-muted-foreground text-sm">{deltaLine}</p> : null}
      {cards.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Needs attention">
          {cards.map((card, index) => {
            const Icon = SEVERITY_ICON[card.severity];
            return (
              <li key={card.id} className={index >= 4 ? 'hidden sm:block' : undefined}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(card.prompt)}
                  className="border-border/60 bg-card hover:border-primary/30 focus-visible:ring-ring group flex min-h-[72px] w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
                >
                  <span
                    className={cn(
                      'inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
                      SEVERITY_TONE[card.severity]
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-stat-value text-foreground block tabular-nums">
                      {card.count}
                    </span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {card.label}
                    </span>
                  </span>
                  <ChevronRight
                    className="text-muted-foreground size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
