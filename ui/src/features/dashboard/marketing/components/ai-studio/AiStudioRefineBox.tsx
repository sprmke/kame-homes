import { useRef, useState, type ReactNode } from 'react';

import { ArrowUp, Loader2 } from 'lucide-react';

import { REFINE_SUGGESTIONS } from '@/features/dashboard/marketing/lib/aiStudioSessions';
import type { AiStudioOutput } from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

import { FeatureAvailabilityButton } from '@/components/feature-availability/FeatureAvailabilityButton';
import { FeatureUnavailableNotice } from '@/components/feature-availability/FeatureUnavailableNotice';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';
import { cn } from '@/lib/utils';

type Props = {
  output: AiStudioOutput;
  onSend: (instruction: string) => Promise<boolean> | boolean;
  busy: boolean;
  /** Why sending is off right now (permission, a clip still rendering…). */
  blockedReason: string | null;
  feature: PlanFeatureKey;
  /** "35 credits" for photos and clips; posts show none. */
  costLabel: string | null;
  /** Size or camera for the next version. */
  options?: ReactNode;
};

const MAX_CHARS = 300;

/**
 * Chat-style message box under the thread: say what to change and the next version
 * appears in the thread. Suggestions fill the box in one tap; Enter sends,
 * Shift+Enter makes a new line.
 */
export function AiStudioRefineBox({
  output,
  onSend,
  busy,
  blockedReason,
  feature,
  costLabel,
  options,
}: Props) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const generateAvailability = useFeatureAvailability('marketing.ai_studio.generate');
  const generateBlocked = !generateAvailability.available && !generateAvailability.isLoading;
  const disabled = busy || Boolean(blockedReason) || generateBlocked;
  const canSend = !disabled && text.trim().length > 0;

  const send = async () => {
    if (!canSend) {
      if (!disabled) inputRef.current?.focus();
      return;
    }
    const sent = await onSend(text.trim());
    if (sent) setText('');
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {generateBlocked ? (
        <FeatureUnavailableNotice
          title="Generation paused"
          label={generateAvailability.message}
          expectedBackLabel={generateAvailability.expectedBackLabel}
          tone={generateAvailability.tone}
        />
      ) : null}
      {text.length === 0 && !disabled ? (
        // One scrollable row on phones, where the preview needs the height; the
        // desktop column has the room to wrap.
        <div
          className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible"
          role="group"
          aria-label="Suggestions"
        >
          {REFINE_SUGGESTIONS[output].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setText(suggestion);
                inputRef.current?.focus();
              }}
              className="border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring min-h-9 shrink-0 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className={cn(
          'border-border bg-background focus-within:border-primary/60 focus-within:ring-primary/15 rounded-2xl border transition-[border-color,box-shadow] focus-within:ring-4',
          disabled && 'opacity-70'
        )}
      >
        <label htmlFor="ai-studio-refine" className="sr-only">
          Describe a change
        </label>
        <Textarea
          ref={inputRef}
          id="ai-studio-refine"
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_CHARS))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={blockedReason ?? 'Describe a change'}
          rows={2}
          disabled={disabled}
          className="max-h-40 min-h-[64px] resize-none border-0 bg-transparent px-3 pt-2.5 text-sm shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center gap-2 px-2 pb-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">{options}</div>
          {costLabel ? (
            <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">
              {costLabel}
            </span>
          ) : null}
          <TierBadgeAnchor feature={feature}>
            {generateBlocked ? (
              <FeatureAvailabilityButton featureKey="marketing.ai_studio.generate">
                <Button
                  type="submit"
                  size="icon"
                  className="size-11 rounded-full lg:size-9"
                  disabled={disabled}
                  aria-disabled={!canSend}
                  aria-label={costLabel ? `Send, ${costLabel}` : 'Send'}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <ArrowUp className="size-4" aria-hidden />
                  )}
                </Button>
              </FeatureAvailabilityButton>
            ) : (
              <Button
                type="submit"
                size="icon"
                className="size-11 rounded-full lg:size-9"
                disabled={disabled}
                aria-disabled={!canSend}
                aria-label={costLabel ? `Send, ${costLabel}` : 'Send'}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ArrowUp className="size-4" aria-hidden />
                )}
              </Button>
            )}
          </TierBadgeAnchor>
        </div>
      </div>
    </form>
  );
}
