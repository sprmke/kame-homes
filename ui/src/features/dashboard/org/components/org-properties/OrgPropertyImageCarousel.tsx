import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from 'react';

import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Taller than PMA `aspect-video` (16:9) for property gallery previews. */
export const ORG_PROPERTY_IMAGE_ASPECT = 'aspect-[5/4]';

const SWIPE_THRESHOLD_PX = 48;

type Props = {
  images: string[];
  name: string;
  className?: string;
  /** Fired on a tap/click on the image area (not arrows, dots, or after a swipe). */
  onSurfaceClick?: () => void;
};

function isCarouselControl(target: EventTarget | null) {
  return Boolean((target as HTMLElement | null)?.closest('[data-carousel-control]'));
}

function stopCarouselControlEvent(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function useSwipeCarousel(length: number) {
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const dragDeltaRef = useRef(0);
  const didSwipeRef = useRef(false);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, length - 1)));
  }, [length]);

  const goTo = useCallback(
    (next: number) => {
      if (length <= 1) return;
      const wrapped = ((next % length) + length) % length;
      setIndex(wrapped);
    },
    [length]
  );

  const goPrevious = useCallback(() => {
    goTo(index - 1);
  }, [goTo, index]);

  const goNext = useCallback(() => {
    goTo(index + 1);
  }, [goTo, index]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (length <= 1) return;
    if (event.button !== 0) return;
    if (isCarouselControl(event.target)) return;
    startXRef.current = event.clientX;
    dragDeltaRef.current = 0;
    didSwipeRef.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging || length <= 1) return;
    const delta = event.clientX - startXRef.current;
    dragDeltaRef.current = delta;
    setDragOffset(delta);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const delta = dragDeltaRef.current;
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
      if (delta < 0) goNext();
      else goPrevious();
      didSwipeRef.current = true;
    }

    setDragOffset(0);
    setIsDragging(false);
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragDeltaRef.current = 0;
    setDragOffset(0);
    setIsDragging(false);
  };

  return {
    index,
    dragOffset,
    isDragging,
    goTo,
    goPrevious,
    goNext,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel,
    didSwipeRef,
  };
}

export function OrgPropertyImageCarousel({ images, name, className, onSurfaceClick }: Props) {
  const {
    index,
    dragOffset,
    isDragging,
    goTo,
    goPrevious,
    goNext,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    didSwipeRef,
  } = useSwipeCarousel(images.length);
  const suppressSurfaceClickRef = useRef(false);

  const handleControlPointerDown = (event: SyntheticEvent) => {
    stopCarouselControlEvent(event);
    suppressSurfaceClickRef.current = true;
  };

  const handleControlClick = (event: ReactMouseEvent<HTMLButtonElement>, action: () => void) => {
    stopCarouselControlEvent(event);
    suppressSurfaceClickRef.current = true;
    action();
    window.setTimeout(() => {
      suppressSurfaceClickRef.current = false;
    }, 0);
  };

  const handleSurfaceClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (isCarouselControl(event.target)) return;
    if (suppressSurfaceClickRef.current) return;
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    onSurfaceClick?.();
  };

  if (images.length === 0) {
    return (
      <div
        className={cn(
          'bg-muted flex items-center justify-center',
          ORG_PROPERTY_IMAGE_ASPECT,
          className
        )}
        onClick={() => onSurfaceClick?.()}
        role={onSurfaceClick ? 'button' : undefined}
        tabIndex={onSurfaceClick ? 0 : undefined}
        onKeyDown={
          onSurfaceClick
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSurfaceClick();
                }
              }
            : undefined
        }
      >
        <Building2 className="text-muted-foreground size-10" aria-hidden />
      </div>
    );
  }

  const translateX =
    images.length > 1 ? `calc(-${index * 100}% + ${isDragging ? dragOffset : 0}px)` : '0';

  return (
    <div
      className={cn(
        'bg-muted group relative touch-pan-y overflow-hidden',
        ORG_PROPERTY_IMAGE_ASPECT,
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={handleSurfaceClick}
    >
      <div
        className={cn(
          'flex h-full w-full',
          isDragging ? 'transition-none' : 'transition-transform duration-300 ease-out'
        )}
        style={{ transform: `translateX(${translateX})` }}
      >
        {images.map((image, imageIndex) => (
          <div key={`${image}-${imageIndex}`} className="h-full w-full shrink-0">
            <img
              src={image}
              alt={`${name}, image ${imageIndex + 1}`}
              draggable={false}
              className={cn(
                'size-full select-none object-cover',
                !isDragging && 'transition-transform duration-300 group-hover:scale-[1.03]'
              )}
              loading={imageIndex === 0 ? 'lazy' : 'lazy'}
            />
          </div>
        ))}
      </div>

      {images.length > 1 ? (
        <>
          <button
            type="button"
            data-carousel-control
            onPointerDown={handleControlPointerDown}
            onClick={(event) => handleControlClick(event, goPrevious)}
            className="absolute left-2 top-1/2 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white opacity-100 transition-opacity hover:bg-black/75 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
            aria-label="Previous image"
          >
            <ChevronLeft className="pointer-events-none size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            data-carousel-control
            onPointerDown={handleControlPointerDown}
            onClick={(event) => handleControlClick(event, goNext)}
            className="absolute right-2 top-1/2 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white opacity-100 transition-opacity hover:bg-black/75 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
            aria-label="Next image"
          >
            <ChevronRight className="pointer-events-none size-3.5" aria-hidden />
          </button>

          <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
            {images.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                data-carousel-control
                onPointerDown={handleControlPointerDown}
                onClick={(event) => handleControlClick(event, () => goTo(dotIndex))}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  dotIndex === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/80'
                )}
                aria-label={`Go to image ${dotIndex + 1}`}
              />
            ))}
          </div>

          <div className="sr-only" aria-live="polite">
            Image {index + 1} of {images.length}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function OrgPropertyThumbnail({
  thumbnailUrl,
  name,
  className,
}: {
  thumbnailUrl: string | null;
  name: string;
  className?: string;
}) {
  if (!thumbnailUrl) {
    return (
      <div className={cn('bg-muted flex size-full items-center justify-center', className)}>
        <Building2 className="text-muted-foreground size-7" aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={thumbnailUrl}
      alt={name}
      className={cn('size-full object-cover', className)}
      loading="lazy"
    />
  );
}
