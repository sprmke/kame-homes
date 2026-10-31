import { useEffect } from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import type { PropertyMediaItem } from '@/features/dashboard/org/lib/propertySettingsConstants';

import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Props = {
  item: PropertyMediaItem | null;
  items: PropertyMediaItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (item: PropertyMediaItem) => void;
};

export function PropertyMediaPreviewDialog({ item, items, open, onOpenChange, onNavigate }: Props) {
  const index = item ? items.findIndex((entry) => entry.id === item.id) : -1;
  const isVideo = item?.type === 'video';
  const showNav = !isVideo && items.length > 1;
  const canPrev = index > 0;
  const canNext = index >= 0 && index < items.length - 1;

  useEffect(() => {
    if (!open || !showNav || !item) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && canPrev) {
        event.preventDefault();
        onNavigate(items[index - 1]!);
      }
      if (event.key === 'ArrowRight' && canNext) {
        event.preventDefault();
        onNavigate(items[index + 1]!);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canNext, canPrev, index, item, items, onNavigate, open, showNav]);

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
          <DialogPrimitive.Title className="sr-only">
            {isVideo ? 'Video preview' : 'Photo preview'}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            className={cn(
              'absolute right-3 top-3 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center',
              'rounded-full bg-white/10 text-white/90 backdrop-blur-sm',
              'transition-colors hover:bg-white/20 hover:text-white',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
            )}
            aria-label="Close preview"
            onClick={(event) => event.stopPropagation()}
          >
            <X className="size-5" aria-hidden />
          </DialogPrimitive.Close>

          {showNav ? (
            <>
              <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
                {index + 1} / {items.length}
              </div>
              <button
                type="button"
                disabled={!canPrev}
                aria-label="Previous photo"
                className={cn(
                  'absolute left-3 top-1/2 z-10 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center',
                  'rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors',
                  'hover:bg-white/20 disabled:pointer-events-none disabled:opacity-30',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  if (canPrev) onNavigate(items[index - 1]!);
                }}
              >
                <ChevronLeft className="size-6" aria-hidden />
              </button>
              <button
                type="button"
                disabled={!canNext}
                aria-label="Next photo"
                className={cn(
                  'absolute right-3 top-1/2 z-10 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center',
                  'rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors',
                  'hover:bg-white/20 disabled:pointer-events-none disabled:opacity-30',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:right-14'
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  if (canNext) onNavigate(items[index + 1]!);
                }}
              >
                <ChevronRight className="size-6" aria-hidden />
              </button>
            </>
          ) : null}

          {item ? (
            <div
              className="flex max-h-full max-w-full items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              {isVideo ? (
                <video
                  key={item.id}
                  src={item.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[calc(100dvh-2rem)] max-w-full rounded-lg object-contain"
                  aria-label="Property video"
                />
              ) : (
                <img
                  key={item.id}
                  src={item.url}
                  alt=""
                  className="max-h-[calc(100dvh-2rem)] max-w-full object-contain"
                />
              )}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
