import { useId, type ChangeEvent } from 'react';

import { Loader2, Plus, Trash2 } from 'lucide-react';

import { useUploadAppSettingsAsset } from '@/features/dashboard/bookings/hooks/useUploadAppSettingsAsset';
import { withStorageUrlCacheBust } from '@/features/dashboard/bookings/lib/storageUrls';
import {
  MAX_EXTERNAL_REVIEW_STAY_PHOTOS,
  normalizeStayPhotoUrls,
} from '@/features/dashboard/org/lib/propertyExternalReviews';

import { cn } from '@/lib/utils';

type Props = {
  reviewId: string;
  stayPhotoUrls: string[];
  disabled?: boolean;
  onStayPhotoUrlsChange: (urls: string[]) => void;
};

function AddPhotoSlot({
  slotKey,
  enabled,
  uploading,
  onSelected,
}: {
  slotKey: string;
  enabled: boolean;
  uploading?: boolean;
  onSelected: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputId = `external-review-stay-add-${slotKey}`;

  return (
    <div
      className={cn(
        'border-border/80 bg-muted/20 relative aspect-square overflow-hidden rounded-xl border border-dashed',
        enabled && !uploading && 'hover:border-primary/40 hover:bg-muted/40 transition-colors',
        (!enabled || uploading) && 'opacity-45'
      )}
    >
      {enabled && !uploading ? (
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={!enabled}
          aria-label="Add photo"
          className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:pointer-events-none disabled:cursor-not-allowed"
          onChange={onSelected}
        />
      ) : null}
      <div className="pointer-events-none flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
        {uploading ? (
          <Loader2 className="text-muted-foreground size-5 animate-spin" aria-hidden />
        ) : (
          <div className="border-border bg-background/80 flex size-8 items-center justify-center rounded-full border">
            <Plus className="text-muted-foreground size-4" aria-hidden />
          </div>
        )}
        <span className="text-muted-foreground text-[11px] font-medium">Photo</span>
      </div>
    </div>
  );
}

function StayPhotoTile({
  url,
  disabled,
  onRemove,
}: {
  url: string;
  disabled?: boolean;
  onRemove: () => void;
}) {
  const displaySrc = withStorageUrlCacheBust(url, null);

  return (
    <div className="border-border bg-muted group relative aspect-square overflow-hidden rounded-xl border">
      <img
        src={displaySrc ?? undefined}
        alt=""
        className="absolute inset-0 size-full object-cover"
        loading="lazy"
        draggable={false}
      />
      {!disabled ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 via-black/35 to-transparent p-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          <div className="pointer-events-auto flex justify-end">
            <button
              type="button"
              aria-label="Remove photo"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex size-8 items-center justify-center rounded-md shadow-sm transition-colors"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PropertyExternalReviewStayPhotosField({
  reviewId,
  stayPhotoUrls,
  disabled,
  onStayPhotoUrlsChange,
}: Props) {
  const baseId = useId();
  const uploadMut = useUploadAppSettingsAsset();
  const photos = normalizeStayPhotoUrls(stayPhotoUrls);
  const busy = disabled || uploadMut.isPending;
  const canAdd = photos.length < MAX_EXTERNAL_REVIEW_STAY_PHOTOS;

  async function uploadNext(file: File) {
    const result = await uploadMut.mutateAsync({
      assetType: 'external_review_stay_photo',
      file,
      reviewId,
      photoIndex: photos.length,
    });
    onStayPhotoUrlsChange([...photos, result.url]);
  }

  function removeAt(index: number) {
    onStayPhotoUrlsChange(photos.filter((_, i) => i !== index));
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void uploadNext(file).catch(() => undefined);
  }

  const slots = Array.from(
    { length: MAX_EXTERNAL_REVIEW_STAY_PHOTOS },
    (_, index) => photos[index] ?? null
  );

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {slots.map((url, index) =>
        url ? (
          <StayPhotoTile
            key={`${reviewId}-photo-${index}`}
            url={url}
            disabled={busy}
            onRemove={() => removeAt(index)}
          />
        ) : (
          <AddPhotoSlot
            key={`${reviewId}-slot-${index}`}
            slotKey={`${baseId}-${index}`}
            enabled={canAdd && !busy}
            uploading={uploadMut.isPending}
            onSelected={handleFileInput}
          />
        )
      )}
    </div>
  );
}
