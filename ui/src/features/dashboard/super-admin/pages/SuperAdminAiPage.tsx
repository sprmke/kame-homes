import { useSearchParams } from 'react-router-dom';

import { AiCreditWalletCard } from '@/features/dashboard/super-admin/components/AiCreditWalletCard';
import { AiDashboardAssistantKillSwitchCard } from '@/features/dashboard/super-admin/components/AiDashboardAssistantKillSwitchCard';
import { AiPlatformKillSwitchCard } from '@/features/dashboard/super-admin/components/AiPlatformKillSwitchCard';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import { SuperAdminSecondaryNav } from '@/features/dashboard/super-admin/components/shared/SuperAdminSecondaryNav';
import { AiLimitsTab } from '@/features/dashboard/super-admin/components/super-admin-ai/AiLimitsTab';
import { AiProfilesTab } from '@/features/dashboard/super-admin/components/super-admin-ai/AiProfilesTab';
import { AiUsageTab } from '@/features/dashboard/super-admin/components/super-admin-ai/AiUsageTab';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { appPageTitle, usePageTitle } from '@/lib/pageTitle';

const TABS = [
  { id: 'usage', label: 'Usage' },
  { id: 'limits', label: 'Limits' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'wallets', label: 'Wallets' },
  { id: 'controls', label: 'Controls' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function parseTab(value: string | null): TabId {
  return TABS.some((tab) => tab.id === value) ? (value as TabId) : 'usage';
}

/**
 * Single home for everything AI on the platform: spend, per-org limits, reusable limit profiles,
 * credit wallets and the kill switches. Hosts only toggle AI and read usage; every number lives here.
 */
export function SuperAdminAiPage() {
  usePageTitle(appPageTitle('AI'));
  const [searchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));

  return (
    <SuperAdminPage
      title="AI"
      subtitle="Spend, limits and controls for every organization. Changes apply within seconds."
      toolbar={
        <SuperAdminSecondaryNav
          ariaLabel="AI sections"
          items={TABS.map((item) => ({
            label: item.label,
            to: superAdminPaths.aiTab(item.id),
            active: item.id === tab,
          }))}
        />
      }
    >
      {tab === 'usage' ? <AiUsageTab /> : null}
      {tab === 'limits' ? <AiLimitsTab /> : null}
      {tab === 'profiles' ? <AiProfilesTab /> : null}
      {tab === 'wallets' ? (
        <div className="max-w-2xl">
          <AiCreditWalletCard />
        </div>
      ) : null}
      {tab === 'controls' ? (
        <div className="space-y-4">
          <AiPlatformKillSwitchCard />
          <div className="max-w-2xl">
            <AiDashboardAssistantKillSwitchCard />
          </div>
        </div>
      ) : null}
    </SuperAdminPage>
  );
}
