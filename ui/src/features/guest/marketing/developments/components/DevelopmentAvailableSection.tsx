import { motion } from 'framer-motion';

import { usePublicParkings } from '@/features/guest/marketing/parkings/hooks/usePublicParkings';
import {
  DEFAULT_PARKINGS_QUERY,
  toParkingListEntry,
} from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import { PropertiesLocationRow } from '@/features/guest/marketing/properties/components/PropertiesLocationRow';
import { usePublicProperties } from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import {
  DEFAULT_PROPERTIES_QUERY,
  toPropertyCard,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';

import { ListingLocationRowsSkeleton } from '@/components/skeletons/ListingGridSkeleton';

import { DevelopmentParkingRow } from './DevelopmentParkingRow';

import type { Development } from '../types';

interface DevelopmentAvailableSectionProps {
  development: Development;
}

export function DevelopmentAvailableSection({ development }: DevelopmentAvailableSectionProps) {
  const propertiesQuery = usePublicProperties({
    ...DEFAULT_PROPERTIES_QUERY,
    development: [development.slug],
    pageSize: 8,
  });
  const parkingsQuery = usePublicParkings({
    ...DEFAULT_PARKINGS_QUERY,
    developmentSlug: development.slug,
    pageSize: 8,
  });

  const properties = (propertiesQuery.data?.data ?? []).map(toPropertyCard);
  const parkingEntries = (parkingsQuery.data?.data ?? []).map(toParkingListEntry);
  const listingsReady = !propertiesQuery.isLoading && !parkingsQuery.isLoading;

  if (listingsReady && properties.length === 0 && parkingEntries.length === 0) return null;

  if (!listingsReady) {
    return (
      <section className="border-border border-t">
        <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
          <ListingLocationRowsSkeleton sectionCount={1} cardsPerSection={4} />
        </div>
      </section>
    );
  }

  return (
    <section className="border-border border-t">
      <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="min-w-0 space-y-10 sm:space-y-12"
        >
          {properties.length > 0 && (
            <PropertiesLocationRow
              title="Available Homes"
              viewAllTo={`/developments/${development.slug}/properties`}
              properties={properties}
            />
          )}
          {parkingEntries.length > 0 && (
            <DevelopmentParkingRow
              title="Available Parking"
              viewAllTo={`/developments/${development.slug}/parking`}
              entries={parkingEntries}
            />
          )}
        </motion.div>
      </div>
    </section>
  );
}
