/**
 * Direction contract (impeccable / new-work).
 *
 * THESIS: The explore landing opens like an arrival, not a pitch. It refuses the
 * split hero of headline-left / floating-UI-right and the equal three-card feature row.
 * OWN-WORLD: Kame teal on white, Plus Jakarta Sans, full-bleed Philippine photography,
 * editorial asymmetric grids, one authored motion idea (content rises into place),
 * flat sections over card stacks, radius that stays round (3xl media, full pills).
 * STORY: A traveler sees a real place, understands they can search it now, scrolls a
 * curated route through stays and destinations, sees how a booking comes together,
 * hears one guest, and leaves via one clear action.
 * FIRST VIEWPORT: full-bleed cross-dissolving destination scene; a left-aligned stack
 * sits centered in the frame: headline, one line, a compact white search console
 * (capped width, not a full-bleed bar), then quick-destination chips.
 * FORM: cinematic media hero + editorial spine. Sections never repeat a layout family.
 */
import {
  ExploreClosingCta,
  ExploreDestinationAtlas,
  ExploreFeaturedStays,
  ExploreGuestVoice,
  ExploreHero,
  ExploreStayJourney,
  ExploreTrustRibbon,
} from '@/features/guest/marketing/explore-preview/components';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function ExplorePreviewPage() {
  usePageTitle(publicPageTitle('Explore preview'));

  return (
    <>
      <ExploreHero />
      <ExploreTrustRibbon />
      <ExploreFeaturedStays />
      <ExploreDestinationAtlas />
      <ExploreStayJourney />
      <ExploreGuestVoice />
      <ExploreClosingCta />

      <p className="text-muted-foreground container mx-auto px-4 pb-12 text-center text-xs sm:px-6 lg:px-8">
        Preview route for review. Photos, nightly rates, and the guest review are sample content.
      </p>
    </>
  );
}
