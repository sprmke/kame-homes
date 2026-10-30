import { useCallback, useEffect, useMemo } from 'react';

import { Navigate, useLocation, useParams } from 'react-router-dom';

import { Activity, RefreshCw } from 'lucide-react';

import { HealthCheckList } from '@/features/dashboard/super-admin/components/super-admin-health/HealthCheckList';
import { HealthIntegrationsSection } from '@/features/dashboard/super-admin/components/super-admin-health/HealthIntegrationsSection';
import { HealthJobsSection } from '@/features/dashboard/super-admin/components/super-admin-health/HealthJobsSection';
import { HealthOverviewSection } from '@/features/dashboard/super-admin/components/super-admin-health/HealthOverviewSection';
import { HealthUsageSection } from '@/features/dashboard/super-admin/components/super-admin-health/HealthUsageSection';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import { SuperAdminSecondaryNav } from '@/features/dashboard/super-admin/components/shared/SuperAdminSecondaryNav';
import {
  allHealthChecks,
  useRunHealthProbes,
  useSystemHealth,
} from '@/features/dashboard/super-admin/hooks/useSystemHealth';
import {
  HEALTH_SECTIONS,
  parseHealthSection,
  type HealthSectionId,
} from '@/features/dashboard/super-admin/lib/systemHealth/healthSections';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { Button } from '@/components/ui/button';
import { appPageTitle, usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';

const SECTION_SUBTITLES: Record<HealthSectionId, string> = {
  overview: 'Platform checks for configuration, integrations, scheduled jobs, and usage.',
  configuration: 'Edge and UI env vars and production posture.',
  integrations: 'Live credential checks, tenant integrations, and AI reliability.',
  jobs: 'Scheduled job heartbeats, database prerequisites, and cron jobs.',
  usage: 'AI spend, rate limits, and database and storage capacity.',
};

function useHealthCheckHighlight() {
  const { hash } = useLocation();
  useEffect(() => {
    const id = hash.replace(/^#/, '');
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('data-highlight', 'true');
    el.scrollIntoView({ block: 'center' });
    return () => el.removeAttribute('data-highlight');
  }, [hash]);
}

export function SuperAdminHealthPage() {
  const { section } = useParams<{ section?: string }>();
  const active = parseHealthSection(section);
  const sectionLabel = HEALTH_SECTIONS.find((item) => item.id === active)?.label;

  usePageTitle(
    appPageTitle(active === 'overview' ? 'System health' : `System health - ${sectionLabel}`)
  );
  useHealthCheckHighlight();

  const { data: summary, isLoading, error } = useSystemHealth();
  const runProbes = useRunHealthProbes();

  const probes = useMemo(
    () => ({
      run: (probeId: string) => runProbes.mutate([probeId]),
      pending: runProbes.isPending,
    }),
    [runProbes]
  );

  const runAllProbes = useCallback(() => runProbes.mutate(undefined), [runProbes]);

  const checks = useMemo(() => (summary ? allHealthChecks(summary) : []), [summary]);

  if (section && active === null) {
    return <Navigate to={superAdminPaths.health} replace />;
  }

  const resolvedSection = active ?? 'overview';

  return (
    <SuperAdminPage
      title="System health"
      subtitle={SECTION_SUBTITLES[resolvedSection]}
      isLoading={isLoading}
      error={error}
      actions={
        resolvedSection === 'overview' || resolvedSection === 'integrations' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px] lg:min-h-9"
            disabled={runProbes.isPending}
            onClick={runAllProbes}
          >
            <RefreshCw
              className={cn('size-4 shrink-0', runProbes.isPending && 'animate-spin')}
              aria-hidden
            />
            Run live checks
          </Button>
        ) : undefined
      }
      toolbar={
        <SuperAdminSecondaryNav
          ariaLabel="System health sections"
          items={HEALTH_SECTIONS.map((item) => ({
            label: item.label,
            to:
              item.id === 'overview'
                ? superAdminPaths.health
                : superAdminPaths.healthSection(item.id),
            active: item.id === resolvedSection,
          }))}
        />
      }
    >
      {!summary ? (
        <SuperAdminEmptyState icon={Activity} title="No checks yet" />
      ) : resolvedSection === 'overview' ? (
        <HealthOverviewSection
          checks={checks}
          probes={probes}
          probesLastRunAt={summary.probesLastRunAt}
        />
      ) : resolvedSection === 'configuration' ? (
        <HealthCheckList
          checks={checks.filter(
            (check) => check.category === 'configuration' || check.category === 'security'
          )}
          searchable
        />
      ) : resolvedSection === 'integrations' ? (
        <HealthIntegrationsSection checks={checks} probes={probes} />
      ) : resolvedSection === 'jobs' ? (
        <HealthJobsSection summary={summary} />
      ) : (
        <HealthUsageSection />
      )}
    </SuperAdminPage>
  );
}
