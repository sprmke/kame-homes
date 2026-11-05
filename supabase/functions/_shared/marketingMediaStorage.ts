/**
 * Marketing media library storage helpers (pure where possible).
 *
 * Bucket `marketing-media` (public). Content-addressed layout:
 *   {propertyId}/{assetId}/original.{ext}
 *   {propertyId}/{assetId}/poster.jpg
 * Plan: docs/workflow/for-testing/marketing-video-editor-multitrack.md §5.4.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import type { PlanMarketingMediaLibrary } from './planFeatures.ts';
import { sniffAudioMime } from './marketingMusicStorage.ts';
import { sniffVisualMime } from './marketingGenerationStorage.ts';

export const MARKETING_MEDIA_BUCKET = 'marketing-media';
export const MARKETING_MEDIA_CACHE_CONTROL = '31536000';
/** Signed upload URLs from Supabase Storage live 2 hours. */
const MARKETING_MEDIA_SIGNED_UPLOAD_TTL_SEC = 2 * 60 * 60;
/** Bytes read from the head of an object at finalize (magic bytes + `ftyp`/`moov` often fit). */
const MARKETING_MEDIA_SNIFF_BYTES = 64 * 1024;
/** Pending reservations older than this are expired by the sweeper. */
export const MARKETING_MEDIA_PENDING_TTL_MS = 3 * 60 * 60 * 1000;
export const MARKETING_MEDIA_DELETE_RETENTION_DAYS = 7;

export type MarketingMediaKind = 'image' | 'video' | 'audio';

export type MarketingMediaLimitCode =
  'storage_full' | 'too_many_files' | 'file_too_large' | 'video_too_long' | 'daily_limit';

const MB = 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
};

export function normalizeMime(mime: string): string {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  if (base === 'audio/mp3') return 'audio/mpeg';
  if (base === 'audio/x-wav') return 'audio/wav';
  if (base === 'audio/x-m4a') return 'audio/mp4';
  return base;
}

export function isAllowedMarketingMediaMime(mime: string): boolean {
  return normalizeMime(mime) in MIME_EXTENSIONS;
}

export function kindForMime(mime: string): MarketingMediaKind | null {
  const base = normalizeMime(mime);
  if (!(base in MIME_EXTENSIONS)) return null;
  if (base.startsWith('image/')) return 'image';
  if (base.startsWith('video/')) return 'video';
  return 'audio';
}

export function extensionForMarketingMime(mime: string): string {
  return MIME_EXTENSIONS[normalizeMime(mime)] ?? 'bin';
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export function marketingMediaOriginalPath(propertyId: string, assetId: string, ext: string) {
  return `${propertyId}/${assetId}/original.${ext.replace(/^\./, '')}`;
}

export function marketingMediaPosterPath(propertyId: string, assetId: string) {
  return `${propertyId}/${assetId}/poster.jpg`;
}

/** Plan allowance → the numeric limits object consumed by `reserve_marketing_media_upload`. */
export function reserveLimitsFor(
  kind: MarketingMediaKind,
  lib: PlanMarketingMediaLibrary
): Record<string, number> {
  const maxMb =
    kind === 'image' ? lib.maxImageMb : kind === 'video' ? lib.maxVideoMb : lib.maxAudioMb;
  return {
    storageBytes: Math.floor(lib.storageMb * MB),
    maxFiles: lib.maxFiles,
    maxFileBytes: Math.floor(maxMb * MB),
    maxVideoSec: lib.maxVideoSec,
    dailyUploads: lib.dailyUploads,
  };
}

const LIMIT_MESSAGES: Record<MarketingMediaLimitCode, (lib: PlanMarketingMediaLibrary) => string> =
  {
    storage_full: (lib) =>
      `You've used all ${formatMb(lib.storageMb)} of media storage. Delete files or upgrade.`,
    too_many_files: (lib) =>
      `You can keep ${lib.maxFiles} files in your library. Delete some or upgrade.`,
    file_too_large: () =>
      'This file is larger than your plan allows. Use a smaller file or upgrade.',
    video_too_long: (lib) =>
      `This video is longer than ${lib.maxVideoSec} seconds. Trim it or upgrade for longer clips.`,
    daily_limit: (lib) =>
      `You can upload ${lib.dailyUploads} files a day on your plan. Try again tomorrow.`,
  };

function formatMb(mb: number): string {
  return mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${mb} MB`;
}

export function isMarketingMediaLimitCode(value: unknown): value is MarketingMediaLimitCode {
  return typeof value === 'string' && value in LIMIT_MESSAGES;
}

export function limitMessage(code: MarketingMediaLimitCode, lib: PlanMarketingMediaLimitsLike) {
  return LIMIT_MESSAGES[code](lib);
}

type PlanMarketingMediaLimitsLike = PlanMarketingMediaLibrary;

/**
 * Detect the real type from magic bytes. M4A shares the ISO `ftyp` box with MP4/MOV,
 * so the major brand decides audio vs video.
 */
export function sniffMarketingMedia(
  bytes: Uint8Array
): { mime: string; kind: MarketingMediaKind } | null {
  if (bytes.byteLength >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!).toLowerCase();
    if (brand.startsWith('m4a') || brand.startsWith('m4b')) {
      return { mime: 'audio/mp4', kind: 'audio' };
    }
  }

  const visual = sniffVisualMime(bytes);
  if (visual && visual !== 'application/octet-stream') {
    const kind = kindForMime(visual);
    if (kind) {
      // WebM can be audio-only, but we cannot tell from magic bytes; treat as video.
      return { mime: normalizeMime(visual), kind };
    }
  }

  const audio = sniffAudioMime(bytes);
  if (audio) {
    const kind = kindForMime(audio);
    if (kind) return { mime: normalizeMime(audio), kind };
  }
  return null;
}

/**
 * The bytes must be an allowed type and agree with what the client declared.
 * Returns the sniffed mime (the stored content type) or throws a host-readable error.
 */
export function assertUploadMatchesBytes(
  bytes: Uint8Array,
  declaredKind: MarketingMediaKind,
  declaredMime: string
): { mime: string; kind: MarketingMediaKind } {
  const sniffed = sniffMarketingMedia(bytes);
  if (!sniffed) {
    throw new Error('File must be a JPEG, PNG, WebP, HEIC, MP4, MOV, WebM, or common audio file');
  }
  if (sniffed.kind !== declaredKind) {
    // A WebM declared as audio is allowed (container cannot be told from magic bytes).
    const webmAudio = sniffed.mime === 'video/webm' && declaredKind === 'audio';
    if (!webmAudio) throw new Error('File contents do not match its type');
  }
  const declared = normalizeMime(declaredMime);
  if (declared && declared !== 'application/octet-stream') {
    const declaredType = kindForMime(declared);
    if (declaredType && declaredType !== declaredKind) {
      throw new Error('File contents do not match its type');
    }
  }
  return sniffed.mime === 'video/webm' && declaredKind === 'audio'
    ? { mime: 'audio/webm', kind: 'audio' }
    : sniffed;
}

/**
 * Walk top-level ISO BMFF boxes in `bytes` for `moov/mvhd` and return the movie duration in ms.
 * Returns null when the head slice does not contain the `moov` box (common for non-faststart
 * files), or the box is malformed. Pure; never throws.
 */
export function parseMp4DurationMs(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readType = (o: number) =>
    String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!);

  function findBox(start: number, end: number, wanted: string): [number, number] | null {
    let offset = start;
    while (offset + 8 <= end) {
      let size = view.getUint32(offset);
      const type = readType(offset + 4);
      let header = 8;
      if (size === 1) {
        if (offset + 16 > end) return null;
        const hi = view.getUint32(offset + 8);
        const lo = view.getUint32(offset + 12);
        size = hi * 2 ** 32 + lo;
        header = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      if (size < header) return null;
      if (type === wanted) return [offset + header, Math.min(offset + size, end)];
      offset += size;
    }
    return null;
  }

  try {
    const moov = findBox(0, bytes.byteLength, 'moov');
    if (!moov) return null;
    const mvhd = findBox(moov[0], moov[1], 'mvhd');
    if (!mvhd) return null;
    const [start, end] = mvhd;
    const version = bytes[start];
    let timescale: number;
    let duration: number;
    if (version === 1) {
      if (start + 32 > end) return null;
      timescale = view.getUint32(start + 20);
      duration = view.getUint32(start + 24) * 2 ** 32 + view.getUint32(start + 28);
    } else {
      if (start + 20 > end) return null;
      timescale = view.getUint32(start + 12);
      duration = view.getUint32(start + 16);
    }
    if (!timescale || !Number.isFinite(duration)) return null;
    return Math.round((duration / timescale) * 1000);
  } catch {
    return null;
  }
}

function publicMarketingMediaUrl(sb: SupabaseClient, path: string): string {
  return sb.storage.from(MARKETING_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function createMarketingMediaSignedUpload(
  sb: SupabaseClient,
  path: string
): Promise<{ uploadUrl: string; token: string; path: string }> {
  const { data, error } = await sb.storage.from(MARKETING_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create upload URL');
  }
  return { uploadUrl: data.signedUrl, token: data.token, path: data.path };
}

/** Size + mime recorded by Storage for an object (authoritative, not the client's claim). */
export async function statMarketingMediaObject(
  sb: SupabaseClient,
  path: string
): Promise<{ size: number; mimeType: string } | null> {
  const slash = path.lastIndexOf('/');
  const dir = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const { data, error } = await sb.storage
    .from(MARKETING_MEDIA_BUCKET)
    .list(dir, { search: name, limit: 5 });
  if (error || !data) return null;
  const hit = data.find((o: { name: string }) => o.name === name) as
    { metadata?: { size?: number; mimetype?: string } | null } | undefined;
  const size = hit?.metadata?.size;
  if (!hit || typeof size !== 'number') return null;
  return { size, mimeType: hit.metadata?.mimetype ?? '' };
}

/** Download the first `MARKETING_MEDIA_SNIFF_BYTES` of an object with a Range request. */
export async function readMarketingMediaHead(
  sb: SupabaseClient,
  path: string,
  fetchImpl: typeof fetch = fetch
): Promise<Uint8Array | null> {
  const url = publicMarketingMediaUrl(sb, path);
  const res = await fetchImpl(url, {
    headers: { Range: `bytes=0-${MARKETING_MEDIA_SNIFF_BYTES - 1}` },
  });
  if (!res.ok && res.status !== 206) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  return buf.byteLength > MARKETING_MEDIA_SNIFF_BYTES
    ? buf.subarray(0, MARKETING_MEDIA_SNIFF_BYTES)
    : buf;
}

export async function removeMarketingMediaObjects(
  sb: SupabaseClient,
  paths: Array<string | null | undefined>
): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length === 0) return;
  const { error } = await sb.storage.from(MARKETING_MEDIA_BUCKET).remove(list);
  if (error) console.warn('[marketing-media] remove failed', error.message);
}

const ROUTES = new Set(['usage', 'used-in', 'reserve', 'finalize', 'abandon', 'restore']);

/**
 * `/marketing-media/reserve` (hosted and `functions serve`) or `/reserve` (direct run): the last
 * segment names the route; anything else is the collection root. Unknown names fall through to
 * the 404 in `permissionFor`.
 */
export function routeFromPath(pathname: string): string {
  const last = pathname.split('/').filter(Boolean).at(-1) ?? '';
  if (last === 'marketing-media') return '';
  return ROUTES.has(last) ? last : last === '' ? '' : `unknown:${last}`;
}

const PEAKS_B64 = /^[A-Za-z0-9+/]{4,1400}={0,2}$/;

/** Accept a client waveform only as compact base64 bytes (one byte per peak, at most 1000). */
export function parsePeaksBase64(value: unknown): string | null {
  if (typeof value !== 'string' || !PEAKS_B64.test(value) || value.length % 4 !== 0) return null;
  return value;
}

/** Stored base64 peaks → 0..1 numbers (three decimals). Null for anything malformed. */
export function decodePeaks(value: unknown): number[] | null {
  const b64 = parsePeaksBase64(value);
  if (!b64) return null;
  try {
    return Array.from(atob(b64), (c) => Math.round((c.charCodeAt(0) / 255) * 1000) / 1000);
  } catch {
    return null;
  }
}
