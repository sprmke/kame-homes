import { AiCreditWalletCard } from '@/features/dashboard/super-admin/components/AiCreditWalletCard';
import { SuperAdminGenerationOverridesCard } from '@/features/dashboard/super-admin/components/SuperAdminGenerationOverridesCard';
import { useSuperAdminOrgContext } from '@/features/dashboard/super-admin/components/super-admin-orgs/superAdminOrgContext';

export function SuperAdminOrgAiSection() {
  const { org } = useSuperAdminOrgContext();
  return (
    <div className="max-w-2xl space-y-4">
      <AiCreditWalletCard initialOrgId={org.id} />
      <SuperAdminGenerationOverridesCard orgId={org.id} />
    </div>
  );
}
