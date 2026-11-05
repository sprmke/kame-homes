import { describe, expect, it } from 'vitest';

import {
  resolveGuestChatFaqPhase,
  pickFollowUpFaqs,
  pickGuestChatFaqs,
  pickRandomGuestChatFaqs,
  GUEST_CHAT_FAQ_VISIBLE_COUNT,
  TALK_TO_HOST_PROMPT,
} from '@/features/guest/chat/lib/guestChatSuggestions';

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

describe('pickFollowUpFaqs', () => {
  it('drops FAQs already covered by the last guest question', () => {
    const faqs = pickFollowUpFaqs({
      phase: 'ongoing',
      lastGuestPrompt: 'What is the WiFi password?',
      lastAiReply: 'Wifi is on the stay guide.',
      count: 8,
    });
    expect(faqs.some((faq) => faq.id === 'g-20')).toBe(false);
  });

  it('returns at most the requested count', () => {
    expect(pickFollowUpFaqs({ phase: 'pre_booking', count: 3 }).length).toBeLessThanOrEqual(3);
  });
});

describe('TALK_TO_HOST_PROMPT', () => {
  it('is a short guest escalation line', () => {
    expect(TALK_TO_HOST_PROMPT.toLowerCase()).toContain('talk to the host');
  });
});
