import { useLocation } from 'react-router-dom';

import {
  GuestProfileFormSkeleton,
  GuestReviewsPageSkeleton,
  GuestVouchersPageSkeleton,
} from '@/components/skeletons/GuestAccountSkeletons';
import {
  DevelopmentDetailPageSkeleton,
  GuestAccountGateSkeleton,
  ParkingDetailPageSkeleton,
  PropertyChatPageSkeleton,
  PropertyDetailPageSkeleton,
  PublicLandingPageSkeleton,
} from '@/components/skeletons/GuestMarketingSkeleton';
import {
  GuestDevelopmentDetailRouteSkeleton,
  GuestFormRouteSkeleton,
  GuestMarketingListRouteSkeleton,
  GuestSearchRouteSkeleton,
} from '@/components/skeletons/RouteSkeletons';

/** Path-aware Suspense fallback for `MarketingLayoutShell` (nav + footer stay mounted). */
export function MarketingRouteSuspenseFallback() {
  const { pathname } = useLocation();

  if (pathname === '/search') {
    return <GuestSearchRouteSkeleton />;
  }

  if (/^\/developments\/[^/]+\/?$/.test(pathname)) {
    return <GuestDevelopmentDetailRouteSkeleton />;
  }

  if (/^\/developments\/[^/]+\/(properties|parking)\/?$/.test(pathname)) {
    return <GuestMarketingListRouteSkeleton />;
  }

  if (/^\/developments(\/in\/[^/]+)?\/?$/.test(pathname)) {
    return <GuestMarketingListRouteSkeleton />;
  }

  if (
    /^\/properties(\/in\/[^/]+)?\/?$/.test(pathname) ||
    /^\/parkings(\/in\/[^/]+)?\/?$/.test(pathname)
  ) {
    return <GuestMarketingListRouteSkeleton />;
  }

  if (/^\/properties\/[^/]+\/?$/.test(pathname)) {
    return <PropertyDetailPageSkeleton />;
  }

  if (/^\/parkings\/[^/]+\/?$/.test(pathname)) {
    return <ParkingDetailPageSkeleton />;
  }

  if (
    /^\/parkings\/[^/]+\/form\/?$/.test(pathname) ||
    /^\/properties\/[^/]+\/form\/?$/.test(pathname)
  ) {
    return <GuestFormRouteSkeleton />;
  }

  if (/^\/hosts\/[^/]+\/?$/.test(pathname)) {
    return <DevelopmentDetailPageSkeleton />;
  }

  if (pathname.startsWith('/for-hosts')) {
    return <PublicLandingPageSkeleton />;
  }

  if (pathname === '/' || pathname.startsWith('/explore-preview')) {
    return <PublicLandingPageSkeleton />;
  }

  return <PublicLandingPageSkeleton />;
}

/** Suspense fallback inside guest account shell (sidebar stays mounted). */
export function GuestAccountRouteSuspenseFallback() {
  const { pathname } = useLocation();

  if (pathname.includes('/account/stays') || pathname.includes('/account/messages')) {
    return <PropertyChatPageSkeleton />;
  }

  if (pathname.includes('/account/profile') || pathname.includes('/account/settings')) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <GuestProfileFormSkeleton />
      </div>
    );
  }

  if (pathname.includes('/account/vouchers')) {
    return <GuestVouchersPageSkeleton />;
  }

  if (pathname.includes('/account/reviews')) {
    return <GuestReviewsPageSkeleton />;
  }

  if (pathname.includes('/account/favorites')) {
    return <GuestVouchersPageSkeleton />;
  }

  if (pathname.includes('/account/favorites')) {
    return <GuestMarketingListRouteSkeleton />;
  }

  return <GuestAccountGateSkeleton />;
}
