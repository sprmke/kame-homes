import { MarketingLocationCarouselShell } from '@/features/guest/marketing/shared/components/MarketingLocationCarouselShell';
import { useHorizontalCarouselScroll } from '@/features/guest/marketing/shared/hooks/useHorizontalCarouselScroll';

import { PropertyCard, type Property } from './PropertyCard';

interface PropertiesLocationRowProps {
  title: string;
  /** Path to flat location browse page (e.g. `/properties/in/tagaytay`) */
  viewAllTo: string;
  properties: Property[];
}

export function PropertiesLocationRow({
  title,
  viewAllTo,
  properties,
}: PropertiesLocationRowProps) {
  const { scrollRef, canScrollLeft, canScrollRight, scrollByCards } = useHorizontalCarouselScroll(
    [properties],
    '[data-property-carousel-card]'
  );

  if (properties.length === 0) return null;

  return (
    <MarketingLocationCarouselShell
      title={title}
      viewAllTo={viewAllTo}
      scrollRef={scrollRef}
      canScrollLeft={canScrollLeft}
      canScrollRight={canScrollRight}
      scrollByCards={scrollByCards}
    >
      {properties.map((property, index) => (
        <div
          key={property.id}
          data-property-carousel-card
          className="w-[164px] shrink-0 sm:w-[260px]"
          style={{ scrollSnapAlign: 'start' }}
        >
          <PropertyCard property={property} index={index} variant="carousel" />
        </div>
      ))}
    </MarketingLocationCarouselShell>
  );
}
