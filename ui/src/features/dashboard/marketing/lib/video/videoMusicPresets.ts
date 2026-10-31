import type { JamendoTrack } from '@/features/dashboard/marketing/hooks/useMarketingMusic';
import { isJamendoStreamUrl } from '@/features/dashboard/marketing/lib/video/importVideoMusic';
import type { VideoProjectMusic } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { VIDEO_MUSIC_DEFAULT_VOLUME } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

export { VIDEO_MUSIC_DEFAULT_VOLUME };

/** User cleared music — do not auto-apply the default track again. */
export const VIDEO_MUSIC_CLEARED_TRACK_ID = '';

/** Default background track for new video templates (Jamendo Trending #2 — Joystock). */
export const DEFAULT_VIDEO_MUSIC: VideoProjectMusic = {
  title: 'Lofi Chillout Hip Hop Beat',
  artist: 'Joystock',
  source: 'jamendo',
  url: null,
  volume: VIDEO_MUSIC_DEFAULT_VOLUME,
};

export function matchDefaultJamendoTrack(tracks: JamendoTrack[]): JamendoTrack | null {
  const titleNeedle = DEFAULT_VIDEO_MUSIC.title!.toLowerCase();
  const artistNeedle = DEFAULT_VIDEO_MUSIC.artist!.toLowerCase();

  return (
    tracks.find((track) => {
      const title = track.title.toLowerCase();
      const artist = track.artist.toLowerCase();
      return (
        artist === artistNeedle &&
        (title === titleNeedle || title.startsWith('lofi chillout hip hop'))
      );
    }) ?? null
  );
}

export function needsVideoMusicResolution(music: VideoProjectMusic | undefined): boolean {
  if (!music || music.trackId === VIDEO_MUSIC_CLEARED_TRACK_ID) return false;
  if (!music.url) return true;
  if (music.source === 'jamendo' && isJamendoStreamUrl(music.url)) return true;
  return false;
}

export function needsVideoMusicPlayback(music: VideoProjectMusic | undefined): boolean {
  if (!music || music.trackId === VIDEO_MUSIC_CLEARED_TRACK_ID) return false;
  if (music.url) return false;
  if (music.trackId) return true;

  // Jamendo cue with title/artist (or the default track) — resolve from browse/search.
  if (music.source === 'jamendo' && (music.title || music.artist)) {
    return true;
  }

  if (music.title === DEFAULT_VIDEO_MUSIC.title && music.artist === DEFAULT_VIDEO_MUSIC.artist) {
    return true;
  }

  if (music.trackId === undefined && !music.title && !music.source) {
    return true;
  }

  return false;
}

export function needsVideoMusicStorageCache(music: VideoProjectMusic | undefined): boolean {
  if (!music || music.trackId === VIDEO_MUSIC_CLEARED_TRACK_ID) return false;
  return music.source === 'jamendo' && isJamendoStreamUrl(music.url);
}

/** @deprecated Use needsVideoMusicResolution */
export function isDefaultVideoMusicPending(music: VideoProjectMusic | undefined): boolean {
  return needsVideoMusicPlayback(music) || needsVideoMusicStorageCache(music);
}

export function defaultProjectMusic(music: VideoProjectMusic | undefined): VideoProjectMusic {
  if (!music || music.trackId === VIDEO_MUSIC_CLEARED_TRACK_ID) {
    if (music?.url) return music;
    if (music?.trackId === VIDEO_MUSIC_CLEARED_TRACK_ID) {
      return { url: null, volume: music.volume ?? VIDEO_MUSIC_DEFAULT_VOLUME, trackId: '' };
    }
  }

  if (music?.url || music?.trackId || music?.title) {
    return {
      ...DEFAULT_VIDEO_MUSIC,
      ...music,
      volume: music.volume ?? VIDEO_MUSIC_DEFAULT_VOLUME,
    };
  }

  return { ...DEFAULT_VIDEO_MUSIC };
}
