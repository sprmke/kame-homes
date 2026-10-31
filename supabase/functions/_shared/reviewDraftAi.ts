/**
 * AI drafts for host-of-guest reviews and public responses.
 * Never posts. Credits via llmClient. Double-blind: unpublished counterpart is never used.
 */

import { generateText } from './ai/llmClient.ts';
import {
  REVIEW_HOST_DRAFT_PROMPT,
  REVIEW_RESPONSE_DRAFT_PROMPT,
} from './ai/prompts/reviewDraft.ts';
import { createServiceClient } from './orgAuth.ts';
import { REVIEW_RESPONSE_MAX_LEN, REVIEW_TEXT_MAX_LEN } from './reviewContentPolicy.ts';
import { guestFirstName } from './reviewAutomationTemplates.ts';

export type ReviewDraftKind = 'host_review' | 'guest_response';

function clip(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trim();
}

/**
 * Recent messages from this guest's own web-chat thread at the property. Only an
 * exact account match is used: matching by display name could pull another
 * guest's conversation into the draft.
 */
async function loadInboxSnippets(propertyId: string, guestUserId: string | null): Promise<string> {
  if (!guestUserId) return '';
  const supabase = createServiceClient();
  const { data: conv } = await supabase
    .from('social_conversations')
    .select('id')
    .eq('property_id', propertyId)
    .eq('platform', 'web')
    .eq('guest_user_id', guestUserId)
    .maybeSingle();
  if (!conv?.id) return '';
  const { data: messages } = await supabase
    .from('social_messages')
    .select('direction, body_text')
    .eq('conversation_id', conv.id)
    .order('sent_at', { ascending: false })
    .limit(8);
  const lines = (messages ?? [])
    .reverse()
    .map((row) => {
      const body = typeof row.body_text === 'string' ? row.body_text.trim() : '';
      if (!body) return null;
      const who = row.direction === 'inbound' ? 'Guest' : 'Host';
      return `${who}: ${clip(body, 240)}`;
    })
    .filter((line): line is string => Boolean(line));
  return lines.join('\n');
}

export async function draftReviewWithAi(input: {
  kind: ReviewDraftKind;
  organizationId: string;
  propertyId: string;
  bookingId: string;
  actorUserId: string | null;
  guestReviewText?: string | null;
  guestRating?: number | null;
}): Promise<string> {
  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from('guest_submissions')
    .select(
      'id, primary_guest_name, guest_facebook_name, check_in_date, check_out_date, property_id, guest_user_id'
    )
    .eq('id', input.bookingId)
    .maybeSingle();
  if (!booking) throw new Error('Booking not found');

  const { data: property } = await supabase
    .from('properties')
    .select('name')
    .eq('id', input.propertyId)
    .maybeSingle();

  const guestName =
    (booking.primary_guest_name as string | null)?.trim() ||
    (booking.guest_facebook_name as string | null)?.trim() ||
    null;
  const inbox = await loadInboxSnippets(
    input.propertyId,
    (booking.guest_user_id as string | null) ?? null
  );
  const propertyName = (property?.name as string | null)?.trim() || 'the property';

  if (input.kind === 'guest_response') {
    const publishedText = (input.guestReviewText ?? '').trim();
    const result = await generateText({
      feature: 'review_draft',
      prompt: REVIEW_RESPONSE_DRAFT_PROMPT,
      system:
        'You draft a short public host response to a published guest review. Warm, specific, no emojis, no contact details, no promises you cannot keep. Do not mention ratings. Return only the response text.',
      user: [
        `Property: ${propertyName}`,
        `Guest: ${guestFirstName(guestName)}`,
        input.guestRating != null ? `Guest overall rating: ${input.guestRating}/5` : null,
        publishedText ? `Guest review:\n${clip(publishedText, 800)}` : 'Guest left no public text.',
        inbox ? `Recent inbox (context only):\n${clip(inbox, 800)}` : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      temperature: 0.4,
      maxOutputTokens: 256,
      billing: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        actorType: 'staff',
      },
    });
    return clip(result.text, REVIEW_RESPONSE_MAX_LEN);
  }

  const result = await generateText({
    feature: 'review_draft',
    prompt: REVIEW_HOST_DRAFT_PROMPT,
    system:
      'You draft a short public host review of a guest after their stay. Positive, specific to the stay dates and property name, no emojis, no contact details. Do not invent damage or complaints. Return only the review text.',
    user: [
      `Property: ${propertyName}`,
      `Guest: ${guestFirstName(guestName)}`,
      `Check-in: ${String(booking.check_in_date ?? '')}`,
      `Check-out: ${String(booking.check_out_date ?? '')}`,
      inbox
        ? `Recent inbox (context only, never quote unpublished reviews):\n${clip(inbox, 800)}`
        : null,
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.4,
    maxOutputTokens: 256,
    billing: {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      actorUserId: input.actorUserId,
      actorType: 'staff',
    },
  });
  return clip(result.text, REVIEW_TEXT_MAX_LEN);
}
