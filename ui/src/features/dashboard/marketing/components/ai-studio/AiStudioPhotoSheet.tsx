import { useEffect, useState } from 'react';

import { Check, Loader2, Upload } from 'lucide-react';

import type { MarketingGenerationReference } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { cn } from '@/lib/utils';

type Source = 'listing' | 'uploads';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: MarketingGenerationReference[];
  maxPhotos: number;
  listingPhotos: string[];
  listingLoading: boolean;
  uploads: MarketingGenerationReference[];
  /** Listing URLs being copied into the library right now. */
  pendingListingUrls: ReadonlySet<string>;
  selectedListingUrls: ReadonlySet<string>;
  uploading: boolean;
  onToggleListing: (url: string) => void;
  onToggleUpload: (reference: MarketingGenerationReference) => void;
  onUploadClick: () => void;
};

const TILE_CLASS =
  'relative aspect-square overflow-hidden rounded-xl focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

function SelectedBadge() {
  return (
    <span className="bg-primary text-primary-foreground absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full shadow-sm">
      <Check className="size-3.5" strokeWidth={3} aria-hidden />
    </span>
  );
}

/**
 * Photo chooser: the listing's own photos first (what most hosts want), then past
 * uploads and generated images saved with "Add to my photos". Selection applies
 * immediately; Done just closes.
 */
export function AiStudioPhotoSheet({
  open,
  onOpenChange,
  selected,
  maxPhotos,
  listingPhotos,
  listingLoading,
  uploads,
  pendingListingUrls,
  selectedListingUrls,
  uploading,
  onToggleListing,
  onToggleUpload,
  onUploadClick,
}: Props) {
  const hasListing = listingLoading || listingPhotos.length > 0;
  const [source, setSource] = useState<Source>(hasListing ? 'listing' : 'uploads');
  const selectedIds = new Set(selected.map((reference) => reference.id));
  const full = selected.length >= maxPhotos;

  // Land on Uploads when this property has no listing photos.
  useEffect(() => {
    if (open && !hasListing) setSource('uploads');
  }, [open, hasListing]);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent sheetLayout="split" className="lg:max-w-2xl">
        <ResponsiveModalHeader className="space-y-3 px-4 pt-4 lg:px-0 lg:pt-0">
          <div className="flex items-baseline justify-between gap-3 pr-8 lg:pr-6">
            <ResponsiveModalTitle>Choose photos</ResponsiveModalTitle>
            <span className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
              {selected.length} of {maxPhotos}
            </span>
          </div>
          {hasListing && (
            <SegmentedControl
              value={source}
              onChange={setSource}
              size="dense"
              fullWidth
              aria-label="Photo source"
              options={[
                { value: 'listing', label: `Listing (${listingPhotos.length})` },
                { value: 'uploads', label: `Uploads (${uploads.length})` },
              ]}
            />
          )}
        </ResponsiveModalHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 lg:max-h-[60vh] lg:px-0">
          {source === 'listing' ? (
            listingLoading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-square rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {listingPhotos.map((url, index) => {
                  const isSelected = selectedListingUrls.has(url);
                  const pending = pendingListingUrls.has(url);
                  const blocked = !isSelected && full;
                  return (
                    <button
                      key={url}
                      type="button"
                      disabled={blocked || pending}
                      aria-pressed={isSelected}
                      aria-label={`Listing photo ${index + 1}`}
                      onClick={() => onToggleListing(url)}
                      className={cn(
                        TILE_CLASS,
                        isSelected && 'ring-primary ring-offset-background ring-2 ring-offset-2',
                        blocked && 'opacity-40'
                      )}
                    >
                      <img
                        src={url}
                        alt=""
                        loading="lazy"
                        className="bg-muted size-full object-cover"
                      />
                      {pending && (
                        <span className="bg-background/60 absolute inset-0 flex items-center justify-center">
                          <Loader2 className="text-foreground size-5 animate-spin" aria-hidden />
                        </span>
                      )}
                      {isSelected && !pending && <SelectedBadge />}
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={onUploadClick}
                disabled={uploading || full}
                className={cn(
                  TILE_CLASS,
                  'border-border bg-muted/30 text-foreground hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-1.5 border border-dashed text-xs font-medium transition-colors',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                {uploading ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <Upload className="text-muted-foreground size-5" aria-hidden />
                )}
                {uploading ? 'Uploading' : 'Upload'}
              </button>
              {uploads.map((reference) => {
                const isSelected = selectedIds.has(reference.id);
                const blocked = !isSelected && full;
                const name = reference.file_name ?? 'photo';
                return (
                  <button
                    key={reference.id}
                    type="button"
                    disabled={blocked}
                    aria-pressed={isSelected}
                    aria-label={isSelected ? `${name} selected` : `Use ${name}`}
                    onClick={() => onToggleUpload(reference)}
                    className={cn(
                      TILE_CLASS,
                      isSelected && 'ring-primary ring-offset-background ring-2 ring-offset-2',
                      blocked && 'opacity-40'
                    )}
                  >
                    <img
                      src={reference.public_url}
                      alt=""
                      loading="lazy"
                      className="bg-muted size-full object-cover"
                    />
                    {isSelected && <SelectedBadge />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-border/60 border-t px-4 py-3 lg:border-0 lg:px-0 lg:pb-0 lg:pt-2">
          <Button
            type="button"
            className="min-h-11 w-full lg:ml-auto lg:flex lg:w-auto lg:min-w-28"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
