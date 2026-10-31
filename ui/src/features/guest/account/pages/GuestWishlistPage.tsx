import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import { GuestAccountEmptyState } from '@/features/guest/account/components/GuestAccountEmptyState';
import {
  WishlistPropertyCard,
  WishlistPropertyCardSkeleton,
} from '@/features/guest/account/components/WishlistPropertyCard';
import { useSavedPropertySlugsQuery } from '@/features/guest/marketing/properties/hooks/useSavedPropertySlugsQuery';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

/** Fixed ~240px tracks (same scale as explore carousels); 2-up on mobile. */
const WISHLIST_GRID_CLASS =
  'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,15rem)] sm:gap-x-4 sm:gap-y-5';

export function GuestWishlistPage() {
  usePageTitle(publicPageTitle('Favorites'));
  const { data: slugs = [], isLoading } = useSavedPropertySlugsQuery();

  if (isLoading) {
    return (
      <GuestAccountContentCard>
        <div className={WISHLIST_GRID_CLASS}>
          {Array.from({ length: 4 }).map((_, index) => (
            <WishlistPropertyCardSkeleton key={index} />
          ))}
        </div>
      </GuestAccountContentCard>
    );
  }

  if (slugs.length === 0) {
    return (
      <GuestAccountEmptyState
        message="No saved properties."
        actionLabel="Browse properties"
        actionHref="/properties"
      />
    );
  }

  return (
    <GuestAccountContentCard>
      <div className={WISHLIST_GRID_CLASS}>
        {slugs.map((slug) => (
          <WishlistPropertyCard key={slug} slug={slug} />
        ))}
      </div>
    </GuestAccountContentCard>
  );
}
