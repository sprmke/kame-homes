/**
 * Direction contract (impeccable / new surface in the established Kame world).
 *
 * THESIS: The landing is a window that opens. It refuses the half-width headline beside a
 * boxed photo card, and the stack of same-size icon cards under it.
 * OWN-WORLD: Kame teal (`primary-strong` fields) on white, Plus Jakarta Sans set large and
 * tight, full-bleed photography reached through rounded clip-path windows, ticket-stub
 * parking, product screens in a dark phone bezel. One motion: the aperture opening.
 * STORY: A guest searches immediately, scrolls into a full-bleed stay, learns one booking
 * covers home, parking, building pass and host chat, sees live stays and places, and
 * leaves through the same search.
 * FIRST VIEWPORT: centered headline and the live search over a rounded window onto a stay;
 * scrolling pins the stage and widens the window to full bleed.
 * FORM: structure 7 of 7 (aperture reveal), staging: pinned hero + sticky phone journey.
 * Seed d853526b.
 */
import { Navigate, useSearchParams } from 'react-router-dom';

import { stripLegacyFromQueryParam } from '@/features/guest/form/lib/bookingSourceFromSearchParams';
import { readGuestPropertySlug } from '@/features/guest/form/lib/guestPropertyScope';
import { guestCalendarPath } from '@/features/guest/lib/guestPublicPaths';
import { V2ApertureHero } from '@/features/guest/marketing/guest-landing-v2/components/V2ApertureHero';
import { V2ClosingSearch } from '@/features/guest/marketing/guest-landing-v2/components/V2ClosingSearch';
import { V2ParkingBand } from '@/features/guest/marketing/guest-landing-v2/components/V2ParkingBand';
import { V2PlacesIndex } from '@/features/guest/marketing/guest-landing-v2/components/V2PlacesIndex';
import { V2StayJourney } from '@/features/guest/marketing/guest-landing-v2/components/V2StayJourney';
import { V2StaysRail } from '@/features/guest/marketing/guest-landing-v2/components/V2StaysRail';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { usePageMeta } from '@/lib/seo/usePageMeta';

/**
 * `/v2` — guest landing redesign for review next to `/`. Keeps the live page's legacy
 * `?property=` redirect so it can replace `GuestLandingPage` as-is once approved.
 */
export function GuestLandingV2Page() {
  usePageTitle(publicPageTitle('Home'));
  // Point search engines at `/` while this is a review route.
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
      <V2ApertureHero />
      <V2StayJourney />
      <V2StaysRail />
      <V2PlacesIndex />
      <V2ParkingBand />
      <V2ClosingSearch />
    </>
  );
}
