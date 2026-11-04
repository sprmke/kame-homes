import { useCallback, useEffect, useRef, useState } from 'react';

import { Link } from 'react-router-dom';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Star } from 'lucide-react';

import { useV2FeaturedStays } from '@/features/guest/marketing/guest-landing-v2/hooks/useV2FeaturedStays';
import {
  apertureOpen,
  inViewOnce,
  rise,
} from '@/features/guest/marketing/guest-landing-v2/lib/apertureMotion';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const CARD_WIDTH = 'w-[min(76vw,19rem)] sm:w-[19rem] lg:w-[21rem]';

/** Live recommended stays. Hides itself when the catalog is empty. */
export function V2StaysRail() {
  const reduce = useReducedMotion() ?? false;
  const { stays, isLoading } = useV2FeaturedStays();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setEdges({ start: node.scrollLeft <= 4, end: node.scrollLeft >= max - 4 });
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [updateEdges, stays.length]);

  if (!isLoading && stays.length === 0) return null;

  const page = (direction: 1 | -1) => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({
      left: direction * node.clientWidth * 0.8,
      behavior: reduce ? 'auto' : 'smooth',
    });
  };

  return (
    <section aria-labelledby="v2-stays-title" className="public-section-y bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <motion.h2
            id="v2-stays-title"
            variants={rise}
            initial={reduce ? false : 'hidden'}
            whileInView="shown"
            viewport={inViewOnce}
            className="text-foreground text-[1.75rem] font-bold leading-[1.08] tracking-[-0.03em] md:text-4xl lg:text-5xl"
          >
            Recommended stays
          </motion.h2>
          <div className="flex items-center gap-2">
            <Link
              to="/properties"
              className="text-foreground hover:text-primary relative text-sm font-semibold underline-offset-4 transition-colors before:absolute before:-inset-3 before:content-[''] hover:underline"
            >
              See all
            </Link>
            <div className="ml-3 hidden gap-2 md:flex">
              <RailButton label="Previous stays" disabled={edges.start} onClick={() => page(-1)}>
                <ArrowLeft className="size-[18px]" aria-hidden />
              </RailButton>
              <RailButton label="Next stays" disabled={edges.end} onClick={() => page(1)}>
                <ArrowRight className="size-[18px]" aria-hidden />
              </RailButton>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        className="mt-6 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] sm:scroll-px-6 sm:px-6 md:mt-8 md:gap-5 lg:scroll-px-[max(2rem,calc((100vw-1400px)/2+2rem))] lg:px-[max(2rem,calc((100vw-1400px)/2+2rem))] [&::-webkit-scrollbar]:hidden"
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn('shrink-0', CARD_WIDTH)} aria-hidden>
                <Skeleton className="aspect-[4/5] w-full rounded-[1.5rem]" />
                <Skeleton className="mt-3 h-4 w-3/4" />
                <Skeleton className="mt-2 h-3.5 w-1/2" />
              </div>
            ))
          : stays.map((stay, index) => (
              <article key={stay.id} className={cn('shrink-0 snap-start', CARD_WIDTH)}>
                <Link
                  to={`/properties/${stay.slug}`}
                  className="focus-visible:ring-ring group block rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
                >
                  <motion.div
                    variants={apertureOpen}
                    initial={reduce ? false : 'hidden'}
                    whileInView="shown"
                    viewport={inViewOnce}
                    transition={{ delay: Math.min(index, 4) * 0.06 }}
                    className="bg-muted relative aspect-[4/5] overflow-hidden rounded-[1.5rem]"
                  >
                    <Image
                      src={stay.images[0] ?? ''}
                      alt={stay.name}
                      fill
                      sizes="(min-width: 1024px) 336px, (min-width: 640px) 304px, 76vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                    <span className="bg-background/95 text-foreground absolute bottom-3 left-3 rounded-full px-3 py-1.5 text-[13px] font-semibold tabular-nums shadow-sm">
                      ₱{stay.price.toLocaleString()}
                      <span className="text-muted-foreground font-medium"> a night</span>
                    </span>
                  </motion.div>
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="public-card-title text-foreground truncate font-semibold">
                        {stay.name}
                      </h3>
                      <p className="text-muted-foreground mt-0.5 truncate text-sm">
                        {stay.location}
                        {stay.guests > 0 ? ` · ${stay.guests} guests` : ''}
                      </p>
                    </div>
                    {stay.rating != null && stay.rating > 0 ? (
                      <span className="text-foreground flex shrink-0 items-center gap-1 text-sm font-medium">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                        {stay.rating}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </article>
            ))}
      </div>
    </section>
  );
}

function RailButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border-border text-foreground hover:bg-muted flex size-11 items-center justify-center rounded-full border transition-colors disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}
