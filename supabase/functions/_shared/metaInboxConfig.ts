/** Meta Graph API version and env helpers for social inbox. */

import { publicApiBaseUrl } from './publicApiBaseUrl.ts';

export const META_GRAPH_VERSION = 'v21.0';

export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

/** Guest Inbox — always requested on Meta OAuth connect. */
export const META_INBOX_OAUTH_SCOPES = [
  'pages_messaging',
  'pages_manage_metadata',
  'pages_read_engagement',
  'pages_show_list',
  'instagram_manage_messages',
  'business_management',
] as const;

/**
 * Marketing Content Studio publishing — included in OAuth by default.
 * Requires matching Meta app use cases; see docs/archive/operations/meta-app-review.md.
 * Set META_OAUTH_EXCLUDE_PUBLISHING_SCOPES=1 to omit while configuring the Meta app.
 */
export const META_PUBLISHING_SCOPES = [
  'pages_manage_posts',
  'instagram_content_publish',
  'instagram_basic',
] as const;

function parseExtraOAuthScopes(): string[] {
  const raw = Deno.env.get('META_OAUTH_EXTRA_SCOPES')?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Build OAuth scope list — inbox + publishing by default. */
export function getMetaOAuthScopes(): string {
  const excludePublishing = Deno.env.get('META_OAUTH_EXCLUDE_PUBLISHING_SCOPES')?.trim() === '1';
  const scopes = new Set<string>([...META_INBOX_OAUTH_SCOPES, ...META_PUBLISHING_SCOPES]);
  if (excludePublishing) {
    for (const scope of META_PUBLISHING_SCOPES) scopes.delete(scope);
  }
  for (const scope of parseExtraOAuthScopes()) scopes.add(scope);
  return [...scopes].join(',');
}

/** Page-level subscribed_apps fields for Messenger/Instagram DM delivery. */
export const META_WEBHOOK_SUBSCRIBED_FIELDS = [
  'messages',
  'messaging_postbacks',
  'message_deliveries',
  'message_reads',
  'message_echoes',
].join(',');

export function getMetaAppCredentials(): { appId: string; appSecret: string } {
  const appId = Deno.env.get('META_APP_ID')?.trim();
  const appSecret = Deno.env.get('META_APP_SECRET')?.trim();
  if (!appId || !appSecret) {
    throw new Error('Missing META_APP_ID or META_APP_SECRET');
  }
  return { appId, appSecret };
}

/**
 * Public Supabase API base for Meta OAuth redirect + webhook URLs.
 * Meta requires HTTPS — for local dev set `PUBLIC_API_URL` (or `SUPABASE_PUBLIC_URL`) to ngrok.
 */
export function metaInboxPublicBaseUrl(): string {
  return publicApiBaseUrl();
}

export function metaInboxOAuthRedirectUri(): string {
  return `${metaInboxPublicBaseUrl()}/functions/v1/meta-inbox-oauth-callback`;
}

export function metaWebhookVerifyToken(): string {
  const token = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN')?.trim();
  if (!token) throw new Error('Missing META_WEBHOOK_VERIFY_TOKEN');
  return token;
}

export function parseMetaOAuthAllowedReturnOrigins(): string[] {
  const raw = Deno.env.get('META_OAUTH_ALLOWED_RETURN_ORIGINS')?.trim();
  if (raw) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ['http://127.0.0.1:5173', 'http://localhost:5173'];
}

export function isMetaReturnOriginAllowed(origin: string): boolean {
  const allowed = parseMetaOAuthAllowedReturnOrigins();
  return allowed.some((a) => a === origin);
}

export function sanitizeMetaReturnPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/inbox';
  return trimmed.split('?')[0] || '/inbox';
}

export function buildMetaOAuthSuccessRedirect(origin: string, returnPath: string): string {
  const sep = returnPath.includes('?') ? '&' : '?';
  return `${origin}${returnPath}${sep}meta_inbox=connected`;
}

export function buildMetaOAuthPickerRedirect(
  origin: string,
  returnPath: string,
  pickerState: string
): string {
  const sep = returnPath.includes('?') ? '&' : '?';
  return `${origin}${returnPath}${sep}meta_inbox=select_page&meta_picker=${encodeURIComponent(pickerState)}`;
}

export function buildMetaOAuthErrorRedirect(
  origin: string,
  returnPath: string,
  code: string
): string {
  const sep = returnPath.includes('?') ? '&' : '?';
  return `${origin}${returnPath}${sep}meta_inbox_error=${encodeURIComponent(code)}`;
}
