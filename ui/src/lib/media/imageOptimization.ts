/**
 * imageOptimization — downscale + re-encode an image in a Web Worker before it
 * is uploaded. Runs client-side so Storage never receives the bloated original,
 * the network payload is smaller, and the main thread never blocks.
 *
 * Contract:
 *  - `optimizeImage` NEVER rejects for an image problem. Every failure path
 *    (decode fail, encode fail, worker unavailable, result larger, aborted,
 *    non-image, animated, kill-switched) resolves with `{ file: <original> }`
 *    and a `path` describing what happened.
 *  - The returned `File` always has a `name` + `type` that agree (the extension
 *    is rewritten when the format changes, e.g. `photo.png` → `photo.webp`).
 *  - It never upscales and never returns a file larger than the input.
 *
 * Quality rationale (long edges, formats, gates) lives in
 * `docs/workflow/planned/image-video-upload-optimization.md` §8–§9. The pure
 * decision logic is in `imageOptimizationPlan.ts` (unit-tested).
 */

// Self-hosted copy of the library, loaded by the worker via `importScripts`.
// Prevents the default CDN fetch (CSP / offline safe) and is cache-busted.
// `?url` yields only a string — no JS enters the module graph here.
import bicLibUrl from 'browser-image-compression/dist/browser-image-compression.js?url';

import {
  headerHasAlpha,
  isProbablyAnimated,
  planOptimization,
  renameExtension,
  type OptimizePreset,
} from '@/lib/media/imageOptimizationPlan';
import {
  emitMediaOptimization,
  type MediaOptimizationEvent,
  type MediaOptimizationPath,
} from '@/lib/media/mediaTelemetry';

// Type only — erased at build time, so the runtime `import()` in
// `loadImageCompression` stays the single (lazy) reference that pulls the
// library into its own chunk (plan §10.6).
import type imageCompressionFn from 'browser-image-compression';

export type { OptimizePreset } from '@/lib/media/imageOptimizationPlan';

const OPTIMIZATION_DISABLED = import.meta.env.VITE_DISABLE_IMAGE_OPTIMIZATION === '1';

/**
 * `browser-image-compression` (~50 KB + a bundled worker) is loaded on demand —
 * only once a plan actually calls for a re-encode — so it never lands in the
 * initial/vendor chunk (plan §10.6). The promise is memoized after first use.
 */
let imageCompressionPromise: Promise<typeof imageCompressionFn> | null = null;
function loadImageCompression(): Promise<typeof imageCompressionFn> {
  if (!imageCompressionPromise) {
    imageCompressionPromise = import('browser-image-compression').then((m) => m.default);
  }
  return imageCompressionPromise;
}

export function isOptimizationDisabled(): boolean {
  return OPTIMIZATION_DISABLED;
}

export interface OptimizeOptions {
  /** Short surface id for telemetry, e.g. `property-media`, `guest-form-valid-id`. */
  surface: string;
  /** Abort a stale in-flight optimization (rapid re-pick). */
  signal?: AbortSignal;
  /** Progress 0..100 from the encoder (optional UI hook). */
  onProgress?: (progress: number) => void;
}

export interface OptimizeResult {
  /** The file to upload — optimized, or the untouched original on any fallback. */
  file: File;
  /** `true` only when `file` is a newly produced, smaller image. */
  optimized: boolean;
  path: MediaOptimizationPath;
  inputBytes: number;
  outputBytes: number;
  durationMs: number;
}

const PASSTHROUGH_PATH: Record<string, MediaOptimizationPath> = {
  disabled: 'passthrough-disabled',
  'preset-none': 'skipped',
  nonimage: 'passthrough-nonimage',
  animated: 'passthrough-animated',
  skipped: 'skipped',
};

export async function optimizeImage(
  file: File,
  preset: OptimizePreset,
  options: OptimizeOptions
): Promise<OptimizeResult> {
  const startedAt = now();
  const inputMime = (file.type || '').toLowerCase();
  let sourceWidth: number | null = null;
  let sourceHeight: number | null = null;

  const finish = (
    outFile: File,
    path: MediaOptimizationPath,
    extra?: { outputWidth?: number | null; outputHeight?: number | null; errorName?: string }
  ): OptimizeResult => {
    const durationMs = now() - startedAt;
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const event: MediaOptimizationEvent = {
      surface: options.surface,
      preset,
      path,
      inputBytes: file.size,
      outputBytes: outFile.size,
      ratio: file.size > 0 ? outFile.size / file.size : 1,
      inputMime,
      outputMime: (outFile.type || '').toLowerCase(),
      inputWidth: sourceWidth,
      inputHeight: sourceHeight,
      outputWidth: extra?.outputWidth ?? null,
      outputHeight: extra?.outputHeight ?? null,
      durationMs,
      errorName: extra?.errorName,
      deviceMemory: (nav as unknown as { deviceMemory?: number })?.deviceMemory,
      hardwareConcurrency: nav?.hardwareConcurrency,
    };
    emitMediaOptimization(event);
    return {
      file: outFile,
      optimized: path === 'optimized',
      path,
      inputBytes: file.size,
      outputBytes: outFile.size,
      durationMs,
    };
  };

  if (options.signal?.aborted) return finish(file, 'aborted');

  // Cheap, DOM-free gates first (kill switch, preset NONE, obvious non-images).
  const quickPlan = planOptimization({
    preset,
    mime: inputMime,
    sizeBytes: file.size,
    sourceLongEdge: 1, // placeholder — only the pre-decode branches are consulted here
    hasAlpha: false,
    animated: false,
    disabled: OPTIMIZATION_DISABLED,
  });
  if (quickPlan.action === 'passthrough' && quickPlan.reason !== 'skipped') {
    return finish(file, PASSTHROUGH_PATH[quickPlan.reason] ?? 'skipped');
  }

  // Read a header slice for alpha + animation detection.
  let header = new Uint8Array(0);
  try {
    header = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
  } catch {
    header = new Uint8Array(0);
  }
  if (isProbablyAnimated(inputMime, header)) {
    return finish(file, 'passthrough-animated');
  }
  const hasAlpha = headerHasAlpha(inputMime, header);

  // Probe dimensions (also the decode-capability check — HEIC on Chrome throws).
  try {
    const size = await probeImageSize(file, options.signal);
    sourceWidth = size.width;
    sourceHeight = size.height;
  } catch (err) {
    if (isAbort(err)) return finish(file, 'aborted');
    return finish(file, 'passthrough-decode-fail', { errorName: errName(err) });
  }

  const plan = planOptimization({
    preset,
    mime: inputMime,
    sizeBytes: file.size,
    sourceLongEdge: Math.max(sourceWidth, sourceHeight),
    hasAlpha,
    animated: false,
    disabled: OPTIMIZATION_DISABLED,
  });

  if (plan.action === 'decode-failed') {
    return finish(file, 'passthrough-decode-fail', { errorName: 'zero-dimension' });
  }
  if (plan.action === 'passthrough') {
    return finish(file, PASSTHROUGH_PATH[plan.reason] ?? 'skipped');
  }

  let compressed: File;
  try {
    const imageCompression = await loadImageCompression();
    compressed = await imageCompression(file, {
      maxWidthOrHeight: plan.targetLongEdge,
      initialQuality: plan.quality,
      useWebWorker: true,
      libURL: bicLibUrl,
      fileType: plan.fileType,
      alwaysKeepResolution: false,
      preserveExif: false,
      signal: options.signal,
      onProgress: options.onProgress,
    });
  } catch (err) {
    if (isAbort(err)) return finish(file, 'aborted');
    return finish(file, 'error', { errorName: errName(err) });
  }

  const finalName = renameExtension(file.name || 'image', plan.extension);
  const finalType = compressed.type || plan.fileType || inputMime;
  const out = new File([compressed], finalName, { type: finalType, lastModified: Date.now() });

  if (out.size >= file.size) {
    return finish(file, 'passthrough-larger');
  }

  let outSize: { width: number; height: number } | null = null;
  try {
    outSize = await probeImageSize(out, options.signal);
  } catch {
    outSize = null;
  }
  if (
    outSize &&
    Math.max(outSize.width, outSize.height) > Math.max(sourceWidth, sourceHeight) + 1
  ) {
    // Encoder somehow upscaled — reject.
    return finish(file, 'passthrough-larger');
  }

  return finish(out, 'optimized', {
    outputWidth: outSize?.width ?? null,
    outputHeight: outSize?.height ?? null,
  });
}

async function probeImageSize(
  file: File,
  signal?: AbortSignal
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    if (signal) {
      signal.addEventListener('abort', () => img.removeAttribute('src'), { once: true });
    }
    await img.decode();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) throw new Error('decode produced zero dimensions');
    return { width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function errName(err: unknown): string {
  if (err instanceof Error) return err.name || 'Error';
  return 'Unknown';
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
