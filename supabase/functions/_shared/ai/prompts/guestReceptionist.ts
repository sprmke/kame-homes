import { definePrompt } from '../prompt.ts';
import { withUntrustedDataRule, wrapUntrusted } from '../untrusted.ts';
import {
  INBOX_MAX_PENDING_MESSAGES,
  INBOX_MAX_TURN_CHARS,
  INBOX_TRANSCRIPT_TURNS,
  pendingGuestMessages,
  pendingQuestionsBlock,
  type InboxReplyPromptInput,
} from './inboxReply.ts';

export const GUEST_RECEPTIONIST_TURN_PROMPT = definePrompt({
  id: 'guest_receptionist',
  version: '2026-11-02.1',
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
    'Answer every pending question listed below - do not stop after the first. ' +
    'Lead with the answer in one or two short sentences per question. No filler. ' +
    'Use a warm Filipino-English tone when the guest writes in Taglish. ' +
    'You may include one maps URL or one markdown table from a tool result. No other markdown. ' +
    'Call every tool you need for the pending questions - independent reads can go in the same round. If Known facts already answer a question, do not call a tool for it. ' +
    'Price or nights questions always call get_inquiry_price with YYYY-MM-DD. Resolve relative dates from Today (Asia/Manila) in Known facts. Do not quote an amount unless that tool returned it. ' +
    'If the guest clearly asks for a person, or is upset and a fact will not help, call handoff_to_host (when offered) instead of guessing. ' +
    'If the guest reports something broken or not working during their stay, call report_maintenance_issue (when offered) with their own words - do not just say you will pass it on. ' +
    'If the guest asks about booking a stay you do not have dates confirmed for, or wants to hold/inquire about a future stay, call request_booking_inquiry (when offered) once you have check-in, check-out, and guest count - say the host will review it, nothing is booked yet. ' +
    'If the guest asks for an earlier check-in or later check-out than usual, call request_early_checkin_late_checkout (when offered) once you know which one and the time they want - say the host will review it, nothing changes yet.';

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
    `Known facts:\n${input.factsText}\n\n` +
    `${contextLines.join('\n')}\n\n` +
    `Conversation:\n${wrapUntrusted('conversation', transcript, 8_000)}\n\n` +
    `Answer every pending question below, in order - do not stop after the first:\n${wrapUntrusted('guest_message', pendingQuestionsBlock(pending), INBOX_MAX_TURN_CHARS * INBOX_MAX_PENDING_MESSAGES)}\n`;

  return { system, user, latestGuestText };
}
