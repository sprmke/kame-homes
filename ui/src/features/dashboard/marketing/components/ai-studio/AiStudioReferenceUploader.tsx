import { useRef, useState } from 'react';

import { ImagePlus, Library, Loader2, X } from 'lucide-react';

import { AiStudioReferenceLibraryDrawer } from '@/features/dashboard/marketing/components/ai-studio/AiStudioReferenceLibraryDrawer';
import {
  useMarketingGenerationReferences,
  useUploadMarketingGenerationReference,
} from '@/features/dashboard/marketing/hooks/useMarketingGenerationReferences';
import type { MarketingGenerationReference } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  references: MarketingGenerationReference[];
  onAdd: (reference: MarketingGenerationReference) => void;
  onRemove: (referenceId: string) => void;
  maxReferences: number;
  disabled?: boolean;
};

/**
 * Reference photos — full drop zone (Canva / Leonardo pattern), thumbnails when added,
 * optional library drawer for previously uploaded shots.
 */
export function AiStudioReferenceUploader({
  references,
  onAdd,
  onRemove,
  maxReferences,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const upload = useUploadMarketingGenerationReference();
  const library = useMarketingGenerationReferences();

  const atCapacity = references.length >= maxReferences;
  const busy = upload.isPending;
  const selectedIds = new Set(references.map((reference) => reference.id));
  const libraryCount = library.data?.length ?? 0;
  const hasPhotos = references.length > 0;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || atCapacity) return;
    const room = maxReferences - references.length;
    for (const file of Array.from(files).slice(0, room)) {
      const reference = await upload.mutateAsync(file).catch(() => null);
      if (reference) onAdd(reference);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="settings-field-label">Photos</Label>
        <span className="text-muted-foreground text-xs tabular-nums">
          {hasPhotos
            ? `${references.length}/${maxReferences}`
            : `Optional · up to ${maxReferences}`}
        </span>
      </div>

      {!atCapacity && (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            'border-border/80 bg-muted/20 hover:border-primary/40 hover:bg-primary/5 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center transition-colors',
            hasPhotos ? 'min-h-[72px] py-3' : 'min-h-[112px]',
            dragging && 'border-primary bg-primary/10',
            (disabled || busy) && 'opacity-60'
          )}
        >
          {busy ? (
            <Loader2 className="text-muted-foreground size-5 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="text-muted-foreground size-5" aria-hidden />
          )}
          <span className="text-foreground text-sm font-medium">
            {busy ? 'Uploading' : hasPhotos ? 'Add more' : 'Drop photos or click'}
          </span>
          {!hasPhotos && <span className="text-muted-foreground text-xs">JPEG, PNG, or WebP</span>}
        </button>
      )}

      {hasPhotos && (
        <div className="flex flex-wrap gap-2">
          {references.map((reference) => (
            <div
              key={reference.id}
              className="border-border/70 bg-muted/30 relative size-16 shrink-0 overflow-hidden rounded-xl border sm:size-[4.5rem]"
            >
              <img
                src={reference.public_url}
                alt={reference.file_name ?? 'Reference'}
                className="size-full object-cover"
                width={72}
                height={72}
              />
              <button
                type="button"
                onClick={() => onRemove(reference.id)}
                aria-label="Remove photo"
                className="bg-background/95 text-foreground absolute right-1 top-1 flex size-7 items-center justify-center rounded-full shadow-sm"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {libraryCount > 0 && !atCapacity && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-9 px-2"
          disabled={disabled}
          onClick={() => setLibraryOpen(true)}
        >
          <Library className="size-3.5" aria-hidden />
          Library
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <AiStudioReferenceLibraryDrawer
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        references={library.data ?? []}
        selectedIds={selectedIds}
        remainingSlots={Math.max(0, maxReferences - references.length)}
        onPick={onAdd}
      />
    </div>
  );
}
