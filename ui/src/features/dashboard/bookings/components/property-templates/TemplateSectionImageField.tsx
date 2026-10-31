import { useRef, type ChangeEvent, type MouseEvent } from 'react';

import { Loader2, Trash2, Upload } from 'lucide-react';

import { useUploadPropertyTemplateAsset } from '@/features/dashboard/bookings/hooks/useUploadPropertyTemplateAsset';
import { withStorageUrlCacheBust } from '@/features/dashboard/bookings/lib/storageUrls';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  templateKey: string;
  imageUrl: string | null;
  previewBust?: number;
  disabled?: boolean;
  onImageUrlChange: (url: string | null) => void;
};

export function TemplateSectionImageField({
  templateKey,
  imageUrl,
  previewBust,
  disabled,
  onImageUrlChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadMut = useUploadPropertyTemplateAsset();
  const busy = disabled || uploadMut.isPending;
  const hasImage = Boolean(imageUrl?.trim());
  const displaySrc = hasImage ? withStorageUrlCacheBust(imageUrl!, previewBust || null) : null;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadMut.mutateAsync({
        assetType: 'section_image',
        templateKey,
        file,
      });
      onImageUrlChange(result.url);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function stopOverlayClick(event: MouseEvent) {
    event.stopPropagation();
  }

  return (
    <div className="mb-4">
      <div className="border-border/60 bg-card w-full rounded-xl border p-3">
        {hasImage ? (
          <div
            tabIndex={busy ? -1 : 0}
            className={cn(
              'group/section-image border-border bg-muted/20 relative h-36 w-full overflow-hidden rounded-lg border border-dashed sm:h-48',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
              busy && 'opacity-60'
            )}
          >
            <img
              key={previewBust ?? imageUrl}
              src={displaySrc!}
              alt=""
              className={cn('h-full w-full object-cover', uploadMut.isPending && 'opacity-50')}
            />
            <div
              className={cn(
                'bg-background/80 absolute inset-0 flex items-center justify-center gap-2 px-3 transition-opacity motion-reduce:transition-none',
                uploadMut.isPending
                  ? 'opacity-100'
                  : 'opacity-0 group-focus-within/section-image:opacity-100 group-hover/section-image:opacity-100 [@media(hover:none)]:opacity-100'
              )}
            >
              {uploadMut.isPending ? (
                <div className="text-foreground flex flex-col items-center gap-2 text-sm font-medium">
                  <Loader2 className="text-primary size-5 animate-spin" aria-hidden />
                  <span>Uploading…</span>
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    className="min-h-[44px] gap-1.5"
                    onClick={(event) => {
                      stopOverlayClick(event);
                      fileRef.current?.click();
                    }}
                  >
                    <Upload className="size-4" aria-hidden />
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className="min-h-[44px] gap-1.5"
                    onClick={(event) => {
                      stopOverlayClick(event);
                      onImageUrlChange(null);
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
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'border-border bg-muted/20 text-muted-foreground flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 text-sm sm:h-48',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
              !busy && 'hover:bg-muted/30 hover:text-foreground cursor-pointer',
              busy && 'cursor-not-allowed opacity-60'
            )}
          >
            {uploadMut.isPending ? (
              <>
                <Loader2 className="text-primary size-5 animate-spin" />
                <span>Uploading…</span>
              </>
            ) : (
              <>
                <Upload className="text-primary size-5" />
                <span>Upload image</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        id={`section-image-${templateKey}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={busy}
        aria-label="Section image"
        onChange={(e) => void handleFileChange(e)}
      />
    </div>
  );
}
