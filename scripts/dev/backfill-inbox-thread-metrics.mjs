#!/usr/bin/env node
/**
 * Backfill inbox_thread_metrics from historical social_messages.
 * Usage: node scripts/dev/backfill-inbox-thread-metrics.mjs [--org-id=<uuid>] [--dry-run]
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or local stack defaults).
 */

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const orgIdArg = args.find((a) => a.startsWith('--org-id='))?.split('=')[1]?.trim() ?? '';

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(url, key);

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function respondedWithin24h(guestAt, hostAt) {
  const guestMs = Date.parse(guestAt);
  const hostMs = Date.parse(hostAt);
  if (Number.isNaN(guestMs) || Number.isNaN(hostMs)) return false;
  return hostMs - guestMs <= TWENTY_FOUR_HOURS_MS;
}

async function loadConversationIds(orgId) {
  let query = supabase.from('social_conversations').select('id, organization_id');
  if (orgId) query = query.eq('organization_id', orgId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function backfillConversation(conversationId, organizationId) {
  const { data: messages, error } = await supabase
    .from('social_messages')
    .select('direction, sent_at')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true });

  if (error) throw error;
  if (!messages?.length) return null;

  const firstInbound = messages.find((m) => m.direction === 'inbound');
  if (!firstInbound) return null;

  const firstOutbound = messages.find(
    (m) => m.direction === 'outbound' && Date.parse(m.sent_at) >= Date.parse(firstInbound.sent_at)
  );

  return {
    organization_id: organizationId,
    conversation_id: conversationId,
    first_guest_message_at: firstInbound.sent_at,
    first_host_reply_at: firstOutbound?.sent_at ?? null,
    responded_within_24h: firstOutbound
      ? respondedWithin24h(firstInbound.sent_at, firstOutbound.sent_at)
      : null,
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  const conversations = await loadConversationIds(orgIdArg);
  let upserted = 0;
  let skipped = 0;

  for (const conv of conversations) {
    const row = await backfillConversation(conv.id, conv.organization_id);
    if (!row) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log('[dry-run]', row.conversation_id, row.responded_within_24h);
      upserted += 1;
      continue;
    }

    const { error } = await supabase.from('inbox_thread_metrics').upsert(row, {
      onConflict: 'conversation_id',
    });
    if (error) {
      console.warn('upsert failed', conv.id, error.message);
      skipped += 1;
      continue;
    }
    upserted += 1;
  }

  console.log(`Done. upserted=${upserted} skipped=${skipped} dryRun=${dryRun}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
