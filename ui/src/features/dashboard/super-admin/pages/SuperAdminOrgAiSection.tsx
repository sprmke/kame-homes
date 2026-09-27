import { Link } from 'react-router-dom';

import { AiCreditWalletCard } from '@/features/dashboard/super-admin/components/AiCreditWalletCard';
import { SuperAdminSettingsCard } from '@/features/dashboard/super-admin/components/shared/SuperAdminSettingsCard';
import { AiResolvedLimits } from '@/features/dashboard/super-admin/components/super-admin-ai/AiResolvedLimits';
import { useSuperAdminOrgContext } from '@/features/dashboard/super-admin/components/super-admin-orgs/superAdminOrgContext';
import { SuperAdminGenerationOverridesCard } from '@/features/dashboard/super-admin/components/SuperAdminGenerationOverridesCard';
import { useAiLimitsOrgDetail } from '@/features/dashboard/super-admin/hooks/useSuperAdminAiLimits';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { Skeleton } from '@/components/ui/skeleton';

export function SuperAdminOrgAiSection() {
  const { org } = useSuperAdminOrgContext();
  const { data, isLoading } = useAiLimitsOrgDetail(org.id);

  return (
    <div className="max-w-2xl space-y-4">
      <SuperAdminSettingsCard
        title="AI limits"
        headerAction={
          <Link
            to={`${superAdminPaths.aiTab('limits')}&q=${encodeURIComponent(org.name)}`}
            className="text-primary text-sm hover:underline"
          >
            Manage
          </Link>
        }
      >
        {isLoading ? (
          <Skeleton className="h-32 w-full" aria-label="Loading AI limits" />
        ) : data?.resolved ? (
          <AiResolvedLimits limits={data.resolved.limits} />
        ) : (
          <p className="text-muted-foreground text-sm">Could not load AI limits.</p>
        )}
      </SuperAdminSettingsCard>
      <AiCreditWalletCard initialOrgId={org.id} />
      <SuperAdminGenerationOverridesCard orgId={org.id} />
    </div>
  );
}
