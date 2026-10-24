export type GuestChatFaqPhase = 'pre_booking' | 'inquiry' | 'ongoing';

export type GuestChatFaq = {
  id: string;
  prompt: string;
  phases: readonly GuestChatFaqPhase[];
};

const ALL_PHASES: readonly GuestChatFaqPhase[] = ['pre_booking', 'inquiry', 'ongoing'];

export const GUEST_CHAT_FAQS: readonly GuestChatFaq[] = [
  { id: 'g-01', prompt: 'What time is check-in and check-out?', phases: ALL_PHASES },
  { id: 'g-02', prompt: 'Is parking available?', phases: ['pre_booking', 'inquiry', 'ongoing'] },
  { id: 'g-03', prompt: 'Are pets allowed?', phases: ['pre_booking', 'inquiry'] },
  { id: 'g-04', prompt: 'Is there WiFi?', phases: ALL_PHASES },
  { id: 'g-05', prompt: 'How do I get to the property?', phases: ALL_PHASES },
  { id: 'g-06', prompt: "What's the cancellation policy?", phases: ['pre_booking', 'inquiry'] },
  { id: 'g-07', prompt: 'Is there a security deposit?', phases: ['pre_booking', 'inquiry'] },
  {
    id: 'g-08',
    prompt: 'Can I check in early?',
    phases: ['inquiry', 'ongoing'],
  },
  { id: 'g-09', prompt: 'What amenities are included?', phases: ['pre_booking', 'inquiry'] },
  { id: 'g-10', prompt: 'How do I book this stay?', phases: ['pre_booking'] },
  { id: 'g-11', prompt: 'What payment methods do you accept?', phases: ['pre_booking', 'inquiry'] },
  { id: 'g-12', prompt: 'Are there house rules I should know?', phases: ALL_PHASES },
  {
    id: 'g-13',
    prompt: 'Is self check-in available?',
    phases: ['pre_booking', 'inquiry', 'ongoing'],
  },
  { id: 'g-14', prompt: 'How many guests can stay?', phases: ['pre_booking', 'inquiry'] },
  { id: 'g-15', prompt: 'Can I check out late?', phases: ['inquiry', 'ongoing'] },
  { id: 'g-16', prompt: 'Do you accept GCash?', phases: ['pre_booking', 'inquiry'] },
  {
    id: 'g-17',
    prompt: 'Is this available for my selected dates?',
    phases: ['inquiry'],
  },
  {
    id: 'g-18',
    prompt: 'What is the total for my stay?',
    phases: ['inquiry'],
  },
  {
    id: 'g-19',
    prompt: 'Where do I park when I arrive?',
    phases: ['ongoing'],
  },
  {
    id: 'g-20',
    prompt: 'What is the WiFi password?',
    phases: ['ongoing'],
  },
  {
    id: 'g-21',
    prompt: 'How do I get into the unit?',
    phases: ['ongoing'],
  },
  {
    id: 'g-22',
    prompt: 'Can I request a late checkout?',
    phases: ['ongoing'],
  },
  {
    id: 'g-23',
    prompt: 'How do I submit my security deposit refund details?',
    phases: ['ongoing'],
  },
];

export const GUEST_CHAT_FAQ_VISIBLE_COUNT = 5;

export const TALK_TO_HOST_PROMPT = "I'd like to talk to the host.";
export const GUEST_CHAT_FOLLOW_UP_COUNT = 3;

export function resolveGuestChatFaqPhase(input: {
  hasInquiryDates: boolean;
  hasMessages: boolean;
}): GuestChatFaqPhase {
  if (input.hasMessages) return 'ongoing';
  if (input.hasInquiryDates) return 'inquiry';
  return 'pre_booking';
}

function overlapTokenCount(prompt: string, haystack: string): number {
  const hay = haystack.toLowerCase();
  const tokens = prompt
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 3);
  return tokens.filter((token) => hay.includes(token)).length;
}

export function pickFollowUpFaqs(input: {
  phase: GuestChatFaqPhase;
  lastGuestPrompt?: string;
  lastAiReply?: string;
  count?: number;
}): GuestChatFaq[] {
  const used = `${input.lastGuestPrompt ?? ''} ${input.lastAiReply ?? ''}`.trim();
  const count = input.count ?? GUEST_CHAT_FOLLOW_UP_COUNT;
  const pool = GUEST_CHAT_FAQS.filter((faq) => {
    if (!faq.phases.includes(input.phase)) return false;
    if (!used) return true;
    return overlapTokenCount(faq.prompt, used) < 2;
  });
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

export function pickGuestChatFaqs(
  phase: GuestChatFaqPhase,
  count: number = GUEST_CHAT_FAQ_VISIBLE_COUNT
): GuestChatFaq[] {
  const pool = GUEST_CHAT_FAQS.filter((faq) => faq.phases.includes(phase));
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

/** @deprecated Use pickGuestChatFaqs with resolveGuestChatFaqPhase */
export function pickRandomGuestChatFaqs(
  count: number = GUEST_CHAT_FAQ_VISIBLE_COUNT
): GuestChatFaq[] {
  return pickGuestChatFaqs('pre_booking', count);
}
