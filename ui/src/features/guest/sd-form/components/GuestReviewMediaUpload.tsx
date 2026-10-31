import { useEffect, useId, useRef, type ChangeEvent, type ReactNode } from 'react';

import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

const MAX_REVIEW_PHOTOS = 3;

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const ACCEPT_REVIEW_IMAGE_INPUT = 'image/jpeg,image/png,image/webp';

export type GuestReviewMediaItem = {
  id: string;
  file: File;
  previewUrl: string;
};

function isReviewImage(file: File): boolean {
  return IMAGE_MIME.has(file.type);
}

function validateReviewPhotoList(items: GuestReviewMediaItem[], incoming: File): string | null {
  if (!isReviewImage(incoming)) return 'Only images are supported';
  if (items.length >= MAX_REVIEW_PHOTOS) return 'Upload up to 3 images';
  return null;
}

function createReviewMediaItem(file: File): GuestReviewMediaItem {
  return {
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

function TileIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'bg-destructive text-destructive-foreground hover:bg-destructive/90 flex size-8 items-center justify-center rounded-md shadow-sm transition-colors',
        'disabled:pointer-events-none disabled:opacity-40'
      )}
    >
      {children}
    </button>
  );
}

function AddPhotoSlot({
  slotKey,
  enabled,
  onSelected,
}: {
  slotKey: string;
  enabled: boolean;
  onSelected: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputId = `guest-review-media-add-photo-${slotKey}`;

  return (
    <div
      className={cn(
        'border-border/80 bg-muted/20 relative aspect-square overflow-hidden rounded-xl border border-dashed',
        enabled && 'hover:border-primary/40 hover:bg-muted/40 transition-colors',
        !enabled && 'opacity-45'
      )}
    >
      {enabled ? (
        <input
          id={inputId}
          type="file"
          accept={ACCEPT_REVIEW_IMAGE_INPUT}
          multiple
          disabled={!enabled}
          aria-label="Add photo"
          className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:pointer-events-none disabled:cursor-not-allowed"
          onChange={onSelected}
        />
      ) : null}
      <div className="pointer-events-none flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
        <div className="border-border bg-background/80 flex size-8 items-center justify-center rounded-full border">
          <Plus className="text-muted-foreground size-4" aria-hidden />
        </div>
        <span className="text-muted-foreground text-[11px] font-medium">Photo</span>
      </div>
    </div>
  );
}

function ReviewPhotoCard({
  item,
  disabled,
  onRemove,
}: {
  item: GuestReviewMediaItem;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="border-border bg-muted group relative aspect-square overflow-hidden rounded-xl border">
      <img
        src={item.previewUrl}
        alt=""
        className="absolute inset-0 size-full object-cover"
        loading="lazy"
        draggable={false}
      />
      {!disabled ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 via-black/35 to-transparent p-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          <div className="pointer-events-auto flex justify-end">
            <TileIconButton label="Remove photo" disabled={disabled} onClick={onRemove}>
              <Trash2 className="size-3.5" aria-hidden />
            </TileIconButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface GuestReviewMediaUploadProps {
  items: GuestReviewMediaItem[];
  onChange: (items: GuestReviewMediaItem[]) => void;
  disabled?: boolean;
  busy?: boolean;
}

export function GuestReviewMediaUpload({
  items,
  onChange,
  disabled = false,
  busy = false,
}: GuestReviewMediaUploadProps) {
  const baseId = useId();
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const canAddPhoto = items.length < MAX_REVIEW_PHOTOS;
  const pickerEnabled = !disabled && !busy;

  const revokeItem = (item: GuestReviewMediaItem) => {
    URL.revokeObjectURL(item.previewUrl);
  };

  const removeItem = (id: string) => {
    const next = items.filter((item) => {
      if (item.id === id) {
        revokeItem(item);
        return false;
      }
      return true;
    });
    onChange(next);
  };

  const addFiles = (files: FileList | File[]) => {
    let working = [...items];
    for (const file of Array.from(files)) {
      const err = validateReviewPhotoList(working, file);
      if (err) {
        toast.error(err);
        continue;
      }
      working = [...working, createReviewMediaItem(file)];
    }
    if (working.length !== items.length) {
      onChange(working);
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) addFiles(files);
    event.target.value = '';
  };

  const photoSlots = Array.from({ length: MAX_REVIEW_PHOTOS }, (_, index) => items[index] ?? null);

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {photoSlots.map((item, index) =>
        item ? (
          <ReviewPhotoCard
            key={item.id}
            item={item}
            disabled={disabled || busy}
            onRemove={() => removeItem(item.id)}
          />
        ) : (
          <AddPhotoSlot
            key={`photo-slot-${index}`}
            slotKey={`${baseId}-slot-${index}`}
            enabled={pickerEnabled && canAddPhoto}
            onSelected={handleFileInput}
          />
        )
      )}
    </div>
  );
}

export function guestReviewMediaFiles(items: GuestReviewMediaItem[]): File[] {
  return items.map((item) => item.file);
}
