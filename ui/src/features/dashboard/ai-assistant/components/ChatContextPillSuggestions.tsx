import { useState } from 'react';

import { HelpCircle, Maximize2, Zap, type LucideIcon } from 'lucide-react';

import type { AttachedContextType } from '@/features/dashboard/ai-assistant/lib/attachedContext';
import { selectContextualSuggestions } from '@/features/dashboard/ai-assistant/lib/moduleSuggestions';

import { ChatSuggestionList } from '@/components/chat/ChatSuggestionList';
import { cn } from '@/lib/utils';

type SuggestionKind = 'question' | 'action';

const MODES: Array<{ value: SuggestionKind; label: string; icon: LucideIcon }> = [
  { value: 'question', label: 'Questions', icon: HelpCircle },
  { value: 'action', label: 'Actions', icon: Zap },
];

// Compact pill popover: shows up to 6 ranked prompts per side for the pinned module.
const VISIBLE_COUNT = 6;

type Props = {
  moduleType: AttachedContextType;
  onPick: (prompt: string) => void;
  /** Property templates only: open the same preview the Inbox uses. */
  onPreview?: () => void;
  disabled?: boolean;
};

/**
 * Compact popover body for a pinned context pill. Shows the ranked Questions / Actions
 * for that single module type (not merged across modules) so the host can drill into one
 * pinned module mid-conversation. Tapping a prompt sends it as a chat message.
 */
export function ChatContextPillSuggestions({ moduleType, onPick, onPreview, disabled }: Props) {
  const [kind, setKind] = useState<SuggestionKind>('question');

  const questions = selectContextualSuggestions([moduleType], 'question', VISIBLE_COUNT);
  const actions = selectContextualSuggestions([moduleType], 'action', VISIBLE_COUNT);
  const suggestions = kind === 'question' ? questions : actions;

  return (
    <div className="flex min-w-0 flex-col gap-2 p-2">
      {onPreview ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onPreview}
          className="text-foreground hover:bg-muted/60 focus-visible:ring-ring inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <Maximize2 className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          Preview template
        </button>
      ) : null}
      <div
        role="group"
        aria-label="Suggestion type"
        className="bg-muted/70 flex rounded-full p-0.5"
        onKeyDown={(event) => {
          if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
          event.preventDefault();
          setKind((current) => (current === 'question' ? 'action' : 'question'));
        }}
      >
        {MODES.map(({ value, label, icon: Icon }) => {
          const active = kind === value;
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => setKind(value)}
              className={cn(
                'native-press focus-visible:ring-ring inline-flex min-h-[36px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                'disabled:pointer-events-none disabled:opacity-50',
                active
                  ? 'bg-primary-strong text-primary-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
      <div className="max-h-[min(60dvh,22rem)] min-w-0 overflow-y-auto">
        <ChatSuggestionList
          key={kind}
          suggestions={suggestions.map((item) => ({
            id: item.id,
            prompt: item.prompt,
            Icon: item.kind === 'action' ? Zap : HelpCircle,
          }))}
          onPick={onPick}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
