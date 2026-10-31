import { useRef, type MouseEvent } from 'react';

import { Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import {
  ACCEPT_PROPERTY_IMAGE_INPUT,
  formatPropertyMediaSizeLimit,
  validatePropertyMediaFile,
} from '@/features/dashboard/org/lib/propertyMedia';
import { useUploadParkingMedia } from '@/features/dashboard/parking/hooks/useUploadParkingMedia';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ParkingMediaUploadProps = {
  coverImage: string;
  onCoverChange: (url: string) => void;
  disabled?: boolean;
};

/** Shared frame for empty drop zone and uploaded preview — keeps both states the same size. */
const COVER_FRAME_CLASS =
  'relative w-full aspect-[16/10] overflow-hidden rounded-xl sm:aspect-[2/1]';

function stopOverlayClick(event: MouseEvent) {
  event.stopPropagation();
}

export function ParkingMediaUpload({
  coverImage,
  onCoverChange,
  disabled = false,
}: ParkingMediaUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, remove } = useUploadParkingMedia();
  const isBusy = upload.isPending || remove.isPending;
  const hasCover = Boolean(coverImage.trim());
  const pickerEnabled = !disabled && !isBusy;

  const handleFile = async (file: File) => {
    const validationError = validatePropertyMediaFile(file, 'image', hasCover ? 1 : 0, 0);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const result = await upload.mutateAsync(file);
      onCoverChange(result.coverImage ?? '');
      toast.success('Photo uploaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (!pickerEnabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleRemove = async () => {
    try {
      await remove.mutateAsync();
      onCoverChange('');
      toast.success('Photo removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove photo');
    }
  };

  const openPicker = () => {
    if (pickerEnabled) fileRef.current?.click();
  };

  return (
    <div className="border-border/60 bg-card w-full rounded-xl border p-3">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_PROPERTY_IMAGE_INPUT}
        className="hidden"
        disabled={!pickerEnabled}
        aria-label="Parking cover photo"
        onChange={handleInputChange}
      />

      {hasCover ? (
        <div
          tabIndex={pickerEnabled ? 0 : -1}
          className={cn(
            COVER_FRAME_CLASS,
            'group/cover border-primary bg-muted ring-primary/30 border ring-1',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            isBusy && 'opacity-60'
          )}
        >
          <img
            src={coverImage}
            alt=""
            className={cn(
              'absolute inset-0 size-full object-cover',
              upload.isPending && 'opacity-50'
            )}
            loading="lazy"
            draggable={false}
          />

          <div
            className={cn(
              'bg-background/80 absolute inset-0 flex items-center justify-center gap-2 px-3 transition-opacity motion-reduce:transition-none',
              isBusy
                ? 'opacity-100'
                : 'opacity-0 group-focus-within/cover:opacity-100 group-hover/cover:opacity-100 [@media(hover:none)]:opacity-100'
            )}
          >
            {isBusy ? (
              <div className="text-foreground flex flex-col items-center gap-2 text-sm font-medium">
                <Loader2 className="text-primary size-5 animate-spin" aria-hidden />
                <span>{upload.isPending ? 'Uploading…' : 'Removing…'}</span>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={!pickerEnabled}
                  className="min-h-[44px] gap-1.5"
                  onClick={(event) => {
                    stopOverlayClick(event);
                    openPicker();
                  }}
                >
                  <Upload className="size-4" aria-hidden />
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!pickerEnabled}
                  className="min-h-[44px] gap-1.5"
                  onClick={(event) => {
                    stopOverlayClick(event);
                    void handleRemove();
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Remove
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={pickerEnabled ? 0 : -1}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openPicker();
            }
          }}
          onDrop={handleDrop}
          onDragOver={(event) => {
            event.preventDefault();
            if (pickerEnabled) event.dataTransfer.dropEffect = 'copy';
          }}
          className={cn(
            COVER_FRAME_CLASS,
            'border-border bg-muted/20 flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-4 text-center transition-colors',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            pickerEnabled && 'hover:border-primary/40 hover:bg-muted/40',
            !pickerEnabled && 'cursor-not-allowed opacity-60'
          )}
        >
          {isBusy ? (
            <>
              <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
              <span className="text-sm font-medium">Uploading…</span>
            </>
          ) : (
            <>
              <div className="bg-muted rounded-full p-4">
                <Upload className="text-muted-foreground size-8" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium sm:text-base">
                  Drop a photo here or tap to upload
                </p>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Images up to {formatPropertyMediaSizeLimit('image')} (1 max)
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!pickerEnabled}
                className="min-h-[44px] gap-2"
                onClick={(event) => {
                  stopOverlayClick(event);
                  openPicker();
                }}
              >
                <Plus className="size-4" aria-hidden />
                Upload photo
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
