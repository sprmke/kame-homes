import { useState } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Car, Layers, X } from 'lucide-react';

import { FilterEmptyLabel } from '@/features/guest/marketing/shared/components/FilterEmptyLabel';
import { FilterSection } from '@/features/guest/marketing/shared/components/FilterSection';
import { FilterSheetSort } from '@/features/guest/marketing/shared/components/FilterSheetSort';
import { PARKING_SORT_OPTIONS } from '@/features/guest/marketing/shared/lib/listingFilterChips';
import { useListingFilterMotion } from '@/features/guest/marketing/shared/lib/listingFilterMotion';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  countActiveParkingFilters,
  DEFAULT_PARKING_FILTERS,
  PARKING_LOCATION_OPTIONS,
  PARKING_PRICE_RANGE_OPTIONS,
  showsTowerFilter,
  type ParkingFilterState,
  type ParkingLocationFilter,
} from '../lib/parkingSlotFilters';

interface ParkingFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
  filters: ParkingFilterState;
  onFiltersChange: (filters: ParkingFilterState) => void;
  /** Tower names from API facets or mock slot list. */
  towerOptions?: string[];
  /** @deprecated use towerOptions */
  insideTowerOptions?: string[];
  /** Mobile sheet sort (keeps “Filters & Sort” honest). */
  sortBy?: string;
  onSortChange?: (sort: string) => void;
}

const LOCATION_ICONS: Record<ParkingLocationFilter, typeof Building2> = {
  inside_tower: Building2,
  outside_tower: Car,
};

export function ParkingFilters({
  isOpen,
  onClose,
  isMobile = false,
  filters,
  onFiltersChange,
  towerOptions = [],
  insideTowerOptions,
  sortBy,
  onSortChange,
}: ParkingFiltersProps) {
  const motionProps = useListingFilterMotion();
  const towers = towerOptions.length > 0 ? towerOptions : (insideTowerOptions ?? []);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    location: true,
    tower: true,
    price: true,
  });
  const showSheetSort = Boolean(isMobile && sortBy != null && onSortChange);

  const showTowerSection = showsTowerFilter(filters);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleLocation = (id: ParkingLocationFilter) => {
    const locations = filters.locations.includes(id)
      ? filters.locations.filter((loc) => loc !== id)
      : [...filters.locations, id];

    const next: ParkingFilterState = { ...filters, locations };

    if (!locations.includes('inside_tower')) {
      next.towers = [];
    }

    onFiltersChange(next);
  };

  const toggleMotorcycle = () => {
    onFiltersChange({ ...filters, motorcycle: !filters.motorcycle });
  };

  const toggleTower = (tower: string) => {
    const towers = filters.towers.includes(tower)
      ? filters.towers.filter((t) => t !== tower)
      : [...filters.towers, tower];
    onFiltersChange({ ...filters, towers });
  };

  const clearAllFilters = () => {
    onFiltersChange(DEFAULT_PARKING_FILTERS);
  };

  const activeFiltersCount = countActiveParkingFilters(filters);
  const hasActiveFilters = activeFiltersCount > 0;

  const filterContent = (
    <div className="space-y-6">
      {showSheetSort ? (
        <FilterSheetSort
          value={sortBy!}
          options={[...PARKING_SORT_OPTIONS]}
          onChange={onSortChange!}
        />
      ) : null}
      <FilterSection
        title="Location"
        expanded={expandedSections.location ?? false}
        onToggle={() => toggleSection('location')}
      >
        <div className="grid grid-cols-1 gap-2">
          {PARKING_LOCATION_OPTIONS.map((option) => {
            const Icon = LOCATION_ICONS[option.id];
            const isSelected = filters.locations.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleLocation(option.id)}
                aria-pressed={isSelected}
                className={cn(
                  'flex min-h-[44px] items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {option.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={toggleMotorcycle}
            aria-pressed={filters.motorcycle}
            className={cn(
              'flex min-h-[44px] items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all',
              filters.motorcycle
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted'
            )}
          >
            <Car className="h-4 w-4 shrink-0" aria-hidden />
            Motorcycle
          </button>
        </div>
      </FilterSection>

      {showTowerSection ? (
        <FilterSection
          title="Tower"
          expanded={expandedSections.tower ?? false}
          onToggle={() => toggleSection('tower')}
        >
          {towers.length === 0 ? (
            <FilterEmptyLabel />
          ) : (
            <div className="space-y-1.5">
              {towers.map((tower) => {
                const isSelected = filters.towers.includes(tower);
                return (
                  <button
                    key={tower}
                    type="button"
                    onClick={() => toggleTower(tower)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex min-h-[44px] w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted'
                    )}
                  >
                    <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="line-clamp-1 flex-1">{tower}</span>
                    {isSelected ? (
                      <span className="bg-primary h-2 w-2 shrink-0 rounded-full" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </FilterSection>
      ) : null}

      <FilterSection
        title="Price Range"
        subtitle="Per night"
        expanded={expandedSections.price ?? false}
        onToggle={() => toggleSection('price')}
      >
        <div className="space-y-2">
          {PARKING_PRICE_RANGE_OPTIONS.map((range) => {
            const isSelected = filters.priceRange === range.id;
            return (
              <button
                key={range.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    priceRange: isSelected ? null : range.id,
                  })
                }
                className={cn(
                  'flex min-h-[44px] w-full items-center justify-between rounded-lg border p-3 text-sm transition-all',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted'
                )}
              >
                <span className="font-medium">{range.label}</span>
                <span className="text-muted-foreground">{range.display}</span>
              </button>
            );
          })}
        </div>
      </FilterSection>
    </div>
  );

  if (!isMobile) {
    return (
      <AnimatePresence>
        {isOpen ? (
          <motion.aside
            initial={motionProps.asideInitial}
            animate={motionProps.asideAnimate}
            exit={motionProps.asideExit}
            transition={motionProps.asideTransition}
            className="border-border bg-background hidden shrink-0 overflow-hidden border-r lg:block"
          >
            <div className="h-full w-[320px] overflow-y-auto p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-foreground text-lg font-semibold">Filters</h3>
                  {activeFiltersCount > 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {activeFiltersCount} filter{activeFiltersCount !== 1 && 's'} applied
                    </p>
                  ) : null}
                </div>
                {hasActiveFilters ? (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    Clear all
                  </Button>
                ) : null}
              </div>
              {filterContent}
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    );
  }

  const sheetTitle = showSheetSort ? 'Filters & Sort' : 'Filters';

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={motionProps.fadeInitial}
            animate={motionProps.fadeAnimate}
            exit={motionProps.fadeExit}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/50 lg:hidden"
          />
          <motion.div
            initial={motionProps.sheetInitial}
            animate={motionProps.sheetAnimate}
            exit={motionProps.sheetExit}
            transition={motionProps.sheetTransition}
            className="bg-card fixed inset-x-0 bottom-0 z-[101] flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={sheetTitle}
          >
            <div className="flex shrink-0 justify-center py-3">
              <div className="bg-muted-foreground/30 h-1.5 w-12 rounded-full" />
            </div>
            <div className="border-border flex shrink-0 items-center justify-between border-b px-6 pb-4">
              <div>
                <h3 className="text-foreground text-lg font-semibold">{sheetTitle}</h3>
                {activeFiltersCount > 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {activeFiltersCount} filter{activeFiltersCount !== 1 && 's'} applied
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="hover:bg-muted min-h-[44px] min-w-[44px] rounded-full p-2"
                aria-label="Close filters"
              >
                <X className="text-muted-foreground h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{filterContent}</div>
            <div className="border-border shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex gap-3">
                {hasActiveFilters ? (
                  <Button
                    variant="outline"
                    onClick={clearAllFilters}
                    className="min-h-[44px] flex-1"
                  >
                    Clear all
                  </Button>
                ) : null}
                <Button onClick={onClose} className="min-h-[44px] flex-1">
                  Show results
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
