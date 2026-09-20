import { useState, useRef } from 'react';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { PropertyCard, type Property } from '../PropertyCard';

interface SimilarPropertiesProps {
  properties: Property[];
  currentPropertyId: string;
}

export function SimilarProperties({ properties, currentPropertyId }: SimilarPropertiesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Filter out current property
  const similarProperties = properties.filter((p) => p.id !== currentPropertyId).slice(0, 8);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScroll, 300);
    }
  };

  if (similarProperties.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-xl font-semibold">Similar properties you may like</h2>

        {/* Navigation Buttons */}
        <div className="hidden gap-2 sm:flex">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            aria-label="Previous similar properties"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            aria-label="Next similar properties"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Scrollable Container */}
      <div className="relative -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="scrollbar-hide flex gap-4 overflow-x-auto pb-4"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {similarProperties.map((property, index) => (
            <div
              key={property.id}
              className="w-[280px] shrink-0 sm:w-[300px]"
              style={{ scrollSnapAlign: 'start' }}
            >
              <PropertyCard property={property} index={index} />
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
