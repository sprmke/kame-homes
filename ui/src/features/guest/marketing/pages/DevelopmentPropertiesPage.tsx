import { useMemo, useState } from 'react';

import { Navigate, Link, useParams } from 'react-router-dom';

import { AnimatePresence, motion } from 'framer-motion';
import { Car, SlidersHorizontal } from 'lucide-react';

import { usePublicDevelopment } from '@/features/guest/marketing/developments/hooks/usePublicDevelopment';
import { usePublicParkings } from '@/features/guest/marketing/parkings/hooks/usePublicParkings';
import { DEFAULT_PARKINGS_QUERY } from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import {
  PropertiesFilters,
  PropertiesHero,
  PropertiesMap,
  PropertiesToolbar,
  PropertyCard,
  PropertyListItem,
  type ViewMode,
} from '@/features/guest/marketing/properties/components';
import { usePublicProperties } from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import {
  DEFAULT_PROPERTIES_QUERY,
  EMPTY_PROPERTIES_FACETS,
  toPropertyCard,
  type PropertiesListingQuery,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';

import { PublicListingBrowseSkeleton } from '@/components/skeletons/GuestMarketingSkeleton';
import { Button } from '@/components/ui/button';

export function DevelopmentPropertiesPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: development, isLoading, isError } = usePublicDevelopment(slug);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState('recommended');
  const [filterQuery, setFilterQuery] = useState<PropertiesListingQuery>(DEFAULT_PROPERTIES_QUERY);

  const listingQuery: PropertiesListingQuery = {
    ...filterQuery,
    development: [slug],
    sort: sortBy as PropertiesListingQuery['sort'],
  };

  const propertiesResult = usePublicProperties(listingQuery, Boolean(slug));
  const parkingResult = usePublicParkings(
    { ...DEFAULT_PARKINGS_QUERY, developmentSlug: slug, pageSize: 1 },
    Boolean(slug)
  );

  const properties = useMemo(
    () => (propertiesResult.data?.data ?? []).map(toPropertyCard),
    [propertiesResult.data?.data]
  );
  const hasParking = (parkingResult.data?.total ?? 0) > 0;

  if (isLoading) {
    return <PublicListingBrowseSkeleton />;
  }

  if (isError || !development) {
    return <Navigate to="/developments" replace />;
  }

  return (
    <div className="bg-background min-h-screen">
      <PropertiesHero />

      <div className="border-border bg-background/95 sticky top-16 z-30 border-b p-4 backdrop-blur-sm lg:hidden">
        <Button
          variant="outline"
          onClick={() => setMobileFiltersOpen(true)}
          className="w-full gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters & Sort
        </Button>
      </div>

      <div className="flex min-w-0">
        <PropertiesFilters
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          isMobile={false}
          value={filterQuery}
          onChange={setFilterQuery}
          facets={propertiesResult.data?.facets ?? EMPTY_PROPERTIES_FACETS}
        />

        <PropertiesFilters
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          isMobile={true}
          value={filterQuery}
          onChange={setFilterQuery}
          facets={propertiesResult.data?.facets ?? EMPTY_PROPERTIES_FACETS}
        />

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <PropertiesToolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortBy={sortBy}
            onSortChange={setSortBy}
            totalResults={propertiesResult.data?.total ?? properties.length}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          />

          <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
            <h1 className="text-foreground min-w-0 text-lg font-semibold tracking-tight sm:text-xl">
              Homes in {development.name}
            </h1>
            {hasParking ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-border hover:bg-muted min-h-[44px] shrink-0 gap-1.5 rounded-xl sm:gap-2"
              >
                <Link to={`/developments/${development.slug}/parking`}>
                  <Car className="h-4 w-4" aria-hidden />
                  View Parking
                </Link>
              </Button>
            ) : null}
          </div>

          <AnimatePresence mode="wait">
            {viewMode === 'map' ? (
              <motion.div
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0 p-4 sm:p-6"
              >
                <PropertiesMap properties={properties} />
              </motion.div>
            ) : (
              <motion.div
                key={`${slug}-${viewMode}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0 p-4 sm:p-6"
              >
                {properties.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <p className="text-muted-foreground">No homes listed here yet.</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {properties.map((property, index) => (
                      <PropertyCard key={property.id} property={property} index={index} />
                    ))}
                  </div>
                ) : (
                  <div className="mx-auto max-w-4xl space-y-4">
                    {properties.map((property, index) => (
                      <PropertyListItem key={property.id} property={property} index={index} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
