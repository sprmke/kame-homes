import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

import { cn } from '@/lib/utils';

type Props = {
  images: string[];
  altPrefix: string;
  open: boolean;
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

/** Fullscreen photo viewer with prev/next + filmstrip nav — shared by every image gallery. */
export function GalleryLightbox({ images, altPrefix, open, index, onClose, onIndexChange }: Props) {
  const hasMultiple = images.length > 1;

  const nextImage = () => onIndexChange((index + 1) % images.length);
  const prevImage = () => onIndexChange(index === 0 ? images.length - 1 : index - 1);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          role="dialog"
          aria-modal="true"
          aria-label={`${altPrefix} photos`}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 min-h-[44px] min-w-[44px] rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            aria-label="Close gallery"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-sm">
            {index + 1} / {images.length}
          </div>

          {hasMultiple ? (
            <>
              <button
                type="button"
                onClick={prevImage}
                className="absolute left-4 top-1/2 z-10 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={nextImage}
                className="absolute right-4 top-1/2 z-10 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                aria-label="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          ) : null}

          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative h-[80vh] w-[90vw] max-w-full"
          >
            <Image
              src={images[index] ?? ''}
              alt={`${altPrefix} - ${index + 1}`}
              fill
              className="object-contain"
            />
          </motion.div>

          {hasMultiple ? (
            <div className="absolute bottom-4 left-1/2 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 gap-2 overflow-x-auto rounded-lg bg-white/10 p-2 backdrop-blur-sm">
              {images.slice(0, 8).map((image, thumbIndex) => (
                <button
                  key={thumbIndex}
                  type="button"
                  onClick={() => onIndexChange(thumbIndex)}
                  className={cn(
                    'relative h-12 w-16 shrink-0 overflow-hidden rounded-md transition-all',
                    index === thumbIndex ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-100'
                  )}
                  aria-label={`View photo ${thumbIndex + 1}`}
                >
                  <Image src={image} alt="" fill className="object-cover" />
                </button>
              ))}
              {images.length > 8 ? (
                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-white/20 text-sm text-white">
                  +{images.length - 8}
                </div>
              ) : null}
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
