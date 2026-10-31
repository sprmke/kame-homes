import { FileText, ImagePlus, Loader2 } from 'lucide-react';

import { UploadPreviewActionBar } from '@/components/forms/UploadPreviewActionBar';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  accept: string;
  file: File | null;
  previewUrl: string | null;
  uploading?: boolean;
  hasError?: boolean;
  emptyHint?: string;
  onFileSelect: (file: File | undefined) => void;
  onClear: () => void;
};

function isPdfFile(file: File | null, previewUrl: string | null): boolean {
  return (
    file?.type === 'application/pdf' ||
    (previewUrl?.toLowerCase().includes('.pdf') ?? false) ||
    (file?.name.toLowerCase().endsWith('.pdf') ?? false)
  );
}

export function DocumentUploadDropzone({
  id,
  accept,
  file,
  previewUrl,
  uploading = false,
  hasError = false,
  emptyHint = 'JPEG, PNG, WebP, or PDF · max 5 MB',
  onFileSelect,
  onClear,
}: Props) {
  const isPdf = isPdfFile(file, previewUrl);
  const hasImagePreview = Boolean(previewUrl && !isPdf);
  const hasDocument = Boolean(file || previewUrl);

  return (
    <div
      className={cn(
        'border-border bg-muted/20 relative flex min-h-[140px] items-center justify-center overflow-hidden rounded-xl border border-dashed',
        hasError && 'border-destructive',
        uploading && 'opacity-70'
      )}
    >
      {uploading ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Uploading…
        </div>
      ) : hasImagePreview ? (
        <>
          <img src={previewUrl!} alt="" className="absolute inset-0 size-full object-cover" />
          <UploadPreviewActionBar inputId={id} onRemove={onClear} />
        </>
      ) : hasDocument ? (
        <>
          <div className="flex w-full flex-col items-center gap-2 px-4 py-6">
            <FileText className="text-primary size-8" aria-hidden />
            <p className="text-foreground max-w-full truncate text-sm font-medium">
              {file?.name ?? 'Document uploaded'}
            </p>
          </div>
          <UploadPreviewActionBar inputId={id} onRemove={onClear} />
        </>
      ) : (
        <label
          htmlFor={id}
          className="flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center gap-2 px-4 py-6 text-center"
        >
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
            <ImagePlus className="size-5" aria-hidden />
          </span>
          <span className="text-foreground text-sm font-medium">Upload</span>
          <span className="text-muted-foreground text-xs">{emptyHint}</span>
        </label>
      )}
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          onFileSelect(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
