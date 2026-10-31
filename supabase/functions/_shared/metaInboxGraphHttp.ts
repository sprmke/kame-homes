/**
 * Low-level Meta Graph HTTP helpers shared by metaInboxGraph + webhook health
 * without creating a circular module graph.
 */

import { decryptMetaInboxToken } from './metaInboxCrypto.ts';
import { META_GRAPH_BASE, META_WEBHOOK_SUBSCRIBED_FIELDS } from './metaInboxConfig.ts';
import type { SocialChannelConnectionRow } from './socialInboxTypes.ts';

/** Parse Meta Graph responses; empty bodies become `{}` instead of throwing. */
export async function parseMetaGraphJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) throw new Error(`Meta API error (${res.status})`);
    return {};
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Meta API returned invalid JSON (${res.status})`);
  }
}

export async function subscribeMetaPageWebhooks(
  pageId: string,
  pageAccessToken: string
): Promise<void> {
  const url = new URL(`${META_GRAPH_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set('subscribed_fields', META_WEBHOOK_SUBSCRIBED_FIELDS);
  url.searchParams.set('access_token', pageAccessToken);
  const res = await fetch(url.toString(), { method: 'POST' });
  const json = await parseMetaGraphJson(res);
  if (!res.ok || json.success !== true) {
    throw new Error(
      (json.error as { message?: string } | undefined)?.message ??
        'Failed to subscribe Meta webhooks'
    );
  }
}

export async function getPageAccessToken(connection: SocialChannelConnectionRow): Promise<string> {
  const enc = connection.encrypted_access_token;
  if (!enc) throw new Error('Channel not connected');
  return decryptMetaInboxToken(enc);
}
