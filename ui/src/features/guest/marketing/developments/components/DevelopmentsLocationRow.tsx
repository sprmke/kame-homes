import { MarketingLocationCarouselShell } from '@/features/guest/marketing/shared/components/MarketingLocationCarouselShell';
import { useHorizontalCarouselScroll } from '@/features/guest/marketing/shared/hooks/useHorizontalCarouselScroll';

import { DevelopmentCard } from './DevelopmentCard';

import type { Development } from '../types';

interface DevelopmentsLocationRowProps {
  title: string;
  /** Path to flat location browse page (e.g. `/developments/in/tagaytay`) */
  viewAllTo: string;
  developments: Development[];
}

export function DevelopmentsLocationRow({
  title,
  viewAllTo,
  developments,
}: DevelopmentsLocationRowProps) {
  const { scrollRef, canScrollLeft, canScrollRight, scrollByCards } = useHorizontalCarouselScroll(
    [developments],
    '[data-dev-carousel-card]'
  );

  if (developments.length === 0) return null;

  return (
    <MarketingLocationCarouselShell
      title={title}
      viewAllTo={viewAllTo}
      scrollRef={scrollRef}
      canScrollLeft={canScrollLeft}
      canScrollRight={canScrollRight}
      scrollByCards={scrollByCards}
    >
      {developments.map((development, index) => (
        <div
          key={development.id}
          data-dev-carousel-card
          className="w-[240px] shrink-0 sm:w-[260px]"
          style={{ scrollSnapAlign: 'start' }}
        >
          <DevelopmentCard development={development} index={index} variant="carousel" />
        </div>
      ))}
    </MarketingLocationCarouselShell>
  );
}
