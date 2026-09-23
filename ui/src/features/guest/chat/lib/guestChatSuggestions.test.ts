import { describe, expect, it } from 'vitest';

import { resolveGuestChatFaqPhase, pickGuestChatFaqs, pickRandomGuestChatFaqs, GUEST_CHAT_FAQ_VISIBLE_COUNT } from '@/features/guest/chat/lib/guestChatSuggestions';

describe('resolveGuestChatFaqPhase', () => {

  it('resolveGuestChatFaqPhase is exported', () => {
    expect(typeof resolveGuestChatFaqPhase).toBe('function');
  });

});

describe('pickGuestChatFaqs', () => {

  it('pickGuestChatFaqs is exported', () => {
    expect(typeof pickGuestChatFaqs).toBe('function');
  });

});

describe('pickRandomGuestChatFaqs', () => {

  it('pickRandomGuestChatFaqs is exported', () => {
    expect(typeof pickRandomGuestChatFaqs).toBe('function');
  });

});

describe('GUEST_CHAT_FAQ_VISIBLE_COUNT', () => {
  it('is defined', () => {
    expect(GUEST_CHAT_FAQ_VISIBLE_COUNT).toBeDefined();
  });
});
