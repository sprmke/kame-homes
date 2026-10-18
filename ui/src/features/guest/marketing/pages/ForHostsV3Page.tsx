import { V3CapabilityGrid } from '@/features/guest/marketing/for-hosts/v3/components/V3CapabilityGrid';
import { V3ClosingCta } from '@/features/guest/marketing/for-hosts/v3/components/V3ClosingCta';
import { V3Faq } from '@/features/guest/marketing/for-hosts/v3/components/V3Faq';
import { V3FeatureBento } from '@/features/guest/marketing/for-hosts/v3/components/V3FeatureBento';
import { V3GuestScreens } from '@/features/guest/marketing/for-hosts/v3/components/V3GuestScreens';
import { V3Hero } from '@/features/guest/marketing/for-hosts/v3/components/V3Hero';
import { V3ReplaceStatement } from '@/features/guest/marketing/for-hosts/v3/components/V3ReplaceStatement';
import { V3SetupSteps } from '@/features/guest/marketing/for-hosts/v3/components/V3SetupSteps';
import { V3TourSection } from '@/features/guest/marketing/for-hosts/v3/components/V3TourSection';
import { V3WorkflowScroll } from '@/features/guest/marketing/for-hosts/v3/components/V3WorkflowScroll';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

/**
 * Third `/for-hosts` direction, served at `/for-hosts/v3` for side-by-side review with the live
 * page and `/for-hosts/v2`. Story order: promise (hero) → pain (struck-through tools) →
 * mechanism (pinned six-step workflow) → host tools (bento) → guest side (phones) → the rest
 * (capability grid) → proof (narrated tour) → setup → objections (FAQ) → close. Section ids `features` / `how-it-works` match the marketing nav,
 * so this can replace `/for-hosts` as-is once approved.
 */
export function ForHostsV3Page() {
  usePageTitle(publicPageTitle('For Hosts'));

  return (
    <>
      <V3Hero />
      <V3ReplaceStatement />
      <V3WorkflowScroll />
      <V3FeatureBento />
      <V3GuestScreens />
      <V3CapabilityGrid />
      <V3TourSection />
      <V3SetupSteps />
      <V3Faq />
      <V3ClosingCta />
    </>
  );
}
