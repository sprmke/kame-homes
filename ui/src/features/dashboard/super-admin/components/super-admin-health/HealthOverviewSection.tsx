import { useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { Activity } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import {
  HealthCheckRow,
  type ProbeRunner,
} from '@/features/dashboard/super-admin/components/super-admin-health/HealthCheckList';
import { HealthStatusBadge } from '@/features/dashboard/super-admin/components/super-admin-health/HealthStatusBadge';
import {
  type HealthSectionId,
  healthSectionPath,
} from '@/features/dashboard/super-admin/lib/systemHealth/healthSections';
import {
  countByStatus,
  formatAgo,
  HEALTH_STATUS_META,
  HEALTH_STATUS_ORDER,
  healthCheckAnchor,
  sortChecks,
  worstStatus,
  type HealthCategory,
  type HealthCheck,
  type HealthStatus,
} from '@/features/dashboard/super-admin/lib/systemHealth/healthStatus';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { STATUS_TONE_HEX } from '@/lib/statusToneColors';

const ISSUE_PREVIEW_LIMIT = 8;

const TILES: Array<{ category: HealthCategory; label: string; section: HealthSectionId }> = [
  { category: 'configuration', label: 'Configuration', section: 'configuration' },
  { category: 'security', label: 'Security', section: 'configuration' },
  { category: 'integrations', label: 'Integrations', section: 'integrations' },
  { category: 'jobs', label: 'Scheduled jobs', section: 'jobs' },
  { category: 'database', label: 'Database', section: 'jobs' },
];

const SECTION_BY_CATEGORY = Object.fromEntries(TILES.map((t) => [t.category, t.section])) as Record<
  HealthCategory,
  HealthSectionId
>;

function statusHex(status: HealthStatus): string {
  return status === 'off' ? '#cbd5e1' : STATUS_TONE_HEX[HEALTH_STATUS_META[status].tone];
}

function StackedBar({ counts }: { counts: Record<HealthStatus, number> }) {
  const total = HEALTH_STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0);
  if (total === 0) return <div className="bg-muted h-1.5 rounded-full" />;
  return (
    <div className="bg-muted flex h-1.5 overflow-hidden rounded-full" aria-hidden>
      {HEALTH_STATUS_ORDER.map((status) =>
        counts[status] > 0 ? (
          <span
            key={status}
            style={{ width: `${(counts[status] / total) * 100}%`, background: statusHex(status) }}
          />
        ) : null
      )}
    </div>
  );
}

export function HealthOverviewSection({
  checks,
  probes,
  probesLastRunAt,
}: {
  checks: HealthCheck[];
  probes?: ProbeRunner;
  probesLastRunAt: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const counts = useMemo(() => countByStatus(checks), [checks]);
  const overall = useMemo(() => worstStatus(checks.map((c) => c.status)), [checks]);
  const chartData = HEALTH_STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => ({
    status,
    count: counts[status],
  }));
  const issues = useMemo(
    () => sortChecks(checks.filter((c) => c.status === 'error' || c.status === 'warn')),
    [checks]
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <section className="surface-card min-w-0 p-3 sm:p-4" aria-label="Overall status">
          <AdminSurfaceCardHeader icon={Activity} title="Overall" iconClassName="bg-muted/80" />
          <div className="flex items-center gap-4">
            <div className="relative aspect-square w-32 shrink-0 sm:w-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="count"
                    nameKey="status"
                    innerRadius="62%"
                    outerRadius="92%"
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.status} fill={statusHex(entry.status)} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-stat-value font-bold tabular-nums">{checks.length}</p>
                <p className="text-muted-foreground text-[11px]">checks</p>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <HealthStatusBadge status={overall} className="text-xs" />
              <ul className="space-y-1">
                {HEALTH_STATUS_ORDER.map((status) => (
                  <li key={status} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: statusHex(status) }}
                        aria-hidden
                      />
                      {HEALTH_STATUS_META[status].label}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{counts[status]}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground border-t pt-2 text-xs lg:hidden">
                Live checks {probesLastRunAt ? formatAgo(probesLastRunAt) : 'never run'}
              </p>
            </div>
          </div>
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TILES.map((tile) => {
            const inCategory = checks.filter((c) => c.category === tile.category);
            const tileCounts = countByStatus(inCategory);
            const status = worstStatus(inCategory.map((c) => c.status));
            return (
              <Link
                key={tile.category}
                to={healthSectionPath(tile.section)}
                className="surface-card hover:bg-muted/40 flex min-h-[44px] min-w-0 flex-col gap-2 p-3 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-card-title">{tile.label}</span>
                  <HealthStatusBadge status={status} />
                </div>
                <StackedBar counts={tileCounts} />
                <p className="text-muted-foreground text-xs tabular-nums">
                  {tileCounts.error} error · {tileCounts.warn} warning · {tileCounts.ok} healthy
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      <section className="surface-card min-w-0 overflow-hidden" aria-label="Issues">
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h2 className="text-card-title">Issues</h2>
          <span className="text-muted-foreground text-xs tabular-nums">{issues.length}</span>
        </header>
        {issues.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">No issues</p>
        ) : (
          <div className="divide-border/60 divide-y">
            {(showAll ? issues : issues.slice(0, ISSUE_PREVIEW_LIMIT)).map((check) => (
              <HealthCheckRow
                key={check.id}
                showGroup
                probes={probes}
                check={{
                  ...check,
                  fixHref:
                    check.fixHref ??
                    `${healthSectionPath(SECTION_BY_CATEGORY[check.category])}#${healthCheckAnchor(check.id)}`,
                }}
              />
            ))}
            {issues.length > ISSUE_PREVIEW_LIMIT ? (
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                className="text-primary hover:bg-muted/40 flex min-h-[44px] w-full items-center justify-center text-sm font-medium"
              >
                {showAll ? 'Show fewer' : `Show all ${issues.length}`}
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
