import { definePrompt } from '../prompt.ts';
import { withUntrustedDataRule, wrapUntrusted } from '../untrusted.ts';

/**
 * Guest inbox reply prompt (suggest + auto-reply). Pure: the service loads the org name,
 * grounding facts and transcript; this only assembles the prompt, so live evals run it verbatim.
 */
export const INBOX_REPLY_PROMPT = definePrompt({ id: 'inbox_reply', version: '2026-11-01.1' });

/** Context budget: recent turns only, each clipped, so one long message cannot flood the prompt. */
export const INBOX_TRANSCRIPT_TURNS = 12;
export const INBOX_MAX_TURN_CHARS = 1_000;
/** A guest burst rarely exceeds this; older questions in a longer burst are dropped, newest kept. */
export const INBOX_MAX_PENDING_MESSAGES = 8;

/**
 * Every guest message since the last outbound reply, oldest first, so a burst of several
 * questions in a row all get answered instead of only the latest one. When the host already
 * replied to everything (no inbound message after the last outbound), falls back to the single
 * most recent guest message so there is always something to react to.
 */
export function pendingGuestMessages(
  messages: Array<{ direction: string; body: string | null; sentAt: string }>
): string[] {
  const chron = [...messages].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  let lastOutboundIdx = -1;
  for (let i = 0; i < chron.length; i++) {
    if (chron[i].direction === 'outbound') lastOutboundIdx = i;
  }
  let pending = chron.filter((m, i) => m.direction === 'inbound' && i > lastOutboundIdx);
  if (pending.length === 0) {
    const lastInbound = [...chron].reverse().find((m) => m.direction === 'inbound');
    pending = lastInbound ? [lastInbound] : [];
  }
  return pending
    .slice(-INBOX_MAX_PENDING_MESSAGES)
    .map((m) => (m.body?.trim() || '(attachment)').slice(0, INBOX_MAX_TURN_CHARS));
}

/** Numbered "1. ...\n2. ..." block for the prompt; empty when there is nothing pending. */
export function pendingQuestionsBlock(pending: readonly string[]): string {
  return pending.map((q, i) => `${i + 1}. ${q}`).join('\n');
}

export type InboxReplyPromptInput = {
  orgName: string;
  systemPromptOverride?: string | null;
  factsText: string;
  platform: string;
  conversationType: string;
  participantName: string | null;
  propertyName?: string | null;
  inquiryCheckIn?: string | null;
  inquiryCheckOut?: string | null;
  messages: Array<{ direction: string; body: string | null; sentAt: string }>;
};

export function buildInboxReplyPrompt(input: InboxReplyPromptInput): {
  system: string;
  user: string;
  latestGuestText: string;
} {
  const safetyPolicy =
    'Answer normal guest inquiries helpfully using Known facts first, then Quick reply snippets when property facts are incomplete. ' +
    'Normal inquiries include availability, rates, location/address/map, tower/residence/unit, payment methods (including GCash account details when listed), cancellation/refund policy, amenities, parking, pets, and booking steps. ' +
    "Only refuse when the guest asks about other guests' bookings, owner revenue/expenses/profit, or internal operations — then politely decline and offer to loop in the host team. " +
    'Do not invent facts missing from Known facts and Quick reply snippets.';
  const basePrompt =
    `You are a friendly property rental host assistant for ${input.orgName}. ` +
    "Reply in complete sentences (1–3 short sentences). Answer the guest's latest question directly. " +
    'Use a warm Filipino-English tone when the guest writes in Taglish. ' +
    'For "available today" or "available tonight", use the Today / Check-in today lines in Known facts. ' +
    'Share payment account name and number when listed under Payment methods — guests need this to pay. ' +
    'Share the full address and map link when listed — guests need this for navigation.';

  // Org "Manage AI response" instructions layer on top of the base behavior — never replace it —
  // so Known facts, quick replies, and the safety policy always still apply.
  const override = input.systemPromptOverride?.trim();
  const customInstructions = override ? `\n\nHost's additional instructions: ${override}` : '';
  const system = withUntrustedDataRule(`${basePrompt}${customInstructions}\n\n${safetyPolicy}`);

  const chron = [...input.messages].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const transcript = chron
    .slice(-INBOX_TRANSCRIPT_TURNS)
    .map((m) => {
      const who = m.direction === 'inbound' ? (input.participantName ?? 'Guest') : 'Host';
      return `${who}: ${(m.body?.trim() || '(attachment)').slice(0, INBOX_MAX_TURN_CHARS)}`;
    })
    .join('\n');
  const pending = pendingGuestMessages(input.messages);
  const latestGuestText = pending.join('\n');

  const contextLines = [`Platform: ${input.platform}`, `Type: ${input.conversationType}`];
  if (input.propertyName) contextLines.push(`Property: ${input.propertyName}`);
  if (input.inquiryCheckIn && input.inquiryCheckOut) {
    contextLines.push(`Inquiry dates: ${input.inquiryCheckIn} to ${input.inquiryCheckOut}`);
  }

  const user =
    `Known facts (property/booking data + quick reply snippets):\n${input.factsText}\n\n` +
    `${contextLines.join('\n')}\n\n` +
    `Conversation:\n${wrapUntrusted('conversation', transcript, 8_000)}\n\n` +
    `Answer every pending question below, in order — do not stop after the first:\n${wrapUntrusted('guest_message', pendingQuestionsBlock(pending), INBOX_MAX_TURN_CHARS * INBOX_MAX_PENDING_MESSAGES)}\n` +
    'Write only the reply text — no quotes, labels, or markdown.';

  return { system, user, latestGuestText };
}
