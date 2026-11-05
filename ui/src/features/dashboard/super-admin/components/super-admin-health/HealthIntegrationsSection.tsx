import { useMemo } from 'react';

import {
  HealthCheckList,
  type ProbeRunner,
} from '@/features/dashboard/super-admin/components/super-admin-health/HealthCheckList';
import { useSuperAdminAiUsage } from '@/features/dashboard/super-admin/hooks/useSuperAdminAiUsage';
import { aiReliabilityChecks } from '@/features/dashboard/super-admin/lib/systemHealth/aiReliability';
import type { HealthCheck } from '@/features/dashboard/super-admin/lib/systemHealth/healthStatus';

export function HealthIntegrationsSection({
  checks,
  probes,
}: {
  checks: HealthCheck[];
  probes: ProbeRunner;
}) {
  const aiUsage = useSuperAdminAiUsage('30d');
  const merged = useMemo(
    () => [
      ...checks.filter((check) => check.category === 'integrations'),
      ...aiReliabilityChecks(aiUsage.data?.featureBreakdown ?? []),
    ],
    [checks, aiUsage.data]
  );

  return <HealthCheckList checks={merged} probes={probes} searchable />;
}
