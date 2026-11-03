import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';

import { Check, Film, Loader2, Music, Trash2, Upload } from 'lucide-react';

import { JamendoTrackBrowser } from '@/features/dashboard/marketing/components/media-library/JamendoTrackBrowser';
import { MediaStorageMeter } from '@/features/dashboard/marketing/components/media-library/MediaStorageMeter';
import { MediaUploadRows } from '@/features/dashboard/marketing/components/media-library/MediaUploadRows';
import {
  useDeleteMarketingMedia,
  useMarketingMediaUsedIn,
  useMarketingMediaLibrary,
  useMarketingMediaUploads,
  useMarketingMediaUsage,
} from '@/features/dashboard/marketing/hooks/useMarketingMedia';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import {
  MARKETING_MEDIA_ACCEPT,
  kindForFile,
} from '@/features/dashboard/marketing/lib/media/marketingMediaRules';
import type {
  MarketingMediaAsset,
  MarketingMediaKind,
} from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';
import {
  payloadFromAsset,
  writeMediaDrag,
  type MediaDragPayload,
} from '@/features/dashboard/marketing/lib/media/mediaDrag';
import type { PropertyMediaItem } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Tab = 'uploads' | 'property' | 'audio' | 'music';

type Props = {
  /** Kinds the caller can use. Hides tabs and filters pickers. Default: all. */
  allowedKinds?: MarketingMediaKind[];
  /** Property gallery shown in its own tab. */
  propertyItems?: PropertyMediaItem[];
  /** Adds a Music tab with free tracks. The video editor sets it; posts do not. */
  includeMusic?: boolean;
  /** Called when a tile is tapped (or Enter). Dragging works regardless. */
  onPick?: (payload: MediaDragPayload) => void;
  className?: string;
};

function durationLabel(ms: number | null): string | null {
  if (ms == null) return null;
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function AssetTile({
  asset,
  selecting,
  selected,
  onToggle,
  onPick,
}: {
  asset: MarketingMediaAsset;
  selecting: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  onPick?: (payload: MediaDragPayload) => void;
}) {
  const duration = durationLabel(asset.durationMs);
  const thumb = asset.kind === 'image' ? asset.url : asset.posterUrl;
  return (
    <li>
      <button
        type="button"
        draggable={!selecting}
        onDragStart={(event) => writeMediaDrag(event.dataTransfer, payloadFromAsset(asset))}
        onClick={() => (selecting ? onToggle(asset.id) : onPick?.(payloadFromAsset(asset)))}
        aria-label={`${selecting ? 'Select' : 'Use'} ${asset.fileName}`}
        aria-pressed={selecting ? selected : undefined}
        className={cn(
          'border-border bg-muted/40 relative aspect-square w-full overflow-hidden rounded-lg border',
          'native-press focus-visible:ring-primary outline-none focus-visible:ring-2',
          selected && 'ring-primary ring-2'
        )}
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            draggable={false}
            className="size-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground flex size-full items-center justify-center">
            {asset.kind === 'audio' ? (
              <Music className="size-6" aria-hidden />
            ) : (
              <Film className="size-6" aria-hidden />
            )}
          </span>
        )}
        {asset.kind !== 'image' ? (
          <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {asset.kind === 'audio' ? (
              <Music className="size-3" aria-hidden />
            ) : (
              <Film className="size-3" aria-hidden />
            )}
            {duration}
          </span>
        ) : null}
        {selecting ? (
          <span
            className={cn(
              'absolute right-1 top-1 flex size-5 items-center justify-center rounded-full border',
              selected
                ? 'bg-primary-strong border-primary text-primary-foreground'
                : 'border-white bg-black/30'
            )}
          >
            {selected ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
          </span>
        ) : null}
      </button>
      {asset.kind === 'audio' ? (
        <p className="text-muted-foreground mt-1 truncate text-[11px]">{asset.fileName}</p>
      ) : null}
    </li>
  );
}

export function MarketingMediaLibrary({
  allowedKinds = ['image', 'video', 'audio'],
  propertyItems,
  includeMusic = false,
  onPick,
  className,
}: Props) {
  const showAudio = allowedKinds.includes('audio');
  const showVisual = allowedKinds.includes('image') || allowedKinds.includes('video');
  const tabs = useMemo(() => {
    const list: Array<{ id: Tab; label: string }> = [];
    if (showVisual) list.push({ id: 'uploads', label: 'Uploads' });
    if (showVisual && propertyItems && propertyItems.length > 0) {
      list.push({ id: 'property', label: 'Property' });
    }
    if (showAudio) list.push({ id: 'audio', label: 'Audio' });
    if (showAudio && includeMusic) list.push({ id: 'music', label: 'Music' });
    return list;
  }, [showAudio, showVisual, propertyItems, includeMusic]);

  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? 'uploads');
  const activeTab = tabs.some((t) => t.id === tab) ? tab : (tabs[0]?.id ?? 'uploads');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { canAddTemplate, canDeleteTemplate } = useMarketingPermissions();
  const { open: openUpgrade } = useUpgradeModal();
  const usageQuery = useMarketingMediaUsage();
  const listKind = activeTab === 'audio' ? 'audio' : undefined;
  // Property photos and free music live outside the uploads quota: no list, meter or upload.
  const external = activeTab === 'property' || activeTab === 'music';
  const library = useMarketingMediaLibrary({ kind: listKind }, !external);
  const uploads = useMarketingMediaUploads();
  const remove = useDeleteMarketingMedia();
  const usedIn = useMarketingMediaUsedIn([...selected], confirmOpen);
  const usedInDesigns = Object.values(usedIn.data ?? {}).reduce((sum, n) => sum + n, 0);

  const assets = useMemo(() => {
    const all = library.data?.pages.flatMap((page) => page.items) ?? [];
    return activeTab === 'audio'
      ? all
      : all.filter((asset) => asset.kind !== 'audio' && allowedKinds.includes(asset.kind));
  }, [library.data, activeTab, allowedKinds]);

  const upgrade = useCallback(() => openUpgrade('marketingMediaLibrary'), [openUpgrade]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const accepted = Array.from(files).filter((file) => {
        const kind = kindForFile(file);
        return kind !== null && allowedKinds.includes(kind);
      });
      if (accepted.length) uploads.enqueue(accepted);
    },
    [allowedKinds, uploads]
  );

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (canAddTemplate && event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  };

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const usage = usageQuery.data;
  const accept = MARKETING_MEDIA_ACCEPT;

  return (
    <section
      className={cn('flex min-h-0 flex-col gap-3', className)}
      onDragOver={(event) => {
        if (canAddTemplate && event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
      aria-label="Media library"
    >
      {tabs.length > 1 ? (
        <div
          role="tablist"
          aria-label="Media sources"
          className="bg-muted flex gap-1 rounded-lg p-0.5"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => {
                setTab(t.id);
                stopSelecting();
              }}
              className={cn(
                'h-8 flex-1 rounded-md text-xs font-medium transition-colors',
                activeTab === t.id ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      {usage && !external ? <MediaStorageMeter usage={usage} onUpgrade={upgrade} /> : null}

      {!external ? (
        <div className="flex items-center gap-2">
          {canAddTemplate ? (
            <>
              <Button
                type="button"
                size="sm"
                className="h-10 flex-1 gap-1.5"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4" aria-hidden />
                Upload
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                accept={activeTab === 'audio' ? 'audio/*,.m4a' : accept}
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </>
          ) : null}
          {canDeleteTemplate && assets.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant={selecting ? 'secondary' : 'outline'}
              className="h-10"
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            >
              {selecting ? 'Done' : 'Select'}
            </Button>
          ) : null}
          {selecting && selected.size > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-10 gap-1.5"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              {selected.size}
            </Button>
          ) : null}
        </div>
      ) : null}

      <MediaUploadRows
        jobs={uploads.jobs}
        onCancel={uploads.cancel}
        onRetry={uploads.retry}
        onDismiss={uploads.dismiss}
        onUpgrade={upgrade}
      />

      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto rounded-lg',
          dragging && 'ring-primary/60 ring-2 ring-offset-2'
        )}
      >
        {activeTab === 'music' ? (
          <JamendoTrackBrowser onPick={onPick} />
        ) : activeTab === 'property' ? (
          <ul className="grid grid-cols-3 gap-2">
            {(propertyItems ?? [])
              .filter((item) => allowedKinds.includes(item.type))
              .map((item) => (
                <li key={item.url}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) =>
                      writeMediaDrag(event.dataTransfer, {
                        kind: item.type,
                        url: item.url,
                        assetId: null,
                        source: 'property',
                        width: null,
                        height: null,
                        durationMs: null,
                        posterUrl: item.type === 'image' ? item.preview : null,
                      })
                    }
                    onClick={() =>
                      onPick?.({
                        kind: item.type,
                        url: item.url,
                        assetId: null,
                        source: 'property',
                        width: null,
                        height: null,
                        durationMs: null,
                        posterUrl: item.type === 'image' ? item.preview : null,
                      })
                    }
                    aria-label={item.type === 'video' ? 'Use video' : 'Use photo'}
                    className="border-border bg-muted/40 native-press relative aspect-square w-full overflow-hidden rounded-lg border"
                  >
                    {item.type === 'image' ? (
                      <img
                        src={item.preview}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-muted-foreground flex size-full items-center justify-center">
                        <Film className="size-6" aria-hidden />
                      </span>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        ) : library.isPending ? (
          <div className="grid grid-cols-3 gap-2" aria-busy>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : library.isError ? (
          <div className="space-y-2 py-6 text-center">
            <p className="text-muted-foreground text-sm">Could not load your files</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void library.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : assets.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {activeTab === 'audio' ? 'No audio yet' : 'No uploads yet'}
          </p>
        ) : (
          <>
            <ul className={cn('grid gap-2', activeTab === 'audio' ? 'grid-cols-3' : 'grid-cols-3')}>
              {assets.map((asset) => (
                <AssetTile
                  key={asset.id}
                  asset={asset}
                  selecting={selecting}
                  selected={selected.has(asset.id)}
                  onToggle={toggle}
                  onPick={onPick}
                />
              ))}
            </ul>
            {library.hasNextPage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-10 w-full"
                disabled={library.isFetchingNextPage}
                onClick={() => void library.fetchNextPage()}
              >
                {library.isFetchingNextPage ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  'Load more'
                )}
              </Button>
            ) : null}
          </>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selected.size === 1 ? 'Delete this file?' : `Delete ${selected.size} files?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {usedInDesigns > 0
                ? `${usedInDesigns === 1 ? '1 design uses' : `${usedInDesigns} designs use`} ${selected.size === 1 ? 'this file' : 'these files'}. ${usedInDesigns === 1 ? 'It' : 'They'} will show missing media until you replace it. You can undo this for 7 days.`
                : 'You can undo this for 7 days.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                remove.mutate([...selected]);
                stopSelecting();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
