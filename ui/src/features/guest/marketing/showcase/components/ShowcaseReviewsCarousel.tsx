import { useCallback, useEffect, useState } from 'react';

import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';

import { useShowcaseStyle } from '@/features/guest/marketing/showcase/components/ShowcaseStyleProvider';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import { useShowcaseEmbla } from '@/features/guest/marketing/showcase/hooks/useShowcaseEmbla';
import { showcaseTestimonialsForDisplay } from '@/features/guest/marketing/showcase/lib/showcaseSectionLayout';
import type { ShowcaseVariant } from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';
import type { ShowcaseTestimonial } from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

type ReviewsChrome = 'full' | 'featured' | 'editorial';

const SLIDE_BASIS: Record<ShowcaseVariant, string> = {
  aurora:
    'min-w-0 shrink-0 grow-0 basis-full pl-4 @sm:basis-[min(100%,26rem)] @lg:basis-[calc(50%-0.625rem)]',
  monolith: 'min-w-0 shrink-0 grow-0 basis-full',
  editorial:
    'min-w-0 shrink-0 grow-0 basis-[min(100%,20rem)] pl-4 @sm:basis-[min(72%,24rem)] @lg:basis-[calc(48%-0.625rem)]',
  verso:
    'min-w-0 shrink-0 grow-0 basis-full pl-4 @sm:basis-[min(100%,26rem)] @lg:basis-[calc(50%-0.625rem)]',
  atlas: 'min-w-0 shrink-0 grow-0 basis-full',
  haven:
    'min-w-0 shrink-0 grow-0 basis-[min(100%,20rem)] pl-4 @sm:basis-[min(72%,24rem)] @lg:basis-[calc(48%-0.625rem)]',
};

const TRACK_CLASS: Record<ShowcaseVariant, string> = {
  aurora: 'flex touch-pan-y -ml-4',
  monolith: 'flex touch-pan-y',
  editorial: 'flex touch-pan-y -ml-4',
  verso: 'flex touch-pan-y -ml-4',
  atlas: 'flex touch-pan-y',
  haven: 'flex touch-pan-y -ml-4',
};

function resolveChrome(variant: ShowcaseVariant): ReviewsChrome {
  if (variant === 'monolith' || variant === 'atlas') return 'featured';
  if (variant === 'editorial' || variant === 'haven') return 'editorial';
  return 'full';
}

function ReviewStars({ rating, className }: { rating?: number | null; className?: string }) {
  if (rating == null || rating <= 0) return null;
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <div className={cn('flex gap-0.5', className)} aria-label={`${filled} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            'size-3.5',
            index < filled
              ? 'fill-current text-[hsl(var(--showcase-accent,var(--primary)))]'
              : 'opacity-25'
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

function CarouselControlButton({
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

function AuroraReviewCard({ item }: { item: ShowcaseTestimonial }) {
  const { tokens } = useShowcaseTheme();
  return (
    <blockquote
      className={cn(
        '@sm:p-8 relative flex h-full min-h-[220px] flex-col rounded-2xl border p-6',
        tokens.testimonialCard
      )}
    >
      <Quote className="text-primary/25 mb-3 size-8 shrink-0" aria-hidden />
      <ReviewStars rating={item.rating} className="mb-3" />
      <p className={cn('flex-1 text-base leading-relaxed', tokens.testimonialQuote || tokens.body)}>
        {item.body}
      </p>
      <footer className={cn('mt-5 text-sm font-medium', tokens.testimonialFooter)}>
        {item.author}
      </footer>
    </blockquote>
  );
}

function MonolithReviewCard({ item }: { item: ShowcaseTestimonial }) {
  const { tokens } = useShowcaseTheme();
  const { displayFontClass } = useShowcaseStyle();
  return (
    <blockquote
      className={cn(
        '@sm:px-6 @sm:py-8 flex h-full min-h-[280px] flex-col px-2 py-4',
        tokens.testimonialBlock
      )}
    >
      <ReviewStars rating={item.rating} className="mb-4" />
      <p
        className={cn(
          displayFontClass,
          'flex-1 text-[clamp(1.25rem,4vw,1.75rem)] leading-snug tracking-tight',
          tokens.testimonialQuote
        )}
      >
        &ldquo;{item.body}&rdquo;
      </p>
      <footer
        className={cn(
          'mt-6 border-t pt-5 text-sm uppercase tracking-[0.14em]',
          tokens.sectionBorder,
          tokens.testimonialFooter
        )}
      >
        {item.author}
      </footer>
    </blockquote>
  );
}

function EditorialReviewCard({ item }: { item: ShowcaseTestimonial }) {
  const { tokens } = useShowcaseTheme();
  return (
    <blockquote
      className={cn('@sm:p-8 flex h-full min-h-[240px] flex-col p-6', tokens.testimonialCard)}
    >
      <ReviewStars rating={item.rating} className="mb-4" />
      <p className={cn('flex-1', tokens.testimonialQuote)}>&ldquo;{item.body}&rdquo;</p>
      <footer className={cn('mt-6 text-sm uppercase tracking-[0.12em]', tokens.testimonialFooter)}>
        — {item.author}
      </footer>
    </blockquote>
  );
}

function ReviewCard({ item, variant }: { item: ShowcaseTestimonial; variant: ShowcaseVariant }) {
  if (variant === 'monolith' || variant === 'atlas') {
    return <MonolithReviewCard item={item} />;
  }
  if (variant === 'editorial' || variant === 'haven') {
    return <EditorialReviewCard item={item} />;
  }
  return <AuroraReviewCard item={item} />;
}

export function ShowcaseReviewsCarousel({
  reviews,
  variant,
  className,
}: {
  reviews: ShowcaseTestimonial[];
  variant: ShowcaseVariant;
  className?: string;
}) {
  const { tokens } = useShowcaseTheme();
  const items = showcaseTestimonialsForDisplay(reviews);
  const [selected, setSelected] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const [emblaRef, emblaApi] = useShowcaseEmbla({
    align: 'start',
    loop: items.length > 1,
    skipSnaps: false,
    containScroll: 'trimSnaps',
    dragFree: false,
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
  }, [emblaApi, items.length]);

  if (items.length === 0) return null;

  const showControls = items.length > 1;
  const chrome = resolveChrome(variant);
  const slideBasis = SLIDE_BASIS[variant];
  const trackClass = TRACK_CLASS[variant];

  return (
    <div
      className={cn('relative w-full max-w-full', className)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Guest reviews"
    >
      <div
        className={cn(
          'overflow-hidden',
          chrome === 'featured' &&
            'border-border/80 @sm:rounded-sm @sm:px-3 @sm:py-4 border px-1 py-2'
        )}
        ref={emblaRef}
      >
        <div className={trackClass}>
          {items.map((item, index) => (
            <div
              key={item.id}
              className={slideBasis}
              aria-roledescription="slide"
              aria-label={`Review ${index + 1} of ${items.length}`}
            >
              <ReviewCard item={item} variant={variant} />
            </div>
          ))}
        </div>
      </div>

      {showControls && chrome === 'featured' ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CarouselControlButton
              direction="prev"
              label="Previous review"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canPrev}
              className={tokens.testimonialControl}
            />
            <CarouselControlButton
              direction="next"
              label="Next review"
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canNext}
              className={tokens.testimonialControl}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5" role="tablist" aria-label="Review slides">
              {items.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={selected === index}
                  aria-label={`Go to review ${index + 1}`}
                  onClick={() => emblaApi?.scrollTo(index)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    selected === index
                      ? 'w-6 bg-[hsl(var(--showcase-accent,var(--primary)))]'
                      : 'bg-foreground/30 hover:bg-foreground/50 w-1.5'
                  )}
                />
              ))}
            </div>
            <p className={cn('text-sm uppercase tabular-nums tracking-[0.12em]', tokens.muted)}>
              {selected + 1} / {items.length}
            </p>
          </div>
        </div>
      ) : null}

      {showControls && chrome === 'editorial' ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <CarouselControlButton
            direction="prev"
            label="Previous review"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canPrev}
            className={tokens.testimonialControl}
          />
          <CarouselControlButton
            direction="next"
            label="Next review"
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canNext}
            className={tokens.testimonialControl}
          />
          <p className={cn('text-sm uppercase tracking-[0.12em]', tokens.muted)}>
            {selected + 1} / {items.length}
          </p>
          <div className="ml-auto flex gap-1.5" role="tablist" aria-label="Review slides">
            {items.map((_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={selected === index}
                aria-label={`Go to review ${index + 1}`}
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  selected === index
                    ? 'w-6 bg-[hsl(var(--showcase-accent,var(--primary)))]'
                    : 'bg-foreground/20 hover:bg-foreground/35 w-2'
                )}
              />
            ))}
          </div>
        </div>
      ) : null}

      {showControls && chrome === 'full' ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CarouselControlButton
              direction="prev"
              label="Previous review"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canPrev}
              className={tokens.testimonialControl}
            />
            <CarouselControlButton
              direction="next"
              label="Next review"
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canNext}
              className={tokens.testimonialControl}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5" role="tablist" aria-label="Review slides">
              {items.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={selected === index}
                  aria-label={`Go to review ${index + 1}`}
                  onClick={() => emblaApi?.scrollTo(index)}
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
                    selected === index
                      ? 'w-6 bg-[hsl(var(--showcase-accent,var(--primary)))]'
                      : 'bg-foreground/20 hover:bg-foreground/35 w-2'
                  )}
                />
              ))}
            </div>
            <p className={cn('text-sm tabular-nums tracking-wide', tokens.muted)}>
              {selected + 1} / {items.length}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
