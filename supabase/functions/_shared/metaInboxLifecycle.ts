/**
 * Meta inbox connect/disconnect cleanup — prevents stale threads/tokens across reconnects.
 * Org wipe only touches org-default rows (property_id/parking_id null); overrides are separate.
 */

import { getPageAccessToken, unsubscribeMetaPageWebhooks } from './metaInboxGraph.ts';
import { createServiceClient } from './orgAuth.ts';
import {
  listOrgDefaultMetaConnections,
  listParkingOverrideMetaConnections,
  listPropertyOverrideMetaConnections,
} from './metaInboxScope.ts';
import { socialInboxDb } from './socialInboxDb.ts';
import { deleteConversationsForConnections } from './socialInboxService.ts';
import type { SocialChannelConnectionRow } from './socialInboxTypes.ts';

const META_PLATFORMS = ['facebook', 'instagram'] as const;

type ClearMetaInboxOptions = {
  deleteConversations?: boolean;
};

async function unsubscribeMetaConnections(
  connections: SocialChannelConnectionRow[]
): Promise<void> {
  for (const conn of connections) {
    if (!conn.meta_page_id || !conn.encrypted_access_token) continue;
    try {
      const token = await getPageAccessToken(conn);
      await unsubscribeMetaPageWebhooks(conn.meta_page_id, token);
    } catch (e) {
      console.warn('[metaInboxLifecycle] unsubscribe:', e);
    }
  }
}

async function deleteMetaConnectionsByIds(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const sb = socialInboxDb();
  const { error, count } = await sb
    .from('social_channel_connections')
    .delete({ count: 'exact' })
    .in('id', ids);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function softDisconnectMetaConnections(
  connections: SocialChannelConnectionRow[]
): Promise<number> {
  if (!connections.length) return 0;
  const ids = connections.map((connection) => connection.id);
  const sb = socialInboxDb();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('social_channel_connections')
    .update({
      status: 'disconnected',
      encrypted_access_token: null,
      token_expires_at: null,
      webhook_subscribed_at: null,
      webhook_last_verified_at: null,
      webhook_verify_attempts: 0,
      error_message: null,
      updated_at: now,
    })
    .in('id', ids)
    .select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

function shouldPreserveExistingMetaHistory(
  rows: SocialChannelConnectionRow[],
  nextPageId?: string | null
): boolean {
  if (!nextPageId) return false;
  return rows.some(
    (row) =>
      (row.meta_page_id === nextPageId || row.external_account_id === nextPageId) &&
      row.status === 'disconnected'
  );
}

/** Wipe org-default Meta inbox data before a fresh org connect/reconnect. */
export async function prepareOrgMetaInboxConnect(
  orgId: string,
  opts: { nextPageId?: string | null } = {}
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('meta_inbox_oauth_state')
    .delete()
    .eq('organization_id', orgId)
    .is('property_id', null)
    .is('parking_id', null);

  const orgMeta = await listOrgDefaultMetaConnections(orgId);
  if (shouldPreserveExistingMetaHistory(orgMeta, opts.nextPageId)) return;
  const ids = orgMeta.map((c) => c.id);
  await deleteConversationsForConnections(ids);
  await deleteMetaConnectionsByIds(ids);
}

/** Full org-default Meta disconnect (overrides remain). */
export async function clearOrgMetaInbox(orgId: string): Promise<{
  conversationsCleared: number;
  connectionsRemoved: number;
}>;
export async function clearOrgMetaInbox(
  orgId: string,
  opts?: ClearMetaInboxOptions
): Promise<{
  conversationsCleared: number;
  connectionsRemoved: number;
}>;
export async function clearOrgMetaInbox(
  orgId: string,
  opts: ClearMetaInboxOptions = {}
): Promise<{
  conversationsCleared: number;
  connectionsRemoved: number;
}> {
  const metaConnections = await listOrgDefaultMetaConnections(orgId);
  await unsubscribeMetaConnections(metaConnections);
  const deleteConversations = opts.deleteConversations === true;
  const ids = metaConnections.map((c) => c.id);
  const conversationsCleared = deleteConversations
    ? await deleteConversationsForConnections(ids)
    : 0;
  const connectionsRemoved = deleteConversations
    ? await deleteMetaConnectionsByIds(ids)
    : await softDisconnectMetaConnections(metaConnections);

  const sb = createServiceClient();
  await sb
    .from('meta_inbox_oauth_state')
    .delete()
    .eq('organization_id', orgId)
    .is('property_id', null)
    .is('parking_id', null);

  return { conversationsCleared, connectionsRemoved };
}

/** Wipe prior property override before connecting a new Page for that property. */
export async function preparePropertyMetaInboxConnect(
  orgId: string,
  propertyId: string,
  opts: { nextPageId?: string | null } = {}
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('meta_inbox_oauth_state')
    .delete()
    .eq('organization_id', orgId)
    .eq('property_id', propertyId);

  const rows = await listPropertyOverrideMetaConnections(orgId, propertyId);
  if (shouldPreserveExistingMetaHistory(rows, opts.nextPageId)) return;
  const ids = rows.map((c) => c.id);
  await deleteConversationsForConnections(ids);
  await deleteMetaConnectionsByIds(ids);
}

/** Wipe prior parking override before connecting a new Page for that parking. */
export async function prepareParkingMetaInboxConnect(
  orgId: string,
  parkingId: string,
  opts: { nextPageId?: string | null } = {}
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('meta_inbox_oauth_state')
    .delete()
    .eq('organization_id', orgId)
    .eq('parking_id', parkingId);

  const rows = await listParkingOverrideMetaConnections(orgId, parkingId);
  if (shouldPreserveExistingMetaHistory(rows, opts.nextPageId)) return;
  const ids = rows.map((c) => c.id);
  await deleteConversationsForConnections(ids);
  await deleteMetaConnectionsByIds(ids);
}

export async function clearPropertyMetaInbox(
  orgId: string,
  propertyId: string,
  opts: ClearMetaInboxOptions = {}
): Promise<{ conversationsCleared: number; connectionsRemoved: number }> {
  const rows = await listPropertyOverrideMetaConnections(orgId, propertyId);
  await unsubscribeMetaConnections(rows);
  const ids = rows.map((c) => c.id);
  const deleteConversations = opts.deleteConversations === true;
  const conversationsCleared = deleteConversations
    ? await deleteConversationsForConnections(ids)
    : 0;
  const connectionsRemoved = deleteConversations
    ? await deleteMetaConnectionsByIds(ids)
    : await softDisconnectMetaConnections(rows);

  const sb = createServiceClient();
  await sb
    .from('meta_inbox_oauth_state')
    .delete()
    .eq('organization_id', orgId)
    .eq('property_id', propertyId);

  return { conversationsCleared, connectionsRemoved };
}

export async function clearParkingMetaInbox(
  orgId: string,
  parkingId: string,
  opts: ClearMetaInboxOptions = {}
): Promise<{ conversationsCleared: number; connectionsRemoved: number }> {
  const rows = await listParkingOverrideMetaConnections(orgId, parkingId);
  await unsubscribeMetaConnections(rows);
  const ids = rows.map((c) => c.id);
  const deleteConversations = opts.deleteConversations === true;
  const conversationsCleared = deleteConversations
    ? await deleteConversationsForConnections(ids)
    : 0;
  const connectionsRemoved = deleteConversations
    ? await deleteMetaConnectionsByIds(ids)
    : await softDisconnectMetaConnections(rows);

  const sb = createServiceClient();
  await sb
    .from('meta_inbox_oauth_state')
    .delete()
    .eq('organization_id', orgId)
    .eq('parking_id', parkingId);

  return { conversationsCleared, connectionsRemoved };
}

/** @deprecated Prefer clearOrgMetaInbox — kept name for call sites that purged all Meta. */
export async function purgeOrgMetaInboxConversations(orgId: string): Promise<number> {
  const orgMeta = await listOrgDefaultMetaConnections(orgId);
  return deleteConversationsForConnections(orgMeta.map((c) => c.id));
}

export async function deleteOrgMetaChannelConnections(orgId: string): Promise<number> {
  const orgMeta = await listOrgDefaultMetaConnections(orgId);
  return deleteMetaConnectionsByIds(orgMeta.map((c) => c.id));
}

export { META_PLATFORMS };
