/**
 * Superhost inbox response metrics — upserted on inbound guest / outbound host messages.
 */

import { socialInboxDb } from './socialInboxDb.ts';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function respondedWithin24h(firstGuestAt: string, firstHostAt: string): boolean {
  const guestMs = Date.parse(firstGuestAt);
  const hostMs = Date.parse(firstHostAt);
  if (Number.isNaN(guestMs) || Number.isNaN(hostMs)) return false;
  return hostMs - guestMs <= TWENTY_FOUR_HOURS_MS;
}

/** After first guest inbound, attach first host reply if one already exists in the thread. */
async function attachFirstHostReplyAfterGuestMessage(
  conversationId: string,
  firstGuestMessageAt: string
): Promise<void> {
  const sb = socialInboxDb();
  const { data: outbound, error } = await sb
    .from('social_messages')
    .select('sent_at')
    .eq('conversation_id', conversationId)
    .eq('direction', 'outbound')
    .gte('sent_at', firstGuestMessageAt)
    .order('sent_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !outbound?.sent_at) return;

  const hostAt = String(outbound.sent_at);
  const within24h = respondedWithin24h(firstGuestMessageAt, hostAt);
  await sb
    .from('inbox_thread_metrics')
    .update({
      first_host_reply_at: hostAt,
      responded_within_24h: within24h,
      updated_at: new Date().toISOString(),
    })
    .eq('conversation_id', conversationId)
    .is('first_host_reply_at', null);
}

/** Record first guest inbound timestamp for Superhost response-rate metrics. */
export async function recordInboxInboundForMetrics(input: {
  organizationId: string;
  conversationId: string;
  sentAt: string;
}): Promise<void> {
  const sb = socialInboxDb();
  const { data: existing } = await sb
    .from('inbox_thread_metrics')
    .select('id, first_host_reply_at')
    .eq('conversation_id', input.conversationId)
    .maybeSingle();

  if (existing?.id) return;

  const { error } = await sb.from('inbox_thread_metrics').insert({
    organization_id: input.organizationId,
    conversation_id: input.conversationId,
    first_guest_message_at: input.sentAt,
    updated_at: new Date().toISOString(),
  });

  if (error && error.code !== '23505') {
    console.warn('[inboxThreadMetrics] inbound insert failed:', error.message);
    return;
  }

  await attachFirstHostReplyAfterGuestMessage(input.conversationId, input.sentAt);
}

/** Record first host outbound reply and whether it landed within 24h of first guest message. */
export async function recordInboxHostReplyForMetrics(input: {
  organizationId: string;
  conversationId: string;
  sentAt: string;
}): Promise<void> {
  const sb = socialInboxDb();
  const { data: row, error: readError } = await sb
    .from('inbox_thread_metrics')
    .select('id, first_guest_message_at, first_host_reply_at')
    .eq('conversation_id', input.conversationId)
    .maybeSingle();

  if (readError) {
    console.warn('[inboxThreadMetrics] lookup failed:', readError.message);
    return;
  }

  if (!row?.id || row.first_host_reply_at) return;

  const within24h = respondedWithin24h(String(row.first_guest_message_at), input.sentAt);
  const { error } = await sb
    .from('inbox_thread_metrics')
    .update({
      first_host_reply_at: input.sentAt,
      responded_within_24h: within24h,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .is('first_host_reply_at', null);

  if (error) {
    console.warn('[inboxThreadMetrics] host reply update failed:', error.message);
  }
}

/** Called from insertMessageIfNew after a new message row is persisted. */
export async function recordInboxMessageForMetrics(fields: {
  organization_id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  sent_at: string;
}): Promise<void> {
  if (fields.direction === 'inbound') {
    await recordInboxInboundForMetrics({
      organizationId: fields.organization_id,
      conversationId: fields.conversation_id,
      sentAt: fields.sent_at,
    });
    return;
  }

  await recordInboxHostReplyForMetrics({
    organizationId: fields.organization_id,
    conversationId: fields.conversation_id,
    sentAt: fields.sent_at,
  });
}
