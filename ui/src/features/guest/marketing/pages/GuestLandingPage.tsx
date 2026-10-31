import { Navigate, useSearchParams } from 'react-router-dom';

import { stripLegacyFromQueryParam } from '@/features/guest/form/lib/bookingSourceFromSearchParams';
import { readGuestPropertySlug } from '@/features/guest/form/lib/guestPropertyScope';
import { guestCalendarPath } from '@/features/guest/lib/guestPublicPaths';
import { FeaturedProperties } from '@/features/guest/marketing/guest-landing/components/FeaturedProperties';
import { GuestHero } from '@/features/guest/marketing/guest-landing/components/GuestHero';
import { LandingSocialProof } from '@/features/guest/marketing/guest-landing/components/LandingSocialProof';
import { PopularDestinations } from '@/features/guest/marketing/guest-landing/components/PopularDestinations';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { usePageMeta } from '@/lib/seo/usePageMeta';

export function GuestLandingPage() {
  usePageTitle(publicPageTitle('Home'));
  usePageMeta({ canonicalPath: '/' });
  const [searchParams] = useSearchParams();
  const property = readGuestPropertySlug(searchParams);

  if (property) {
    const next = stripLegacyFromQueryParam(new URLSearchParams(searchParams));
    next.delete('property');
    next.delete('property_slug');
    return <Navigate to={guestCalendarPath(property, next)} replace />;
  }

  return (
    <>
      <GuestHero />
      <FeaturedProperties />
      <PopularDestinations />
      <LandingSocialProof />
    </>
  );
}
