import { useAccountIdentity } from '@/features/guest/account/hooks/useAccountIdentity';

import { BriefingAttentionCards } from '@/features/dashboard/ai-assistant/components/BriefingAttentionCards';
import { useAssistantBriefing } from '@/features/dashboard/ai-assistant/hooks/useAssistantBriefing';
import { useAiAssistantSession } from '@/features/dashboard/ai-assistant/lib/aiAssistantSessionContext';

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

        <BriefingAttentionCards
          cards={cards}
          loading={briefing.isLoading}
          disabled={disabled}
          onPick={(prompt) => pickSuggestion(prompt, [])}
          sinceYesterday={briefing.data?.sinceYesterday}
        />

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
