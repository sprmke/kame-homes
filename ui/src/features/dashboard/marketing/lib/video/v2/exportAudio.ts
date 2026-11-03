import {
  ensureVideoMusicForExport,
  isJamendoStreamUrl,
} from '@/features/dashboard/marketing/lib/video/importVideoMusic';
import { musicClipAsCue } from '@/features/dashboard/marketing/lib/video/v2/projectLoad';
import {
  isAudioItem,
  type AudioItem,
  type VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

/** Audio clips still pointing at a Jamendo stream, which the browser export cannot read. */
export function jamendoStreamClips(project: VideoProjectV2): AudioItem[] {
  return project.tracks
    .flatMap((track) => track.items)
    .filter(isAudioItem)
    .filter((item) => isJamendoStreamUrl(item.media.url));
}

/** Swap clip URLs (`string`) or drop clips (`null`). Unlisted clips are untouched. */
export function remapAudioUrls(
  project: VideoProjectV2,
  changes: ReadonlyMap<string, string | null>
): VideoProjectV2 {
  if (changes.size === 0) return project;
  return {
    ...project,
    tracks: project.tracks.map((track) => {
      if (track.kind !== 'audio') return track;
      const items = track.items.flatMap((item) => {
        if (!isAudioItem(item) || !changes.has(item.id)) return [item];
        const url = changes.get(item.id);
        if (url === null || url === undefined) return [];
        return [{ ...item, media: { ...item.media, url } }];
      });
      return { ...track, items };
    }),
  };
}

export type ExportAudioResult = {
  /** What to render. Unreadable Jamendo clips are dropped. */
  project: VideoProjectV2;
  /** Cached copies to keep on the saved project (clip id to Storage URL). */
  cached: Map<string, string>;
  dropped: number;
};

/**
 * Jamendo's CDN blocks browser reads, so each stream clip is cached to Storage first. A clip that
 * cannot be cached is left out of the export (and reported) instead of failing the whole render.
 */
export async function cacheJamendoAudioForExport(
  project: VideoProjectV2,
  propertyId: string | null
): Promise<ExportAudioResult> {
  const clips = jamendoStreamClips(project);
  const cached = new Map<string, string>();
  const changes = new Map<string, string | null>();
  let dropped = 0;
  for (const clip of clips) {
    const { music, strippedJamendo } = await ensureVideoMusicForExport(
      musicClipAsCue(clip),
      propertyId
    );
    if (!strippedJamendo && music?.url) {
      cached.set(clip.id, music.url);
      changes.set(clip.id, music.url);
    } else {
      dropped += 1;
      changes.set(clip.id, null);
    }
  }
  return { project: remapAudioUrls(project, changes), cached, dropped };
}
