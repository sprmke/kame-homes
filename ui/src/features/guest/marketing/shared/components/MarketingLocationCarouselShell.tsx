import type { ReactNode, RefObject } from 'react';

import { Link } from 'react-router-dom';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

interface MarketingLocationCarouselShellProps {
  title: string;
  viewAllTo: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scrollByCards: (direction: -1 | 1) => void;
  children: ReactNode;
}

/** Shared title + chevron controls + horizontal scrollport for marketing location rows. */
export function MarketingLocationCarouselShell({
  title,
  viewAllTo,
  scrollRef,
  canScrollLeft,
  canScrollRight,
  scrollByCards,
  children,
}: MarketingLocationCarouselShellProps) {
  return (
    <section className="min-w-0 space-y-1.5 sm:space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={viewAllTo}
          className="text-foreground group/title inline-flex min-h-[36px] items-center gap-1 text-base font-semibold tracking-tight sm:min-h-[44px] sm:gap-1.5 sm:text-xl"
        >
          <span>{title}</span>
          <ChevronRight
            className="h-5 w-5 shrink-0 transition-transform group-hover/title:translate-x-0.5"
            aria-hidden="true"
          />
          <span className="sr-only">View all</span>
        </Link>

        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={() => scrollByCards(-1)}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
            className={cn(
              'border-border bg-background text-foreground flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition-opacity',
              canScrollLeft ? 'hover:bg-muted opacity-100' : 'cursor-default opacity-40'
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCards(1)}
            disabled={!canScrollRight}
            aria-label="Scroll right"
            className={cn(
              'border-border bg-background text-foreground flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition-opacity',
              canScrollRight ? 'hover:bg-muted opacity-100' : 'cursor-default opacity-40'
            )}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-hide flex min-w-0 gap-3 overflow-x-auto sm:gap-4 overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </section>
  );
}
