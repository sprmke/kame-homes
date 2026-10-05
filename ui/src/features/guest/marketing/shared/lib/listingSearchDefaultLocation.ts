import { useMemo } from 'react';

import { useLocation } from 'react-router-dom';

import { usePublicDevelopment } from '@/features/guest/marketing/developments/hooks/usePublicDevelopment';
import { humanizeLocationSlug } from '@/features/guest/marketing/shared/lib/locationSlug';

const LOCATION_BROWSE_PATH = /^\/(?:developments|properties|parkings)\/in\/([^/]+)$/;
const DEVELOPMENT_PATH = /^\/developments\/([^/]+)(?:\/(?:properties|parking)(?:\/.*)?)?$/;

/** Development slug for `/developments/:slug`, `…/properties` and `…/parking*` routes. */
export function developmentSlugFromPath(pathname: string): string {
  const match = pathname.match(DEVELOPMENT_PATH);
  const slug = match?.[1] ?? '';
  return slug && slug !== 'in' ? decodeURIComponent(slug) : '';
}

/**
 * Route-aware default for the hero search "Where" field.
 *
 * Category indexes (`/developments`, `/properties`, …) stay empty: the page
 * already scopes the catalog, and stuffing the category label into Where looks
 * like a failed search ("No matches" for "Developments").
 *
 * Location browse paths prefill the place from the route slug; development paths
 * prefill the live development name once loaded (`developmentName`).
 */
export function getListingSearchDefaultLocation(
  pathname: string,
  developmentName?: string | null
): string {
  const locationMatch = pathname.match(LOCATION_BROWSE_PATH);
  if (locationMatch) {
    return humanizeLocationSlug(decodeURIComponent(locationMatch[1] ?? ''));
  }

  if (developmentSlugFromPath(pathname)) {
    return developmentName?.trim() ?? '';
  }

  return '';
}

/** Hook form; shares the development query cache with the development pages. */
export function useListingSearchDefaultLocation(): string {
  const { pathname } = useLocation();
  const developmentSlug = developmentSlugFromPath(pathname);
  const development = usePublicDevelopment(developmentSlug, Boolean(developmentSlug));
  const developmentName = development.data?.name ?? null;
  return useMemo(
    () => getListingSearchDefaultLocation(pathname, developmentName),
    [pathname, developmentName]
  );
}
