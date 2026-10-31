import { useMemo } from 'react';

import {
  GUEST_CHAT_FAQ_VISIBLE_COUNT,
  pickGuestChatFaqs,
  resolveGuestChatFaqPhase,
  type GuestChatFaqPhase,
} from '@/features/guest/chat/lib/guestChatSuggestions';

import { ChatSuggestionList } from '@/components/chat/ChatSuggestionList';

type Props = {
  onPick: (prompt: string) => void;
  disabled?: boolean;
  hasInquiryDates?: boolean;
  hasMessages?: boolean;
  phase?: GuestChatFaqPhase;
};

export function GuestChatFaqSuggestions({
  onPick,
  disabled,
  hasInquiryDates = false,
  hasMessages = false,
  phase,
}: Props) {
  const resolvedPhase = phase ?? resolveGuestChatFaqPhase({ hasInquiryDates, hasMessages });

  const suggestions = useMemo(
    () => pickGuestChatFaqs(resolvedPhase, GUEST_CHAT_FAQ_VISIBLE_COUNT),
    [resolvedPhase]
  );

  if (suggestions.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Suggested questions"
      aria-busy={disabled || undefined}
      className="flex min-h-full flex-1 flex-col px-4 py-6"
    >
      <div className="m-auto flex w-full min-w-0 max-w-[22rem] flex-col">
        <ChatSuggestionList suggestions={suggestions} onPick={onPick} disabled={disabled} />
      </div>
    </div>
  );
}
