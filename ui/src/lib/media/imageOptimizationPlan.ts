/**
 * imageOptimizationPlan — the pure decision core of `optimizeImage`.
 *
 * Given only facts about the source file (no DOM, no worker), decide what should
 * happen: pass through, skip, or re-encode at a target long edge + format. Kept
 * DOM-free so it is exhaustively unit-testable and reusable by the offline
 * quality-check script.
 */

import { UPLOAD_MAX_BYTES } from '@/lib/media/uploadLimits';

export type OptimizePreset = 'PHOTO_MASTER' | 'CONTENT' | 'AVATAR' | 'DOCUMENT' | 'NONE';

export type PlanPassthroughReason =
  'disabled' | 'preset-none' | 'nonimage' | 'animated' | 'skipped';

export interface PlanInput {
  preset: OptimizePreset;
  /** Lowercased MIME, e.g. `image/jpeg`. */
  mime: string;
  sizeBytes: number;
  /** Longest side in px, or `null` if it could not be decoded. */
  sourceLongEdge: number | null;
  hasAlpha: boolean;
  animated: boolean;
  /** Kill switch (`VITE_DISABLE_IMAGE_OPTIMIZATION`). */
  disabled?: boolean;
}

export type Plan =
  | { action: 'passthrough'; reason: PlanPassthroughReason }
  | { action: 'decode-failed' }
  | {
      action: 'reencode';
      targetLongEdge: number;
      /** `undefined` → keep the source format. */
      fileType: string | undefined;
      extension: string;
      /** Quality 0..1, or `undefined` for lossless (PNG). */
      quality: number | undefined;
    };

interface PresetConfig {
  maxLongEdge: number;
  minLongEdge: number;
  quality: number;
  format: 'webp' | 'keep';
  alreadyGoodBytes: number;
}

export const PRESET_CONFIGS: Record<Exclude<OptimizePreset, 'NONE'>, PresetConfig> = {
  PHOTO_MASTER: {
    maxLongEdge: 3840,
    minLongEdge: 1600,
    quality: 0.82,
    format: 'webp',
    alreadyGoodBytes: 900 * 1024,
  },
  CONTENT: {
    maxLongEdge: 2048,
    minLongEdge: 1024,
    quality: 0.82,
    format: 'webp',
    alreadyGoodBytes: 400 * 1024,
  },
  AVATAR: {
    maxLongEdge: 512,
    minLongEdge: 256,
    quality: 0.85,
    format: 'webp',
    alreadyGoodBytes: 120 * 1024,
  },
  DOCUMENT: {
    maxLongEdge: 3000,
    minLongEdge: 1400,
    quality: 0.9,
    format: 'keep',
    // Leave a document untouched only while it is under the hard ceiling; past
    // that it must be re-encoded down even if its pixel dimensions are fine.
    alreadyGoodBytes: UPLOAD_MAX_BYTES.document,
  },
};

const COMPRESSIBLE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/bmp',
  'image/tiff',
]);

export function normalizeMime(mime: string): string {
  const m = (mime || '').toLowerCase();
  return m === 'image/jpg' ? 'image/jpeg' : m;
}

export function extensionForMime(mime: string): string {
  switch (normalizeMime(mime)) {
    case 'image/webp':
      return '.webp';
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/avif':
      return '.avif';
    case 'image/heic':
      return '.heic';
    case 'image/heif':
      return '.heif';
    default:
      return '.img';
  }
}

/** Replace (or append) the final extension on a filename, preserving any path. */
export function renameExtension(name: string, extWithDot: string): string {
  const trimmed = (name || '').trim() || 'image';
  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  const dir = slash >= 0 ? trimmed.slice(0, slash + 1) : '';
  const base = slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `${dir}${stem}${extWithDot}`;
}

export function planOptimization(input: PlanInput): Plan {
  if (input.disabled) return { action: 'passthrough', reason: 'disabled' };
  if (input.preset === 'NONE') return { action: 'passthrough', reason: 'preset-none' };

  const mime = normalizeMime(input.mime);
  if (!mime.startsWith('image/') || mime === 'image/svg+xml' || mime === 'image/gif') {
    return { action: 'passthrough', reason: 'nonimage' };
  }
  if (!COMPRESSIBLE_MIME.has(mime)) {
    return { action: 'passthrough', reason: 'nonimage' };
  }
  if (input.animated) {
    return { action: 'passthrough', reason: 'animated' };
  }
  if (input.sourceLongEdge === null || input.sourceLongEdge <= 0) {
    return { action: 'decode-failed' };
  }

  const cfg = PRESET_CONFIGS[input.preset];

  let targetLongEdge = Math.min(input.sourceLongEdge, cfg.maxLongEdge);
  if (targetLongEdge < cfg.minLongEdge && input.sourceLongEdge >= cfg.minLongEdge) {
    targetLongEdge = cfg.minLongEdge;
  }
  const needsDownscale = targetLongEdge < input.sourceLongEdge;

  // Skip re-encoding an image that is already both right-sized and small enough.
  // For DOCUMENT `alreadyGoodBytes` is the hard ceiling, so an over-ceiling
  // document still falls through to a re-encode.
  if (!needsDownscale && input.sizeBytes <= cfg.alreadyGoodBytes) {
    return { action: 'passthrough', reason: 'skipped' };
  }

  const output = decideOutput(input.preset, mime, input.hasAlpha);
  return {
    action: 'reencode',
    targetLongEdge,
    fileType: output.fileType,
    extension: output.extension,
    quality: output.fileType === 'image/png' ? undefined : cfg.quality,
  };
}

function decideOutput(
  preset: OptimizePreset,
  sourceMime: string,
  hasAlpha: boolean
): { fileType: string | undefined; extension: string } {
  if (preset === 'DOCUMENT') {
    return { fileType: normalizeMime(sourceMime), extension: extensionForMime(sourceMime) };
  }
  if (preset === 'AVATAR' && hasAlpha) {
    return { fileType: 'image/png', extension: '.png' };
  }
  return { fileType: 'image/webp', extension: '.webp' };
}

/** PNG alpha via IHDR colour type (4/6) or a palette `tRNS` chunk. */
export function headerHasAlpha(mime: string, header: Uint8Array): boolean {
  if (normalizeMime(mime) !== 'image/png' || header.length < 26) return false;
  const colourType = header[25];
  if (colourType === 4 || colourType === 6) return true;
  return indexOfAscii(header, 'tRNS', 8) !== -1;
}

/** APNG (`acTL`) / animated WebP (`ANIM`). GIF is handled as non-image upstream. */
export function isProbablyAnimated(mime: string, header: Uint8Array): boolean {
  if (header.length === 0) return false;
  const m = normalizeMime(mime);
  if (m === 'image/png') return indexOfAscii(header, 'acTL', 8) !== -1;
  if (m === 'image/webp') return indexOfAscii(header, 'ANIM', 12) !== -1;
  return false;
}

export function indexOfAscii(bytes: Uint8Array, needle: string, from = 0): number {
  const n = needle.length;
  const limit = bytes.length - n;
  for (let i = Math.max(0, from); i <= limit; i += 1) {
    let match = true;
    for (let j = 0; j < n; j += 1) {
      if (bytes[i + j] !== needle.charCodeAt(j)) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}
