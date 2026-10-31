import type {
  ImportedMarketingMusic,
  JamendoTrack,
} from '@/features/dashboard/marketing/hooks/useMarketingMusic';
import { VIDEO_MUSIC_DEFAULT_VOLUME } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { VideoProjectMusic } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export function isJamendoStreamUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return /jamendo\.com/i.test(url);
}

export function videoMusicFromJamendoTrack(
  track: JamendoTrack,
  music: VideoProjectMusic
): VideoProjectMusic {
  return {
    ...music,
    title: track.title,
    artist: track.artist,
    source: 'jamendo',
    trackId: track.id,
    url: track.streamUrl,
    volume: music.volume ?? VIDEO_MUSIC_DEFAULT_VOLUME,
  };
}

export function findJamendoTrackForMusic(
  tracks: JamendoTrack[],
  music: VideoProjectMusic
): JamendoTrack | null {
  if (music.trackId && music.trackId.length > 0) {
    const byId = tracks.find((track) => track.id === music.trackId);
    if (byId) return byId;
  }

  const titleNeedle = music.title?.trim().toLowerCase();
  const artistNeedle = music.artist?.trim().toLowerCase();
  if (!titleNeedle && !artistNeedle) return null;

  const exact =
    tracks.find((track) => {
      const title = track.title.toLowerCase();
      const artist = track.artist.toLowerCase();
      const titleOk = !titleNeedle || title === titleNeedle || title.includes(titleNeedle);
      const artistOk = !artistNeedle || artist === artistNeedle || artist.includes(artistNeedle);
      return titleOk && artistOk;
    }) ?? null;
  if (exact) return exact;

  if (artistNeedle) {
    return tracks.find((track) => track.artist.toLowerCase().includes(artistNeedle)) ?? null;
  }
  return null;
}

export function applyImportedVideoMusic(
  music: VideoProjectMusic,
  imported: ImportedMarketingMusic
): VideoProjectMusic {
  return {
    ...music,
    url: imported.url,
    title: imported.title ?? music.title,
    artist: imported.artist ?? music.artist,
    source: imported.source,
    trackId: imported.trackId ?? music.trackId,
  };
}

async function importJamendoTrackOnServer(
  propertyId: string,
  trackId: string
): Promise<ImportedMarketingMusic> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('marketing-music', propertyId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'import-jamendo', trackId }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: ImportedMarketingMusic;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Could not import track');
  }
  return json.data;
}

/**
 * Cache a Jamendo track to property Storage via the edge function.
 * Browser fetch of Jamendo stream URLs is CORS-blocked — never fetch them client-side.
 */
export async function importJamendoTrackViaUpload(
  track: JamendoTrack,
  music: VideoProjectMusic,
  propertyId: string
): Promise<VideoProjectMusic> {
  const imported = await importJamendoTrackOnServer(propertyId, track.id);
  return {
    ...applyImportedVideoMusic(music, imported),
    title: track.title,
    artist: track.artist,
    source: 'jamendo',
    trackId: track.id,
  };
}

/**
 * Remotion web export cannot read Jamendo CDN audio (CORS). Ensure the project
 * music URL is a same-origin/Storage URL before `renderMediaOnWeb`.
 */
export async function ensureVideoMusicForExport(
  music: VideoProjectMusic | undefined,
  propertyId: string | null
): Promise<{ music: VideoProjectMusic | undefined; strippedJamendo: boolean }> {
  if (!music?.url || !isJamendoStreamUrl(music.url)) {
    return { music, strippedJamendo: false };
  }

  const trackId = music.trackId?.trim();
  if (!propertyId || !trackId) {
    return {
      music: { ...music, url: null },
      strippedJamendo: true,
    };
  }

  try {
    const imported = await importJamendoTrackOnServer(propertyId, trackId);
    return {
      music: {
        ...applyImportedVideoMusic(music, imported),
        source: 'jamendo',
        trackId,
      },
      strippedJamendo: false,
    };
  } catch {
    return {
      music: { ...music, url: null },
      strippedJamendo: true,
    };
  }
}
