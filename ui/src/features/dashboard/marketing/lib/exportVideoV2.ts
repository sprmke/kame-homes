import { canRenderMediaOnWeb, renderMediaOnWeb } from '@remotion/web-renderer';

import {
  CampaignVideoCompositionV2,
  type VideoCompositionV2Props,
} from '@/features/dashboard/marketing/components/video-editor/VideoCompositionV2';
import {
  collectExportMedia,
  exportBlockers,
  exportRenderOptions,
  findUnreachableMedia,
  type ExportMediaRef,
} from '@/features/dashboard/marketing/lib/video/v2/exportPreflight';
import { projectDurationInFrames } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import type { VideoProjectV2 } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { VIDEO_FORMAT_DIMENSIONS } from '@/features/dashboard/marketing/lib/video/videoFormatDimensions';

import { captureError } from '@/lib/sentry/capture';

export type VideoExportErrorCode =
  'blocked' | 'unsupported' | 'unreachable' | 'cancelled' | 'failed';

export class VideoExportError extends Error {
  readonly code: VideoExportErrorCode;
  constructor(code: VideoExportErrorCode, message: string) {
    super(message);
    this.name = 'VideoExportError';
    this.code = code;
  }
}

export type VideoExportPhase = 'checking' | 'rendering';

export type ExportVideoV2Input = {
  project: VideoProjectV2;
  inputProps: Omit<VideoCompositionV2Props, 'project'>;
  signal?: AbortSignal;
  onPhase?: (phase: VideoExportPhase) => void;
  /** 0..1 while rendering. */
  onProgress?: (progress: number) => void;
};

const PROBE_TIMEOUT_MS = 10_000;

async function probeUrl(ref: ExportMediaRef, signal?: AbortSignal): Promise<{ ok: boolean }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    // A 1-byte ranged GET works on every storage origin and still proves CORS is open.
    const response = await fetch(ref.url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal,
      cache: 'no-store',
    });
    void response.body?.cancel();
    return { ok: response.ok || response.status === 206 };
  } catch {
    return { ok: false };
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function describeUnreachable(failed: ExportMediaRef[]): string {
  const kinds = new Set(failed.map((ref) => ref.kind));
  const what =
    kinds.size === 1
      ? ({ image: 'photo', video: 'video', audio: 'audio file' }[[...kinds][0]!] ?? 'file')
      : 'file';
  return failed.length === 1
    ? `One ${what} can't be loaded. Replace or remove it, then try again.`
    : `${failed.length} files can't be loaded. Replace or remove them, then try again.`;
}

/**
 * Render a v2 project to MP4 in the browser.
 *
 * 1. Blocks empty or over-long projects.
 * 2. Asks the browser whether it can encode this size (WebCodecs, codecs, WebGL).
 * 3. Checks every media file is reachable, so a bad link fails fast instead of at 80%.
 * 4. Renders with `strictMedia` (a failing file aborts) and honours `signal` for Cancel.
 */
export async function exportVideoV2(input: ExportVideoV2Input): Promise<Blob> {
  const { project, signal } = input;
  const throwIfCancelled = () => {
    if (signal?.aborted) throw new VideoExportError('cancelled', 'Export cancelled');
  };

  const blockers = exportBlockers(project);
  if (blockers.length > 0) throw new VideoExportError('blocked', blockers[0]!.message);

  const dims = VIDEO_FORMAT_DIMENSIONS[project.format];
  const { muted } = exportRenderOptions(project);

  input.onPhase?.('checking');
  const support = await canRenderMediaOnWeb({
    container: 'mp4',
    width: dims.width,
    height: dims.height,
    muted,
  });
  if (!support.canRender) {
    throw new VideoExportError(
      'unsupported',
      'This browser cannot export video. Try the latest Chrome or Edge on a computer.'
    );
  }
  throwIfCancelled();

  const refs = collectExportMedia(project);
  const failed = await findUnreachableMedia(refs, (ref) => probeUrl(ref, signal), { signal });
  throwIfCancelled();
  if (failed.length > 0) throw new VideoExportError('unreachable', describeUnreachable(failed));

  input.onPhase?.('rendering');
  const durationInFrames = projectDurationInFrames(project);
  const props: VideoCompositionV2Props = {
    ...input.inputProps,
    project,
    previewMuted: false,
    strictMedia: true,
  };

  try {
    const result = await renderMediaOnWeb({
      composition: {
        id: project.templateId,
        component: CampaignVideoCompositionV2,
        width: dims.width,
        height: dims.height,
        fps: project.fps,
        durationInFrames,
        defaultProps: props,
      },
      inputProps: props,
      container: 'mp4',
      muted,
      // `free-license` or a company license key. Unset logs Remotion's licence reminder.
      licenseKey: import.meta.env.VITE_REMOTION_LICENSE_KEY?.trim() || null,
      signal: signal ?? null,
      onProgress: (progress) => input.onProgress?.(progress.progress),
    });
    return await result.getBlob();
  } catch (error) {
    // Cancelling is a user decision, not a fault.
    if (signal?.aborted) throw new VideoExportError('cancelled', 'Export cancelled');
    console.error('Video export error:', error);
    captureError(error, {
      level: 'warning',
      tags: { media_export: 'video_v2' },
      fingerprint: ['media_export', 'video_v2'],
    });
    throw new VideoExportError('failed', 'Video export failed. Try again.');
  }
}
