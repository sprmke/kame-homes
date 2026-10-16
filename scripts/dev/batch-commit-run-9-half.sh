#!/usr/bin/env bash
# Batch 9 commits — ~1/2 of WIP: public listing search vertical.
# Hold: guest trip hub, for-hosts v3, marketing/social remotion WIP, booking trip link UI.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

commit() {
  local msg=$1
  shift
  git add "$@"
  git commit -m "$msg"
}

commit "feat(supabase): add public listing search index and rpcs" \
  supabase/migrations/20261316126800_public_listing_search_index.sql

commit "feat(supabase): add public listing search shared services" \
  supabase/functions/_shared/publicListingSearch.ts \
  supabase/functions/_shared/publicListingSearch_test.ts \
  supabase/functions/_shared/publicListingCache.ts \
  supabase/functions/_shared/publicListingCache_test.ts \
  supabase/functions/_shared/publicListingCards.ts \
  supabase/functions/_shared/publicListingRows_test.ts \
  supabase/functions/_shared/publicDevelopmentLink.ts \
  supabase/functions/_shared/publicSitemap.ts \
  supabase/functions/_shared/publicSitemap_test.ts \
  supabase/functions/_shared/availabilityService.ts \
  supabase/functions/_shared/publicGeoScope.ts \
  supabase/functions/_shared/publicListingFacets.ts \
  supabase/functions/_shared/publicListingRows.ts \
  supabase/functions/_shared/publicPropertyService.ts \
  supabase/functions/_shared/publicSearch.ts \
  supabase/functions/tests/publicListingSearchParity.integration_test.ts

commit "feat(supabase): wire public listing edges and sitemap" \
  supabase/functions/list-public-properties/index.ts \
  supabase/functions/list-public-parkings/index.ts \
  supabase/functions/list-public-developments/index.ts \
  supabase/functions/list-public-place-groups/index.ts \
  supabase/functions/search-listings/index.ts \
  supabase/functions/search-suggestions/index.ts \
  supabase/functions/public-sitemap/index.ts \
  supabase/functions/_shared/parkingScope.ts \
  supabase/functions/_shared/parkingSettingsSeed.ts \
  supabase/config.toml \
  deno.lock

commit "feat(ui): add listing shared pagination and fetch helpers" \
  ui/src/features/guest/marketing/shared/lib/publicListingFetch.ts \
  ui/src/features/guest/marketing/shared/lib/listingPagination.ts \
  ui/src/features/guest/marketing/shared/lib/listingPagination.test.ts \
  ui/src/features/guest/marketing/shared/lib/galleryWindow.ts \
  ui/src/features/guest/marketing/shared/lib/galleryWindow.test.ts \
  ui/src/features/guest/marketing/shared/lib/responsiveImage.ts \
  ui/src/features/guest/marketing/shared/lib/responsiveImage.test.ts \
  ui/src/features/guest/marketing/shared/lib/listingSearchDefaultLocation.ts \
  ui/src/features/guest/marketing/shared/lib/listingSearchDefaultLocation.test.ts \
  ui/src/features/guest/marketing/shared/lib/locationSlug.ts \
  ui/src/features/guest/marketing/shared/hooks/useListingUrlQuery.ts \
  ui/src/features/guest/marketing/shared/hooks/useGalleryWindow.ts \
  ui/src/features/guest/marketing/shared/hooks/usePublicPlaceGroups.ts \
  ui/src/features/guest/marketing/shared/components/ListingResultsPagination.tsx \
  ui/src/features/guest/marketing/shared/components/ListingLoadError.tsx \
  ui/src/features/guest/marketing/shared/components/LazyListingMapView.tsx \
  ui/src/features/guest/marketing/shared/components/MarketingImage.tsx \
  ui/src/features/guest/marketing/shared/components/MarketingLayoutShell.tsx \
  ui/src/features/guest/marketing/shared/components/PublicListingPagination.tsx

commit "feat(ui): refresh search results and listing fetch clients" \
  ui/src/features/guest/search/lib/publicSearchFetch.ts \
  ui/src/features/guest/search/hooks/useSearchListings.ts \
  ui/src/features/guest/search/hooks/useSearchSuggestions.ts \
  ui/src/features/guest/search/components/SearchResultsGrid.tsx \
  ui/src/features/guest/search/pages/SearchResultsPage.tsx

commit "feat(ui): update development and parking listing helpers" \
  ui/src/features/guest/marketing/developments/lib/parkingSlotFilters.ts \
  ui/src/features/guest/marketing/developments/lib/parkingSlotFilters.test.ts \
  ui/src/features/guest/marketing/developments/lib/resolvePublicDevelopment.ts \
  ui/src/features/guest/marketing/developments/lib/resolvePublicDevelopment.test.ts \
  ui/src/features/guest/marketing/developments/components/DevelopmentHero.tsx \
  ui/src/features/guest/marketing/developments/components/DevelopmentsMap.tsx \
  ui/src/features/guest/marketing/developments/hooks/usePublicDevelopment.ts \
  ui/src/features/guest/marketing/developments/hooks/usePublicDevelopments.ts \
  ui/src/features/guest/marketing/developments/hooks/useDevelopmentHasParking.ts \
  ui/src/features/guest/marketing/parkings/lib/parkingListEntries.ts \
  ui/src/features/guest/marketing/parkings/lib/parkingsQuery.ts \
  ui/src/features/guest/marketing/parkings/hooks/usePublicParkings.ts \
  ui/src/features/guest/marketing/parkings/hooks/usePublicParkingDetail.ts \
  ui/src/features/guest/marketing/parkings/components/ParkingOverview.tsx \
  ui/src/features/guest/marketing/properties/hooks/usePublicProperties.ts \
  ui/src/features/guest/marketing/properties/lib/mapPublicPropertyDetail.ts \
  ui/src/features/guest/marketing/properties/types/publicProperty.ts \
  ui/src/features/guest/marketing/properties/components/PropertyCard.tsx \
  ui/src/features/guest/marketing/properties/components/PropertyListItem.tsx \
  ui/src/features/guest/marketing/properties/components/PropertiesMap.tsx \
  ui/src/features/guest/marketing/properties/components/property-detail/PropertyOverview.tsx

commit "feat(ui): harden public browse and detail listing pages" \
  ui/src/features/guest/marketing/pages/PropertiesListPage.tsx \
  ui/src/features/guest/marketing/pages/PropertiesLocationPage.tsx \
  ui/src/features/guest/marketing/pages/PropertyDetailPage.tsx \
  ui/src/features/guest/marketing/pages/ParkingsListPage.tsx \
  ui/src/features/guest/marketing/pages/ParkingsLocationPage.tsx \
  ui/src/features/guest/marketing/pages/ParkingDetailPage.tsx \
  ui/src/features/guest/marketing/pages/DevelopmentsListPage.tsx \
  ui/src/features/guest/marketing/pages/DevelopmentsLocationPage.tsx \
  ui/src/features/guest/marketing/pages/DevelopmentDetailPage.tsx \
  ui/src/features/guest/marketing/pages/DevelopmentPropertiesPage.tsx \
  ui/src/features/guest/marketing/pages/DevelopmentParkingListPage.tsx \
  ui/src/features/guest/marketing/guest-landing/components/FeaturedProperties.tsx \
  ui/src/features/guest/marketing/guest-landing/components/HeroCanvas.tsx \
  ui/src/features/guest/marketing/guest-landing/components/HeroSearch.tsx \
  ui/src/features/guest/marketing/guest-landing/components/HeroSearchParts.tsx \
  ui/src/features/guest/marketing/guest-landing/lib/heroSearchState.ts \
  ui/src/features/guest/marketing/guest-landing/lib/heroSearchState.test.ts \
  ui/src/features/guest/marketing/guest-landing/components/FeaturedDevelopments.tsx \
  ui/src/features/guest/marketing/parkings/lib/parkingListEntries.test.ts \
  ui/src/features/guest/marketing/pages/GuestLandingPage.tsx \
  ui/src/features/guest/marketing/routes/index.tsx

commit "feat(ui): add seo middleware and public robots rules" \
  ui/middleware.ts \
  ui/tsconfig.middleware.json \
  ui/public/robots.txt \
  ui/src/lib/seo \
  ui/.env.example \
  ui/e2e/features/public/publicListingBrowse.spec.ts

commit "docs(docs): document public listing search and browse hardening" \
  docs/PROJECT.md \
  docs/architecture/edge-functions.md \
  docs/architecture/overview.md \
  docs/architecture/routing.md \
  docs/architecture/validation-and-env.md \
  docs/archive/operations/migration-runbook.md \
  docs/guides/routes/search.md \
  docs/workflow/for-testing/public-listing-pages-hardening.md

echo "batch-commit-run-9-half done"
