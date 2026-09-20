import { ClosingCta } from '@/features/guest/marketing/for-hosts/preview/components/ClosingCta';
import { FeatureShowcase } from '@/features/guest/marketing/for-hosts/preview/components/FeatureShowcase';
import { HeroEditorial } from '@/features/guest/marketing/for-hosts/preview/components/HeroEditorial';
import { ProofLine } from '@/features/guest/marketing/for-hosts/preview/components/ProofLine';
import { SetupSteps } from '@/features/guest/marketing/for-hosts/preview/components/SetupSteps';
import { VideoTourSection } from '@/features/guest/marketing/for-hosts/preview/components/VideoTourSection';
import { WorkflowSpine } from '@/features/guest/marketing/for-hosts/preview/components/WorkflowSpine';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

/**
 * Ground-up redesign of `/for-hosts`, served at `/for-hosts/preview` for review before it
 * replaces the live route. Font stays Plus Jakarta Sans throughout; the signature is the teal
 * "thread" (hero spine → animated workflow rail → showcase progress) marking what Kame handles
 * on its own. Section ids `features` / `how-it-works` match the marketing nav so this
 * is drop-in for `/for-hosts`. The reviews section was removed platform-wide until real
 * host testimonials exist.
 */
export function ForHostsPreviewPage() {
  usePageTitle(publicPageTitle('For Hosts'));

  return (
    <>
      <HeroEditorial />
      <ProofLine />
      <WorkflowSpine />
      <FeatureShowcase />
      <VideoTourSection />
      <SetupSteps />
      <ClosingCta />
    </>
  );
}
