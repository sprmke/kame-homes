import type { SearchListingsType } from '@/features/guest/search/types/search';
import type { SearchSuggestionKind } from '@/features/guest/search/types/search';

/** Category the current marketing page should prioritize in search. */
export type ListingSearchPreferType = Exclude<SearchListingsType, 'all'>;

/**
 * Map a marketing pathname to the listing family we should prioritize in
 * typeahead + `/search` results. Homepage / `/search` / services → none.
 */
export function getListingSearchPreferType(pathname: string): ListingSearchPreferType | null {
  if (pathname === '/search' || pathname.startsWith('/search?')) return null;

  if (
    pathname === '/properties' ||
    pathname.startsWith('/properties/') ||
    pathname.match(/^\/developments\/[^/]+\/properties$/)
  ) {
    return 'properties';
  }

  if (
    pathname === '/parkings' ||
    pathname.startsWith('/parkings/') ||
    pathname.match(/^\/developments\/[^/]+\/parking/)
  ) {
    return 'parkings';
  }

  if (pathname === '/developments' || pathname.startsWith('/developments/')) {
    return 'developments';
  }

  // Services has no search-listings type yet — leave unprioritized (all).
  return null;
}

export function preferTypeToSuggestionKind(
  prefer: ListingSearchPreferType | null
): SearchSuggestionKind | null {
  if (prefer === 'properties') return 'property';
  if (prefer === 'developments') return 'development';
  if (prefer === 'parkings') return 'parking';
  return null;
}

/** Section / tab order with preferred category first (locations stay first in typeahead). */
export function orderListingCategories<T extends ListingSearchPreferType>(
  prefer: ListingSearchPreferType | null,
  categories: readonly T[]
): T[] {
  if (!prefer) return [...categories];
  const preferred = categories.filter((c) => c === prefer);
  const rest = categories.filter((c) => c !== prefer);
  return [...preferred, ...rest];
}

const DEFAULT_SUGGESTION_LISTING_KINDS: SearchSuggestionKind[] = [
  'development',
  'property',
  'parking',
];

/**
 * Typeahead section order: Locations always first, then preferred listing family, then the rest.
 */
export function orderSuggestionKinds(
  prefer: ListingSearchPreferType | null
): SearchSuggestionKind[] {
  const preferKind = preferTypeToSuggestionKind(prefer);
  const listingKinds = preferKind
    ? [preferKind, ...DEFAULT_SUGGESTION_LISTING_KINDS.filter((k) => k !== preferKind)]
    : DEFAULT_SUGGESTION_LISTING_KINDS;
  return ['location', ...listingKinds];
}
