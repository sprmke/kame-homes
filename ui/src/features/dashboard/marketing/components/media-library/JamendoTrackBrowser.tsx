import { useEffect, useRef, useState } from 'react';

import { Loader2, Pause, Play, Plus, Search } from 'lucide-react';

import {
  useMarketingMusicBrowse,
  type JamendoTrack,
} from '@/features/dashboard/marketing/hooks/useMarketingMusic';
import { payloadFromTrack } from '@/features/dashboard/marketing/lib/media/jamendoPayload';
import type { MediaDragPayload } from '@/features/dashboard/marketing/lib/media/mediaDrag';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  onPick?: (payload: MediaDragPayload) => void;
};

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Free music (Jamendo): trending or searched, with a preview and an Add button. */
export function JamendoTrackBrowser({ onPick }: Props) {
  const propertyId = usePropertyIdParam();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Stop the preview when the panel closes.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    []
  );

  const browse = useMarketingMusicBrowse(propertyId, {
    q: debounced || undefined,
    order: debounced ? 'relevance' : 'popularity_week',
  });
  const tracks = browse.data?.tracks ?? [];

  const togglePreview = (track: JamendoTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(track.streamUrl);
    audioRef.current = audio;
    setLoadingId(track.id);
    audio.addEventListener('playing', () => {
      setLoadingId(null);
      setPlayingId(track.id);
    });
    audio.addEventListener('ended', () => setPlayingId(null));
    audio.addEventListener('error', () => {
      setLoadingId(null);
      setPlayingId(null);
    });
    void audio.play().catch(() => setLoadingId(null));
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search free music"
          aria-label="Search free music"
          className="h-10 pl-9"
        />
      </div>

      {browse.isPending ? (
        <div className="space-y-2" aria-busy>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : browse.isError || browse.data?.jamendoConfigured === false ? (
        <div className="space-y-2 py-6 text-center">
          <p className="text-muted-foreground text-sm">Free music is not available right now</p>
          {browse.isError ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void browse.refetch()}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : tracks.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">No tracks found</p>
      ) : (
        <ul className="space-y-2" aria-label="Free music">
          {tracks.map((track) => (
            <li
              key={track.id}
              className="border-border flex items-center gap-2 rounded-lg border px-2 py-1.5"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={
                  loadingId === track.id
                    ? 'Loading preview'
                    : playingId === track.id
                      ? 'Pause preview'
                      : `Preview ${track.title}`
                }
                onClick={() => togglePreview(track)}
              >
                {loadingId === track.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : playingId === track.id ? (
                  <Pause className="size-4" aria-hidden />
                ) : (
                  <Play className="size-4" aria-hidden />
                )}
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{track.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {track.artist} · {clock(track.durationSec)}
                </p>
              </div>
              {onPick ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label={`Add ${track.title}`}
                  onClick={() => {
                    audioRef.current?.pause();
                    setPlayingId(null);
                    onPick(payloadFromTrack(track));
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
