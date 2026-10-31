import type { ListingSearchPreferType } from '@/features/guest/marketing/shared/lib/listingSearchPreferType';
import { getListingSearchPreferType } from '@/features/guest/marketing/shared/lib/listingSearchPreferType';

export type ListingScrollSearchConfig = {
  /** Always the unified results surface. */
  redirectTo: '/search';
  /** Prioritize this category on submit (typeahead + All-view section order). */
  preferType: ListingSearchPreferType | null;
};

/** Exact listing roots that morph the hero search into the sticky nav. */
const LISTING_SEARCH_PATHS: Record<string, ListingScrollSearchConfig> = {
  '/properties': { redirectTo: '/search', preferType: 'properties' },
  '/developments': { redirectTo: '/search', preferType: 'developments' },
  '/parkings': { redirectTo: '/search', preferType: 'parkings' },
  '/services': { redirectTo: '/search', preferType: null },
  '/search': { redirectTo: '/search', preferType: null },
};

/**
 * Location browse pages (`/properties/in/:location`, `/developments/in/:location`)
 * use the same hero → header search morph as their parent list pages.
 */
function locationBrowseConfig(pathname: string): ListingScrollSearchConfig | null {
  if (pathname.startsWith('/properties/in/')) {
    return { redirectTo: '/search', preferType: 'properties' };
  }
  if (pathname.startsWith('/developments/in/')) {
    return { redirectTo: '/search', preferType: 'developments' };
  }
  if (pathname.startsWith('/parkings/in/')) {
    return { redirectTo: '/search', preferType: 'parkings' };
  }
  return null;
}

function developmentDetailConfig(pathname: string): ListingScrollSearchConfig | null {
  const match = pathname.match(/^\/developments\/([^/]+)$/);
  if (!match?.[1] || match[1] === 'in') return null;
  return { redirectTo: '/search', preferType: 'developments' };
}

function developmentPropertiesConfig(pathname: string): ListingScrollSearchConfig | null {
  const match = pathname.match(/^\/developments\/([^/]+)\/properties$/);
  if (!match?.[1] || match[1] === 'in') return null;
  return { redirectTo: '/search', preferType: 'properties' };
}

function developmentParkingConfig(pathname: string): ListingScrollSearchConfig | null {
  const match = pathname.match(/^\/developments\/([^/]+)\/parking/);
  if (!match?.[1] || match[1] === 'in') return null;
  return { redirectTo: '/search', preferType: 'parkings' };
}

export function getListingScrollSearchConfig(pathname: string): ListingScrollSearchConfig | null {
  return (
    LISTING_SEARCH_PATHS[pathname] ??
    locationBrowseConfig(pathname) ??
    developmentParkingConfig(pathname) ??
    developmentDetailConfig(pathname) ??
    developmentPropertiesConfig(pathname)
  );
}

/** Prefer type for any marketing path (including when scroll morph is off). */
export function resolveListingSearchPreferType(pathname: string): ListingSearchPreferType | null {
  return getListingScrollSearchConfig(pathname)?.preferType ?? getListingSearchPreferType(pathname);
}
