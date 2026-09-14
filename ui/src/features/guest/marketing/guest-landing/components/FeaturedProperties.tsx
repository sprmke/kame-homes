import { useCallback, useEffect, useRef, useState } from 'react';

import { Link } from 'react-router-dom';

import { motion, useInView } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';

import { usePublicProperties } from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import {
  DEFAULT_PROPERTIES_QUERY,
  toPropertyCard,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const CARD_SCROLL_AMOUNT = 304;
const SKELETON_CARD_COUNT = 4;

/** Matches the loaded card's footprint so the section doesn't jump height once data arrives. */
function FeaturedPropertyCardSkeleton() {
  return (
    <div className="w-[min(78vw,300px)] shrink-0 sm:w-[280px] lg:w-[300px]" aria-hidden>
      <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3.5 w-1/3" />
      </div>
    </div>
  );
}

export function FeaturedProperties() {
  const ref = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const featuredQuery = usePublicProperties({
    ...DEFAULT_PROPERTIES_QUERY,
    sort: 'recommended',
    page: 1,
    pageSize: 8,
  });
  const stays = (featuredQuery.data?.data ?? []).map(toPropertyCard);

  const updateScrollState = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const maxScroll = node.scrollWidth - node.clientWidth;
    setCanScrollLeft(node.scrollLeft > 4);
    setCanScrollRight(node.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, [updateScrollState]);

  if (!featuredQuery.isLoading && stays.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollBy({
      left: direction === 'left' ? -CARD_SCROLL_AMOUNT : CARD_SCROLL_AMOUNT,
      behavior: 'smooth',
    });
  };

  return (
    <section ref={ref} className="bg-background py-14 lg:py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45 }}
          className="mb-6 flex items-end justify-between gap-4"
        >
          <h2 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Stays guests love
          </h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="min-h-[44px] min-w-[44px] rounded-full"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label="Previous stays"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="min-h-[44px] min-w-[44px] rounded-full"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label="Next stays"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </motion.div>

        <div className="relative -mx-4 sm:-mx-6 lg:-mx-8">
          <div
            className={cn(
              'from-background pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r to-transparent transition-opacity duration-200 sm:w-10',
              canScrollLeft ? 'opacity-100' : 'opacity-0'
            )}
            aria-hidden
          />
          <div
            className={cn(
              'from-background pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l to-transparent transition-opacity duration-200 sm:w-10',
              canScrollRight ? 'opacity-100' : 'opacity-0'
            )}
            aria-hidden
          />

          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-5 sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {featuredQuery.isLoading
              ? Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
                  <FeaturedPropertyCardSkeleton key={i} />
                ))
              : stays.map((stay, index) => (
                  <motion.article
                    key={stay.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, delay: index * 0.06 }}
                    className="w-[min(78vw,300px)] shrink-0 snap-start sm:w-[280px] lg:w-[300px]"
                  >
                    <Link to={`/properties/${stay.slug}`} className="group block">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                        <Image
                          src={stay.images[0] ?? ''}
                          alt={stay.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-foreground line-clamp-1 font-semibold">
                            {stay.name}
                          </h3>
                          {stay.rating != null && stay.rating > 0 && (
                            <span className="text-foreground flex shrink-0 items-center gap-1 text-sm">
                              <Star
                                className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                                aria-hidden
                              />
                              {stay.rating}
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {stay.location}
                          {stay.guests > 0 ? ` · ${stay.guests} guests` : ''}
                        </p>
                        <p className="text-foreground text-sm">
                          <span className="font-semibold">₱{stay.price.toLocaleString()}</span>
                          <span className="text-muted-foreground"> / night</span>
                        </p>
                      </div>
                    </Link>
                  </motion.article>
                ))}
          </div>
        </div>

        <div className="mt-8 text-center sm:text-left">
          <Button variant="outline" className="min-h-[44px] rounded-full px-6" asChild>
            <Link to="/properties">Browse all properties</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
