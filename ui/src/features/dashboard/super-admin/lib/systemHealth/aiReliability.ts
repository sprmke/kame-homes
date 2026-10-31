import type { SuperAdminAiUsage } from '@/features/dashboard/super-admin/hooks/useSuperAdminAiUsage';
import { labelAiFeature } from '@/features/dashboard/super-admin/lib/aiFeatureLabels';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import type { HealthCheck } from '@/features/dashboard/super-admin/lib/systemHealth/healthStatus';

export const AI_MIN_CALLS = 20;
export const AI_ERROR_RATE_WARN_PCT = 10;
export const AI_FALLBACK_RATE_WARN_PCT = 20;

/** Flags AI features with high error or fallback rates. Low-volume features are skipped. */
export function aiReliabilityChecks(
  breakdown: SuperAdminAiUsage['featureBreakdown']
): HealthCheck[] {
  return breakdown
    .filter((row) => row.calls >= AI_MIN_CALLS)
    .map((row): HealthCheck => {
      const highErrors = row.errorRatePct > AI_ERROR_RATE_WARN_PCT;
      const highFallback = row.fallbackRatePct > AI_FALLBACK_RATE_WARN_PCT;
      return {
        id: `ai.${row.feature}`,
        category: 'integrations',
        group: 'AI reliability (30 days)',
        label: labelAiFeature(row.feature),
        status: highErrors || highFallback ? 'warn' : 'ok',
        detail: `${row.calls} calls · ${row.errorRatePct.toFixed(1)}% errors · ${row.fallbackRatePct.toFixed(1)}% fallback`,
        hint: highErrors
          ? 'High error rate. Check provider keys and quotas.'
          : highFallback
            ? 'Often falling back. The primary model may be rate limited.'
            : undefined,
        fixHref: superAdminPaths.aiTab('usage'),
      };
    });
}
