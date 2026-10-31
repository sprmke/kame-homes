/**
 * prepareImageForUpload — the one call site every image uploader uses right
 * before it builds its request body.
 *
 *   const { file, error } = await prepareImageForUpload(picked, {
 *     preset: 'PHOTO_MASTER', surface: 'property-media', kind: 'image',
 *   });
 *   if (error) { setError(error); return; }
 *   // ...upload `file`
 *
 * It: rejects absurdly large inputs early (before any decode), runs the
 * concurrency-limited optimizer, then re-validates the *result* against the hard
 * ceiling. Never throws — image problems come back as `{ error }` or as an
 * untouched passthrough `file`.
 */

import type { OptimizeResult } from '@/lib/media/imageOptimization';
import type { OptimizePreset } from '@/lib/media/imageOptimizationPlan';
import { runOptimize } from '@/lib/media/optimizeQueue';
import {
  formatMaxBytesError,
  UPLOAD_MAX_BYTES,
  validateUploadFile,
  type UploadLimitKind,
} from '@/lib/media/uploadLimits';

/** Anything larger than this is rejected before we attempt to decode it. */
const PRE_OPTIMIZE_SANITY_BYTES = 75 * 1024 * 1024;

export interface PrepareImageOptions {
  preset: OptimizePreset;
  /** Telemetry surface id. */
  surface: string;
  /** Hard-ceiling group the *result* must satisfy. */
  kind: UploadLimitKind;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

export interface PrepareImageResult {
  /** The file to upload (optimized, or the untouched original). */
  file: File;
  /** `true` when the optimizer produced a new, smaller file. */
  changed: boolean;
  /** Set when the file cannot be uploaded — surface this to the user. */
  error?: string;
  /** Raw optimizer outcome (telemetry / tests). */
  result?: OptimizeResult;
}

export async function prepareImageForUpload(
  file: File,
  options: PrepareImageOptions
): Promise<PrepareImageResult> {
  if (file.size > PRE_OPTIMIZE_SANITY_BYTES) {
    return { file, changed: false, error: formatMaxBytesError(UPLOAD_MAX_BYTES[options.kind]) };
  }

  const result = await runOptimize(file, options.preset, {
    surface: options.surface,
    signal: options.signal,
    onProgress: options.onProgress,
  });

  const finalFile = result.file;
  const validation = validateUploadFile(finalFile, options.kind);
  if (!validation.ok) {
    return { file: finalFile, changed: result.optimized, error: validation.message, result };
  }

  return { file: finalFile, changed: result.optimized, result };
}
