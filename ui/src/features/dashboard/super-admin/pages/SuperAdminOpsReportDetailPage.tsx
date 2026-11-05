import { useMemo } from 'react';

import { Link, useParams } from 'react-router-dom';

import { ArrowLeft, Copy, Download, FileText, Send } from 'lucide-react';
import { toast } from 'sonner';

import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import {
  OpsSeverityBadge,
  OpsStatusBadge,
} from '@/features/dashboard/super-admin/components/super-admin-ops-reports/OpsStatusBadge';
import {
  useOpsReport,
  useSendOpsReportEmail,
} from '@/features/dashboard/super-admin/hooks/useOpsReports';
import {
  OPS_SEVERITIES,
  formatOpsPeriod,
  type OpsFinding,
  type OpsReportSummary,
} from '@/features/dashboard/super-admin/lib/opsReports';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { Button } from '@/components/ui/button';
import { appPageTitle, usePageTitle } from '@/lib/pageTitle';

function agentPrompt(summary: OpsReportSummary): string {
  const lines = summary.nextActions.map(
    (action) =>
      `- [${action.priority.toUpperCase()}] ${action.findingIds.join(', ')}: ${action.title}`
  );
  return [
    'You are working on Kame Space. Address the following operations findings.',
    'For each: reproduce the evidence, fix the root cause, add a test, run bun run ci:quality.',
    'Do not change public API shape, plan entitlements, or RLS unless required.',
    '',
    ...lines,
  ].join('\n');
}

async function copyText(value: string, success: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(success);
  } catch {
    toast.error('Could not copy');
  }
}

function downloadMarkdown(markdown: string, reportId: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ops-report-${reportId.slice(0, 8)}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function Findings({ findings, title }: { findings: OpsFinding[]; title: string }) {
  if (findings.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-section-title">{title}</h2>
      <ul className="space-y-2">
        {findings.map((finding) => (
          <li key={finding.id} className="surface-card space-y-2 px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <OpsSeverityBadge severity={finding.severity} />
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                {finding.source} · {finding.category}
              </span>
            </div>
            <p className="text-sm font-medium">{finding.title}</p>
            <p className="text-muted-foreground text-sm">{finding.detail}</p>
            <p className="text-sm">
              <span className="font-medium">Action:</span> {finding.suggestedAction}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <code className="text-muted-foreground text-[11px]">{finding.id}</code>
              {finding.links?.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs font-medium underline-offset-4 hover:underline"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SuperAdminOpsReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  usePageTitle(appPageTitle('Operations report'));
  const { data: report, isLoading, error } = useOpsReport(reportId);
  const send = useSendOpsReportEmail();

  const openFindings = useMemo(
    () => (report?.summary.findings ?? []).filter((finding) => finding.status === 'open'),
    [report]
  );
  const grouped = useMemo(() => {
    return OPS_SEVERITIES.map((severity) => ({
      severity,
      findings: openFindings.filter((finding) => finding.severity === severity),
    })).filter((group) => group.findings.length > 0);
  }, [openFindings]);

  return (
    <SuperAdminPage
      title="Operations report"
      isLoading={isLoading}
      error={error}
      actions={
        report ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="settings-action"
              onClick={() => copyText(agentPrompt(report.summary), 'Agent prompt copied')}
            >
              <Copy className="size-4" aria-hidden />
              Copy agent prompt
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="settings-action"
              onClick={() => downloadMarkdown(report.markdown, report.id)}
            >
              <Download className="size-4" aria-hidden />
              Download .md
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] lg:min-h-9"
              disabled={send.isPending}
              onClick={() =>
                send.mutate({
                  reportId: report.id,
                  force: Boolean(report.email_sent_at),
                })
              }
            >
              <Send className="size-4" aria-hidden />
              {report.email_sent_at ? 'Resend email' : 'Send email'}
            </Button>
          </div>
        ) : null
      }
    >
      <Link
        to={superAdminPaths.opsReports}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All reports
      </Link>

      {!report ? (
        <SuperAdminEmptyState icon={FileText} title="Report not found" />
      ) : (
        <div className="space-y-4">
          <div className="surface-card flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
            <OpsStatusBadge status={report.overall_status} />
            <span className="text-sm font-medium">
              {formatOpsPeriod(report.period_start, report.period_end)}
            </span>
            <span className="text-muted-foreground text-xs">
              {report.period_kind === 'weekly' ? 'Completed week' : 'Current week'} ·{' '}
              {report.generated_by} · {new Date(report.generated_at).toLocaleString('en-PH')}
            </span>
            {report.email_sent_at ? (
              <span className="text-muted-foreground text-xs">Emailed</span>
            ) : report.email_error ? (
              <span className="text-destructive text-xs">{report.email_error}</span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OPS_SEVERITIES.slice(0, 4).map((severity) => (
              <div key={severity} className="surface-card px-3 py-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">{severity}</p>
                <p className="text-stat-value">{report.counts[severity] ?? 0}</p>
              </div>
            ))}
          </div>

          <section className="space-y-2">
            <h2 className="text-section-title">Sources</h2>
            <ul className="space-y-1.5">
              {report.summary.sources.map((source) => (
                <li
                  key={source.id}
                  className="surface-card flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                >
                  <OpsStatusBadge status={source.status} />
                  <span className="font-medium">{source.label}</span>
                  {source.detail ? (
                    <span className="text-muted-foreground text-xs">{source.detail}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {grouped.map((group) => (
            <Findings
              key={group.severity}
              title={`${group.severity} findings`}
              findings={group.findings}
            />
          ))}

          {report.summary.changes.new.length > 0 || report.summary.changes.resolved.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-section-title">Changes</h2>
              <div className="surface-card space-y-1 px-3 py-3 text-sm">
                {report.summary.changes.new.length > 0 ? (
                  <p>
                    <span className="font-medium">New:</span>{' '}
                    {report.summary.changes.new.map((finding) => finding.id).join(', ')}
                  </p>
                ) : null}
                {report.summary.changes.resolved.length > 0 ? (
                  <p>
                    <span className="font-medium">Resolved:</span>{' '}
                    {report.summary.changes.resolved.map((finding) => finding.id).join(', ')}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {report.summary.metrics.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-section-title">Metrics</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {report.summary.metrics.map((group) => (
                  <div key={group.label} className="surface-card px-3 py-3">
                    <p className="text-sm font-medium">{group.label}</p>
                    <dl className="mt-2 space-y-1 text-sm">
                      {group.rows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">{row.label}</dt>
                          <dd className="font-medium tabular-nums">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-section-title">Agent prompt</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="settings-action"
                onClick={() => copyText(agentPrompt(report.summary), 'Agent prompt copied')}
              >
                <Copy className="size-4" aria-hidden />
                Copy
              </Button>
            </div>
            <pre className="surface-card overflow-x-auto whitespace-pre-wrap px-3 py-3 text-xs">
              {agentPrompt(report.summary)}
            </pre>
          </section>

          <details className="surface-card px-3 py-3">
            <summary className="cursor-pointer text-sm font-medium">Full Markdown</summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">
              {report.markdown}
            </pre>
          </details>
        </div>
      )}
    </SuperAdminPage>
  );
}
