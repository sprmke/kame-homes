import { useLocation } from 'react-router-dom';

import { motion } from 'framer-motion';

import {
  HeroSearch,
  type HeroSearchField,
  type HeroSearchValues,
} from '@/features/guest/marketing/guest-landing/components/HeroSearch';
import { useListingScrollSearchOptional } from '@/features/guest/marketing/shared/context/ListingScrollSearchContext';
import { resolveListingSearchPreferType } from '@/features/guest/marketing/shared/lib/listingScrollSearchPaths';
import { useListingSearchDefaultLocation } from '@/features/guest/marketing/shared/lib/listingSearchDefaultLocation';
import {
  useListingSearchFields,
  useListingSearchWhereSegment,
} from '@/features/guest/marketing/shared/lib/listingSearchFields';
import type { ListingSearchPreferType } from '@/features/guest/marketing/shared/lib/listingSearchPreferType';

import { cn } from '@/lib/utils';

export type { HeroSearchValues as PropertySearchState };

interface ListingHeroSearchProps {
  onSearch?: (values: HeroSearchValues) => void;
  /** Always navigates to `/search` for real results (kept for API compatibility). */
  redirectTo?: string;
  preferType?: ListingSearchPreferType | null;
  className?: string;
  fields?: HeroSearchField[];
  whereLabel?: string;
  wherePlaceholder?: string;
  whereCompactPlaceholder?: string;
}

export function ListingHeroSearch({
  onSearch,
  redirectTo = '/search',
  preferType: preferTypeProp,
  className,
  fields: fieldsProp,
  whereLabel: whereLabelProp,
  wherePlaceholder: wherePlaceholderProp,
  whereCompactPlaceholder: whereCompactPlaceholderProp,
}: ListingHeroSearchProps) {
  const { pathname } = useLocation();
  const scrollSearch = useListingScrollSearchOptional();
  const morphEnabled = scrollSearch?.enabled ?? false;
  const routeDefaultLocation = useListingSearchDefaultLocation();
  const routeFields = useListingSearchFields();
  const routeWhereSegment = useListingSearchWhereSegment();
  const defaultLocation = scrollSearch?.defaultLocation ?? routeDefaultLocation;
  const fields = fieldsProp ?? scrollSearch?.fields ?? routeFields;
  const whereLabel = whereLabelProp ?? scrollSearch?.whereLabel ?? routeWhereSegment.label;
  const wherePlaceholder =
    wherePlaceholderProp ?? scrollSearch?.wherePlaceholder ?? routeWhereSegment.placeholder;
  const whereCompactPlaceholder =
    whereCompactPlaceholderProp ??
    scrollSearch?.whereCompactPlaceholder ??
    routeWhereSegment.compactPlaceholder;
  const preferType =
    preferTypeProp !== undefined
      ? preferTypeProp
      : (scrollSearch?.preferType ?? resolveListingSearchPreferType(pathname));

  if (morphEnabled && scrollSearch) {
    return (
      <motion.div
        className={cn('w-full lg:mx-auto lg:max-w-3xl', className)}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div ref={scrollSearch.heroAnchorRef} className="h-14 w-full lg:h-[92px]" aria-hidden />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn('mx-auto w-full max-w-3xl', className)}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <HeroSearch
        redirectTo={redirectTo}
        preferType={preferType}
        defaultLocation={defaultLocation}
        onSearch={onSearch}
        fields={fields}
        whereLabel={whereLabel}
        wherePlaceholder={wherePlaceholder}
        whereCompactPlaceholder={whereCompactPlaceholder}
      />
    </motion.div>
  );
}
