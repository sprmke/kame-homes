import { useState } from 'react';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Plus,
  Star,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';

import { PropertyMediaPreviewDialog } from '@/features/dashboard/org/components/property-settings/PropertyMediaPreviewDialog';
import { useUploadPropertyMedia } from '@/features/dashboard/org/hooks/useUploadPropertyMedia';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import {
  ACCEPT_PROPERTY_IMAGE_INPUT,
  ACCEPT_PROPERTY_VIDEO_INPUT,
  countPropertyMedia,
  formatPropertyMediaSizeLimit,
  MAX_PROPERTY_IMAGES,
  MAX_PROPERTY_VIDEOS,
  normalizePropertyMediaDraft,
  partitionPropertyMedia,
  sequencedPropertyMediaItems,
  validatePropertyMediaFile,
  type PropertyMediaUploadKind,
} from '@/features/dashboard/org/lib/propertyMedia';
import type { PropertyMediaItem } from '@/features/dashboard/org/lib/propertySettingsConstants';
import { useUploadDevelopmentMedia } from '@/features/dashboard/super-admin/hooks/useUploadDevelopmentMedia';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PropertyMediaUploadProps = {
  items: PropertyMediaItem[];
  onChange: (items: PropertyMediaItem[]) => void;
  onPersisted?: (items: PropertyMediaItem[]) => void;
  onPersistOrder?: (items: PropertyMediaItem[]) => Promise<void>;
  disabled?: boolean;
  /** When set, uploads go to development gallery storage instead of property. */
  developmentId?: string;
};

function stopSortablePointer(event: React.PointerEvent | React.MouseEvent) {
  event.stopPropagation();
}

function MediaCardAction({
  label,
  tone = 'neutral',
  disabled,
  onClick,
  children,
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'destructive';
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onPointerDown={stopSortablePointer}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex size-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        tone === 'neutral' &&
          'border-border/60 bg-background/95 text-foreground hover:bg-background',
        tone === 'primary' &&
          'border-primary/20 bg-primary-strong text-primary-foreground hover:bg-primary-strong/90',
        tone === 'destructive' &&
          'border-destructive/20 bg-background/95 text-destructive hover:bg-destructive hover:text-white'
      )}
    >
      {children}
    </button>
  );
}

function FilePickerOverlay({
  id,
  accept,
  multiple,
  enabled,
  onSelected,
  ariaLabel,
}: {
  id: string;
  accept: string;
  multiple?: boolean;
  enabled: boolean;
  onSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  ariaLabel: string;
}) {
  return (
    <input
      id={id}
      type="file"
      accept={accept}
      multiple={multiple}
      disabled={!enabled}
      aria-label={ariaLabel}
      className={cn(
        'absolute inset-0 z-10 cursor-pointer opacity-0 disabled:pointer-events-none disabled:cursor-not-allowed'
      )}
      onChange={onSelected}
    />
  );
}

function AddMediaSlot({
  kind,
  slotKey,
  enabled,
  busy,
  onSelected,
}: {
  kind: PropertyMediaUploadKind;
  slotKey: string;
  enabled: boolean;
  busy: boolean;
  onSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const isVideo = kind === 'video';
  const accept = isVideo ? ACCEPT_PROPERTY_VIDEO_INPUT : ACCEPT_PROPERTY_IMAGE_INPUT;
  const label = isVideo ? 'Video' : 'Photo';
  const inputId = `property-media-add-${kind}-${slotKey}`;

  return (
    <div
      className={cn(
        'border-border/70 bg-muted/15 relative aspect-square overflow-hidden rounded-xl border border-dashed',
        enabled && !busy && 'hover:border-primary/35 hover:bg-muted/25 transition-colors',
        (!enabled || busy) && 'opacity-45'
      )}
    >
      {enabled && !busy ? (
        <FilePickerOverlay
          id={inputId}
          accept={accept}
          multiple={!isVideo}
          enabled={enabled && !busy}
          onSelected={onSelected}
          ariaLabel={`Add ${label.toLowerCase()}`}
        />
      ) : null}
      <div className="pointer-events-none flex size-full flex-col items-center justify-center gap-1.5 p-2 text-center">
        {busy ? (
          <Loader2 className="text-muted-foreground size-5 animate-spin" aria-hidden />
        ) : (
          <div className="border-border/70 bg-background/90 flex size-9 items-center justify-center rounded-full border shadow-sm">
            <Plus className="text-muted-foreground size-4" aria-hidden />
          </div>
        )}
        <span className="text-muted-foreground text-[11px] font-medium">{label}</span>
      </div>
    </div>
  );
}

function CoverStarButton({
  isPrimary,
  disabled,
  onSetPrimary,
  className,
}: {
  isPrimary: boolean;
  disabled?: boolean;
  onSetPrimary: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled || isPrimary}
      aria-label={isPrimary ? 'Cover photo' : 'Set as cover photo'}
      title={isPrimary ? 'Cover photo' : 'Set as cover photo'}
      onPointerDown={stopSortablePointer}
      onClick={(event) => {
        event.stopPropagation();
        if (!isPrimary) onSetPrimary();
      }}
      className={cn(
        'flex size-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-colors',
        'disabled:pointer-events-none',
        isPrimary
          ? 'border-primary bg-primary-strong text-primary-foreground'
          : 'border-border/60 bg-background/95 text-foreground hover:bg-primary-strong hover:text-white',
        className
      )}
    >
      <Star className={cn('size-3.5', isPrimary && 'fill-current')} aria-hidden />
    </button>
  );
}

function DragReorderHandle({
  attributes,
  listeners,
}: {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
}) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      title="Drag to reorder"
      className={cn(
        'absolute left-1.5 top-1.5 z-20 flex min-h-[36px] min-w-[36px] cursor-grab items-center justify-center rounded-sm text-white shadow-sm backdrop-blur-lg',
        'touch-none active:cursor-grabbing'
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-3.5" aria-hidden />
    </button>
  );
}

function SortableImageCard({
  item,
  disabled,
  busy,
  reorderDisabled,
  onSetPrimary,
  onRemove,
  onPreview,
}: {
  item: PropertyMediaItem;
  disabled: boolean;
  busy: boolean;
  reorderDisabled?: boolean;
  onSetPrimary: () => void;
  onRemove: () => void;
  onPreview: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: disabled || busy || reorderDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'bg-muted group relative aspect-square touch-manipulation overflow-hidden rounded-xl',
        item.isPrimary
          ? 'ring-primary ring-offset-background shadow-sm ring-2 ring-offset-2'
          : 'ring-border/80 ring-1 ring-inset',
        isDragging && 'ring-primary/40 z-20 scale-[1.02] opacity-95 shadow-lg'
      )}
    >
      <img
        src={item.url}
        alt=""
        className="absolute inset-0 size-full object-cover"
        loading="lazy"
        draggable={false}
      />

      <button
        type="button"
        className="absolute inset-0 z-[5] cursor-zoom-in"
        aria-label="Preview photo"
        onClick={onPreview}
      />

      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200',
          !disabled && 'group-focus-within:bg-black/20 group-hover:bg-black/20'
        )}
        aria-hidden
      />

      {!disabled && !busy ? (
        <DragReorderHandle attributes={attributes} listeners={listeners} />
      ) : null}

      {!disabled ? (
        <div
          className={cn(
            'absolute right-1.5 top-1.5 z-20 flex items-center gap-1 transition-opacity duration-200',
            item.isPrimary
              ? 'opacity-100'
              : 'opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100'
          )}
        >
          <CoverStarButton
            isPrimary={item.isPrimary === true}
            disabled={busy}
            onSetPrimary={onSetPrimary}
          />
          <MediaCardAction
            label="Remove photo"
            tone="destructive"
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </MediaCardAction>
        </div>
      ) : null}
    </div>
  );
}

function VideoMediaCard({
  item,
  disabled,
  busy,
  onRemove,
  onPreview,
}: {
  item: PropertyMediaItem;
  disabled: boolean;
  busy: boolean;
  onRemove: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="bg-muted ring-border/80 group relative aspect-square overflow-hidden rounded-xl ring-1 ring-inset">
      <video
        src={item.url}
        className="pointer-events-none absolute inset-0 size-full object-cover"
        muted
        playsInline
        preload="metadata"
      />
      <span className="bg-background/92 text-foreground border-border/60 absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur-sm">
        <Video className="size-3" aria-hidden />
        Video
      </span>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-black/35 p-2.5 backdrop-blur-sm">
          <Video className="size-4 text-white" aria-hidden />
        </div>
      </div>
      <button
        type="button"
        className="absolute inset-0 z-[5] cursor-pointer"
        aria-label="Preview video"
        onClick={onPreview}
      />
      {!disabled ? (
        <div
          className={cn(
            'absolute right-1.5 top-1.5 z-20 transition-opacity duration-200',
            'opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100'
          )}
        >
          <MediaCardAction
            label="Remove video"
            tone="destructive"
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </MediaCardAction>
        </div>
      ) : null}
    </div>
  );
}

function EmptyMediaDropzone({
  imagePickerEnabled,
  videoPickerEnabled,
  isBusy,
  disabled,
  onImageSelected,
  onVideoSelected,
  onDrop,
}: {
  imagePickerEnabled: boolean;
  videoPickerEnabled: boolean;
  isBusy: boolean;
  disabled: boolean;
  onImageSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onVideoSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent, kind: PropertyMediaUploadKind) => void;
}) {
  const photoInputId = 'property-media-empty-photos';
  const videoInputId = 'property-media-empty-video';

  return (
    <div
      onDrop={(event) => onDrop(event, 'image')}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      className={cn(
        'border-border rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-8',
        (disabled || isBusy) && 'opacity-60'
      )}
    >
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-muted rounded-full p-4">
            {isBusy ? (
              <Loader2 className="text-muted-foreground size-8 animate-spin" aria-hidden />
            ) : (
              <Upload className="text-muted-foreground size-8" aria-hidden />
            )}
          </div>
          <div>
            <p className="font-medium">Drop files here or use the buttons below</p>
            <p className="text-muted-foreground text-sm">
              Images up to {formatPropertyMediaSizeLimit('image')} ({MAX_PROPERTY_IMAGES} max) ·
              Video up to {formatPropertyMediaSizeLimit('video')} ({MAX_PROPERTY_VIDEOS} max)
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative inline-flex w-full sm:w-auto">
            <FilePickerOverlay
              id={photoInputId}
              accept={ACCEPT_PROPERTY_IMAGE_INPUT}
              multiple
              enabled={imagePickerEnabled}
              onSelected={onImageSelected}
              ariaLabel="Upload photos"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!imagePickerEnabled}
              className="pointer-events-none min-h-[44px] w-full sm:w-auto"
              tabIndex={-1}
              aria-hidden
            >
              <ImageIcon className="size-4" aria-hidden />
              Upload Photos
            </Button>
          </div>

          <div className="relative inline-flex w-full sm:w-auto">
            <FilePickerOverlay
              id={videoInputId}
              accept={ACCEPT_PROPERTY_VIDEO_INPUT}
              enabled={videoPickerEnabled}
              onSelected={onVideoSelected}
              ariaLabel="Upload video"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!videoPickerEnabled}
              className="pointer-events-none min-h-[44px] w-full sm:w-auto"
              tabIndex={-1}
              aria-hidden
            >
              <Video className="size-4" aria-hidden />
              Upload Video
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PropertyMediaUpload({
  items,
  onChange,
  onPersisted,
  onPersistOrder,
  disabled = false,
  developmentId,
}: PropertyMediaUploadProps) {
  const propertyId = usePropertyIdParam();
  const propertyMedia = useUploadPropertyMedia();
  const developmentMedia = useUploadDevelopmentMedia(developmentId);
  const { upload, remove } = developmentId ? developmentMedia : propertyMedia;
  const scopeId = developmentId ?? propertyId;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadingKind, setUploadingKind] = useState<PropertyMediaUploadKind | null>(null);
  const [uploadingSlotKey, setUploadingSlotKey] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<PropertyMediaItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { images, video } = partitionPropertyMedia(items);
  const counts = countPropertyMedia(items);
  const canUploadImage = counts.images < MAX_PROPERTY_IMAGES;
  const canUploadVideo = counts.videos < MAX_PROPERTY_VIDEOS;
  const isBusy = upload.isPending || remove.isPending || Boolean(uploadingKind);
  const hasMedia = items.length > 0;

  const imagePickerEnabled = !disabled && !isBusy && canUploadImage;
  const videoPickerEnabled = !disabled && !isBusy && canUploadVideo;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const applyMedia = (next: PropertyMediaItem[], persisted = false) => {
    const normalized = normalizePropertyMediaDraft(next);
    onChange(normalized);
    if (persisted) onPersisted?.(normalized);
  };

  const persistOrder = async (next: PropertyMediaItem[]) => {
    onChange(next);
    if (onPersistOrder) {
      try {
        await onPersistOrder(next);
        onPersisted?.(next);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save gallery order');
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((item) => item.id === active.id);
    const newIndex = images.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedImages = arrayMove(images, oldIndex, newIndex);
    void persistOrder(sequencedPropertyMediaItems(reorderedImages, video));
  };

  const setPrimary = (id: string) => {
    void persistOrder(sequencedPropertyMediaItems(images, video, id));
  };

  const handleRemove = async (item: PropertyMediaItem) => {
    setBusyId(item.id);
    try {
      const result = await remove.mutateAsync({
        mediaId: item.id,
        storagePath: item.storagePath,
      });
      applyMedia(result.media, true);
      toast.success('Media removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove media');
    } finally {
      setBusyId(null);
    }
  };

  const processFiles = async (
    files: FileList | File[],
    kind: PropertyMediaUploadKind,
    slotKey?: string
  ) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    if (!scopeId) {
      toast.error(
        developmentId
          ? 'Development context is missing. Reload the page'
          : 'Property context is missing. Reload the page'
      );
      return;
    }

    setUploadingKind(kind);
    setUploadingSlotKey(slotKey ?? (kind === 'video' ? 'video' : `slot-${images.length}`));
    let working = [...items];
    let currentCounts = countPropertyMedia(working);

    for (const file of list) {
      const validationError = validatePropertyMediaFile(
        file,
        kind,
        currentCounts.images,
        currentCounts.videos
      );
      if (validationError) {
        toast.error(validationError);
        continue;
      }

      try {
        const result = await upload.mutateAsync(file);
        working = result.media;
        currentCounts = countPropertyMedia(working);
        applyMedia(working, true);
        if (kind === 'image') {
          const nextImages = partitionPropertyMedia(working).images;
          setUploadingSlotKey(`slot-${nextImages.length}`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Upload failed');
        break;
      }
    }

    if (working.length > items.length) {
      toast.success(kind === 'video' ? 'Video uploaded' : 'Photo uploaded');
    }
    setUploadingKind(null);
    setUploadingSlotKey(null);
  };

  const handleFileInput = (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: PropertyMediaUploadKind,
    slotKey?: string
  ) => {
    const files = event.target.files;
    if (files?.length) void processFiles(files, kind, slotKey);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent, kind: PropertyMediaUploadKind) => {
    event.preventDefault();
    if (disabled || isBusy) return;
    if (event.dataTransfer.files?.length) {
      void processFiles(
        event.dataTransfer.files,
        kind,
        kind === 'video' ? 'video' : `slot-${images.length}`
      );
    }
  };

  const imageSlots = Array.from(
    { length: MAX_PROPERTY_IMAGES },
    (_, index) => images[index] ?? null
  );

  const openPreview = (item: PropertyMediaItem) => {
    setPreviewItem(item);
    setPreviewOpen(true);
  };

  const previewItems = previewItem?.type === 'video' ? (video ? [video] : []) : images;

  return (
    <div className="space-y-3">
      <PropertyMediaPreviewDialog
        item={previewItem}
        items={previewItems}
        open={previewOpen}
        onOpenChange={(nextOpen) => {
          setPreviewOpen(nextOpen);
          if (!nextOpen) setPreviewItem(null);
        }}
        onNavigate={setPreviewItem}
      />
      {!hasMedia ? (
        <EmptyMediaDropzone
          imagePickerEnabled={imagePickerEnabled}
          videoPickerEnabled={videoPickerEnabled}
          isBusy={isBusy}
          disabled={disabled}
          onImageSelected={(event) => handleFileInput(event, 'image')}
          onVideoSelected={(event) => handleFileInput(event, 'video')}
          onDrop={handleDrop}
        />
      ) : (
        <>
          <p className="text-muted-foreground text-xs sm:text-[13px]">
            Drag photos to reorder · first photo is cover unless you choose another
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-3">
              <SortableContext items={images.map((item) => item.id)} strategy={rectSortingStrategy}>
                {imageSlots.map((item, index) =>
                  item ? (
                    <SortableImageCard
                      key={item.id}
                      item={item}
                      disabled={disabled}
                      busy={busyId === item.id}
                      reorderDisabled={uploadingKind !== null}
                      onSetPrimary={() => setPrimary(item.id)}
                      onRemove={() => void handleRemove(item)}
                      onPreview={() => openPreview(item)}
                    />
                  ) : (
                    <AddMediaSlot
                      key={`photo-slot-${index}`}
                      kind="image"
                      slotKey={`slot-${index}`}
                      enabled={imagePickerEnabled}
                      busy={uploadingSlotKey === `slot-${index}`}
                      onSelected={(event) => handleFileInput(event, 'image', `slot-${index}`)}
                    />
                  )
                )}
              </SortableContext>

              {video ? (
                <VideoMediaCard
                  item={video}
                  disabled={disabled}
                  busy={busyId === video.id}
                  onRemove={() => void handleRemove(video)}
                  onPreview={() => openPreview(video)}
                />
              ) : (
                <AddMediaSlot
                  kind="video"
                  slotKey="video"
                  enabled={videoPickerEnabled}
                  busy={uploadingSlotKey === 'video'}
                  onSelected={(event) => handleFileInput(event, 'video', 'video')}
                />
              )}
            </div>
          </DndContext>
        </>
      )}
    </div>
  );
}
