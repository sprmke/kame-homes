import {
  Building2,
  Car,
  ChevronRight,
  Home,
  MapPin,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import {
  orderSuggestionKinds,
  type ListingSearchPreferType,
} from '@/features/guest/marketing/shared/lib/listingSearchPreferType';
import { isConceptSuggestionId } from '@/features/guest/search/lib/searchIntents';
import type {
  SearchListingsType,
  SearchSuggestionItem,
  SearchSuggestionKind,
} from '@/features/guest/search/types/search';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Max rows shown per category in the typeahead (See all → full `/search` tab). */
export const SUGGESTION_PREVIEW_LIMIT = 3;

const KIND_ICON: Record<SearchSuggestionKind, LucideIcon> = {
  location: MapPin,
  development: Building2,
  property: Home,
  parking: Car,
};

const SECTION_LABEL: Record<SearchSuggestionKind, string> = {
  location: 'Locations',
  development: 'Developments',
  property: 'Properties',
  parking: 'Parkings',
};

/** Short header action — primary affordance next to the category label. */
const SEE_ALL_HEADER: Record<SearchSuggestionKind, string> = {
  location: 'See all',
  development: 'See all',
  property: 'See all',
  parking: 'See all',
};

/** Footer when truncated — names the category for clarity. */
const SEE_ALL_FOOTER: Record<SearchSuggestionKind, string> = {
  location: 'View all locations',
  development: 'View all developments',
  property: 'View all properties',
  parking: 'View all parkings',
};

function isIntentChip(item: SearchSuggestionItem): boolean {
  return item.id === 'nearby' || isConceptSuggestionId(item.id);
}

function sectionLabelFor(kind: SearchSuggestionKind, items: SearchSuggestionItem[]): string {
  if (kind === 'location' && items.length > 0 && items.every(isIntentChip)) {
    return 'Ideas';
  }
  return SECTION_LABEL[kind];
}

function iconForItem(item: SearchSuggestionItem): LucideIcon {
  if (isConceptSuggestionId(item.id)) return Sparkles;
  if (item.id === 'nearby') return MapPin;
  return KIND_ICON[item.kind];
}

export type SuggestionFlatItem = SearchSuggestionItem & { flatIndex: number };

type SuggestionGroups = {
  locations: SearchSuggestionItem[];
  developments: SearchSuggestionItem[];
  properties: SearchSuggestionItem[];
  parkings: SearchSuggestionItem[];
};

export type SuggestionCategoryTarget = {
  kind: SearchSuggestionKind;
  /** Listing type for `/search?type=` — null for locations (All with where only). */
  type: Exclude<SearchListingsType, 'all'> | null;
};

type Props = SuggestionGroups & {
  isLoading: boolean;
  query: string;
  activeIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (item: SearchSuggestionItem) => void;
  /** Navigate to unified `/search` without page focus (clear `focus` param). */
  onSearchAnyway: () => void;
  /** Open `/search` on a single category tab (or All for locations). */
  onViewCategory: (target: SuggestionCategoryTarget) => void;
  /** Origin listing page category — reorders typeahead sections. */
  preferType?: ListingSearchPreferType | null;
};

function itemsForKind(
  groups: SuggestionGroups,
  kind: SearchSuggestionKind
): SearchSuggestionItem[] {
  if (kind === 'location') return groups.locations;
  if (kind === 'development') return groups.developments;
  if (kind === 'property') return groups.properties;
  return groups.parkings;
}

export function suggestionKindToSearchType(
  kind: SearchSuggestionKind
): Exclude<SearchListingsType, 'all'> | null {
  if (kind === 'property') return 'properties';
  if (kind === 'development') return 'developments';
  if (kind === 'parking') return 'parkings';
  return null;
}

/** Keyboard list = preview rows only (See all is pointer/Tab, not arrow-nav). */
export function flattenSuggestions(
  input: SuggestionGroups & { preferType?: ListingSearchPreferType | null }
): SuggestionFlatItem[] {
  const order = orderSuggestionKinds(input.preferType ?? null);
  const flat: SuggestionFlatItem[] = [];
  for (const kind of order) {
    const preview = itemsForKind(input, kind).slice(0, SUGGESTION_PREVIEW_LIMIT);
    for (const item of preview) {
      flat.push({ ...item, flatIndex: flat.length });
    }
  }
  return flat;
}

function SuggestionSkeleton() {
  return (
    <ul className="space-y-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <span className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function SearchAllResultsButton({
  query,
  onClick,
  prominent = false,
}: {
  query: string;
  onClick: () => void;
  prominent?: boolean;
}) {
  const label = query.trim() ? `Search all results for “${query.trim()}”` : 'Search all results';

  if (prominent) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/40 flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2"
      >
        <Search className="size-4" aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border hover:bg-muted focus-visible:ring-primary/40 group flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
    >
      <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
        <Search className="size-4" aria-hidden />
      </span>
      <span className="text-primary min-w-0 flex-1 truncate text-sm font-semibold underline-offset-4 group-hover:underline">
        {label}
      </span>
    </button>
  );
}

export function SearchSuggestionPanel({
  locations,
  developments,
  properties,
  parkings,
  isLoading,
  query,
  activeIndex,
  onHighlight,
  onSelect,
  onSearchAnyway,
  onViewCategory,
  preferType = null,
}: Props) {
  const groups = { locations, developments, properties, parkings };
  const sections = orderSuggestionKinds(preferType)
    .map((kind) => {
      const items = itemsForKind(groups, kind);
      return {
        kind,
        items,
        preview: items.slice(0, SUGGESTION_PREVIEW_LIMIT),
        truncated: items.length >= SUGGESTION_PREVIEW_LIMIT,
      };
    })
    .filter((section) => section.items.length > 0);

  const flat = flattenSuggestions({ ...groups, preferType });
  const showLive = query.trim().length >= 2;

  if (!showLive) return null;

  if (isLoading && flat.length === 0) {
    return (
      <div className="mt-1">
        <p className="text-muted-foreground mb-3 text-xs font-semibold">Searching</p>
        <SuggestionSkeleton />
      </div>
    );
  }

  if (flat.length === 0) {
    return (
      <div className="mt-1 space-y-3">
        <p className="text-muted-foreground text-sm">No matches</p>
        <SearchAllResultsButton query={query} onClick={onSearchAnyway} prominent />
      </div>
    );
  }

  let runningIndex = -1;

  return (
    <div className="mt-1">
      {sections.map((section) => {
        const target: SuggestionCategoryTarget = {
          kind: section.kind,
          type: suggestionKindToSearchType(section.kind),
        };
        const showSeeAll = section.truncated && !section.items.every(isIntentChip);
        return (
          <div key={section.kind} className="mb-3 last:mb-0">
            <div className="mb-1 flex min-h-[36px] items-center justify-between gap-2">
              <p className="text-foreground text-xs font-semibold">
                {sectionLabelFor(section.kind, section.items)}
              </p>
              {showSeeAll ? (
                <button
                  type="button"
                  onClick={() => onViewCategory(target)}
                  className="text-primary hover:text-primary/80 focus-visible:ring-primary/40 inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-end gap-0.5 px-1 text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2"
                  aria-label={SEE_ALL_FOOTER[section.kind]}
                >
                  {SEE_ALL_HEADER[section.kind]}
                  <ChevronRight className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
            <ul className="space-y-1">
              {section.preview.map((item) => {
                runningIndex += 1;
                const index = runningIndex;
                const active = index === activeIndex;
                const Icon = iconForItem(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      id={`search-suggestion-${index}`}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => onHighlight(index)}
                      onClick={() => onSelect(item)}
                      className={cn(
                        'flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors',
                        active ? 'bg-muted' : 'hover:bg-muted'
                      )}
                    >
                      <span className="bg-muted text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="text-foreground block text-sm font-medium">
                          {item.label}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {item.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <div className="border-border mt-3 border-t pt-3">
        <SearchAllResultsButton query={query} onClick={onSearchAnyway} />
      </div>
    </div>
  );
}
