import { useState } from 'react';

import { HelpCircle, Zap, type LucideIcon } from 'lucide-react';

import { AssistantSuggestionList } from '@/features/dashboard/ai-assistant/components/AssistantSuggestionList';
import type { AssistantSuggestion } from '@/features/dashboard/ai-assistant/lib/assistantSuggestions';

import { cn } from '@/lib/utils';

type SuggestionKind = 'question' | 'action';

const MODES: Array<{ value: SuggestionKind; label: string; icon: LucideIcon }> = [
  { value: 'question', label: 'Questions', icon: HelpCircle },
  { value: 'action', label: 'Actions', icon: Zap },
];

type Props = {
  questions: AssistantSuggestion[];
  actions: AssistantSuggestion[];
  onPick: (prompt: string) => void;
  disabled?: boolean;
};

export function AssistantSuggestionGroups({ questions, actions, onPick, disabled }: Props) {
  const [kind, setKind] = useState<SuggestionKind>('question');
  const suggestions = kind === 'question' ? questions : actions;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
      <div className="m-auto flex w-full max-w-[22rem] flex-col gap-5">
        <div
          role="group"
          aria-label="Starter type"
          className="bg-muted/70 flex rounded-full p-1"
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
                  'native-press focus-visible:ring-ring inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  'disabled:pointer-events-none disabled:opacity-50',
                  active
                    ? 'bg-primary-strong text-primary-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>

        <AssistantSuggestionList
          key={kind}
          suggestions={suggestions}
          onPick={onPick}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
