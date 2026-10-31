import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react';

import { ImagePlus, Loader2, Paperclip, Video, X } from 'lucide-react';
import { toast } from 'sonner';

import { useUploadSupportTicketAttachment } from '@/features/dashboard/help-support/hooks/useSupportTickets';
import type { SupportTicketAttachmentDraft } from '@/features/dashboard/help-support/lib/supportTicketSchema';

import { formatUploadLimit, validateUploadFile } from '@/lib/media/uploadLimits';
import { cn } from '@/lib/utils';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime';
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
]);
const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif|mp4|mov)$/i;
const MAX_ATTACHMENTS = 3;
const EMPTY_HINT = `JPEG, PNG, WebP, MP4, or MOV · image ${formatUploadLimit(
  'image'
)}, video ${formatUploadLimit('video')} (trim or compress longer clips first) · up to 3`;

type ComposerSlot = {
  trigger: ReactNode;
  chips: ReactNode;
  busy: boolean;
};

type Props = {
  value: SupportTicketAttachmentDraft[];
  onChange: (next: SupportTicketAttachmentDraft[]) => void;
  disabled?: boolean;
  compact?: boolean;
  onBusyChange?: (busy: boolean) => void;
  /** Reply composer: chips + paperclip trigger, no dashed dropzone. */
  variant?: 'dropzone' | 'composer';
  children?: (slot: ComposerSlot) => ReactNode;
};

function isAllowedFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (ALLOWED_MIME.has(mime)) return true;
  return !mime && ALLOWED_EXT.test(file.name);
}

export function TicketAttachmentDropzone({
  value,
  onChange,
  disabled = false,
  compact = false,
  onBusyChange,
  variant = 'dropzone',
  children,
}: Props) {
  const upload = useUploadSupportTicketAttachment();
  const generatedId = useId();
  const inputId = `ticket-attachment-${generatedId}`;
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const previewUrlsRef = useRef<Map<string, string>>(new Map());
  const onBusyChangeRef = useRef(onBusyChange);
  const [, forceRender] = useState(0);
  onBusyChangeRef.current = onBusyChange;

  useEffect(() => {
    const previews = previewUrlsRef.current;
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    onBusyChangeRef.current?.(isUploading);
    return () => onBusyChangeRef.current?.(false);
  }, [isUploading]);

  const isBusy = disabled || isUploading;
  const canAddMore = value.length < MAX_ATTACHMENTS && !disabled;

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0 || isBusy) return;
    const remaining = MAX_ATTACHMENTS - value.length;
    if (remaining <= 0) return;

    const incoming = Array.from(files);
    if (incoming.length > remaining) {
      toast.error(`Attach up to ${MAX_ATTACHMENTS} files`);
    }
    const toUpload = incoming.slice(0, remaining);

    setIsUploading(true);
    let next = value;
    for (const file of toUpload) {
      if (!isAllowedFile(file)) {
        toast.error(`${file.name} isn't a supported file type`);
        continue;
      }
      const limitCheck = validateUploadFile(
        file,
        file.type.startsWith('video/') ? 'video' : 'image'
      );
      if (!limitCheck.ok) {
        toast.error(`${file.name}: ${limitCheck.message}`);
        continue;
      }
      try {
        const attachment = await upload.mutateAsync(file);
        previewUrlsRef.current.set(attachment.path, URL.createObjectURL(file));
        next = [...next, attachment];
        onChange(next);
        forceRender((n) => n + 1);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Failed to upload ${file.name}`);
      }
    }
    setIsUploading(false);
  };

  const handleRemove = (path: string) => {
    const url = previewUrlsRef.current.get(path);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current.delete(path);
    }
    onChange(value.filter((item) => item.path !== path));
  };

  const onDragEnter = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isBusy && canAddMore) setDragActive(true);
  };

  const onDragLeave = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setDragActive(false);
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isBusy && canAddMore) event.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (isBusy || !canAddMore) return;
    void handleFiles(event.dataTransfer.files);
  };

  const fileInput = (
    <input
      id={inputId}
      type="file"
      accept={ACCEPT}
      multiple
      disabled={isBusy || !canAddMore}
      aria-label="Attach screenshot or video"
      className="peer sr-only"
      onChange={(event) => {
        void handleFiles(event.target.files);
        event.target.value = '';
      }}
    />
  );

  const chips =
    value.length > 0 ? (
      <ul className="flex flex-wrap gap-2">
        {value.map((item) => {
          const previewUrl = previewUrlsRef.current.get(item.path) ?? null;
          const isVideo = item.mimeType.startsWith('video/');
          return (
            <li
              key={item.path}
              className="bg-muted ring-border/80 relative size-12 overflow-hidden rounded-lg ring-1 ring-inset"
            >
              {previewUrl && !isVideo ? (
                <img src={previewUrl} alt="" className="size-full object-cover" />
              ) : previewUrl && isVideo ? (
                <video
                  src={previewUrl}
                  className="size-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Paperclip className="text-muted-foreground size-4" aria-hidden />
                </div>
              )}
              {!disabled ? (
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => handleRemove(item.path)}
                  className="absolute right-0 top-0 flex size-11 items-center justify-center"
                >
                  <span className="bg-background/95 text-foreground flex size-5 items-center justify-center rounded-full border shadow-sm">
                    <X className="size-3" aria-hidden />
                  </span>
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    ) : null;

  const trigger = (
    <label
      htmlFor={inputId}
      className={cn(
        'text-muted-foreground hover:text-foreground inline-flex size-10 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg',
        (isBusy || !canAddMore) && 'pointer-events-none opacity-50'
      )}
    >
      {isUploading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Paperclip className="size-4" aria-hidden />
      )}
      <span className="sr-only">Attach</span>
    </label>
  );

  if (variant === 'composer') {
    return (
      <>
        {fileInput}
        {children ? children({ trigger, chips, busy: isBusy }) : null}
      </>
    );
  }

  return (
    <div className="space-y-2">
      {fileInput}

      {value.length > 0 ? (
        <ul
          className="grid grid-cols-3 gap-2.5 sm:grid-cols-4"
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {value.map((item) => {
            const previewUrl = previewUrlsRef.current.get(item.path) ?? null;
            const isVideo = item.mimeType.startsWith('video/');
            return (
              <li
                key={item.path}
                className="bg-muted ring-border/80 group relative aspect-square min-w-0 overflow-hidden rounded-xl ring-1 ring-inset"
              >
                {previewUrl && !isVideo ? (
                  <img
                    src={previewUrl}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : previewUrl && isVideo ? (
                  <video
                    src={previewUrl}
                    className="absolute inset-0 size-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center px-2">
                    <Paperclip className="text-muted-foreground size-5 shrink-0" aria-hidden />
                  </div>
                )}
                {isVideo ? (
                  <span className="bg-background/92 text-foreground border-border/60 absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm">
                    <Video className="size-3" aria-hidden />
                    Video
                  </span>
                ) : null}
                {!disabled ? (
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    title={item.name}
                    onClick={() => handleRemove(item.path)}
                    className="absolute right-0 top-0 z-10 flex size-11 items-center justify-center"
                  >
                    <span className="bg-background/95 text-foreground flex size-8 items-center justify-center rounded-full border shadow-sm">
                      <X className="size-3.5" aria-hidden />
                    </span>
                  </button>
                ) : null}
              </li>
            );
          })}
          {canAddMore ? (
            <li>
              <label
                htmlFor={inputId}
                className={cn(
                  'border-border bg-muted/20 flex aspect-square min-h-[44px] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed transition-colors',
                  !isBusy && 'hover:border-primary/50 hover:bg-primary/[0.03]',
                  dragActive && 'border-primary bg-primary/5',
                  isBusy && 'cursor-not-allowed opacity-70'
                )}
              >
                {isUploading ? (
                  <Loader2 className="text-muted-foreground size-5 animate-spin" aria-hidden />
                ) : (
                  <>
                    <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-full">
                      <ImagePlus className="size-4" aria-hidden />
                    </span>
                    <span className="text-foreground text-xs font-medium">Add</span>
                  </>
                )}
              </label>
            </li>
          ) : null}
        </ul>
      ) : (
        <div
          className={cn(
            'border-border/80 bg-muted/20 peer-focus-visible:ring-ring relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2',
            compact ? 'min-h-[112px]' : 'min-h-[140px]',
            !isBusy && 'hover:border-primary/50 hover:bg-primary/[0.03]',
            dragActive && 'border-primary bg-primary/5',
            isBusy && 'opacity-70'
          )}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {isUploading ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-6 text-sm">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Uploading…
            </div>
          ) : (
            <label
              htmlFor={inputId}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center',
                compact ? 'min-h-[112px]' : 'min-h-[140px]',
                isBusy ? 'cursor-not-allowed' : 'cursor-pointer'
              )}
            >
              <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
                <ImagePlus className="size-5" aria-hidden />
              </span>
              <span className="text-foreground text-sm font-medium">Upload</span>
              <span className="text-muted-foreground max-w-[18rem] text-xs leading-snug">
                {EMPTY_HINT}
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
