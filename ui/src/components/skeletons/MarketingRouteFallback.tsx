import { useLocation } from 'react-router-dom';

import { SectionContentSkeleton } from '@/components/skeletons/AdminSkeletons';
import {
  DevelopmentDetailPageSkeleton,
  GuestAccountGateSkeleton,
  PropertyChatPageSkeleton,
} from '@/components/skeletons/GuestMarketingSkeleton';
import {
  GuestProfileFormSkeleton,
  GuestVouchersPageSkeleton,
} from '@/components/skeletons/GuestAccountSkeletons';
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

  if (/^\/properties\/[^/]+\/?$/.test(pathname) || /^\/parkings\/[^/]+\/?$/.test(pathname)) {
    return <DevelopmentDetailPageSkeleton />;
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
    return <SectionContentSkeleton rows={6} className="mx-auto max-w-6xl px-4 py-8 sm:px-6" />;
  }

  if (pathname === '/' || pathname.startsWith('/explore-preview')) {
    return <SectionContentSkeleton rows={8} className="mx-auto max-w-6xl px-4 py-8 sm:px-6" />;
  }

  return <SectionContentSkeleton rows={5} className="mx-auto max-w-6xl px-4 py-8 sm:px-6" />;
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

  if (pathname.includes('/account/favorites')) {
    return <GuestVouchersPageSkeleton />;
  }

  if (pathname.includes('/account/favorites')) {
    return <GuestMarketingListRouteSkeleton />;
  }

  return <GuestAccountGateSkeleton />;
}
