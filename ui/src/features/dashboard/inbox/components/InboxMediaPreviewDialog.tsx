import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Play, X } from 'lucide-react';

import type { InboxAttachmentPreview } from '@/features/dashboard/inbox/lib/inboxMessageAttachments';

import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Props = {
  attachment: InboxAttachmentPreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InboxMediaPreviewDialog({ attachment, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="modal-scrim-lightbox" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-0 z-[101] flex items-center justify-center p-3 outline-none sm:p-6',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
          onClick={() => onOpenChange(false)}
        >
          <DialogPrimitive.Title className="sr-only">Media preview</DialogPrimitive.Title>
          <DialogPrimitive.Close
            className={cn(
              'absolute right-3 top-3 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center',
              'rounded-full bg-white/10 text-white/90 backdrop-blur-sm',
              'transition-colors hover:bg-white/20 hover:text-white',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
            )}
            aria-label="Close preview"
            onClick={(e) => e.stopPropagation()}
          >
            <X className="size-5" aria-hidden />
          </DialogPrimitive.Close>

          {attachment && (
            <div
              className="flex max-h-full max-w-full items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {attachment.kind === 'video' ? (
                <video
                  src={attachment.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[calc(100dvh-2rem)] max-w-full object-contain"
                  aria-label={attachment.label ?? 'Video attachment'}
                />
              ) : attachment.kind === 'image' ? (
                <img
                  src={attachment.url}
                  alt={attachment.label ?? 'Image attachment'}
                  className="max-h-[calc(100dvh-2rem)] max-w-full object-contain"
                />
              ) : (
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-white underline-offset-2 hover:underline"
                >
                  Open attachment
                </a>
              )}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

type MediaTileProps = {
  attachment: InboxAttachmentPreview;
  outbound: boolean;
  onOpen: () => void;
};

export function InboxMessageMediaTile({ attachment, outbound, onOpen }: MediaTileProps) {
  if (attachment.kind === 'image') {
    return (
      <button
        type="button"
        className={cn(
          'block max-w-[min(100%,16rem)] overflow-hidden rounded-2xl sm:max-w-[min(100%,20rem)]',
          'ring-1 ring-black/10 transition-opacity hover:opacity-95 dark:ring-white/10',
          outbound ? 'rounded-br-md' : 'rounded-bl-md'
        )}
        onClick={onOpen}
        aria-label="View image"
      >
        <img
          src={attachment.url}
          alt={attachment.label ?? 'Attachment'}
          className="max-h-64 w-full object-cover"
          loading="lazy"
        />
      </button>
    );
  }

  if (attachment.kind === 'video') {
    return (
      <button
        type="button"
        className={cn(
          'relative block max-w-[min(100%,16rem)] overflow-hidden rounded-2xl sm:max-w-[min(100%,20rem)]',
          'ring-1 ring-black/10 transition-opacity hover:opacity-95 dark:ring-white/10',
          outbound ? 'rounded-br-md' : 'rounded-bl-md'
        )}
        onClick={onOpen}
        aria-label="Play video"
      >
        <video
          src={attachment.url}
          muted
          playsInline
          preload="metadata"
          className="max-h-64 w-full object-cover"
        />
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25"
          aria-hidden
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-black/50 text-white">
            <Play className="ml-0.5 size-5 fill-current" />
          </span>
        </span>
      </button>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary text-xs font-medium underline underline-offset-2"
    >
      {attachment.label ?? 'Open attachment'}
    </a>
  );
}
