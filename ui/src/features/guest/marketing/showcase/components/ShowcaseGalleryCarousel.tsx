import { useCallback, useEffect, useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { GalleryLightbox } from '@/features/guest/marketing/shared/components/GalleryLightbox';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import { useShowcaseEmbla } from '@/features/guest/marketing/showcase/hooks/useShowcaseEmbla';
import type { ShowcaseVariant } from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';

import { cn } from '@/lib/utils';

type GalleryChrome = 'full' | 'overlay';

const SLIDE_BASIS: Record<ShowcaseVariant, string> = {
  aurora: 'min-w-0 shrink-0 grow-0 basis-full pl-3',
  editorial: 'min-w-0 shrink-0 grow-0 basis-full pl-3',
  monolith: 'min-w-0 shrink-0 grow-0 basis-full',
  verso: 'min-w-0 shrink-0 grow-0 basis-full pl-3',
  atlas: 'min-w-0 shrink-0 grow-0 basis-full',
  haven: 'min-w-0 shrink-0 grow-0 basis-full pl-4',
};

const TRACK_CLASS: Record<ShowcaseVariant, string> = {
  aurora: 'flex touch-pan-y -ml-3',
  editorial: 'flex touch-pan-y -ml-3',
  monolith: 'flex touch-pan-y',
  verso: 'flex touch-pan-y -ml-3',
  atlas: 'flex touch-pan-y',
  haven: 'flex touch-pan-y -ml-4',
};

const IMAGE_ASPECT: Record<ShowcaseVariant, string> = {
  aurora: 'aspect-[4/3]',
  editorial: 'aspect-[5/4]',
  monolith: 'aspect-[4/3]',
  verso: 'aspect-[3/4]',
  atlas: 'aspect-[4/3]',
  haven: 'aspect-[4/3]',
};

function GalleryControlButton({
  direction,
  onClick,
  disabled,
  className,
  label,
}: {
  direction: 'prev' | 'next';
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  label: string;
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border transition-opacity disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

export function ShowcaseGalleryCarousel({
  images,
  propertyName,
  variant,
  className,
  imageClassName,
  chrome = variant === 'monolith' ? 'overlay' : 'full',
}: {
  images: string[];
  propertyName: string;
  variant: ShowcaseVariant;
  className?: string;
  imageClassName?: string;
  chrome?: GalleryChrome;
}) {
  const { tokens } = useShowcaseTheme();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selected, setSelected] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const [emblaRef, emblaApi] = useShowcaseEmbla({
    align: 'start',
    loop: images.length > 1,
    skipSnaps: false,
    containScroll: 'trimSnaps',
  });

  const syncCarousel = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    syncCarousel();
    emblaApi.on('select', syncCarousel);
    emblaApi.on('reInit', syncCarousel);
    return () => {
      emblaApi.off('select', syncCarousel);
      emblaApi.off('reInit', syncCarousel);
    };
  }, [emblaApi, syncCarousel]);

  useEffect(() => {
    emblaApi?.reInit();
  }, [emblaApi, images.length]);

  if (images.length === 0) return null;

  const showControls = images.length > 1;
  const slideBasis = SLIDE_BASIS[variant];
  const trackClass = TRACK_CLASS[variant];
  const aspect = IMAGE_ASPECT[variant];

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <div
        className={cn('relative w-full max-w-full', className)}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${propertyName} photos`}
      >
        <div className="overflow-hidden" ref={emblaRef}>
          <div className={trackClass}>
            {images.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className={slideBasis}
                aria-roledescription="slide"
                aria-label={`Photo ${i + 1} of ${images.length}`}
              >
                <button
                  type="button"
                  onClick={() => openLightbox(i)}
                  className={cn(
                    'group relative block w-full overflow-hidden',
                    aspect,
                    'focus-visible:ring-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    imageClassName
                  )}
                  aria-label={`View photo ${i + 1} of ${images.length}`}
                >
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                  <span className="group-hover:bg-black/12 absolute inset-0 bg-black/0 transition-colors duration-300" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {showControls && chrome === 'overlay' ? (
          <>
            <GalleryControlButton
              direction="prev"
              label="Previous photo"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canPrev}
              className={cn(
                'border-border bg-background/90 text-foreground hover:bg-background absolute left-3 top-1/2 z-10 -translate-y-1/2 shadow-sm backdrop-blur-sm',
                tokens.testimonialControl
              )}
            />
            <GalleryControlButton
              direction="next"
              label="Next photo"
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canNext}
              className={cn(
                'border-border bg-background/90 text-foreground hover:bg-background absolute right-3 top-1/2 z-10 -translate-y-1/2 shadow-sm backdrop-blur-sm',
                tokens.testimonialControl
              )}
            />
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to photo ${i + 1}`}
                  aria-current={selected === i ? 'true' : undefined}
                  onClick={() => emblaApi?.scrollTo(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    selected === i
                      ? 'w-6 bg-[hsl(var(--showcase-accent,var(--primary)))]'
                      : 'bg-foreground/35 hover:bg-foreground/55 w-1.5'
                  )}
                />
              ))}
            </div>
          </>
        ) : null}

        {showControls && chrome === 'full' ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GalleryControlButton
                direction="prev"
                label="Previous photo"
                onClick={() => emblaApi?.scrollPrev()}
                disabled={!canPrev}
                className={tokens.testimonialControl}
              />
              <GalleryControlButton
                direction="next"
                label="Next photo"
                onClick={() => emblaApi?.scrollNext()}
                disabled={!canNext}
                className={tokens.testimonialControl}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1.5" role="tablist" aria-label="Gallery slides">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={selected === i}
                    aria-label={`Go to photo ${i + 1}`}
                    onClick={() => emblaApi?.scrollTo(i)}
                    className={cn(
                      'h-2 rounded-full transition-all duration-300',
                      selected === i
                        ? 'w-6 bg-[hsl(var(--showcase-accent,var(--primary)))]'
                        : 'bg-foreground/20 hover:bg-foreground/35 w-2'
                    )}
                  />
                ))}
              </div>
              <p className={cn('text-sm tabular-nums tracking-wide', tokens.muted)}>
                {selected + 1} / {images.length}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <GalleryLightbox
        images={images}
        altPrefix={propertyName}
        open={lightboxOpen}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
      />
    </>
  );
}
