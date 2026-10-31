import { definePrompt } from '../prompt.ts';
import { withUntrustedDataRule, wrapUntrusted } from '../untrusted.ts';
import {
  INBOX_MAX_TURN_CHARS,
  INBOX_TRANSCRIPT_TURNS,
  type InboxReplyPromptInput,
} from './inboxReply.ts';

export const GUEST_RECEPTIONIST_TURN_PROMPT = definePrompt({
  id: 'guest_receptionist',
  version: '2026-10-19.2',
});

export function buildGuestReceptionistTurnPrompt(input: InboxReplyPromptInput): {
  system: string;
  user: string;
  latestGuestText: string;
} {
  const safetyPolicy =
    'Answer normal guest inquiries using Known facts first, then tools when the guest names dates (including relative ones like Friday or tomorrow), asks for a price or total, asks about their own booking, stay-guide details during an active stay, parking, or directions. ' +
    "Only refuse when the guest asks about other guests' bookings, owner revenue/expenses/profit, or internal operations. " +
    'Do not invent facts missing from Known facts or tool results. Never reveal access codes or wifi passwords unless a stay-guide tool returned them.';

  const basePrompt =
    `You are a property rental host assistant for ${input.orgName}. ` +
    'Lead with the answer in one or two short sentences. No filler. ' +
    'Use a warm Filipino-English tone when the guest writes in Taglish. ' +
    'You may include one maps URL or one markdown table from a tool result. No other markdown. ' +
    'Call at most one tool per round. If Known facts already answer, do not call a tool. ' +
    'Price or nights questions always call get_inquiry_price with YYYY-MM-DD. Resolve relative dates from Today (Asia/Manila) in Known facts. Do not quote an amount unless that tool returned it.';

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
  const lastGuest = [...chron].reverse().find((m) => m.direction === 'inbound');
  const latestGuestText = lastGuest?.body?.trim() || '(attachment)';

  const contextLines = [`Platform: ${input.platform}`, `Type: ${input.conversationType}`];
  if (input.propertyName) contextLines.push(`Property: ${input.propertyName}`);
  if (input.inquiryCheckIn && input.inquiryCheckOut) {
    contextLines.push(`Inquiry dates: ${input.inquiryCheckIn} to ${input.inquiryCheckOut}`);
  }

  const user =
    `Known facts:\n${input.factsText}\n\n` +
    `${contextLines.join('\n')}\n\n` +
    `Conversation:\n${wrapUntrusted('conversation', transcript, 8_000)}\n\n` +
    `Reply to the guest's latest message:\n${wrapUntrusted('guest_message', latestGuestText, INBOX_MAX_TURN_CHARS)}\n`;

  return { system, user, latestGuestText };
}
