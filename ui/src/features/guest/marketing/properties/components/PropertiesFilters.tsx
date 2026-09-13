import { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Home,
  Building2,
  Castle,
  Waves,
  Mountain,
  TreePine,
  Wifi,
  Car,
  UtensilsCrossed,
  Dumbbell,
  Wind,
  Tv,
  PawPrint,
  Sparkles,
  Layers,
  type LucideIcon,
} from 'lucide-react';

import {
  clearPropertyFilters,
  countActivePropertyFilters,
  type PropertiesFacets,
  type PropertiesListingQuery,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { FilterEmptyLabel } from '@/features/guest/marketing/shared/components/FilterEmptyLabel';
import { FilterSection } from '@/features/guest/marketing/shared/components/FilterSection';
import { FilterSheetSort } from '@/features/guest/marketing/shared/components/FilterSheetSort';
import { PROPERTY_SORT_OPTIONS } from '@/features/guest/marketing/shared/lib/listingFilterChips';
import { useListingFilterMotion } from '@/features/guest/marketing/shared/lib/listingFilterMotion';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PropertiesFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
  value: PropertiesListingQuery;
  onChange: (next: PropertiesListingQuery) => void;
  facets: PropertiesFacets;
  /** Mobile sheet sort (keeps “Filters & Sort” honest). */
  sortBy?: string;
  onSortChange?: (sort: string) => void;
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  apartment: Building2,
  condo: Building2,
  house: Home,
  villa: Castle,
  beach: Waves,
  beachfront: Waves,
  mountain: Mountain,
  cabin: TreePine,
  townhouse: Home,
};

const AMENITY_ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  parking: Car,
  kitchen: UtensilsCrossed,
  gym: Dumbbell,
  aircon: Wind,
  ac: Wind,
  tv: Tv,
  pets_allowed: PawPrint,
  pets: PawPrint,
  pool: Sparkles,
};

const PRICE_PRESETS = [
  { id: 'budget', label: 'Budget', min: 0, max: 2000, display: '₱0 - ₱2,000' },
  { id: 'mid', label: 'Mid-range', min: 2000, max: 5000, display: '₱2,000 - ₱5,000' },
  { id: 'premium', label: 'Premium', min: 5000, max: 10000, display: '₱5,000 - ₱10,000' },
  { id: 'luxury', label: 'Luxury', min: 10000, max: null as number | null, display: '₱10,000+' },
] as const;

function selectedPricePresetId(value: PropertiesListingQuery): string | null {
  for (const preset of PRICE_PRESETS) {
    const matchesMin =
      value.minPrice === preset.min || (preset.min === 0 && value.minPrice == null);
    const matchesMax =
      (preset.max == null && value.maxPrice == null && value.minPrice === preset.min) ||
      (preset.max != null && value.minPrice === preset.min && value.maxPrice === preset.max);
    if (matchesMin && matchesMax && (value.minPrice != null || value.maxPrice != null)) {
      if (preset.max == null && value.minPrice === preset.min && value.maxPrice == null) {
        return preset.id;
      }
      if (preset.max != null && value.minPrice === preset.min && value.maxPrice === preset.max) {
        return preset.id;
      }
    }
  }
  // Explicit luxury: min only
  if (value.minPrice === 10000 && value.maxPrice == null) return 'luxury';
  if (value.minPrice === 0 && value.maxPrice === 2000) return 'budget';
  if (value.minPrice === 2000 && value.maxPrice === 5000) return 'mid';
  if (value.minPrice === 5000 && value.maxPrice === 10000) return 'premium';
  return null;
}

export function PropertiesFilters({
  isOpen,
  onClose,
  isMobile = false,
  value,
  onChange,
  facets,
  sortBy,
  onSortChange,
}: PropertiesFiltersProps) {
  const motionProps = useListingFilterMotion();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    propertyType: true,
    price: true,
    bedrooms: true,
    amenities: true,
    development: false,
  });
  const showSheetSort = Boolean(isMobile && sortBy != null && onSortChange);

  const patch = (partial: Partial<PropertiesListingQuery>) => {
    onChange({ ...value, ...partial, page: 1 });
  };

  const toggleType = (id: string) => {
    const next = value.type.includes(id) ? value.type.filter((t) => t !== id) : [...value.type, id];
    patch({ type: next });
  };

  const toggleAmenity = (id: string) => {
    const next = value.amenities.includes(id)
      ? value.amenities.filter((a) => a !== id)
      : [...value.amenities, id];
    patch({ amenities: next });
  };

  const toggleDevelopment = (slug: string) => {
    const next = value.development.includes(slug)
      ? value.development.filter((d) => d !== slug)
      : [...value.development, slug];
    patch({ development: next });
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const clearAllFilters = () => {
    onChange(clearPropertyFilters(value));
  };

  const activeFiltersCount = countActivePropertyFilters(value);
  const hasActiveFilters = activeFiltersCount > 0;
  const selectedPrice = selectedPricePresetId(value);

  const typeOptions =
    facets.types.length > 0
      ? facets.types
      : value.type.map((type) => ({ type, label: type, count: 0 }));

  const bedroomOptions = [
    { label: 'Any', value: null as number | null },
    ...facets.bedrooms.map((b) => ({
      label: b.value >= 5 ? '5+' : String(b.value),
      value: b.value >= 5 ? 5 : b.value,
    })),
  ];
  // Ensure unique bedroom chips
  const seenBeds = new Set<string>();
  const uniqueBedroomOptions = bedroomOptions.filter((opt) => {
    const key = opt.label;
    if (seenBeds.has(key)) return false;
    seenBeds.add(key);
    return true;
  });

  const amenityOptions =
    facets.amenities.length > 0
      ? facets.amenities
      : value.amenities.map((id) => ({ id, label: id, count: 0 }));

  const developmentOptions =
    facets.developments.length > 0
      ? facets.developments
      : value.development.map((slug) => ({ slug, name: slug, count: 0 }));

  const filterContent = (
    <div className="space-y-6">
      {showSheetSort ? (
        <FilterSheetSort
          value={sortBy!}
          options={[...PROPERTY_SORT_OPTIONS]}
          onChange={onSortChange!}
        />
      ) : null}
      <FilterSection
        title="Property Type"
        expanded={expandedSections.propertyType ?? false}
        onToggle={() => toggleSection('propertyType')}
      >
        {typeOptions.length === 0 ? (
          <FilterEmptyLabel />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {typeOptions.map((entry) => {
              const Icon = TYPE_ICONS[entry.type] ?? Building2;
              const isSelected = value.type.includes(entry.type);
              return (
                <button
                  key={entry.type}
                  type="button"
                  onClick={() => toggleType(entry.type)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex min-h-[44px] items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate">{entry.label}</span>
                  {entry.count > 0 ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {entry.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </FilterSection>

      <FilterSection
        title="Price Range"
        subtitle="Per night"
        expanded={expandedSections.price ?? false}
        onToggle={() => toggleSection('price')}
      >
        <div className="space-y-2">
          {PRICE_PRESETS.map((range) => {
            const isSelected = selectedPrice === range.id;
            return (
              <button
                key={range.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  if (isSelected) {
                    patch({ minPrice: null, maxPrice: null });
                    return;
                  }
                  patch({
                    minPrice: range.min,
                    maxPrice: range.max,
                  });
                }}
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

      <FilterSection
        title="Bedrooms"
        expanded={expandedSections.bedrooms ?? false}
        onToggle={() => toggleSection('bedrooms')}
      >
        <div className="flex flex-wrap gap-2">
          {uniqueBedroomOptions.map((option) => {
            const isSelected = value.bedrooms === option.value;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={isSelected}
                onClick={() => patch({ bedrooms: option.value })}
                className={cn(
                  'min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-all',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted border'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection
        title="Amenities"
        expanded={expandedSections.amenities ?? false}
        onToggle={() => toggleSection('amenities')}
      >
        {amenityOptions.length === 0 ? (
          <FilterEmptyLabel />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {amenityOptions.map((amenity) => {
              const Icon = AMENITY_ICONS[amenity.id] ?? Sparkles;
              const isSelected = value.amenities.includes(amenity.id);
              return (
                <button
                  key={amenity.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleAmenity(amenity.id)}
                  className={cn(
                    'flex min-h-[44px] items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="line-clamp-1 flex-1">{amenity.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </FilterSection>

      <FilterSection
        title="Development"
        subtitle="Filter by complex or community"
        expanded={expandedSections.development ?? false}
        onToggle={() => toggleSection('development')}
      >
        {developmentOptions.length === 0 ? (
          <FilterEmptyLabel />
        ) : (
          <div className="space-y-1.5">
            {developmentOptions.map((dev) => {
              const isSelected = value.development.includes(dev.slug);
              return (
                <button
                  key={dev.slug}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleDevelopment(dev.slug)}
                  className={cn(
                    'flex min-h-[44px] w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted'
                  )}
                >
                  <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="line-clamp-1 flex-1">{dev.name}</span>
                  {dev.count > 0 ? (
                    <span className="text-muted-foreground text-xs tabular-nums">{dev.count}</span>
                  ) : null}
                  {isSelected ? (
                    <span className="bg-primary h-2 w-2 shrink-0 rounded-full" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </FilterSection>
    </div>
  );

  if (!isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
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
                  {activeFiltersCount > 0 && (
                    <p className="text-muted-foreground text-sm">
                      {activeFiltersCount} filter{activeFiltersCount !== 1 && 's'} applied
                    </p>
                  )}
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    Clear all
                  </Button>
                )}
              </div>

              {filterContent}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    );
  }

  const sheetTitle = showSheetSort ? 'Filters & Sort' : 'Filters';

  return (
    <AnimatePresence>
      {isOpen && (
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
                {activeFiltersCount > 0 && (
                  <p className="text-muted-foreground text-sm">
                    {activeFiltersCount} filter{activeFiltersCount !== 1 && 's'} applied
                  </p>
                )}
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
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={clearAllFilters}
                    className="min-h-[44px] flex-1"
                  >
                    Clear all
                  </Button>
                )}
                <Button onClick={onClose} className="min-h-[44px] flex-1">
                  Show results
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
