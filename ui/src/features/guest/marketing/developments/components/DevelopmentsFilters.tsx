import { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, Home, Layers } from 'lucide-react';

import {
  clearDevelopmentFilters,
  countActiveDevelopmentFilters,
  type DevelopmentsFacets,
  type DevelopmentsListingQuery,
} from '@/features/guest/marketing/developments/lib/developmentsQuery';
import { FilterEmptyLabel } from '@/features/guest/marketing/shared/components/FilterEmptyLabel';
import { FilterSection } from '@/features/guest/marketing/shared/components/FilterSection';
import { FilterSheetSort } from '@/features/guest/marketing/shared/components/FilterSheetSort';
import { DEVELOPMENT_SORT_OPTIONS } from '@/features/guest/marketing/shared/lib/listingFilterChips';
import { useListingFilterMotionWidth } from '@/features/guest/marketing/shared/lib/listingFilterMotion';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DevelopmentsFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
  value: DevelopmentsListingQuery;
  onChange: (next: DevelopmentsListingQuery) => void;
  facets: DevelopmentsFacets;
  /** Mobile sheet sort (keeps “Filters & Sort” honest). */
  sortBy?: string;
  onSortChange?: (sort: string) => void;
}

const TYPE_ICONS: Record<string, typeof Building2> = {
  CONDOMINIUM: Building2,
  SUBDIVISION: Home,
  MIXED_USE: Layers,
  TOWNHOUSE: Home,
  COMMERCIAL: Building2,
};

const PRICE_PRESETS = [
  { id: 'budget', label: 'Under ₱3,000', min: 0, max: 3000 },
  { id: 'mid', label: '₱3,000 – ₱6,000', min: 3000, max: 6000 },
  { id: 'premium', label: '₱6,000 – ₱12,000', min: 6000, max: 12000 },
  { id: 'luxury', label: '₱12,000+', min: 12000, max: null as number | null },
] as const;

function selectedPricePresetId(value: DevelopmentsListingQuery): string | null {
  for (const preset of PRICE_PRESETS) {
    if (preset.max == null && value.minPrice === preset.min && value.maxPrice == null) {
      return preset.id;
    }
    if (preset.max != null && value.minPrice === preset.min && value.maxPrice === preset.max) {
      return preset.id;
    }
  }
  return null;
}

export function DevelopmentsFilters({
  isOpen,
  onClose,
  isMobile = false,
  value,
  onChange,
  facets,
  sortBy,
  onSortChange,
}: DevelopmentsFiltersProps) {
  const motionProps = useListingFilterMotionWidth(300);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    type: true,
    city: true,
    price: true,
    developer: false,
  });
  const showSheetSort = Boolean(isMobile && sortBy != null && onSortChange);

  const patch = (partial: Partial<DevelopmentsListingQuery>) => {
    onChange({ ...value, ...partial, page: 1 });
  };

  const toggleType = (id: string) => {
    const next = value.type.includes(id) ? value.type.filter((t) => t !== id) : [...value.type, id];
    patch({ type: next });
  };

  const toggleCity = (city: string) => {
    const next = value.city.includes(city)
      ? value.city.filter((c) => c !== city)
      : [...value.city, city];
    patch({ city: next });
  };

  const toggleDeveloper = (name: string) => {
    const next = value.developer.includes(name)
      ? value.developer.filter((d) => d !== name)
      : [...value.developer, name];
    patch({ developer: next });
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const clearAll = () => {
    onChange(clearDevelopmentFilters(value));
  };

  const activeCount = countActiveDevelopmentFilters(value);
  const selectedPrice = selectedPricePresetId(value);

  const typeOptions =
    facets.types.length > 0
      ? facets.types
      : value.type.map((type) => ({
          type,
          label: type,
          count: 0,
        }));

  const cityOptions =
    facets.cities.length > 0 ? facets.cities : value.city.map((city) => ({ city, count: 0 }));

  const developerOptions =
    facets.developers.length > 0
      ? facets.developers
      : value.developer.map((name) => ({ name, count: 0 }));

  const filterContent = (
    <div className="space-y-6">
      {showSheetSort ? (
        <FilterSheetSort
          value={sortBy!}
          options={[...DEVELOPMENT_SORT_OPTIONS]}
          onChange={onSortChange!}
        />
      ) : null}
      <FilterSection
        title="Development Type"
        expanded={expandedSections.type ?? false}
        onToggle={() => toggleSection('type')}
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
        title="City / Location"
        expanded={expandedSections.city ?? false}
        onToggle={() => toggleSection('city')}
      >
        {cityOptions.length === 0 ? (
          <FilterEmptyLabel />
        ) : (
          <div className="space-y-1.5">
            {cityOptions.map((entry) => {
              const isSelected = value.city.includes(entry.city);
              return (
                <button
                  key={entry.city}
                  type="button"
                  onClick={() => toggleCity(entry.city)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex min-h-[44px] w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted'
                  )}
                >
                  <span>{entry.city}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {entry.count > 0 ? entry.count : isSelected ? '•' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </FilterSection>

      <FilterSection
        title="Price Range"
        subtitle="Per night (starting from)"
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
                {range.label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection
        title="Developer"
        expanded={expandedSections.developer ?? false}
        onToggle={() => toggleSection('developer')}
      >
        {developerOptions.length === 0 ? (
          <FilterEmptyLabel />
        ) : (
          <div className="space-y-1.5">
            {developerOptions.map((entry) => {
              const isSelected = value.developer.includes(entry.name);
              return (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => toggleDeveloper(entry.name)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex min-h-[44px] w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted'
                  )}
                >
                  <span>{entry.name}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {entry.count > 0 ? entry.count : isSelected ? '•' : ''}
                  </span>
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
            <div className="h-full w-[300px] overflow-y-auto p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-foreground text-lg font-semibold">Filters</h3>
                  {activeCount > 0 && (
                    <p className="text-muted-foreground text-sm">
                      {activeCount} filter{activeCount !== 1 ? 's' : ''} applied
                    </p>
                  )}
                </div>
                {activeCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAll}>
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
                {activeCount > 0 && (
                  <p className="text-muted-foreground text-sm">
                    {activeCount} filter{activeCount !== 1 ? 's' : ''} applied
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
                {activeCount > 0 && (
                  <Button variant="outline" onClick={clearAll} className="min-h-[44px] flex-1">
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
