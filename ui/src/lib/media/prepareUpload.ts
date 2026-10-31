/**
 * prepareUpload — front door for any uploader that may receive images, video,
 * or PDF. Routes images through the optimizer (`prepareImageForUpload`) and
 * validates video / PDF against the shared ceiling without touching the bytes.
 *
 *   const { file, error } = await prepareUpload(picked, {
 *     imagePreset: 'PHOTO_MASTER', surface: 'property-media',
 *   });
 *   if (error) { setError(error); return; }
 *   // upload `file`
 */

import type { OptimizePreset } from '@/lib/media/imageOptimizationPlan';
import { isSurfaceOptimizationEnabled } from '@/lib/media/optimizationSurfaces';
import { prepareImageForUpload, type PrepareImageResult } from '@/lib/media/prepareImageForUpload';
import { validateUploadFile, type UploadLimitKind } from '@/lib/media/uploadLimits';

const KIND_FOR_PRESET: Record<OptimizePreset, UploadLimitKind> = {
  PHOTO_MASTER: 'image',
  CONTENT: 'image',
  AVATAR: 'avatar',
  DOCUMENT: 'document',
  NONE: 'image',
};

export interface PrepareUploadOptions {
  /** Preset for the image branch. */
  imagePreset: OptimizePreset;
  surface: string;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

function isVideo(file: File): boolean {
  return (file.type || '').toLowerCase().startsWith('video/');
}

function isPdf(file: File): boolean {
  return (file.type || '').toLowerCase() === 'application/pdf';
}

export async function prepareUpload(
  file: File,
  options: PrepareUploadOptions
): Promise<PrepareImageResult> {
  if (isPdf(file)) {
    const v = validateUploadFile(file, 'pdf');
    return { file, changed: false, error: v.ok ? undefined : v.message };
  }
  if (isVideo(file)) {
    const v = validateUploadFile(file, 'video');
    return { file, changed: false, error: v.ok ? undefined : v.message };
  }
  // Staged rollout (§12): a surface still validates against the ceiling, but
  // only re-encodes once its quality gate is enabled for this build.
  const preset: OptimizePreset = isSurfaceOptimizationEnabled(options.surface)
    ? options.imagePreset
    : 'NONE';

  return prepareImageForUpload(file, {
    preset,
    kind: KIND_FOR_PRESET[options.imagePreset],
    surface: options.surface,
    signal: options.signal,
    onProgress: options.onProgress,
  });
}
