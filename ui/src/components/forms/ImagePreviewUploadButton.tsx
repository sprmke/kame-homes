import type { ReactNode } from 'react';

import { Loader2, Upload } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  imageUrl: string;
  previewAlt: string;
  previewClassName?: string;
  busy?: boolean;
  uploading?: boolean;
  uploadAriaLabel: string;
  onPickFile: () => void;
  overlay?: ReactNode;
};

export function ImagePreviewUploadButton({
  imageUrl,
  previewAlt,
  previewClassName = 'block h-auto max-h-40 w-auto max-w-full object-contain',
  busy = false,
  uploading = false,
  uploadAriaLabel,
  onPickFile,
  overlay,
}: Props) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onPickFile}
      aria-label={uploadAriaLabel}
      className={cn(
        'relative block max-w-full overflow-hidden rounded-lg border-0 bg-transparent p-0',
        'focus-visible:ring-ring focus-visible:ring-offset-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        !busy && 'cursor-pointer',
        busy && !uploading && 'cursor-not-allowed opacity-60'
      )}
    >
      <img
        src={imageUrl}
        alt={previewAlt}
        className={cn(previewClassName, uploading && 'opacity-50')}
      />
      <span
        className={cn(
          'bg-background/80 text-foreground pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-sm font-medium transition-opacity motion-reduce:transition-none',
          uploading
            ? 'opacity-100'
            : 'opacity-0 group-focus-within/image:opacity-100 group-hover/image:opacity-100'
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span>Uploading…</span>
          </>
        ) : (
          <>
            <Upload className="size-5" aria-hidden />
            {overlay ?? <span>Upload</span>}
          </>
        )}
      </span>
    </button>
  );
}
