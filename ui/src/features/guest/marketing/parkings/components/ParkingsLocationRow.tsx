import { ParkingSlotCard } from '@/features/guest/marketing/developments/components/ParkingSlotCard';
import { MarketingLocationCarouselShell } from '@/features/guest/marketing/shared/components/MarketingLocationCarouselShell';
import { useHorizontalCarouselScroll } from '@/features/guest/marketing/shared/hooks/useHorizontalCarouselScroll';

import type { ParkingListEntry } from '../lib/parkingListEntries';

interface ParkingsLocationRowProps {
  title: string;
  viewAllTo: string;
  entries: ParkingListEntry[];
}

export function ParkingsLocationRow({ title, viewAllTo, entries }: ParkingsLocationRowProps) {
  const { scrollRef, canScrollLeft, canScrollRight, scrollByCards } = useHorizontalCarouselScroll(
    [entries],
    '[data-parking-carousel-card]'
  );

  if (entries.length === 0) return null;

  return (
    <MarketingLocationCarouselShell
      title={title}
      viewAllTo={viewAllTo}
      scrollRef={scrollRef}
      canScrollLeft={canScrollLeft}
      canScrollRight={canScrollRight}
      scrollByCards={scrollByCards}
    >
      {entries.map((entry, index) => (
        <div
          key={entry.slot.id}
          data-parking-carousel-card
          className="w-[240px] shrink-0 sm:w-[260px]"
          style={{ scrollSnapAlign: 'start' }}
        >
          <ParkingSlotCard
            slot={entry.slot}
            developmentSlug={entry.developmentSlug}
            developmentName={entry.developmentName}
            city={entry.city}
            detailSlug={entry.detailSlug}
            index={index}
            variant="carousel"
          />
        </div>
      ))}
    </MarketingLocationCarouselShell>
  );
}
