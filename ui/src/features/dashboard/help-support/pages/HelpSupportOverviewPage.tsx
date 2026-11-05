import { AppInfoCard } from '@/components/pwa/AppInfoCard';
import { HelpCenterFaqAccordion } from '@/features/dashboard/help-support/components/HelpCenterFaqAccordion';

export function HelpSupportOverviewPage() {
  return (
    <>
      <HelpCenterFaqAccordion />
      <AppInfoCard className="mt-4" />
    </>
  );
}
