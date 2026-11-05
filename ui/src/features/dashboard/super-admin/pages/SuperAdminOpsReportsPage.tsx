import { Link } from 'react-router-dom';

import { ChevronRight, FileText, RefreshCw } from 'lucide-react';

import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import {
  OpsSeverityBadge,
  OpsStatusBadge,
} from '@/features/dashboard/super-admin/components/super-admin-ops-reports/OpsStatusBadge';
import {
  useGenerateOpsReport,
  useOpsReports,
} from '@/features/dashboard/super-admin/hooks/useOpsReports';
import {
  formatOpsPeriod,
  type OpsReportListRow,
} from '@/features/dashboard/super-admin/lib/opsReports';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { Button } from '@/components/ui/button';
import { appPageTitle, usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';

function periodLabel(row: OpsReportListRow): string {
  return `${row.period_kind === 'weekly' ? 'Week of' : 'Current week'} · ${formatOpsPeriod(
    row.period_start,
    row.period_end
  )}`;
}

function generatedLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function SuperAdminOpsReportsPage() {
  usePageTitle(appPageTitle('Operations reports'));
  const { data, isLoading, error } = useOpsReports();
  const generate = useGenerateOpsReport();

  return (
    <SuperAdminPage
      title="Operations reports"
      isLoading={isLoading}
      error={error}
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px] lg:min-h-9"
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          <RefreshCw className={cn('size-4', generate.isPending && 'animate-spin')} aria-hidden />
          Generate now
        </Button>
      }
    >
      {!data || data.length === 0 ? (
        <SuperAdminEmptyState icon={FileText} title="No reports yet" />
      ) : (
        <ul className="space-y-2">
          {data.map((row) => (
            <li key={row.id}>
              <Link
                to={superAdminPaths.opsReportDetail(row.id)}
                className="surface-card hover:bg-muted/40 flex items-center gap-3 px-3 py-3 transition-colors sm:px-4"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <OpsStatusBadge status={row.overall_status} />
                    <OpsSeverityBadge severity="critical" count={row.counts.critical ?? 0} />
                    <OpsSeverityBadge severity="high" count={row.counts.high ?? 0} />
                    <OpsSeverityBadge severity="medium" count={row.counts.medium ?? 0} />
                  </div>
                  <p className="text-sm font-medium">{periodLabel(row)}</p>
                  <p className="text-muted-foreground text-xs">
                    Generated {generatedLabel(row.generated_at)}
                    {row.email_sent_at ? ' · emailed' : row.email_error ? ' · email failed' : ''}
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SuperAdminPage>
  );
}
