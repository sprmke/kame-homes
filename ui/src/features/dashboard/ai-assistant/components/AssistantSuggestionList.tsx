import { HelpCircle, Zap } from 'lucide-react';

import type { AssistantSuggestion } from '@/features/dashboard/ai-assistant/lib/assistantSuggestions';

import { ChatSuggestionList } from '@/components/chat/ChatSuggestionList';

type Props = {
  suggestions: AssistantSuggestion[];
  onPick: (prompt: string) => void;
  disabled?: boolean;
};

export function AssistantSuggestionList({ suggestions, onPick, disabled }: Props) {
  return (
    <ChatSuggestionList
      suggestions={suggestions.map((item) => ({
        id: item.id,
        prompt: item.prompt,
        Icon: item.kind === 'action' ? Zap : HelpCircle,
      }))}
      onPick={onPick}
      disabled={disabled}
    />
  );
}
