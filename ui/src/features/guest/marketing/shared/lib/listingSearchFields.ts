import { useMemo } from 'react';

import { useLocation } from 'react-router-dom';

import {
  HERO_SEARCH_FIELDS,
  type HeroSearchField,
} from '@/features/guest/marketing/guest-landing/components/HeroSearch';
import {
  getListingSearchPreferType,
  type ListingSearchPreferType,
} from '@/features/guest/marketing/shared/lib/listingSearchPreferType';

export type ListingSearchWhereSegment = {
  label: string;
  placeholder: string;
  compactPlaceholder: string;
};

const DEFAULT_WHERE_SEGMENT: ListingSearchWhereSegment = {
  label: 'Where',
  placeholder: 'Search destinations',
  compactPlaceholder: 'Anywhere',
};

const SERVICES_WHERE_SEGMENT: ListingSearchWhereSegment = {
  label: 'What',
  placeholder: 'Search services',
  compactPlaceholder: 'Services',
};

const CATEGORY_WHERE_SEGMENTS: Record<ListingSearchPreferType, ListingSearchWhereSegment> = {
  developments: {
    label: 'Where',
    placeholder: 'Search developments',
    compactPlaceholder: 'Developments',
  },
  properties: {
    label: 'Where',
    placeholder: 'Search properties',
    compactPlaceholder: 'Properties',
  },
  parkings: {
    label: 'Where',
    placeholder: 'Search parkings',
    compactPlaceholder: 'Parkings',
  },
};

/** Route-aware visible search segments (e.g. parking and services omit Who). */
export function getListingSearchFields(pathname: string): HeroSearchField[] {
  if (pathname === '/services') {
    return ['where', 'when'];
  }
  if (pathname.match(/^\/developments\/([^/]+)\/parking/)) {
    return ['where', 'when'];
  }
  if (pathname === '/parkings' || pathname.startsWith('/parkings/in/')) {
    return ['where', 'when'];
  }
  return [...HERO_SEARCH_FIELDS];
}

/** Where label + placeholders — category pages name the family; home stays destination-generic. */
export function getListingSearchWhereSegment(pathname: string): ListingSearchWhereSegment {
  if (pathname === '/services' || pathname.startsWith('/services/')) {
    return SERVICES_WHERE_SEGMENT;
  }
  const prefer = getListingSearchPreferType(pathname);
  if (prefer) return CATEGORY_WHERE_SEGMENTS[prefer];
  return DEFAULT_WHERE_SEGMENT;
}

export function useListingSearchFields(): HeroSearchField[] {
  const { pathname } = useLocation();
  return useMemo(() => getListingSearchFields(pathname), [pathname]);
}

export function useListingSearchWhereSegment(): ListingSearchWhereSegment {
  const { pathname } = useLocation();
  return useMemo(() => getListingSearchWhereSegment(pathname), [pathname]);
}
