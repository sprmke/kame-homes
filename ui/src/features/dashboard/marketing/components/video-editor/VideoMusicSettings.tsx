import { useEffect, useRef, useState } from 'react';

import { Flame, Link2, Loader2, Pause, Play, Search, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  type ImportedMarketingMusic,
  type JamendoTrack,
  fetchUrlAsAudioFile,
  useImportMusicUrl,
  useMarketingMusicBrowse,
  useUploadMarketingMusic,
} from '@/features/dashboard/marketing/hooks/useMarketingMusic';
import {
  applyImportedVideoMusic,
  importJamendoTrackViaUpload,
} from '@/features/dashboard/marketing/lib/video/importVideoMusic';
import {
  VIDEO_MUSIC_CLEARED_TRACK_ID,
  VIDEO_MUSIC_DEFAULT_VOLUME,
  defaultProjectMusic,
} from '@/features/dashboard/marketing/lib/video/videoMusicPresets';
import type { VideoProjectMusic } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type MusicTab = 'trending' | 'search' | 'upload' | 'link';

type Props = {
  music: VideoProjectMusic;
  onChange: (music: VideoProjectMusic) => void;
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function selectedLabel(music: VideoProjectMusic): string | null {
  if (music.title) {
    return music.artist ? `${music.title} · ${music.artist}` : music.title;
  }
  if (music.url) {
    try {
      const path = new URL(music.url).pathname.split('/').pop() ?? music.url;
      return path.length > 40 ? `${path.slice(0, 37)}…` : path;
    } catch {
      return music.url.length > 40 ? `${music.url.slice(0, 37)}…` : music.url;
    }
  }
  return null;
}

const MUSIC_TABS: { id: MusicTab; label: string; icon: typeof Flame }[] = [
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'link', label: 'Link', icon: Link2 },
];

function MusicTabIconButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof Flame;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-lg transition-colors',
        active
          ? 'bg-primary-strong text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
    </button>
  );
}

function TrackRowSkeleton() {
  return (
    <div className="border-border flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-lg border px-2 py-1.5">
      <Skeleton className="size-11 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
        <Skeleton className="h-4 w-[72%]" />
        <Skeleton className="h-3 w-[45%]" />
      </div>
    </div>
  );
}

function TrackRow({
  track,
  selected,
  importing,
  previewLoading,
  previewing,
  disabled,
  onPreview,
  onSelect,
}: {
  track: JamendoTrack;
  selected: boolean;
  importing: boolean;
  previewLoading: boolean;
  previewing: boolean;
  disabled: boolean;
  onPreview: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        'relative flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-lg border px-2 py-1.5 transition-opacity',
        selected ? 'border-primary bg-primary/5' : 'border-border',
        disabled && !importing && 'opacity-60'
      )}
    >
      {importing ? (
        <div
          className="bg-background/50 absolute inset-0 z-10 flex items-center justify-center rounded-lg"
          aria-hidden
        >
          <Loader2 className="text-primary size-5 animate-spin" />
        </div>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="min-h-[44px] min-w-[44px] shrink-0"
        aria-label={
          previewLoading ? 'Loading preview' : previewing ? 'Pause preview' : 'Preview track'
        }
        aria-busy={previewLoading}
        onClick={onPreview}
        disabled={importing || (disabled && !previewLoading)}
      >
        {previewLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : previewing ? (
          <Pause className="size-4" aria-hidden />
        ) : (
          <Play className="size-4" aria-hidden />
        )}
      </Button>
      <button
        type="button"
        className="min-h-[44px] min-w-0 flex-1 text-left disabled:cursor-not-allowed"
        onClick={onSelect}
        disabled={disabled || importing}
        aria-busy={importing}
      >
        <p className="truncate text-sm font-medium">{track.title}</p>
        <p className="text-muted-foreground truncate text-xs">
          {track.artist} · {formatDuration(track.durationSec)}
        </p>
      </button>
    </div>
  );
}

export function VideoMusicSettings({ music, onChange }: Props) {
  const propertyId = usePropertyIdParam();
  const [tab, setTab] = useState<MusicTab>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [importingTrackId, setImportingTrackId] = useState<string | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [previewLoadingTrackId, setPreviewLoadingTrackId] = useState<string | null>(null);
  const [linkImporting, setLinkImporting] = useState(false);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const importUrl = useImportMusicUrl(propertyId);
  const uploadMusic = useUploadMarketingMusic(propertyId);

  const trendingQuery = useMarketingMusicBrowse(propertyId, {
    order: 'popularity_week',
  });
  const searchBrowseQuery = useMarketingMusicBrowse(propertyId, {
    q: debouncedSearch,
    order: 'relevance',
    enabled: tab === 'search' && debouncedSearch.length >= 2,
  });

  const emptyRetryRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      previewRef.current?.pause();
    };
  }, []);

  const volumePercent = Math.round((music.volume ?? VIDEO_MUSIC_DEFAULT_VOLUME) * 100);
  const activeLabel = selectedLabel(music);
  const browseQuery = tab === 'search' ? searchBrowseQuery : trendingQuery;
  const tracks = browseQuery.data?.tracks ?? [];
  const jamendoConfigured = browseQuery.data?.jamendoConfigured ?? false;
  const browseFailed = browseQuery.isError;
  const browseLoading =
    browseQuery.isPending || (browseQuery.isFetching && tracks.length === 0 && !browseFailed);

  useEffect(() => {
    emptyRetryRef.current = false;
  }, [propertyId]);

  useEffect(() => {
    if (emptyRetryRef.current) return;
    if (tab !== 'trending' && tab !== 'search') return;
    if (browseLoading || browseFailed || !jamendoConfigured || tracks.length > 0) return;

    emptyRetryRef.current = true;
    void (tab === 'search' ? searchBrowseQuery.refetch() : trendingQuery.refetch());
  }, [
    tab,
    browseLoading,
    browseFailed,
    jamendoConfigured,
    tracks.length,
    trendingQuery.refetch,
    searchBrowseQuery.refetch,
  ]);

  const anyImportBusy =
    importUrl.isPending || uploadMusic.isPending || Boolean(importingTrackId) || linkImporting;

  const stopPreview = () => {
    previewRef.current?.pause();
    previewRef.current = null;
    setPreviewTrackId(null);
    setPreviewLoadingTrackId(null);
  };

  const togglePreview = (track: JamendoTrack) => {
    if (previewTrackId === track.id && !previewLoadingTrackId) {
      stopPreview();
      return;
    }

    stopPreview();
    setPreviewLoadingTrackId(track.id);

    const audio = new Audio(track.streamUrl);
    previewRef.current = audio;

    const clearPreviewLoading = () => {
      setPreviewLoadingTrackId((current) => (current === track.id ? null : current));
    };

    audio.addEventListener(
      'canplay',
      () => {
        clearPreviewLoading();
        setPreviewTrackId(track.id);
      },
      { once: true }
    );

    audio.addEventListener(
      'error',
      () => {
        clearPreviewLoading();
        setPreviewTrackId(null);
        toast.error('Preview failed');
      },
      { once: true }
    );

    audio.onended = () => {
      setPreviewTrackId(null);
      setPreviewLoadingTrackId(null);
    };

    void audio.play().catch(() => {
      clearPreviewLoading();
      setPreviewTrackId(null);
      toast.error('Preview failed');
    });
  };

  const handleSelectTrack = async (track: JamendoTrack) => {
    stopPreview();
    if (!propertyId) {
      toast.error('Property required');
      return;
    }
    setImportingTrackId(track.id);
    try {
      // Edge import — browser cannot fetch Jamendo streams (CORS).
      onChange(await importJamendoTrackViaUpload(track, music, propertyId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import track');
    } finally {
      setImportingTrackId(null);
    }
  };

  const handleImportUrl = async () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) return;

    setLinkImporting(true);
    try {
      let imported: ImportedMarketingMusic;
      try {
        const file = await fetchUrlAsAudioFile(trimmed);
        imported = await uploadMusic.mutateAsync({ file });
      } catch {
        imported = await importUrl.mutateAsync(trimmed);
      }
      onChange(applyImportedVideoMusic(music, imported));
      setLinkUrl('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import URL');
    } finally {
      setLinkImporting(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = await uploadMusic.mutateAsync({ file });
      onChange(applyImportedVideoMusic(music, imported));
    } catch {
      // toast handled in hook
    }
  };

  const clearMusic = () => {
    stopPreview();
    onChange({
      url: null,
      volume: music.volume ?? VIDEO_MUSIC_DEFAULT_VOLUME,
      trackId: VIDEO_MUSIC_CLEARED_TRACK_ID,
    });
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-3 overflow-x-hidden">
      {activeLabel ? (
        <div className="border-primary/30 bg-primary/5 flex items-center gap-1.5 rounded-lg border px-2 py-1.5">
          <p className="min-w-0 flex-1 truncate text-sm">{activeLabel}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] shrink-0"
            aria-label="Clear music"
            onClick={clearMusic}
            disabled={anyImportBusy}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : importingTrackId ? (
        <div className="border-border flex items-center gap-2 rounded-lg border px-2 py-2">
          <Loader2 className="text-primary size-4 shrink-0 animate-spin" aria-hidden />
          <Skeleton className="h-4 flex-1" />
        </div>
      ) : null}

      <div className="flex w-full min-w-0 max-w-full gap-1.5">
        {MUSIC_TABS.map(({ id, label, icon }) => (
          <MusicTabIconButton
            key={id}
            active={tab === id}
            label={label}
            icon={icon}
            onClick={() => setTab(id)}
          />
        ))}
      </div>

      {tab === 'trending' || tab === 'search' ? (
        <div className="min-w-0 space-y-2">
          {tab === 'search' ? (
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tracks"
              className="h-10"
              aria-label="Search music"
            />
          ) : null}

          {browseLoading ? (
            <div className="max-h-[min(40vh,280px)] min-w-0 space-y-1.5 overflow-y-auto pr-0.5">
              {Array.from({ length: 5 }).map((_, index) => (
                <TrackRowSkeleton key={index} />
              ))}
            </div>
          ) : browseFailed ? (
            <p className="text-destructive text-sm">Could not load tracks</p>
          ) : !jamendoConfigured ? (
            <p className="text-muted-foreground text-sm">Library unavailable</p>
          ) : tab === 'search' && debouncedSearch.length < 2 ? null : tracks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tracks</p>
          ) : (
            <div className="max-h-[min(40vh,280px)] min-w-0 space-y-1.5 overflow-y-auto pr-0.5">
              {tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  selected={
                    music.trackId === track.id ||
                    (Boolean(music.title) &&
                      !music.url &&
                      track.title.toLowerCase().startsWith('lofi chillout hip hop') &&
                      track.artist.toLowerCase() === 'joystock')
                  }
                  importing={importingTrackId === track.id}
                  previewLoading={previewLoadingTrackId === track.id}
                  previewing={previewTrackId === track.id && !previewLoadingTrackId}
                  disabled={
                    Boolean(importingTrackId) ||
                    (Boolean(previewLoadingTrackId) && previewLoadingTrackId !== track.id)
                  }
                  onPreview={() => togglePreview(track)}
                  onSelect={() => void handleSelectTrack(track)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'upload' ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac"
            className="sr-only"
            onChange={(event) => void handleFileChange(event)}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            disabled={uploadMusic.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadMusic.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="mr-2 size-4" aria-hidden />
            )}
            Upload audio
          </Button>
        </div>
      ) : null}

      {tab === 'link' ? (
        <div className="flex min-w-0 gap-1.5">
          <Input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://…"
            className="h-10 min-w-0 flex-1"
            aria-label="Audio URL"
          />
          <Button
            type="button"
            className="min-h-[44px] shrink-0"
            disabled={!linkUrl.trim() || linkImporting || uploadMusic.isPending}
            onClick={() => void handleImportUrl()}
          >
            {linkImporting || uploadMusic.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              'Use'
            )}
          </Button>
        </div>
      ) : null}

      <div className="w-full min-w-0 space-y-2 overflow-hidden">
        <Label htmlFor="video-music-volume">Volume ({volumePercent}%)</Label>
        <div className="w-full min-w-0 overflow-hidden">
          <input
            id="video-music-volume"
            type="range"
            min={0}
            max={100}
            value={volumePercent}
            disabled={anyImportBusy}
            onChange={(event) => onChange({ ...music, volume: Number(event.target.value) / 100 })}
            className="box-border block h-2 w-full min-w-0 max-w-full cursor-pointer accent-[hsl(var(--primary))]"
          />
        </div>
      </div>
    </div>
  );
}

export { defaultProjectMusic };
