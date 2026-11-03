/**
 * Pure rules for the Marketing media library: what a picked file is, whether the plan allows it,
 * and whether a video needs re-encoding before upload. No DOM, no network.
 *
 * Limit order and copy mirror the server (`reserve_marketing_media_upload`, `limitMessage`), so a
 * local pre-check fails with the same message the server would send.
 */

import type { PlanMarketingMediaLibrary } from '@/features/dashboard/plans/lib/planFeatures';
import type {
  MarketingMediaKind,
  MarketingMediaLimitCode,
  MarketingMediaUsage,
} from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';

const MB = 1024 * 1024;

const EXTENSION_KIND: Record<string, MarketingMediaKind> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  heic: 'image',
  heif: 'image',
  avif: 'image',
  gif: 'image',
  mp4: 'video',
  mov: 'video',
  m4v: 'video',
  webm: 'video',
  mp3: 'audio',
  m4a: 'audio',
  aac: 'audio',
  wav: 'audio',
  ogg: 'audio',
};

/** `accept` for the native file picker (images, video and audio). */
export const MARKETING_MEDIA_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  '.heic',
  '.heif',
  '.m4a',
].join(',');

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Kind of a picked file: MIME first (HEIC and MOV often arrive with an empty type), then extension. */
export function kindForFile(file: { name: string; type: string }): MarketingMediaKind | null {
  const mime = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
  if (mime === 'image/svg+xml') return null;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return EXTENSION_KIND[extensionOf(file.name)] ?? null;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * MB) return `${Math.round((bytes / (1024 * MB)) * 10) / 10} GB`;
  if (bytes >= MB) return `${Math.round((bytes / MB) * 10) / 10} MB`;
  return `${Math.max(0, Math.round(bytes / 1024))} KB`;
}

export function formatMb(mb: number): string {
  return mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${mb} MB`;
}

export function limitMessage(
  code: MarketingMediaLimitCode,
  lib: PlanMarketingMediaLibrary
): string {
  switch (code) {
    case 'storage_full':
      return `You've used all ${formatMb(lib.storageMb)} of media storage. Delete files or upgrade.`;
    case 'too_many_files':
      return `You can keep ${lib.maxFiles} files in your library. Delete some or upgrade.`;
    case 'file_too_large':
      return 'This file is larger than your plan allows. Use a smaller file or upgrade.';
    case 'video_too_long':
      return `This video is longer than ${lib.maxVideoSec} seconds. Trim it or upgrade for longer clips.`;
    case 'daily_limit':
      return `You can upload ${lib.dailyUploads} files a day on your plan. Try again tomorrow.`;
  }
}

export type LocalLimitInput = {
  kind: MarketingMediaKind;
  bytes: number;
  durationMs?: number | null;
};

export function maxBytesFor(kind: MarketingMediaKind, lib: PlanMarketingMediaLibrary): number {
  const mb = kind === 'image' ? lib.maxImageMb : kind === 'video' ? lib.maxVideoMb : lib.maxAudioMb;
  return Math.floor(mb * MB);
}

/**
 * First plan limit the file would break, in the same order as the server, or null.
 * `pendingBytes` / `pendingFiles` account for other files already queued in this batch.
 */
export function limitErrorFor(
  input: LocalLimitInput,
  usage: Pick<MarketingMediaUsage, 'usedBytes' | 'files' | 'uploadsToday' | 'limits'>,
  pending: { bytes?: number; files?: number } = {}
): { code: MarketingMediaLimitCode; message: string } | null {
  const lib = usage.limits;
  const fail = (code: MarketingMediaLimitCode) => ({ code, message: limitMessage(code, lib) });

  if (input.bytes > maxBytesFor(input.kind, lib)) return fail('file_too_large');
  if (
    input.kind === 'video' &&
    input.durationMs != null &&
    input.durationMs > lib.maxVideoSec * 1000
  ) {
    return fail('video_too_long');
  }
  if (usage.uploadsToday + (pending.files ?? 0) >= lib.dailyUploads) return fail('daily_limit');
  if (usage.files + (pending.files ?? 0) >= lib.maxFiles) return fail('too_many_files');
  if (usage.usedBytes + (pending.bytes ?? 0) + input.bytes > Math.floor(lib.storageMb * MB)) {
    return fail('storage_full');
  }
  return null;
}

export type StorageLevel = 'ok' | 'warn' | 'full';

/** Meter colour: amber from 80%, red at 100% of either bytes or files. */
export function storageLevel(
  usage: Pick<MarketingMediaUsage, 'usedBytes' | 'files' | 'limits'>
): StorageLevel {
  const byteShare =
    usage.limits.storageMb > 0 ? usage.usedBytes / (usage.limits.storageMb * MB) : 1;
  const fileShare = usage.limits.maxFiles > 0 ? usage.files / usage.limits.maxFiles : 1;
  const share = Math.max(byteShare, fileShare);
  if (share >= 1) return 'full';
  if (share >= 0.8) return 'warn';
  return 'ok';
}

export function meterShare(usage: Pick<MarketingMediaUsage, 'usedBytes' | 'limits'>): number {
  const cap = usage.limits.storageMb * MB;
  return cap > 0 ? Math.min(1, usage.usedBytes / cap) : 1;
}

// ─── Video optimization ─────────────────────────────────────────────────────

export const VIDEO_OPTIMIZE = {
  /** Longest edge after optimization. */
  maxLongEdge: 1920,
  /** Re-encode when the source runs above this. */
  maxBitrate: 10_000_000,
  targetBitrate: 8_000_000,
  audioBitrate: 128_000,
} as const;

export type VideoProbe = {
  /** Mediabunny codec id, e.g. `avc`, `hevc`, `vp9`; null when unknown. */
  codec: string | null;
  width: number;
  height: number;
  /** Average bits per second of the video track, when measurable. */
  bitrate: number | null;
  /** Lowercase container hint: `mp4`, `mov`, `webm`. */
  container: string | null;
};

/** Re-encode unless the file is already H.264 in MP4/MOV, within 1080p and under 10 Mbps. */
export function shouldTranscodeVideo(probe: VideoProbe): boolean {
  if (probe.codec !== 'avc') return true;
  if (Math.max(probe.width, probe.height) > VIDEO_OPTIMIZE.maxLongEdge) return true;
  if (probe.bitrate != null && probe.bitrate > VIDEO_OPTIMIZE.maxBitrate) return true;
  if (probe.container && !['mp4', 'mov', 'm4v'].includes(probe.container)) return true;
  return false;
}

/**
 * True when the codec or container will not play (or export) everywhere. These files are always
 * re-encoded to H.264/MP4, even if the result is larger: a smaller file that fails in Chrome on
 * Windows or in Firefox is worse than a few extra megabytes.
 */
export function needsCompatibilityTranscode(probe: VideoProbe): boolean {
  if (probe.codec !== 'avc') return true;
  return Boolean(probe.container && !['mp4', 'mov', 'm4v'].includes(probe.container));
}

/** Target bitrate: 1.6x a measured source (H.264 needs more than HEVC/VP9), 2.5 to 8 Mbps. */
export function transcodeBitrate(probe: Pick<VideoProbe, 'bitrate'>): number {
  const floor = 2_500_000;
  if (probe.bitrate == null || probe.bitrate <= 0) return VIDEO_OPTIMIZE.targetBitrate;
  return Math.round(Math.min(VIDEO_OPTIMIZE.targetBitrate, Math.max(floor, probe.bitrate * 1.6)));
}

const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);

/** Output size: keep aspect, longest edge at most 1920, even dimensions (H.264 requirement). */
export function transcodeSize(width: number, height: number): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  const scale = longEdge > VIDEO_OPTIMIZE.maxLongEdge ? VIDEO_OPTIMIZE.maxLongEdge / longEdge : 1;
  return { width: even(width * scale), height: even(height * scale) };
}

/** Rough duration cap check used before the (slow) transcode starts. */
export function exceedsVideoLength(durationMs: number, lib: PlanMarketingMediaLibrary): boolean {
  return durationMs > lib.maxVideoSec * 1000;
}

/** Poster size for the library grid and timeline thumbnail (longest edge, px). */
export const POSTER_LONG_EDGE = 480;
export const AUDIO_PEAK_COUNT = 1000;

/** Frame used for the poster: half a second in, or the middle of very short clips. */
export function posterTimestamp(durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  return Math.min(0.5, durationSec / 2);
}

/** Collapse samples into at most `count` normalized 0..1 peaks (max abs per bucket). */
export function bucketPeaks(
  samples: ArrayLike<number>,
  count: number = AUDIO_PEAK_COUNT
): number[] {
  const total = samples.length;
  if (total === 0 || count <= 0) return [];
  const buckets = Math.min(count, total);
  const out = new Array<number>(buckets).fill(0);
  let max = 0;
  for (let i = 0; i < total; i += 1) {
    const b = Math.min(buckets - 1, Math.floor((i / total) * buckets));
    const v = Math.abs(samples[i]!);
    if (v > out[b]!) out[b] = v;
    if (v > max) max = v;
  }
  return max > 0 ? out.map((v) => Math.round((v / max) * 1000) / 1000) : out;
}
