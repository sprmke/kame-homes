import type { JamendoTrack } from '@/features/dashboard/marketing/hooks/useMarketingMusic';
import type { MediaDragPayload } from '@/features/dashboard/marketing/lib/media/mediaDrag';

/** A free-music track as a clip the editor can place. The stream plays in preview; export caches it. */
export function payloadFromTrack(track: JamendoTrack): MediaDragPayload {
  return {
    kind: 'audio',
    url: track.streamUrl,
    assetId: null,
    source: 'jamendo',
    width: null,
    height: null,
    durationMs: track.durationSec > 0 ? Math.round(track.durationSec * 1000) : null,
    posterUrl: null,
    title: track.title,
    artist: track.artist,
    trackId: track.id,
  };
}
