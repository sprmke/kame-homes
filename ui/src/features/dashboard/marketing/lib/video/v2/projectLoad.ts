/**
 * Loading and building v2 projects for the editor, plus the default-music hand-off.
 *
 * v1 templates carry a music cue without a URL until the editor resolves the Joystock track.
 * The v1 to v2 migration drops a URL-less cue (an audio clip needs a file), so the cue is
 * returned separately as `pendingMusic` and turned into an audio clip once it resolves.
 */

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { migrateVideoProjectV1 } from '@/features/dashboard/marketing/lib/video/v2/migrateVideoProjectV1';
import { parseVideoProjectV2 } from '@/features/dashboard/marketing/lib/video/v2/parseVideoProjectV2';
import {
  createTrack,
  normalizeProject,
} from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import { projectDurationInFrames } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  isAudioItem,
  type AudioItem,
  type VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import {
  needsVideoMusicPlayback,
  needsVideoMusicStorageCache,
} from '@/features/dashboard/marketing/lib/video/videoMusicPresets';
import {
  buildDefaultVideoProject,
  parseVideoProject,
} from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';
import {
  VIDEO_MUSIC_DEFAULT_VOLUME,
  type VideoFormat,
  type VideoProjectMusic,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

export const MUSIC_ITEM_ID = 'music';

export type LoadedProjectV2 = {
  project: VideoProjectV2;
  /** A music cue that still needs a file; resolve it, then call `withResolvedMusic`. */
  pendingMusic: VideoProjectMusic | undefined;
};

function pendingFrom(music: VideoProjectMusic | undefined): VideoProjectMusic | undefined {
  if (!music) return undefined;
  return needsVideoMusicPlayback(music) || needsVideoMusicStorageCache(music) ? music : undefined;
}

function isRec(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Saved row to project. v1 rows migrate; a v2 row never has a pending cue. */
export function loadProjectV2(
  raw: unknown,
  templateId: string,
  category: string,
  binding: DesignBinding,
  format: VideoFormat
): LoadedProjectV2 {
  const project = parseVideoProjectV2(raw, templateId, category, binding, format);
  if (isRec(raw) && raw.version === 2) return { project, pendingMusic: undefined };
  const v1 = parseVideoProject(raw, templateId, category, binding, format);
  return { project, pendingMusic: pendingFrom(v1.music) };
}

export function buildDefaultProjectV2(
  templateId: string,
  category: string,
  binding: DesignBinding,
  format: VideoFormat
): LoadedProjectV2 {
  const v1 = buildDefaultVideoProject(templateId, category, binding, format);
  return { project: migrateVideoProjectV1(v1), pendingMusic: pendingFrom(v1.music) };
}/**
 * Put the resolved track on the project as the looping `music` clip, replacing an earlier
 * version of it. A track with no URL leaves the project untouched.
 */
export function withResolvedMusic(
  project: VideoProjectV2,
  music: VideoProjectMusic | undefined,
  options: { addIfMissing?: boolean } = {}
): VideoProjectV2 {
  const url = music?.url?.trim();
  if (!music || !url) return project;
  const addIfMissing = options.addIfMissing ?? true;
  const total = projectDurationInFrames(project);
  const next: AudioItem = {
    id: MUSIC_ITEM_ID,
    type: 'audio',
    from: 0,
    durationInFrames: total,
    label: music.title,
    media: { url, source: music.source ?? 'upload' },
    volume: music.volume ?? VIDEO_MUSIC_DEFAULT_VOLUME,
    loop: true,
    title: music.title,
    artist: music.artist,
    trackId: music.trackId,
  };

  let replaced = false;
  const tracks = project.tracks.map((track) => {
    if (track.kind !== 'audio') return track;
    const items = track.items.map((item) => {
      if (!isAudioItem(item) || item.id !== MUSIC_ITEM_ID) return item;
      replaced = true;
      // Keep the host's volume and span; only the file and its credit change.
      return {
        ...item,
        media: next.media,
        label: next.label,
        title: next.title,
        artist: next.artist,
        trackId: next.trackId,
      };
    });
    return replaced ? { ...track, items } : track;
  });
  if (replaced) return normalizeProject({ ...project, tracks });
  // The host removed the clip while the cached copy was still downloading: leave it removed.
  if (!addIfMissing) return project;
  return normalizeProject({ ...project, tracks: [...tracks, createTrack('audio', [next])] });
}

/** The `music` clip as a v1 music cue (what the Jamendo resolver and importer understand). */
export function musicClipAsCue(item: AudioItem): VideoProjectMusic {
  return {
    url: item.media.url,
    volume: item.volume,
    title: item.title,
    artist: item.artist,
    source: item.media.source === 'jamendo' ? 'jamendo' : 'upload',
    trackId: item.trackId,
  };
}
