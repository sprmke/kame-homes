import { useEffect, useRef } from 'react';

import { useMarketingMusicBrowse } from '@/features/dashboard/marketing/hooks/useMarketingMusic';
import {
  findJamendoTrackForMusic,
  importJamendoTrackViaUpload,
  isJamendoStreamUrl,
  videoMusicFromJamendoTrack,
} from '@/features/dashboard/marketing/lib/video/importVideoMusic';
import {
  DEFAULT_VIDEO_MUSIC,
  matchDefaultJamendoTrack,
  needsVideoMusicPlayback,
  needsVideoMusicStorageCache,
} from '@/features/dashboard/marketing/lib/video/videoMusicPresets';
import type {
  VideoProject,
  VideoProjectMusic,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

/** Updates that are not host edits (see `useVideoProjectHistory().amendProject`). */
type SetProject = (updater: (prev: VideoProject | null) => VideoProject | null) => void;

/**
 * Resolves the default Joystock lofi track for new/legacy templates:
 * 1. Sets Jamendo stream URL immediately so Remotion preview can play.
 * 2. Caches to property-media via edge `import-jamendo` for CORS-safe export URLs.
 */
export function useEnsureDefaultVideoMusic(project: VideoProject | null, setProject: SetProject) {
  const propertyId = usePropertyIdParam();
  const trendingQuery = useMarketingMusicBrowse(propertyId, { order: 'popularity_week' });
  const runningRef = useRef(false);
  const mountedRef = useRef(true);

  const music = project?.music;
  const needsPlayback = needsVideoMusicPlayback(music);
  const needsStorage = needsVideoMusicStorageCache(music);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!project || !propertyId) return;
    if (!needsPlayback && !needsStorage) return;
    if (runningRef.current) return;

    const baseMusic = music ?? DEFAULT_VIDEO_MUSIC;

    void (async () => {
      runningRef.current = true;
      try {
        let tracks = trendingQuery.data?.tracks ?? [];
        if (tracks.length === 0) {
          const refetched = await trendingQuery.refetch();
          tracks = refetched.data?.tracks ?? [];
        }

        let track = findJamendoTrackForMusic(tracks, baseMusic) ?? matchDefaultJamendoTrack(tracks);

        // Recipe music cues may not appear in the trending page — search Jamendo once.
        if (!track && (baseMusic.title || baseMusic.artist)) {
          const q = [baseMusic.artist, baseMusic.title].filter(Boolean).join(' ');
          try {
            const jwt = await getSessionJwt();
            const params = new URLSearchParams({ order: 'relevance', q });
            const res = await fetch(scopedFunctionsUrl(`marketing-music?${params}`, propertyId), {
              headers: { Authorization: `Bearer ${jwt}` },
            });
            const json = (await res.json()) as {
              success?: boolean;
              data?: { tracks?: typeof tracks };
            };
            const searched = json.data?.tracks ?? [];
            track = findJamendoTrackForMusic(searched, baseMusic) ?? searched[0] ?? null;
          } catch {
            // Fall through — leave music unresolved for this pass.
          }
        }

        if (!track) return;

        const resolvedMusic = baseMusic.url
          ? baseMusic
          : videoMusicFromJamendoTrack(track, baseMusic);

        if (needsPlayback && !baseMusic.url && mountedRef.current) {
          setProject((prev) => {
            if (!prev || prev.music?.url || prev.music?.trackId === '') return prev;
            if (!needsVideoMusicPlayback(prev.music)) return prev;
            return { ...prev, music: resolvedMusic };
          });
        }

        const shouldCache = !resolvedMusic.url || isJamendoStreamUrl(resolvedMusic.url);
        if (!shouldCache) return;

        const cachedMusic = await importJamendoTrackViaUpload(track, resolvedMusic, propertyId);
        if (!mountedRef.current || !cachedMusic.url) return;

        setProject((prev) => {
          if (!prev) return prev;
          if (prev.music?.trackId === '') return prev;
          if (prev.music?.url && !isJamendoStreamUrl(prev.music.url)) return prev;
          if (
            prev.music?.trackId &&
            cachedMusic.trackId &&
            prev.music.trackId !== cachedMusic.trackId
          ) {
            return prev;
          }
          return { ...prev, music: cachedMusic };
        });
      } catch {
        // Preview may still work via Jamendo stream URL from step 1.
        // Export calls ensureVideoMusicForExport which retries server import.
      } finally {
        runningRef.current = false;
      }
    })();
  }, [
    propertyId,
    needsPlayback,
    needsStorage,
    music?.trackId,
    music?.url,
    music?.title,
    music?.artist,
    music?.source,
    setProject,
    trendingQuery.data?.tracks,
    trendingQuery.refetch,
  ]);
}

/** Writes a music cue back into the v2 editor (never counted as a host edit). */
export type SetMusic = (
  updater: (prev: VideoProjectMusic | undefined) => VideoProjectMusic | undefined
) => void;

/**
 * v2 counterpart of `useEnsureDefaultVideoMusic`: the track project keeps the unresolved cue
 * aside (`pendingMusic`) instead of owning a `music` field, so resolution hands the cue back
 * through `setMusic`.
 *
 * 1. Jamendo stream URL first, so the Remotion preview can play it.
 * 2. Cached copy in property storage second, so export is CORS-safe.
 *
 * Keyed on the cue itself, so the second pass (after the URL lands) still runs while an
 * already-resolved cue does nothing.
 */
export function useResolveDefaultVideoMusic(
  pendingMusic: VideoProjectMusic | undefined,
  enabled: boolean,
  setMusic: SetMusic
) {
  const propertyId = usePropertyIdParam();
  const trendingQuery = useMarketingMusicBrowse(propertyId, { order: 'popularity_week' });
  const runningRef = useRef(false);
  const settledKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cueKey = pendingMusic
    ? [pendingMusic.trackId ?? '', pendingMusic.title ?? '', pendingMusic.artist ?? '', pendingMusic.url ?? ''].join('|')
    : null;

  useEffect(() => {
    if (!enabled || !pendingMusic || !propertyId || !cueKey) return;
    if (settledKeyRef.current === cueKey) return;
    if (runningRef.current) return;

    const needsPlayback = needsVideoMusicPlayback(pendingMusic);
    const needsStorage = needsVideoMusicStorageCache(pendingMusic);
    if (!needsPlayback && !needsStorage) return;

    void (async () => {
      runningRef.current = true;
      try {
        let tracks = trendingQuery.data?.tracks ?? [];
        if (tracks.length === 0) {
          const refetched = await trendingQuery.refetch();
          tracks = refetched.data?.tracks ?? [];
        }

        let track =
          findJamendoTrackForMusic(tracks, pendingMusic) ?? matchDefaultJamendoTrack(tracks);

        if (!track && (pendingMusic.title || pendingMusic.artist)) {
          const q = [pendingMusic.artist, pendingMusic.title].filter(Boolean).join(' ');
          try {
            const jwt = await getSessionJwt();
            const params = new URLSearchParams({ order: 'relevance', q });
            const res = await fetch(scopedFunctionsUrl(`marketing-music?${params}`, propertyId), {
              headers: { Authorization: `Bearer ${jwt}` },
            });
            const json = (await res.json()) as {
              success?: boolean;
              data?: { tracks?: typeof tracks };
            };
            const searched = json.data?.tracks ?? [];
            track = findJamendoTrackForMusic(searched, pendingMusic) ?? searched[0] ?? null;
          } catch {
            // Fall through — leave the cue unresolved for this pass.
          }
        }

        if (!track) return;

        const resolved = pendingMusic.url
          ? pendingMusic
          : videoMusicFromJamendoTrack(track, pendingMusic);

        if (needsPlayback && !pendingMusic.url && mountedRef.current) {
          setMusic((prev) => (prev && !prev.url ? resolved : prev));
        }

        const shouldCache = !resolved.url || isJamendoStreamUrl(resolved.url);
        if (shouldCache) {
          const cached = await importJamendoTrackViaUpload(track, resolved, propertyId);
          if (mountedRef.current && cached.url) {
            setMusic((prev) => {
              if (!prev) return prev;
              if (prev.url && !isJamendoStreamUrl(prev.url)) return prev;
              if (prev.trackId && cached.trackId && prev.trackId !== cached.trackId) return prev;
              return cached;
            });
          }
        }

        settledKeyRef.current = cueKey;
      } catch {
        // Preview may still work via the Jamendo stream URL from step 1.
      } finally {
        runningRef.current = false;
      }
    })();
  }, [cueKey, enabled, pendingMusic, propertyId, setMusic, trendingQuery.data?.tracks, trendingQuery.refetch]);
}
