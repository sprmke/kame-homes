/**
 * Pure export checks for a v2 project. No DOM, no network: the caller supplies `probe`.
 *
 * Export runs in the browser and a media file it cannot read fails the whole render, so we find
 * unreachable files first and say which clip they belong to.
 */

import { isRenderableMediaUrl } from '@/features/dashboard/marketing/lib/video/v2/clipStyles';
import { projectHasAudio } from '@/features/dashboard/marketing/lib/video/v2/editorCommands';
import {
  allItems,
  contentEndFrame,
  mainTrackOf,
} from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  VIDEO_V2_LIMITS,
  isAudioItem,
  isLayerItem,
  isMediaItem,
  type VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

export type ExportBlockCode = 'empty' | 'too_long';

export type ExportBlock = { code: ExportBlockCode; message: string };

/** Hard stops before any work starts. The server re-checks length on save. */
export function exportBlockers(project: VideoProjectV2): ExportBlock[] {
  const out: ExportBlock[] = [];
  if (mainTrackOf(project).items.length === 0) {
    out.push({ code: 'empty', message: 'Add a photo or video to the timeline first.' });
  }
  if (contentEndFrame(project) > VIDEO_V2_LIMITS.maxDurationFrames) {
    out.push({ code: 'too_long', message: 'This video is longer than 60 seconds. Trim it first.' });
  }
  return out;
}

export type ExportMediaRef = { itemId: string; url: string; kind: 'image' | 'video' | 'audio' };

/** Every remote file the render will fetch. Hidden and muted tracks are skipped. */
export function collectExportMedia(project: VideoProjectV2): ExportMediaRef[] {
  const out: ExportMediaRef[] = [];
  const seen = new Set<string>();
  const push = (itemId: string, url: string | null | undefined, kind: ExportMediaRef['kind']) => {
    if (!isRenderableMediaUrl(url)) return;
    const key = `${kind}:${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ itemId, url, kind });
  };
  for (const track of project.tracks) {
    if (track.hidden) continue;
    for (const item of track.items) {
      if (isMediaItem(item)) push(item.id, item.media.url, item.type);
      else if (isAudioItem(item)) {
        if (!track.muted && item.volume > 0) push(item.id, item.media.url, 'audio');
      } else if (isLayerItem(item)) push(item.id, item.layer.imageUrl, 'image');
    }
  }
  return out;
}

/** Items that should show media but have none (deleted asset, empty slot). */
export function itemsMissingMedia(project: VideoProjectV2): string[] {
  return allItems(project)
    .filter((item) => (isMediaItem(item) || isAudioItem(item)) && !item.media.url.trim())
    .map((item) => item.id);
}

export type ProbeResult = { ok: boolean };

/**
 * Check every file with a bounded number of parallel probes. Returns the refs that failed.
 * `probe` should resolve (never reject) with `ok: false` for unreachable files.
 */
export async function findUnreachableMedia(
  refs: ExportMediaRef[],
  probe: (ref: ExportMediaRef) => Promise<ProbeResult>,
  options: { concurrency?: number; signal?: AbortSignal } = {}
): Promise<ExportMediaRef[]> {
  const concurrency = Math.max(1, options.concurrency ?? 6);
  const failed: ExportMediaRef[] = [];
  let next = 0;
  const worker = async () => {
    while (next < refs.length) {
      if (options.signal?.aborted) return;
      const ref = refs[next++]!;
      let ok = false;
      try {
        ok = (await probe(ref)).ok;
      } catch {
        ok = false;
      }
      if (!ok) failed.push(ref);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, refs.length) }, worker));
  return refs.filter((ref) => failed.includes(ref));
}

/** Render options derived from the project: mute when nothing can make sound. */
export function exportRenderOptions(project: VideoProjectV2): { muted: boolean } {
  return { muted: !projectHasAudio(project) };
}
