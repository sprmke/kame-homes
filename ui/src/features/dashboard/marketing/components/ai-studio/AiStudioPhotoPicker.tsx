import { useMemo, useRef, useState, type DragEvent } from 'react';

import { ImagePlus, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import { AiStudioPhotoSheet } from '@/features/dashboard/marketing/components/ai-studio/AiStudioPhotoSheet';
import {
  useMarketingGenerationReferences,
  useUploadMarketingGenerationReference,
} from '@/features/dashboard/marketing/hooks/useMarketingGenerationReferences';
import type { MarketingGenerationReference } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import {
  findListingPhotoReference,
  isListingPhotoReference,
  listingPhotoFileName,
} from '@/features/dashboard/marketing/lib/marketingListingPhotoReference';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';

import { cn } from '@/lib/utils';

type Props = {
  references: MarketingGenerationReference[];
  onAdd: (reference: MarketingGenerationReference) => void;
  onRemove: (referenceId: string) => void;
  maxPhotos: number;
  disabled?: boolean;
};

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

/**
 * "Your photos": the shots the AI should base the result on. Hosts pick from their
 * listing photos or past uploads in one sheet, or drop files straight onto the field.
 */
export function AiStudioPhotoPicker({ references, onAdd, onRemove, maxPhotos, disabled }: Props) {
  const { property } = useOrgContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pendingListingUrls, setPendingListingUrls] = useState<ReadonlySet<string>>(new Set());
  // Listing URL → reference id picked this session. The file-name stem also finds
  // copies from earlier sessions; this map keeps selection right even if it cannot.
  const [listingPicks, setListingPicks] = useState<ReadonlyMap<string, string>>(new Map());
  const upload = useUploadMarketingGenerationReference();
  const library = useMarketingGenerationReferences();
  const listing = usePublicPropertyDetail(property.slug);

  const listingPhotos = useMemo(
    () => Array.from(new Set((listing.data?.images ?? []).filter(Boolean))),
    [listing.data?.images]
  );
  const uploads = useMemo(
    () => (library.data ?? []).filter((reference) => !isListingPhotoReference(reference)),
    [library.data]
  );

  const selectedListing = (url: string) =>
    references.find((row) => row.id === listingPicks.get(url)) ??
    findListingPhotoReference(references, url);
  const selectedListingUrls = new Set(listingPhotos.filter((url) => selectedListing(url)));

  const count = references.length;
  const full = count >= maxPhotos;
  const uploading = upload.isPending && pendingListingUrls.size === 0;

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || full) return;
    const room = maxPhotos - count;
    const picked = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (picked.length === 0) {
      toast.error('Use a JPEG, PNG, WebP or HEIC photo');
      return;
    }
    if (picked.length > room) toast.message(`Added ${room}. Remove a photo to add more.`);
    for (const file of picked.slice(0, room)) {
      const reference = await upload.mutateAsync(file).catch(() => null);
      if (reference) onAdd(reference);
    }
  };

  const toggleListing = async (url: string) => {
    const already = selectedListing(url);
    if (already) {
      onRemove(already.id);
      return;
    }
    if (full) return;
    const remember = (reference: MarketingGenerationReference) => {
      setListingPicks((current) => new Map(current).set(url, reference.id));
      onAdd(reference);
    };
    const saved = findListingPhotoReference(library.data ?? [], url);
    if (saved) {
      remember(saved);
      return;
    }
    setPendingListingUrls((current) => new Set(current).add(url));
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('fetch');
      const blob = await response.blob();
      const type = blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
      const file = new File([blob], listingPhotoFileName(url, type), { type });
      remember(await upload.mutateAsync(file));
    } catch (error) {
      // Upload errors already toast from the mutation; only the fetch needs a message.
      if ((error as Error).message === 'fetch' || error instanceof TypeError) {
        toast.error('Could not load that photo. Try uploading it instead.');
      }
    } finally {
      setPendingListingUrls((current) => {
        const next = new Set(current);
        next.delete(url);
        return next;
      });
    }
  };

  const toggleUpload = (reference: MarketingGenerationReference) => {
    if (references.some((row) => row.id === reference.id)) onRemove(reference.id);
    else if (!full) onAdd(reference);
  };

  const dropProps = {
    onDragOver: (event: DragEvent) => {
      if (disabled || full) return;
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      if (!disabled) void uploadFiles(event.dataTransfer.files);
    },
  };

  const previews = listingPhotos.slice(0, 3);
  const busy = upload.isPending || pendingListingUrls.size > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="settings-field-label">Your photos</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {count > 0 ? `${count} of ${maxPhotos}` : 'Optional'}
        </span>
      </div>

      {count === 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setSheetOpen(true)}
          {...dropProps}
          className={cn(
            'border-border/80 bg-muted/20 hover:border-primary/40 hover:bg-primary/[0.04] flex min-h-[64px] w-full items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 text-left',
            'transition-[border-color,background-color] duration-150 ease-out',
            'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
            dragging && 'border-primary bg-primary/10'
          )}
        >
          {previews.length > 0 ? (
            <span className="flex shrink-0 -space-x-3" aria-hidden>
              {previews.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  width={40}
                  height={40}
                  className="border-background bg-muted size-10 rounded-lg border-2 object-cover"
                />
              ))}
            </span>
          ) : (
            <span className="bg-background border-border/70 flex size-10 shrink-0 items-center justify-center rounded-lg border">
              {busy ? (
                <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="text-muted-foreground size-4" aria-hidden />
              )}
            </span>
          )}
          <span className="min-w-0">
            <span className="text-foreground block text-sm font-medium">
              {busy ? 'Adding photo' : 'Add photos'}
            </span>
            <span className="text-muted-foreground block text-xs">
              {previews.length > 0 ? 'From your listing or your device' : 'From your device'}
            </span>
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap gap-2" {...dropProps}>
          {references.map((reference) => (
            <div
              key={reference.id}
              className="border-border/70 bg-muted/30 relative size-16 shrink-0 overflow-hidden rounded-xl border sm:size-[4.5rem]"
            >
              <img
                src={reference.public_url}
                alt=""
                width={72}
                height={72}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(reference.id)}
                disabled={disabled}
                aria-label="Remove photo"
                className="absolute right-0 top-0 flex size-9 items-start justify-end p-1"
              >
                <span className="bg-background/95 text-foreground flex size-6 items-center justify-center rounded-full shadow-sm">
                  <X className="size-3.5" aria-hidden />
                </span>
              </button>
            </div>
          ))}
          {!full && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setSheetOpen(true)}
              aria-label="Add photos"
              className={cn(
                'border-border/80 text-muted-foreground hover:border-primary/40 hover:text-foreground flex size-16 shrink-0 items-center justify-center rounded-xl border border-dashed transition-colors sm:size-[4.5rem]',
                'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'disabled:opacity-60',
                dragging && 'border-primary bg-primary/10'
              )}
            >
              {busy ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-5" aria-hidden />
              )}
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          void uploadFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <AiStudioPhotoSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selected={references}
        maxPhotos={maxPhotos}
        listingPhotos={listingPhotos}
        listingLoading={listing.isLoading}
        uploads={uploads}
        pendingListingUrls={pendingListingUrls}
        selectedListingUrls={selectedListingUrls}
        uploading={uploading}
        onToggleListing={(url) => void toggleListing(url)}
        onToggleUpload={toggleUpload}
        onUploadClick={() => inputRef.current?.click()}
      />
    </div>
  );
}
