import { useCallback, useMemo, useState } from 'react';

import { Navigate, Link, useParams, useSearchParams } from 'react-router-dom';

import { AnimatePresence, motion } from 'framer-motion';
import { Home, SlidersHorizontal } from 'lucide-react';

import {
  ParkingFilters,
  ParkingHero,
  ParkingSlotsGrid,
  ParkingToolbar,
} from '@/features/guest/marketing/developments/components';
import { usePublicDevelopment } from '@/features/guest/marketing/developments/hooks/usePublicDevelopment';
import {
  DEFAULT_PARKING_FILTERS,
  filterParkingSlots,
  locationsFromLegacyTypeParam,
  sortParkingSlots,
  uniqueTowersFromInsideSlots,
  type ParkingFilterState,
  type ParkingSortKey,
} from '@/features/guest/marketing/developments/lib/parkingSlotFilters';
import type { HeroSearchValues } from '@/features/guest/marketing/guest-landing/components/HeroSearch';
import { usePublicParkings } from '@/features/guest/marketing/parkings/hooks/usePublicParkings';
import {
  DEFAULT_PARKINGS_QUERY,
  toParkingListEntry,
} from '@/features/guest/marketing/parkings/lib/parkingsQuery';

import { PublicListingBrowseSkeleton } from '@/components/skeletons/GuestMarketingSkeleton';
import { Button } from '@/components/ui/button';

function searchValuesFromParams(
  params: URLSearchParams,
  defaultLocation: string
): HeroSearchValues {
  return {
    location: params.get('location') ?? defaultLocation,
    checkIn: params.get('checkIn') ?? '',
    checkOut: params.get('checkOut') ?? '',
    guests: '',
  };
}

function initialFiltersFromParams(searchParams: URLSearchParams): ParkingFilterState {
  const legacy = locationsFromLegacyTypeParam(searchParams.get('type'));
  if (legacy.locations.length === 0 && !legacy.motorcycle) return DEFAULT_PARKING_FILTERS;
  return { ...DEFAULT_PARKING_FILTERS, locations: legacy.locations, motorcycle: legacy.motorcycle };
}

export function DevelopmentParkingListPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: development, isLoading, isError } = usePublicDevelopment(slug);
  const parkingsResult = usePublicParkings(
    { ...DEFAULT_PARKINGS_QUERY, developmentSlug: slug, pageSize: 48 },
    Boolean(slug)
  );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<ParkingSortKey>('tower');
  const [filters, setFilters] = useState<ParkingFilterState>(() =>
    initialFiltersFromParams(searchParams)
  );

  const defaultLocation = development ? `${development.name} Parking` : '';

  const searchValues = useMemo(
    () => searchValuesFromParams(searchParams, defaultLocation),
    [searchParams, defaultLocation]
  );

  const handleSearch = useCallback(
    (values: HeroSearchValues) => {
      const next = new URLSearchParams(searchParams);
      const type = searchParams.get('type');
      if (type) next.set('type', type);

      if (values.location.trim()) next.set('location', values.location.trim());
      else next.delete('location');

      if (values.checkIn) next.set('checkIn', values.checkIn);
      else next.delete('checkIn');

      if (values.checkOut) next.set('checkOut', values.checkOut);
      else next.delete('checkOut');

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const entries = useMemo(
    () => (parkingsResult.data?.data ?? []).map(toParkingListEntry),
    [parkingsResult.data?.data]
  );
  const slots = useMemo(() => entries.map((entry) => entry.slot), [entries]);
  const insideTowerOptions = useMemo(() => uniqueTowersFromInsideSlots(slots), [slots]);

  const filteredEntries = useMemo(() => {
    if (!development) return [];
    const filtered = filterParkingSlots(slots, filters, searchValues);
    const filteredIds = new Set(filtered.map((slot) => slot.id));
    const sorted = sortParkingSlots(filtered, sortBy);
    const byId = new Map(entries.map((entry) => [entry.slot.id, entry]));
    return sorted.flatMap((slot) => {
      const entry = byId.get(slot.id);
      return entry && filteredIds.has(slot.id) ? [entry] : [];
    });
  }, [slots, filters, searchValues, sortBy, development, entries]);

  if (isLoading || parkingsResult.isLoading) {
    return <PublicListingBrowseSkeleton />;
  }

  if (isError || !development) {
    return <Navigate to="/developments" replace />;
  }

  return (
    <div className="bg-background min-h-screen">
      <ParkingHero
        onSearch={handleSearch}
        redirectTo={`/developments/${development.slug}/parking`}
      />

      <div className="border-border bg-background/95 sticky top-16 z-30 border-b p-4 backdrop-blur-sm lg:hidden">
        <Button
          variant="outline"
          onClick={() => setMobileFiltersOpen(true)}
          className="min-h-[44px] w-full gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters & Sort
        </Button>
      </div>

      <div className="flex">
        <ParkingFilters
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filters={filters}
          onFiltersChange={setFilters}
          insideTowerOptions={insideTowerOptions}
        />

        <ParkingFilters
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          isMobile
          filters={filters}
          onFiltersChange={setFilters}
          insideTowerOptions={insideTowerOptions}
        />

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <ParkingToolbar
            sortBy={sortBy}
            onSortChange={setSortBy}
            totalResults={filteredEntries.length}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          />

          <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
            <h1 className="text-foreground min-w-0 text-lg font-semibold tracking-tight sm:text-xl">
              Parking in {development.name}
            </h1>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-border hover:bg-muted min-h-[44px] shrink-0 gap-1.5 rounded-xl sm:gap-2"
            >
              <Link to={`/developments/${development.slug}/properties`}>
                <Home className="h-4 w-4" aria-hidden />
                View Homes
              </Link>
            </Button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${slug}-${filteredEntries.length}-${sortBy}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-w-0 p-4 sm:p-6"
            >
              {filteredEntries.length === 0 ? (
                <p className="text-muted-foreground py-24 text-center">
                  No parking listed here yet.
                </p>
              ) : (
                <ParkingSlotsGrid entries={filteredEntries} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
