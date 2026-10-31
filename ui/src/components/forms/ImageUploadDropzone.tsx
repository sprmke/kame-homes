import { ImageIcon, ImagePlus, Loader2 } from 'lucide-react';

import { UploadPreviewActionBar } from '@/components/forms/UploadPreviewActionBar';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  accept?: string;
  imageUrl: string | null;
  uploading?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  previewClassName?: string;
  onFileSelect: (file: File | undefined) => void;
  onRemove: () => void;
};

export function ImageUploadDropzone({
  id,
  accept = 'image/jpeg,image/png,image/webp',
  imageUrl,
  uploading = false,
  disabled = false,
  emptyLabel = 'Upload',
  previewClassName = 'absolute inset-0 size-full object-cover',
  onFileSelect,
  onRemove,
}: Props) {
  const busy = disabled || uploading;
  const hasImage = Boolean(imageUrl?.trim());

  return (
    <div
      className={cn(
        'border-border bg-muted/20 relative flex min-h-[140px] items-center justify-center overflow-hidden rounded-xl border border-dashed',
        busy && !uploading && 'opacity-60'
      )}
    >
      {uploading ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Uploading…
        </div>
      ) : hasImage ? (
        <>
          <img src={imageUrl!} alt="" className={previewClassName} />
          <UploadPreviewActionBar inputId={id} onRemove={onRemove} />
        </>
      ) : (
        <label
          htmlFor={id}
          className={cn(
            'flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center gap-2 px-4 py-6 text-center',
            busy && 'cursor-not-allowed'
          )}
        >
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
            <ImagePlus className="size-5" aria-hidden />
          </span>
          <span className="text-foreground text-sm font-medium">{emptyLabel}</span>
        </label>
      )}
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          onFileSelect(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Contained image preview (settings cards) with the same bottom action bar. */
export function ImageUploadDropzoneContained({
  id,
  accept = 'image/jpeg,image/png,image/webp',
  imageUrl,
  uploading = false,
  disabled = false,
  emptyIcon: EmptyIcon = ImageIcon,
  emptyLabel = 'Screenshot',
  onFileSelect,
  onRemove,
}: Omit<Props, 'previewClassName'> & {
  emptyIcon?: typeof ImageIcon;
  emptyLabel?: string;
}) {
  const busy = disabled || uploading;
  const hasImage = Boolean(imageUrl?.trim());

  return (
    <div
      className={cn(
        'border-border/60 bg-muted/10 relative w-full overflow-hidden rounded-xl border',
        busy && !uploading && 'opacity-60'
      )}
    >
      <div
        className={cn(
          'bg-muted/20 relative flex min-h-[140px] w-full items-center justify-center overflow-hidden sm:min-h-[160px]',
          !hasImage && 'border-border border border-dashed'
        )}
      >
        {uploading ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Uploading…
          </div>
        ) : hasImage ? (
          <>
            <div className="flex max-h-[min(40vh,220px)] min-h-[140px] w-full items-center justify-center p-3 sm:min-h-[160px]">
              <img
                src={imageUrl!}
                alt=""
                className="max-h-[min(36vh,196px)] w-auto max-w-full rounded-md object-contain shadow-sm"
              />
            </div>
            <UploadPreviewActionBar inputId={id} onRemove={onRemove} />
          </>
        ) : (
          <label
            htmlFor={id}
            className={cn(
              'text-muted-foreground flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center gap-2.5 px-4 py-6 text-sm sm:min-h-[160px]',
              !busy && 'hover:bg-muted/20 hover:text-foreground',
              busy && 'cursor-not-allowed'
            )}
          >
            <span className="border-border bg-background flex size-11 items-center justify-center rounded-xl border shadow-sm">
              <EmptyIcon className="text-primary size-5" aria-hidden />
            </span>
            <span className="text-foreground font-medium">{emptyLabel}</span>
          </label>
        )}
      </div>
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          onFileSelect(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
