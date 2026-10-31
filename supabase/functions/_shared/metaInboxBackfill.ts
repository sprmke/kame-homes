/**
 * Meta inbox conversation backfill (Graph Conversations API → DB).
 * Kept separate from webhook handlers so sync workers stay lightweight.
 */

import {
  fetchMetaConversationsPage,
  formatMetaParticipantDisplayName,
  getPageAccessToken,
  type MetaConversationItem,
} from './metaInboxGraph.ts';
import { metaMessagingWindowExpiry } from './metaTimestamp.ts';
import { socialInboxDb } from './socialInboxDb.ts';
import { buildDmThreadId, clearMetaBackfillState, getFacebookConnectionForOrg, getMetaBackfillState, insertMessageIfNew, markMetaBackfillFullyComplete, markMetaInitialSyncComplete, migrateLegacyDmThreadId, metaBackfillHasMore, setMetaBackfillState, upsertConversation } from './socialInboxService.ts';
import type {
  ConversationType,
  ReplyStatus,
  SocialChannelConnectionRow,
  SocialPlatform,
} from './socialInboxTypes.ts';

type MetaBackfillMessage = {
  from?: { id: string };
  created_time?: string;
};

/** Pending when the latest message is from the guest; replied when the page spoke last. */
export function deriveReplyStatusFromMetaMessages(
  messages: MetaBackfillMessage[],
  pageId: string
): ReplyStatus {
  if (messages.length === 0) return 'none';

  let latest = messages[0];
  for (const msg of messages) {
    if (!msg.created_time) continue;
    if (!latest?.created_time || msg.created_time > latest.created_time) {
      latest = msg;
    }
  }

  return latest?.from?.id === pageId ? 'replied' : 'pending';
}

export function latestInboundMessageAt(
  messages: MetaBackfillMessage[],
  pageId: string
): string | null {
  let latest: string | null = null;
  for (const msg of messages) {
    if (msg.from?.id === pageId || !msg.created_time) continue;
    if (!latest || msg.created_time > latest) latest = msg.created_time;
  }
  return latest;
}

function selfAccountIds(connection: SocialChannelConnectionRow, pageId: string): Set<string> {
  return new Set(
    [
      pageId,
      connection.meta_page_id,
      connection.meta_ig_user_id,
      connection.external_account_id,
    ].filter((id): id is string => Boolean(id?.trim()))
  );
}

function participantFromConversation(
  conv: MetaConversationItem,
  selfIds: Set<string>
): { id: string; name: string | null } {
  const parts = conv.participants?.data ?? [];
  const guest = parts.find((p) => !selfIds.has(p.id)) ?? parts[0];
  return {
    id: guest?.id ?? 'unknown',
    name: formatMetaParticipantDisplayName({
      name: guest?.name,
      username: guest?.username,
    }),
  };
}

export async function syncMetaConversationToDb(opts: {
  orgId: string;
  connection: SocialChannelConnectionRow;
  platform: SocialPlatform;
  conv: MetaConversationItem;
  pageId: string;
  conversationType?: ConversationType;
  /** Scroll sync: upsert thread + latest message only. */
  metadataOnly?: boolean;
}): Promise<string | null> {
  const { orgId, connection, platform, conv, pageId } = opts;
  const conversationType = opts.conversationType ?? 'dm';
  const metadataOnly = opts.metadataOnly === true;
  const participant = participantFromConversation(conv, selfAccountIds(connection, pageId));
  const messages = conv.messages?.data ?? [];
  const latest = messages.reduce<(typeof messages)[number] | undefined>((acc, msg) => {
    if (!msg.created_time) return acc ?? msg;
    if (!acc?.created_time || msg.created_time > acc.created_time) return msg;
    return acc;
  }, messages[0]);
  const preview = latest?.message?.trim() || '(attachment)';
  const lastAt = latest?.created_time ?? conv.updated_time ?? new Date().toISOString();
  const lastInboundAt = latestInboundMessageAt(messages, pageId);
  const replyStatus = deriveReplyStatusFromMetaMessages(messages, pageId);

  const externalThreadId =
    conversationType === 'dm' ? buildDmThreadId(platform, participant.id) : conv.id;

  if (conversationType === 'dm') {
    await migrateLegacyDmThreadId(orgId, platform, participant.id, externalThreadId, conv.id);
  }

  const row = await upsertConversation({
    organization_id: orgId,
    connection_id: connection.id,
    platform,
    external_thread_id: externalThreadId,
    conversation_type: conversationType,
    external_participant_id: participant.id,
    participant_name: participant.name,
    subject_preview: preview.slice(0, 500),
    last_message_at: lastAt,
    last_inbound_at: lastInboundAt,
    unread_count: 0,
    reply_status: replyStatus,
    messaging_window_expires_at: lastInboundAt ? metaMessagingWindowExpiry(lastInboundAt) : null,
  });

  const messagesToStore = metadataOnly ? (latest ? [latest] : []) : [...messages].reverse();

  for (const msg of messagesToStore) {
    const isOutbound = msg.from?.id === pageId;
    try {
      await insertMessageIfNew({
        organization_id: orgId,
        conversation_id: row.id,
        direction: isOutbound ? 'outbound' : 'inbound',
        external_message_id: msg.id,
        body_text: msg.message ?? null,
        attachments: msg.attachments?.data ?? [],
        sent_at: msg.created_time ?? new Date().toISOString(),
        delivery_status: null,
        sent_by_user_id: null,
        is_ai_generated: false,
      });
    } catch (e) {
      console.warn('[syncMetaConversationToDb] skip message:', (e as Error).message);
    }
  }

  return row.id;
}

async function instagramConnectionForPage(
  orgId: string,
  pageId: string
): Promise<SocialChannelConnectionRow | null> {
  const sb = socialInboxDb();
  const { data } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('organization_id', orgId)
    .eq('platform', 'instagram')
    .eq('status', 'connected')
    .eq('meta_page_id', pageId)
    .limit(1);
  const row = data?.[0];
  return (row as SocialChannelConnectionRow | undefined) ?? null;
}

function syncAbortedResult(): MetaBackfillChunkResult {
  return { done: true, phase: 'complete', nextUrl: null, syncedInChunk: 0, metaHasMore: false };
}

async function syncConversationSafe(opts: {
  orgId: string;
  connection: SocialChannelConnectionRow;
  platform: SocialPlatform;
  conv: MetaConversationItem;
  pageId: string;
  metadataOnly?: boolean;
}): Promise<boolean> {
  try {
    await syncMetaConversationToDb({ ...opts, conversationType: 'dm' });
    return true;
  } catch (e) {
    console.warn('[backfillOrgMetaInboxChunk] skip conversation:', (e as Error).message);
    return false;
  }
}

export type MetaBackfillChunkPhase = 'messenger' | 'instagram';

export type MetaBackfillChunkState = {
  phase: MetaBackfillChunkPhase;
  nextUrl: string | null;
};

export type MetaBackfillChunkResult = {
  done: boolean;
  phase: MetaBackfillChunkPhase | 'complete';
  nextUrl: string | null;
  syncedInChunk: number;
  metaHasMore: boolean;
};

async function persistBackfillProgress(
  orgId: string,
  state: { phase: 'messenger' | 'instagram' | null; nextUrl: string | null }
): Promise<void> {
  if (state.phase) {
    await setMetaBackfillState(orgId, state);
    return;
  }
  await clearMetaBackfillState(orgId);
}

async function clearMetaSyncError(orgId: string): Promise<void> {
  const sb = socialInboxDb();
  const now = new Date().toISOString();
  await sb
    .from('social_channel_connections')
    .update({ error_message: null, updated_at: now })
    .eq('organization_id', orgId)
    .eq('platform', 'facebook')
    .eq('status', 'connected');
}

/** Surface an unrecoverable per-chunk failure so the client can stop polling and prompt reconnect. */
async function recordMetaSyncError(orgId: string, message: string): Promise<void> {
  const sb = socialInboxDb();
  const now = new Date().toISOString();
  await sb
    .from('social_channel_connections')
    .update({ error_message: message.slice(0, 500), updated_at: now })
    .eq('organization_id', orgId)
    .eq('platform', 'facebook')
    .eq('status', 'connected');
}

/** Sync one Graph conversations page per call — keeps edge workers fast. */
export async function backfillOrgMetaInboxChunk(
  orgId: string,
  state?: MetaBackfillChunkState,
  opts?: { light?: boolean }
): Promise<MetaBackfillChunkResult> {
  const connection = await getFacebookConnectionForOrg(orgId);
  if (!connection) return syncAbortedResult();

  const stored = await getMetaBackfillState(orgId);
  const phase = state?.phase ?? stored.phase;
  const nextUrl = state?.nextUrl !== undefined ? state.nextUrl : stored.nextUrl;
  const pageId = connection.meta_page_id ?? connection.external_account_id;
  const token = await getPageAccessToken(connection);
  let syncedInChunk = 0;
  const hadInitialSync = Boolean(connection.last_sync_at);
  const graphOpts = { light: opts?.light === true };
  const metadataOnly = opts?.light === true;

  if (phase === 'messenger' && !nextUrl) {
    await clearMetaSyncError(orgId);
    if (!connection.meta_backfill_phase) {
      await setMetaBackfillState(orgId, { phase: 'messenger', nextUrl: null });
    }
  }

  try {
    if (phase === 'instagram') {
      const igConnection = await instagramConnectionForPage(orgId, pageId);
      if (!igConnection) {
        await persistBackfillProgress(orgId, { phase: null, nextUrl: null });
        await markMetaBackfillFullyComplete(orgId, null);
        return {
          done: true,
          phase: 'complete',
          nextUrl: null,
          syncedInChunk: 0,
          metaHasMore: false,
        };
      }

      const page = await fetchMetaConversationsPage(pageId, token, 'instagram', nextUrl, graphOpts);
      const freshIg = await instagramConnectionForPage(orgId, pageId);
      if (!freshIg) return syncAbortedResult();

      for (const conv of page.conversations) {
        if (
          await syncConversationSafe({
            orgId,
            connection: freshIg,
            platform: 'instagram',
            conv,
            pageId,
            metadataOnly,
          })
        ) {
          syncedInChunk += 1;
        }
      }

      if (page.nextUrl) {
        await persistBackfillProgress(orgId, { phase: 'instagram', nextUrl: page.nextUrl });
        if (!hadInitialSync) await markMetaInitialSyncComplete(orgId);
        return {
          done: false,
          phase: 'instagram',
          nextUrl: page.nextUrl,
          syncedInChunk,
          metaHasMore: true,
        };
      }

      await persistBackfillProgress(orgId, { phase: null, nextUrl: null });
      await markMetaBackfillFullyComplete(orgId, freshIg);
      return { done: true, phase: 'complete', nextUrl: null, syncedInChunk, metaHasMore: false };
    }

    const page = await fetchMetaConversationsPage(pageId, token, 'messenger', nextUrl, graphOpts);
    const freshFacebook = await getFacebookConnectionForOrg(orgId);
    if (!freshFacebook) return syncAbortedResult();

    for (const conv of page.conversations) {
      if (
        await syncConversationSafe({
          orgId,
          connection: freshFacebook,
          platform: 'facebook',
          conv,
          pageId,
          metadataOnly,
        })
      ) {
        syncedInChunk += 1;
      }
    }

    if (page.nextUrl) {
      await persistBackfillProgress(orgId, { phase: 'messenger', nextUrl: page.nextUrl });
      if (!hadInitialSync) await markMetaInitialSyncComplete(orgId);
      return {
        done: false,
        phase: 'messenger',
        nextUrl: page.nextUrl,
        syncedInChunk,
        metaHasMore: true,
      };
    }

    const igConnection = await instagramConnectionForPage(orgId, pageId);
    if (igConnection) {
      await persistBackfillProgress(orgId, { phase: 'instagram', nextUrl: null });
      if (!hadInitialSync) await markMetaInitialSyncComplete(orgId);
      return {
        done: false,
        phase: 'instagram',
        nextUrl: null,
        syncedInChunk,
        metaHasMore: true,
      };
    }

    await persistBackfillProgress(orgId, { phase: null, nextUrl: null });
    await markMetaBackfillFullyComplete(orgId, null);
    return { done: true, phase: 'complete', nextUrl: null, syncedInChunk, metaHasMore: false };
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (msg.includes('social_conversations_connection_id_fkey')) {
      console.warn('[backfillOrgMetaInboxChunk] connection removed during sync');
      return syncAbortedResult();
    }
    console.error('[backfillOrgMetaInboxChunk]', e);
    // Unrecoverable here (bad/expired token, disabled app, etc.) — persist so the client
    // stops treating this as "in progress" and prompts reconnect instead of spinning forever.
    if (!hadInitialSync) {
      await recordMetaSyncError(orgId, msg || 'Could not sync conversations from Meta.');
    }
    const fresh = await getFacebookConnectionForOrg(orgId);
    return {
      done: false,
      phase,
      nextUrl,
      syncedInChunk,
      metaHasMore: metaBackfillHasMore(fresh),
    };
  }
}

/** Stop showing in-progress sync when chunks fail but partial data may exist. */
export async function finalizeMetaInboxSync(orgId: string): Promise<void> {
  const connection = await getFacebookConnectionForOrg(orgId);
  const pageId = connection?.meta_page_id ?? connection?.external_account_id ?? null;
  const igConnection = pageId ? await instagramConnectionForPage(orgId, pageId) : null;
  await clearMetaSyncError(orgId);
  await persistBackfillProgress(orgId, { phase: null, nextUrl: null });
  await markMetaBackfillFullyComplete(orgId, igConnection);
}

export async function backfillOrgMetaInbox(
  orgId: string,
  _connection: SocialChannelConnectionRow,
  opts?: { maxPages?: number }
): Promise<void> {
  try {
    let state: MetaBackfillChunkState = { phase: 'messenger', nextUrl: null };
    let pagesFetched = 0;
    const maxPages = opts?.maxPages ?? Number.POSITIVE_INFINITY;

    while (pagesFetched < maxPages) {
      const result = await backfillOrgMetaInboxChunk(orgId, state);
      pagesFetched += 1;
      if (result.done) return;
      state = { phase: result.phase as MetaBackfillChunkPhase, nextUrl: result.nextUrl };
    }

    await finalizeMetaInboxSync(orgId);
  } catch (e) {
    console.error('[backfillOrgMetaInbox]', e);
    throw e;
  }
}
