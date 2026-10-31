import { Building2, Mountain, Navigation, Palmtree, Waves, type LucideIcon } from 'lucide-react';

import { suggestedDestinations } from '@/features/guest/marketing/guest-landing/data/landingContent';
import type { ListingSearchPreferType } from '@/features/guest/marketing/shared/lib/listingSearchPreferType';
import {
  suggestedSectionTitle,
  type SuggestedSearchItem,
  useSuggestedCategoryListings,
} from '@/features/guest/search/hooks/useSuggestedCategoryListings';

import { Skeleton } from '@/components/ui/skeleton';

const DESTINATION_ICONS: Record<(typeof suggestedDestinations)[number]['icon'], LucideIcon> = {
  nearby: Navigation,
  city: Building2,
  beach: Waves,
  mountain: Mountain,
  island: Palmtree,
};

type Props = {
  preferType: ListingSearchPreferType | null;
  onPickNearby: (label: string) => void;
  onPickDestination: (label: string) => void;
  onPickListing: (item: SuggestedSearchItem) => void;
};

/**
 * Where empty-state suggestions: destinations on home, recommended listings on category pages.
 * Nearby is always first on category pages (category-tagged label).
 */
export function SearchSuggestedEmptyPanel({
  preferType,
  onPickNearby,
  onPickDestination,
  onPickListing,
}: Props) {
  const { items, isLoading } = useSuggestedCategoryListings(preferType);
  const title = suggestedSectionTitle(preferType);

  if (preferType) {
    return (
      <>
        <p className="text-foreground mb-3 text-xs font-semibold">{title}</p>
        {isLoading && items.length <= 1 ? (
          <ul
            className="space-y-1"
            role="status"
            aria-live="polite"
            aria-label="Loading suggestions"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex min-h-[44px] items-center gap-3 px-2 py-2" aria-hidden>
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <Skeleton className="h-4 w-36 max-w-full" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="scrollbar-hide max-h-[min(42vh,300px)] space-y-1 overflow-y-auto">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (item.kind === 'nearby') onPickNearby(item.label);
                      else onPickListing(item);
                    }}
                    className="hover:bg-muted flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors"
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
        )}
      </>
    );
  }

  return (
    <>
      <p className="text-foreground mb-3 text-xs font-semibold">{title}</p>
      <ul className="scrollbar-hide max-h-[min(42vh,300px)] space-y-1 overflow-y-auto">
        {suggestedDestinations.map((destination) => {
          const Icon = DESTINATION_ICONS[destination.icon];
          return (
            <li key={destination.id}>
              <button
                type="button"
                onClick={() => {
                  if (destination.id === 'nearby') onPickNearby(destination.label);
                  else onPickDestination(destination.label);
                }}
                className="hover:bg-muted flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors"
              >
                <span className="bg-muted text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="text-foreground block text-sm font-medium">
                    {destination.label}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {destination.subtitle}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
