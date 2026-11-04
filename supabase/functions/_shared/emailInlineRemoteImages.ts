/**
 * CID-inline remote images whose host does not match the sending / app origin.
 * Clears Resend "Host images on the sending domain" insights for Storage logos
 * and other off-domain `<img>` / CSS `url()` references in transactional HTML.
 */

import { createClient } from './supabaseJs.ts';
import { parseStorageObjectUrl } from './storageSignedUrl.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';

export type ResendInlineAttachment = {
  filename: string;
  content: string;
  /** Resend expects `base64` for binary parts. */
  encoding: string;
  content_id?: string;
  content_type?: string;
};

export const EMAIL_INLINE_CONTENT_ID_PREFIX = 'email-asset-';

const MAX_INLINE_IMAGES = 12;
const MAX_BYTES_PER_IMAGE = 1_500_000;

function supabaseAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

/** Extract bare email from `Name <user@host>` or `user@host`. */
export function extractEmailAddress(fromHeader: string): string | null {
  const trimmed = fromHeader.trim();
  if (!trimmed) return null;
  const angled = /<([^>]+)>/.exec(trimmed);
  const raw = (angled?.[1] ?? trimmed).trim().toLowerCase();
  if (!raw.includes('@')) return null;
  return raw;
}

export function hostnameFromEmailOrUrl(value: string): string | null {
  const email = extractEmailAddress(value);
  if (email) {
    const host = email.split('@')[1]?.trim().toLowerCase();
    return host || null;
  }
  try {
    return new URL(value).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

function stripWww(host: string): string {
  return host.replace(/^www\./i, '');
}

/** Hosts safe to leave as remote URLs (aligned with From / public app origin). */
export function resolveTrustedEmailImageHosts(fromHeader: string): Set<string> {
  const trusted = new Set<string>();
  const add = (host: string | null | undefined) => {
    const h = host?.trim().toLowerCase();
    if (!h) return;
    trusted.add(h);
    trusted.add(stripWww(h));
    if (!h.startsWith('www.')) trusted.add(`www.${h}`);
  };

  add(hostnameFromEmailOrUrl(fromHeader));
  add(hostnameFromEmailOrUrl(resolvePublicGuestAppOrigin()));

  const fromEnv = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (fromEnv) add(hostnameFromEmailOrUrl(fromEnv));

  return trusted;
}

export function isTrustedEmailImageHost(hostname: string, trustedHosts: Set<string>): boolean {
  const h = hostname.toLowerCase();
  if (trustedHosts.has(h) || trustedHosts.has(stripWww(h))) return true;
  // Images on parent brand domain while From is a subdomain (or the reverse).
  const bare = stripWww(h);
  for (const trusted of trustedHosts) {
    const t = stripWww(trusted);
    if (!t || !bare) continue;
    if (bare === t || bare.endsWith(`.${t}`) || t.endsWith(`.${bare}`)) return true;
  }
  return false;
}

export function collectRemoteImageUrls(html: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const url = raw.trim();
    if (!url || seen.has(url)) return;
    if (/^(cid:|data:)/i.test(url)) return;
    if (!/^https?:\/\//i.test(url)) return;
    seen.add(url);
    found.push(url);
  };

  for (const match of html.matchAll(/\bsrc\s*=\s*(["'])([^"']+)\1/gi)) {
    push(match[2] ?? '');
  }
  for (const match of html.matchAll(/url\(\s*(['"]?)(https?:\/\/[^'")\s]+)\1\s*\)/gi)) {
    push(match[2] ?? '');
  }

  return found;
}

function toBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + chunkSize))));
  }
  return btoa(chunks.join(''));
}

function extensionForContentType(contentType: string): string {
  const base = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (base === 'image/png') return 'png';
  if (base === 'image/webp') return 'webp';
  if (base === 'image/gif') return 'gif';
  if (base === 'image/svg+xml') return 'svg';
  return 'jpg';
}

async function downloadViaStorage(url: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
  filename: string;
} | null> {
  const loc = parseStorageObjectUrl(url);
  if (!loc) return null;
  try {
    const { data, error } = await supabaseAdminClient().storage.from(loc.bucket).download(loc.path);
    if (error || !data) return null;
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES_PER_IMAGE) return null;
    const contentType = data.type?.split(';')[0]?.trim() || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;
    const filename = loc.path.split('/').pop() || `inline.${extensionForContentType(contentType)}`;
    return { bytes, contentType, filename };
  } catch {
    return null;
  }
}

async function downloadViaFetch(url: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
  filename: string;
} | null> {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local') ||
      host === '0.0.0.0'
    ) {
      return null;
    }
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { Accept: 'image/*,*/*;q=0.8' },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES_PER_IMAGE) return null;
    let filename = 'inline.' + extensionForContentType(contentType);
    try {
      const pathName = new URL(url).pathname;
      const last = pathName.split('/').pop();
      if (last && /\.(png|jpe?g|gif|webp|svg)$/i.test(last)) filename = last;
    } catch {
      /* keep default */
    }
    return { bytes, contentType, filename };
  } catch {
    return null;
  }
}

async function downloadImage(url: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
  filename: string;
} | null> {
  const fromStorage = await downloadViaStorage(url);
  if (fromStorage) return fromStorage;
  return downloadViaFetch(url);
}

function replaceAllLiteral(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack;
  return haystack.split(needle).join(replacement);
}

function nextContentId(used: Set<string>, index: number): string {
  let id = `${EMAIL_INLINE_CONTENT_ID_PREFIX}${index}`;
  let n = index;
  while (used.has(id)) {
    n += 1;
    id = `${EMAIL_INLINE_CONTENT_ID_PREFIX}${n}`;
  }
  used.add(id);
  return id;
}

export type InlineRemoteImagesResult = {
  html: string;
  attachments: ResendInlineAttachment[];
  inlinedCount: number;
};

/**
 * Download off-domain image URLs and rewrite them to `cid:` attachments.
 * Fail-open: if a download fails, the original URL stays in the HTML.
 */
export async function inlineRemoteImagesInHtml(
  html: string,
  options: {
    fromHeader: string;
    existingAttachments?: ResendInlineAttachment[];
  }
): Promise<InlineRemoteImagesResult> {
  const trusted = resolveTrustedEmailImageHosts(options.fromHeader);
  const attachments: ResendInlineAttachment[] = [...(options.existingAttachments ?? [])];
  const usedIds = new Set(
    attachments.map((a) => a.content_id).filter((id): id is string => Boolean(id))
  );

  const candidates = collectRemoteImageUrls(html).filter((url) => {
    try {
      const host = new URL(url).hostname;
      return !isTrustedEmailImageHost(host, trusted);
    } catch {
      return false;
    }
  });

  if (candidates.length === 0) {
    return { html, attachments, inlinedCount: 0 };
  }

  let nextHtml = html;
  let inlinedCount = 0;
  let index = 0;

  for (const url of candidates) {
    if (inlinedCount >= MAX_INLINE_IMAGES) break;
    if (!nextHtml.includes(url)) continue;

    const downloaded = await downloadImage(url);
    if (!downloaded) continue;

    const contentId = nextContentId(usedIds, index);
    index += 1;
    attachments.push({
      filename: downloaded.filename,
      content: toBase64(downloaded.bytes),
      encoding: 'base64',
      content_id: contentId,
      content_type: downloaded.contentType,
    });
    nextHtml = replaceAllLiteral(nextHtml, url, `cid:${contentId}`);
    inlinedCount += 1;
  }

  return { html: nextHtml, attachments, inlinedCount };
}
