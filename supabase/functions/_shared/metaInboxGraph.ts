/**
 * Meta Graph API client for inbox OAuth, webhooks, send, and backfill.
 */

import { assertFeatureAvailable, FeatureUnavailableError } from './featureAvailability.ts';
import type { FeatureAvailabilityKey } from './featureAvailabilityCatalog.ts';
import { encryptMetaInboxToken } from './metaInboxCrypto.ts';
import {
  META_GRAPH_BASE,
  getMetaOAuthScopes,
  META_WEBHOOK_SUBSCRIBED_FIELDS,
  getMetaAppCredentials,
  metaInboxOAuthRedirectUri,
} from './metaInboxConfig.ts';
import type { SocialChannelConnectionRow, SocialPlatform } from './socialInboxTypes.ts';
import { upsertChannelConnection } from './socialInboxDb.ts';
import {
  getPageAccessToken,
  parseMetaGraphJson,
  subscribeMetaPageWebhooks,
} from './metaInboxGraphHttp.ts';

export { getPageAccessToken, parseMetaGraphJson, subscribeMetaPageWebhooks };

export type MetaPageAccount = {
  id: string;
  name: string;
  access_token: string;
  picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string };
};

export async function exchangeMetaCodeForToken(code: string): Promise<{
  access_token: string;
  token_type?: string;
  expires_in?: number;
}> {
  const { appId, appSecret } = getMetaAppCredentials();
  const redirectUri = metaInboxOAuthRedirectUri();
  const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);
  const res = await fetch(url.toString());
  const json = await parseMetaGraphJson(res);
  if (!res.ok || !json.access_token) {
    throw new Error(
      (json.error as { message?: string } | undefined)?.message ?? 'Meta token exchange failed'
    );
  }
  return json as { access_token: string; token_type?: string; expires_in?: number };
}

export async function exchangeMetaLongLivedUserToken(shortLivedToken: string): Promise<string> {
  const { appId, appSecret } = getMetaAppCredentials();
  const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', shortLivedToken);
  const res = await fetch(url.toString());
  const json = await parseMetaGraphJson(res);
  if (!res.ok || !json.access_token) {
    throw new Error(
      (json.error as { message?: string } | undefined)?.message ??
        'Meta long-lived token exchange failed'
    );
  }
  return json.access_token as string;
}

export async function fetchMetaUserPages(userAccessToken: string): Promise<MetaPageAccount[]> {
  const url = new URL(`${META_GRAPH_BASE}/me/accounts`);
  url.searchParams.set('fields', 'id,name,access_token,picture,instagram_business_account');
  url.searchParams.set('access_token', userAccessToken);
  const res = await fetch(url.toString());
  const json = await parseMetaGraphJson(res);
  if (!res.ok) {
    throw new Error(
      (json.error as { message?: string } | undefined)?.message ?? 'Failed to fetch Meta pages'
    );
  }
  return (json.data ?? []) as MetaPageAccount[];
}

export async function fetchMetaIgProfile(
  igUserId: string,
  pageAccessToken: string
): Promise<{ username?: string; profile_picture_url?: string }> {
  const url = new URL(`${META_GRAPH_BASE}/${igUserId}`);
  url.searchParams.set('fields', 'username,profile_picture_url');
  url.searchParams.set('access_token', pageAccessToken);
  const res = await fetch(url.toString());
  const json = await parseMetaGraphJson(res);
  if (!res.ok) return {};
  return json as { username?: string; profile_picture_url?: string };
}

export async function unsubscribeMetaPageWebhooks(
  pageId: string,
  pageAccessToken: string
): Promise<void> {
  const url = new URL(`${META_GRAPH_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set('access_token', pageAccessToken);
  await fetch(url.toString(), { method: 'DELETE' });
}

/** Display label from Graph user fields — IG often has `username` and no `name`. */
export function formatMetaParticipantDisplayName(opts: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): string | null {
  const fullName = opts.name?.trim() || '';
  const first = opts.firstName?.trim() || '';
  const last = opts.lastName?.trim() || '';
  const composed = fullName || [first, last].filter(Boolean).join(' ').trim();
  if (composed) return composed;
  const username = opts.username?.trim().replace(/^@/, '') || '';
  return username ? `@${username}` : null;
}

const IG_PROFILE_FIELDS = 'name,username,profile_pic';
const MESSENGER_PROFILE_FIELDS = 'first_name,last_name,name,profile_pic';

function profileFromGraphUser(json: Record<string, unknown>): {
  name: string | null;
  profilePic: string | null;
} {
  const name = formatMetaParticipantDisplayName({
    name: typeof json.name === 'string' ? json.name : null,
    firstName: typeof json.first_name === 'string' ? json.first_name : null,
    lastName: typeof json.last_name === 'string' ? json.last_name : null,
    username: typeof json.username === 'string' ? json.username : null,
  });
  const profilePic = typeof json.profile_pic === 'string' ? json.profile_pic : null;
  return { name, profilePic };
}

function isMissingMessengerNameFields(message: string | undefined): boolean {
  if (!message) return false;
  return /nonexisting field \((first_name|last_name)\)/i.test(message);
}

/**
 * Resolve Messenger / Instagram DM sender display name from PSID / IGSID.
 * Instagram User Profile rejects Messenger-only fields like `first_name`.
 */
export async function fetchMetaMessengerParticipantProfile(
  psid: string,
  pageAccessToken: string,
  platform: SocialPlatform = 'facebook'
): Promise<{ name: string | null; profilePic: string | null }> {
  const fieldSets =
    platform === 'instagram' ? [IG_PROFILE_FIELDS] : [MESSENGER_PROFILE_FIELDS, IG_PROFILE_FIELDS];

  try {
    for (let i = 0; i < fieldSets.length; i++) {
      const fields = fieldSets[i]!;
      const url = new URL(`${META_GRAPH_BASE}/${psid}`);
      url.searchParams.set('fields', fields);
      url.searchParams.set('access_token', pageAccessToken);
      const res = await fetch(url.toString());
      const json = await parseMetaGraphJson(res);
      if (res.ok) return profileFromGraphUser(json);

      const msg = (json.error as { message?: string } | undefined)?.message;
      const canRetryIgFields = i < fieldSets.length - 1 && isMissingMessengerNameFields(msg);
      if (canRetryIgFields) continue;

      console.warn('[fetchMetaMessengerParticipantProfile]', msg ?? res.status);
      return { name: null, profilePic: null };
    }
    return { name: null, profilePic: null };
  } catch (e) {
    console.warn('[fetchMetaMessengerParticipantProfile]', (e as Error).message);
    return { name: null, profilePic: null };
  }
}

export type PersistMetaPageScope = {
  propertyId?: string | null;
  parkingId?: string | null;
};

async function assertMetaPageAvailable(
  pageId: string,
  opts: { orgId: string; propertyId?: string | null; parkingId?: string | null }
): Promise<void> {
  const sb = (await import('./socialInboxDb.ts')).socialInboxDb();
  const { data, error } = await sb
    .from('social_channel_connections')
    .select('id, organization_id, property_id, parking_id')
    .eq('meta_page_id', pageId)
    .eq('platform', 'facebook')
    .eq('status', 'connected')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;

  const sameOrg = data.organization_id === opts.orgId;
  const sameProperty =
    opts.propertyId != null && data.property_id === opts.propertyId && !data.parking_id;
  const sameParking =
    opts.parkingId != null && data.parking_id === opts.parkingId && !data.property_id;
  const sameOrgDefault =
    !opts.propertyId && !opts.parkingId && !data.property_id && !data.parking_id && sameOrg;

  if (sameOrgDefault || sameProperty || sameParking) return;
  throw new Error('This Facebook Page is already connected to another inbox');
}

export async function persistMetaPageConnection(
  orgId: string,
  page: MetaPageAccount,
  scope: PersistMetaPageScope = {}
): Promise<{ facebook: SocialChannelConnectionRow; instagram: SocialChannelConnectionRow | null }> {
  const propertyId = scope.propertyId ?? null;
  const parkingId = scope.parkingId ?? null;
  if (propertyId && parkingId) {
    throw new Error('Cannot set both property and parking scope on a Meta connection');
  }

  await assertMetaPageAvailable(page.id, { orgId, propertyId, parkingId });

  const encrypted = await encryptMetaInboxToken(page.access_token);
  const scopeFields = {
    property_id: propertyId,
    parking_id: parkingId,
  };

  const facebook = await upsertChannelConnection({
    organization_id: orgId,
    platform: 'facebook',
    external_account_id: page.id,
    display_name: page.name,
    profile_image_url: page.picture?.data?.url ?? null,
    encrypted_access_token: encrypted,
    meta_page_id: page.id,
    status: 'connected',
    webhook_subscribed_at: null,
    last_sync_at: null,
    error_message: null,
    ...scopeFields,
  });

  let instagram: SocialChannelConnectionRow | null = null;
  const igId = page.instagram_business_account?.id;
  if (igId) {
    const igProfile = await fetchMetaIgProfile(igId, page.access_token);
    instagram = await upsertChannelConnection({
      organization_id: orgId,
      platform: 'instagram',
      external_account_id: igId,
      display_name: igProfile.username ? `@${igProfile.username}` : 'Instagram',
      profile_image_url: igProfile.profile_picture_url ?? null,
      encrypted_access_token: encrypted,
      meta_page_id: page.id,
      meta_ig_user_id: igId,
      status: 'connected',
      webhook_subscribed_at: null,
      last_sync_at: null,
      error_message: null,
      ...scopeFields,
    });
  }

  const { reconcileMetaConnectionWebhook } = await import('./metaInboxWebhookHealth.ts');
  await reconcileMetaConnectionWebhook(facebook);

  return { facebook, instagram };
}

export type MetaMessageSendResult =
  { ok: true; message_id: string } | { ok: false; code: 'feature_unavailable'; message: string };

export async function sendMetaMessage(opts: {
  pageId: string;
  pageAccessToken: string;
  recipientId: string;
  text: string;
  platform: SocialPlatform;
  replyToMid?: string;
  tag?: 'HUMAN_AGENT';
  /** Defaults to `inbox.meta.reply`. Auto-reply passes `inbox.meta.auto_reply`. */
  availabilityKey?: FeatureAvailabilityKey;
}): Promise<MetaMessageSendResult> {
  const availabilityKey = opts.availabilityKey ?? 'inbox.meta.reply';
  try {
    await assertFeatureAvailable(availabilityKey);
  } catch (err) {
    if (err instanceof FeatureUnavailableError) {
      return { ok: false, code: 'feature_unavailable', message: err.message };
    }
    throw err;
  }

  const url = new URL(`${META_GRAPH_BASE}/${opts.pageId}/messages`);
  url.searchParams.set('access_token', opts.pageAccessToken);

  const body: Record<string, unknown> = {
    recipient: { id: opts.recipientId },
    message: { text: opts.text },
    messaging_type: opts.tag ? 'MESSAGE_TAG' : 'RESPONSE',
  };
  if (opts.tag) {
    body.tag = opts.tag;
  }
  if (opts.replyToMid) {
    body.reply_to = { mid: opts.replyToMid };
  }

  const json = await postMetaJsonWithRetry(url, body, 'Failed to send Meta message');
  return { ok: true, message_id: json.message_id as string };
}

/** Fetch attachment metadata for a single message (media-only rows from backfill). */
export async function fetchMetaMessageAttachments(
  messageId: string,
  pageAccessToken: string
): Promise<unknown[]> {
  const url = new URL(`${META_GRAPH_BASE}/${messageId}`);
  url.searchParams.set(
    'fields',
    'attachments{type,mime_type,name,image_data,video_data,file_url,payload}'
  );
  url.searchParams.set('access_token', pageAccessToken);
  const res = await fetch(url);
  const json = await parseMetaGraphJson(res);
  if (!res.ok) {
    const msg = (json.error as { message?: string } | undefined)?.message;
    console.warn('[fetchMetaMessageAttachments]', messageId, msg ?? res.status);
    return [];
  }
  const attachments = json.attachments as { data?: unknown[] } | undefined;
  return attachments?.data ?? [];
}

export type MetaConversationItem = {
  id: string;
  updated_time?: string;
  participants?: {
    data?: Array<{ id: string; name?: string; username?: string; email?: string }>;
  };
  messages?: {
    data?: Array<{
      id: string;
      message?: string;
      created_time?: string;
      from?: { id: string; name?: string; username?: string };
      attachments?: { data?: unknown[] };
    }>;
  };
};

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!normalized || normalized.length % 2 !== 0) return new Uint8Array();
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const pair = normalized.slice(i * 2, i * 2 + 2);
    const value = Number.parseInt(pair, 16);
    if (Number.isNaN(value)) return new Uint8Array();
    bytes[i] = value;
  }
  return bytes;
}

function shouldRetryMetaPostStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function postMetaJsonWithRetry(
  url: URL,
  body: Record<string, unknown>,
  errorFallback: string
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(errorFallback);
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
      continue;
    }

    const json = (await res.json()) as Record<string, unknown>;
    if (res.ok) return json;

    const message =
      (json.error as { message?: string } | undefined)?.message ??
      `${errorFallback} (${res.status})`;
    if (!shouldRetryMetaPostStatus(res.status)) {
      throw new Error(message);
    }
    lastError = new Error(message);

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error(errorFallback);
}

const META_MESSAGE_FIELDS =
  'id,message,created_time,from,attachments{type,mime_type,name,image_data,video_data,file_url,payload}';

export function buildMetaConversationsUrl(
  pageId: string,
  pageAccessToken: string,
  platform: 'messenger' | 'instagram',
  opts?: { light?: boolean }
): string {
  const url = new URL(`${META_GRAPH_BASE}/${pageId}/conversations`);
  url.searchParams.set('platform', platform);
  const msgLimit = opts?.light ? 3 : 10;
  const fields = `id,updated_time,participants{id,name,username},messages.limit(${msgLimit}){${META_MESSAGE_FIELDS}}`;
  url.searchParams.set('fields', fields);
  url.searchParams.set('limit', opts?.light ? '25' : '50');
  url.searchParams.set('access_token', pageAccessToken);
  return url.toString();
}

export async function fetchMetaConversationsPage(
  pageId: string,
  pageAccessToken: string,
  platform: 'messenger' | 'instagram',
  nextUrl?: string | null,
  opts?: { light?: boolean }
): Promise<{ conversations: MetaConversationItem[]; nextUrl: string | null }> {
  const url = nextUrl ?? buildMetaConversationsUrl(pageId, pageAccessToken, platform, opts);
  const res = await fetch(url);
  const json = await parseMetaGraphJson(res);
  if (!res.ok) {
    const msg =
      (json.error as { message?: string } | undefined)?.message ?? `Meta API error (${res.status})`;
    throw new Error(msg);
  }
  const paging = json.paging as { next?: string } | undefined;
  return {
    conversations: (json.data ?? []) as MetaConversationItem[],
    nextUrl: paging?.next ?? null,
  };
}

export async function backfillMetaConversations(
  pageId: string,
  pageAccessToken: string,
  platform: 'messenger' | 'instagram',
  opts?: { maxPages?: number }
): Promise<MetaConversationItem[]> {
  const all: MetaConversationItem[] = [];
  const maxPages = opts?.maxPages ?? Number.POSITIVE_INFINITY;
  let pagesFetched = 0;
  let nextUrl: string | null = null;

  do {
    const page = await fetchMetaConversationsPage(pageId, pageAccessToken, platform, nextUrl);
    all.push(...page.conversations);
    pagesFetched += 1;
    nextUrl = pagesFetched < maxPages ? page.nextUrl : null;
  } while (nextUrl);

  return all;
}

export async function verifyMetaWebhookSignatureAsync(
  rawBody: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const { appSecret } = getMetaAppCredentials();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const got = new Uint8Array(sig);
  const expected = hexToBytes(signatureHeader.slice('sha256='.length));
  return timingSafeEqual(got, expected);
}

export function buildMetaOAuthUrl(state: string): string {
  const { appId } = getMetaAppCredentials();
  const redirectUri = metaInboxOAuthRedirectUri();
  const url = new URL(`https://www.facebook.com/v21.0/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', getMetaOAuthScopes());
  url.searchParams.set('response_type', 'code');
  return url.toString();
}
