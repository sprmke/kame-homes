import { AlertCircle, AlertTriangle, ChevronRight, Info, type LucideIcon } from 'lucide-react';

import { useAccountIdentity } from '@/features/guest/account/hooks/useAccountIdentity';

import { useAssistantBriefing } from '@/features/dashboard/ai-assistant/hooks/useAssistantBriefing';
import type { AssistantBriefingCard } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { useAiAssistantSession } from '@/features/dashboard/ai-assistant/lib/aiAssistantSessionContext';

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

const STARTER_COUNT = 4;

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Empty-thread home in AI mode: greeting, "needs attention" cards, starter chips. */
export function BriefingHome() {
  const { pageContext, questions, actions, pickSuggestion, pending, sending } =
    useAiAssistantSession();
  const { displayName } = useAccountIdentity();
  const briefing = useAssistantBriefing(
    { propertyId: pageContext.propertyId ?? null, parkingId: pageContext.parkingId ?? null },
    true
  );
  const firstName = displayName?.split(/\s+/)[0] ?? '';
  const starters = [...questions.slice(0, 2), ...actions.slice(0, 2)].slice(0, STARTER_COUNT);
  const disabled = pending || sending;
  const cards = briefing.data?.cards ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-testid="assistant-briefing">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-6 pt-10 sm:px-6 lg:pt-16">
        <h1 className="text-admin-page-title text-foreground">
          {greeting(new Date().getHours())}
          {firstName ? `, ${firstName}` : ''}
        </h1>

        {briefing.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] rounded-xl" />
            ))}
          </div>
        ) : cards.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Needs attention">
            {cards.map((card) => {
              const Icon = SEVERITY_ICON[card.severity];
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => pickSuggestion(card.prompt, [])}
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

        {starters.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Suggestions">
            {starters.map((starter) => (
              <button
                key={starter.id}
                type="button"
                disabled={disabled}
                onClick={() => pickSuggestion(starter.prompt)}
                className="border-border/70 text-foreground hover:bg-muted/60 focus-visible:ring-ring min-h-[40px] rounded-full border px-3.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
              >
                {starter.prompt}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
