/**
 * Direction contract (impeccable / replacement world for the guest landing, rev. 2).
 *
 * THESIS: Quiet arrival, not a performance. A full-bleed photo and a short line of copy,
 * not a boxed/clipped window and not a pinned scroll-jacked sequence. Refuses the first
 * attempt's mistake of a literal object (elevator, flap board, stamped ticket, flipping
 * page) standing in for craft.
 * OWN-WORLD: Kame teal + neutral white/charcoal only — no new accent. Real photography,
 * generous whitespace, one calm motion vocabulary (fade + small rise) used everywhere,
 * nothing that performs a trick.
 * STORY: Arrive on one real photo, search; browse by place and by building through one
 * confident type-as-navigation device (not two different ones); see the stays and parking;
 * understand the one-booking bundle plainly; read the quiet trust case; hear one guest voice
 * at a time, cross-fading; ask a few questions; arrive again at the close.
 * FIRST VIEWPORT: full-bleed photo, slow one-directional zoom, a one-line headline, the
 * search docked near the bottom of a normal-height section — no pin.
 * FORM: no pinned/scrubbed sequence anywhere. Every section fades and rises once, in view,
 * and nothing else.
 * See `docs/workflow/in-progress/guest-landing-v3.md` §10 for the full rationale — this is
 * a rebuild after the first attempt (§5 in that doc) was reviewed and rejected.
 */
import { Navigate, useSearchParams } from 'react-router-dom';

import { stripLegacyFromQueryParam } from '@/features/guest/form/lib/bookingSourceFromSearchParams';
import { readGuestPropertySlug } from '@/features/guest/form/lib/guestPropertyScope';
import { guestCalendarPath } from '@/features/guest/lib/guestPublicPaths';
import { V3Bundle } from '@/features/guest/marketing/guest-landing-v3/components/V3Bundle';
import { V3Closing } from '@/features/guest/marketing/guest-landing-v3/components/V3Closing';
import { V3Faq } from '@/features/guest/marketing/guest-landing-v3/components/V3Faq';
import { V3GuestVoice } from '@/features/guest/marketing/guest-landing-v3/components/V3GuestVoice';
import { V3Hero } from '@/features/guest/marketing/guest-landing-v3/components/V3Hero';
import { V3ParkingList } from '@/features/guest/marketing/guest-landing-v3/components/V3ParkingList';
import { V3StaysRail } from '@/features/guest/marketing/guest-landing-v3/components/V3StaysRail';
import { V3Trust } from '@/features/guest/marketing/guest-landing-v3/components/V3Trust';
import { V3TypeIndex } from '@/features/guest/marketing/guest-landing-v3/components/V3TypeIndex';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { usePageMeta } from '@/lib/seo/usePageMeta';

/**
 * `/v3` — "Quiet Arrival": guest landing redesign for review next to `/` and `/v2`. Keeps
 * the live page's legacy `?property=` redirect so it can replace `GuestLandingPage` as-is
 * once approved.
 */
export function GuestLandingV3Page() {
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
      <V3Hero />
      <V3TypeIndex
        headingId="v3-places-title"
        heading="Browse by place"
        family="properties"
        imageKind="property"
        basePath="/properties/in"
        unitNoun={(total) => `${total} ${total === 1 ? 'stay' : 'stays'}`}
      />
      <V3StaysRail />
      <V3ParkingList />
      <V3TypeIndex
        headingId="v3-developments-title"
        heading="The buildings behind the stays"
        family="developments"
        imageKind="development"
        basePath="/developments/in"
        unitNoun={(total) => `${total} ${total === 1 ? 'building' : 'buildings'}`}
      />
      <V3Bundle />
      <V3Trust />
      <V3GuestVoice />
      <V3Faq />
      <V3Closing />
    </>
  );
}
