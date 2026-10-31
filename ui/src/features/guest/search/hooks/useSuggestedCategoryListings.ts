import { Building2, Car, Navigation, type LucideIcon } from 'lucide-react';

import { usePublicDevelopments } from '@/features/guest/marketing/developments/hooks/usePublicDevelopments';
import { DEFAULT_DEVELOPMENTS_QUERY } from '@/features/guest/marketing/developments/lib/developmentsQuery';
import { usePublicParkings } from '@/features/guest/marketing/parkings/hooks/usePublicParkings';
import { DEFAULT_PARKINGS_QUERY } from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import { usePublicProperties } from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import { DEFAULT_PROPERTIES_QUERY } from '@/features/guest/marketing/properties/lib/propertiesQuery';
import type { ListingSearchPreferType } from '@/features/guest/marketing/shared/lib/listingSearchPreferType';
import { nearbyDisplayLabel } from '@/features/guest/search/lib/searchIntents';

const SUGGESTED_LIMIT = 5;

export type SuggestedSearchItem = {
  id: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  /** Nearby chip — triggers geo search */
  kind: 'nearby' | 'listing';
  /** Detail slug when kind is listing */
  slug?: string;
  listingType?: ListingSearchPreferType;
};

export function suggestedSectionTitle(preferType: ListingSearchPreferType | null): string {
  if (preferType === 'developments') return 'Suggested developments';
  if (preferType === 'properties') return 'Suggested properties';
  if (preferType === 'parkings') return 'Suggested parkings';
  return 'Suggested destinations';
}

export function categoryListingIcon(preferType: ListingSearchPreferType): LucideIcon {
  if (preferType === 'parkings') return Car;
  return Building2;
}

function nearbyItem(preferType: ListingSearchPreferType | null): SuggestedSearchItem {
  return {
    id: 'nearby',
    label: nearbyDisplayLabel(preferType),
    subtitle:
      preferType === 'developments'
        ? 'Developments around you'
        : preferType === 'properties'
          ? 'Stays around you'
          : preferType === 'parkings'
            ? 'Parking around you'
            : "Find what's around you",
    icon: Navigation,
    kind: 'nearby',
  };
}

/**
 * Recommended listings for the Where empty state on category pages.
 * Home / unfocused pages should use static destinations instead.
 */
export function useSuggestedCategoryListings(preferType: ListingSearchPreferType | null): {
  items: SuggestedSearchItem[];
  isLoading: boolean;
} {
  const enabled = preferType != null;

  const developments = usePublicDevelopments(
    { ...DEFAULT_DEVELOPMENTS_QUERY, pageSize: SUGGESTED_LIMIT, sort: 'recommended' },
    enabled && preferType === 'developments'
  );
  const properties = usePublicProperties(
    { ...DEFAULT_PROPERTIES_QUERY, pageSize: SUGGESTED_LIMIT, sort: 'recommended' },
    enabled && preferType === 'properties'
  );
  const parkings = usePublicParkings(
    { ...DEFAULT_PARKINGS_QUERY, pageSize: SUGGESTED_LIMIT, sort: 'tower' },
    enabled && preferType === 'parkings'
  );

  if (!preferType) {
    return { items: [], isLoading: false };
  }

  const nearby = nearbyItem(preferType);
  const Icon = categoryListingIcon(preferType);

  if (preferType === 'developments') {
    const rows = developments.data?.data ?? [];
    return {
      isLoading: developments.isLoading && !developments.data,
      items: [
        nearby,
        ...rows.map((row) => ({
          id: row.id,
          label: row.name,
          subtitle: [row.city, row.location].filter(Boolean).join(' · ') || row.developerName,
          icon: Icon,
          kind: 'listing' as const,
          slug: row.slug,
          listingType: 'developments' as const,
        })),
      ],
    };
  }

  if (preferType === 'properties') {
    const rows = properties.data?.data ?? [];
    return {
      isLoading: properties.isLoading && !properties.data,
      items: [
        nearby,
        ...rows.map((row) => ({
          id: row.id,
          label: row.name,
          subtitle: row.location || row.developmentName || row.type,
          icon: Icon,
          kind: 'listing' as const,
          slug: row.slug,
          listingType: 'properties' as const,
        })),
      ],
    };
  }

  const rows = parkings.data?.data ?? [];
  return {
    isLoading: parkings.isLoading && !parkings.data,
    items: [
      nearby,
      ...rows.map((row) => ({
        id: row.id,
        label: row.name,
        subtitle:
          [row.residenceName ?? row.developmentName, row.city].filter(Boolean).join(' · ') ||
          row.slotLabel,
        icon: Icon,
        kind: 'listing' as const,
        slug: row.slug,
        listingType: 'parkings' as const,
      })),
    ],
  };
}
