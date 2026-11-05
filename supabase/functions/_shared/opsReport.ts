/**
 * Weekly operations report builder.
 *
 * Plan: docs/workflow/in-progress/weekly-ops-report.md
 *
 * The report is deliberately deterministic: stable finding ids, fixed section order, and
 * no timestamps inside the body except the period boundaries. That makes a diff between
 * two weeks meaningful and lets an AI agent address findings by id.
 */

import type { HealthCheck } from './systemHealth/types.ts';

export const OPS_REPORT_SCHEMA_VERSION = 1 as const;
export const OPS_REPORT_MAX_FINDINGS = 100;
export const OPS_REPORT_MAX_ACTIONS = 12;

export type OpsSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type OpsSourceStatus = 'ok' | 'partial' | 'skipped' | 'error';
export type OpsEnvironment = 'production' | 'non-production';
export type OpsPeriodKind = 'weekly' | 'manual';

export type OpsFinding = {
  id: string;
  source: 'supabase' | 'sentry' | 'posthog' | 'vercel' | 'database' | 'report';
  severity: OpsSeverity;
  category: string;
  title: string;
  detail: string;
  impact?: string;
  suggestedAction: string;
  files?: string[];
  links?: Array<{ label: string; href: string }>;
  firstSeen?: string;
  lastSeen?: string;
  count?: number;
  status: 'open' | 'resolved';
};

export type OpsSource = {
  id: string;
  label: string;
  status: OpsSourceStatus;
  detail?: string;
  checkedAt?: string;
};

export type OpsMetricGroup = {
  label: string;
  rows: Array<{ label: string; value: string }>;
};

export type OpsNextAction = {
  priority: OpsSeverity;
  title: string;
  findingIds: string[];
  prompt: string;
};

export type OpsReportSummary = {
  schemaVersion: typeof OPS_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  environment: OpsEnvironment;
  periodKind: OpsPeriodKind;
  periodStart: string;
  periodEnd: string;
  overallStatus: 'ok' | 'warn' | 'error' | 'unknown';
  counts: Record<OpsSeverity, number>;
  sources: OpsSource[];
  findings: OpsFinding[];
  metrics: OpsMetricGroup[];
  changes: { resolved: OpsFinding[]; new: OpsFinding[] };
  nextActions: OpsNextAction[];
};

export type SentryIssue = {
  id: string;
  title: string;
  culprit?: string | null;
  level?: string | null;
  count?: number | string | null;
  userCount?: number | null;
  firstSeen?: string | null;
  lastSeen?: string | null;
  permalink?: string | null;
  shortId?: string | null;
  status?: string | null;
};

export type BuildOpsReportInput = {
  generatedAt: string;
  environment: OpsEnvironment;
  periodKind: OpsPeriodKind;
  periodStart: string;
  periodEnd: string;
  healthChecks: HealthCheck[];
  metrics: Record<string, unknown> | null;
  capacity: Record<string, unknown> | null;
  sentry: {
    status: OpsSourceStatus;
    issues: SentryIssue[];
    detail?: string;
  };
  previous: OpsReportSummary | null;
};

const SEVERITY_ORDER: OpsSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

const SEVERITY_RANK: Record<OpsSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function emptyCounts(): Record<OpsSeverity, number> {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}

export function healthSeverity(check: HealthCheck): OpsSeverity | null {
  if (check.status === 'ok' || check.status === 'off') return null;
  if (check.status === 'unknown') return 'low';
  if (check.status === 'error') return check.category === 'security' ? 'critical' : 'high';
  return 'medium';
}

export function sentrySeverity(level: string | null | undefined): OpsSeverity {
  switch ((level ?? '').toLowerCase()) {
    case 'fatal':
    case 'error':
      return 'high';
    case 'warning':
      return 'medium';
    case 'info':
      return 'low';
    default:
      return 'info';
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function formatBytes(value: number | null): string | null {
  if (value == null) return null;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${value} B`;
}

function formatNumber(value: unknown): string | null {
  const n = asNumber(value);
  return n == null ? null : new Intl.NumberFormat('en-US').format(n);
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function findingFromCheck(check: HealthCheck): OpsFinding | null {
  const severity = healthSeverity(check);
  if (!severity) return null;
  const links: Array<{ label: string; href: string }> = [];
  if (check.fixHref) links.push({ label: 'Fix in app', href: check.fixHref });
  if (check.manageHref) links.push({ label: 'Open provider', href: check.manageHref });

  return {
    id: `health:${check.id}`,
    source: 'supabase',
    severity,
    category: check.category,
    title: check.label,
    detail:
      check.detail ??
      check.hint ??
      `${check.group} check is ${check.status}${check.checkedAt ? ` (checked ${check.checkedAt})` : ''}.`,
    impact: check.features?.length ? `Affects: ${check.features.join(', ')}.` : undefined,
    suggestedAction:
      check.hint ??
      (check.fixHref
        ? `Open ${check.fixHref} and resolve the check.`
        : 'Open System health, reproduce the check, and resolve the root cause.'),
    links,
    status: 'open',
  };
}

function findingFromSentry(issue: SentryIssue): OpsFinding {
  const count = asNumber(issue.count);
  const users = asNumber(issue.userCount);
  const detailParts = [
    issue.culprit?.trim() || 'Unknown location',
    count == null ? null : `${count} events`,
    users == null ? null : `${users} users`,
  ].filter(Boolean);

  return {
    id: `sentry:${issue.id}`,
    source: 'sentry',
    severity: sentrySeverity(issue.level),
    category: 'errors',
    title: `Sentry: ${issue.title}`,
    detail: detailParts.join(' · '),
    impact: 'Unhandled production errors. They may affect guests, hosts, or background jobs.',
    suggestedAction:
      'Open the Sentry issue, confirm the stack trace, fix the root cause, and deploy. Mute only with a documented reason and an expiry.',
    links: issue.permalink ? [{ label: 'Sentry issue', href: issue.permalink }] : [],
    firstSeen: issue.firstSeen ?? undefined,
    lastSeen: issue.lastSeen ?? undefined,
    count: count ?? undefined,
    status: 'open',
  };
}

function buildMetrics(
  metrics: Record<string, unknown> | null,
  capacity: Record<string, unknown> | null
): OpsMetricGroup[] {
  const m = obj(metrics);
  const bookings = obj(m.bookings);
  const emails = obj(m.emails);
  const payments = obj(m.payments);
  const support = obj(m.support);
  const social = obj(m.social);
  const ai = obj(m.ai);
  const activity = obj(m.activity);
  const ops = obj(m.ops);
  const cap = obj(capacity);
  const tables = Array.isArray(cap.tables) ? cap.tables : [];
  const largest = tables
    .map((row) => obj(row))
    .sort((a, b) => (asNumber(b.bytes) ?? 0) - (asNumber(a.bytes) ?? 0))[0];
  const buckets = Array.isArray(cap.buckets) ? cap.buckets : [];
  const storageBytes = buckets.reduce((sum, row) => sum + (asNumber(obj(row).bytes) ?? 0), 0);

  const rows = (pairs: Array<[string, string | null]>): Array<{ label: string; value: string }> =>
    pairs
      .filter(([, value]) => value != null)
      .map(([label, value]) => ({ label, value: value as string }));

  return [
    {
      label: 'Bookings',
      rows: rows([
        ['Created', formatNumber(bookings.created)],
        ['Completed', formatNumber(bookings.completed)],
        ['Cancelled', formatNumber(bookings.cancelled)],
        ['Pending review (now)', formatNumber(bookings.pending_review)],
        ['Pending documents (now)', formatNumber(bookings.pending_documents)],
        ['Ready for check-in (now)', formatNumber(bookings.ready_for_checkin)],
        ['Ready for check-out (now)', formatNumber(bookings.ready_for_checkout)],
      ]),
    },
    {
      label: 'Email',
      rows: rows([
        ['Processed', formatNumber(emails.processed)],
        ['Suppressed', formatNumber(emails.suppressed)],
      ]),
    },
    {
      label: 'Payments',
      rows: rows([
        ['Parking paid', formatNumber(payments.parking_paid)],
        ['Parking failed', formatNumber(payments.parking_failed)],
        ['Org plan paid', formatNumber(payments.org_paid)],
        ['Org plan failed', formatNumber(payments.org_failed)],
      ]),
    },
    {
      label: 'Support and inbox',
      rows: rows([
        ['Tickets opened', formatNumber(support.opened)],
        ['Tickets open now', formatNumber(support.open_now)],
        ['Social webhook events', formatNumber(social.webhook_events)],
      ]),
    },
    {
      label: 'AI',
      rows: rows([
        ['Requests', formatNumber(ai.requests)],
        ['Errors', formatNumber(ai.errors)],
        ['Credits consumed', formatNumber(ai.credits)],
      ]),
    },
    {
      label: 'Activity',
      rows: rows([
        ['Activity events', formatNumber(activity.total)],
        ['Destructive events', formatNumber(activity.destructive)],
      ]),
    },
    {
      label: 'Capacity',
      rows: rows([
        ['Database size', formatBytes(asNumber(ops.db_size_bytes) ?? asNumber(cap.db_size_bytes))],
        ['Rate-limit rows', formatNumber(ops.rate_limit_rows)],
        ['Failing jobs', formatNumber(ops.failing_jobs)],
        ['Largest table', largest?.name ? String(largest.name) : null],
        ['Largest table size', formatBytes(asNumber(largest?.bytes))],
        ['Storage objects', formatBytes(storageBytes || null)],
      ]),
    },
  ].filter((group) => group.rows.length > 0);
}

function buildNextActions(findings: OpsFinding[]): OpsNextAction[] {
  return findings
    .filter((finding) => finding.severity === 'critical' || finding.severity === 'high')
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, OPS_REPORT_MAX_ACTIONS)
    .map((finding) => ({
      priority: finding.severity,
      title: finding.title,
      findingIds: [finding.id],
      prompt: [
        `Fix finding ${finding.id}: ${finding.title}.`,
        `Evidence: ${finding.detail}`,
        `Suggested action: ${finding.suggestedAction}`,
        'Constraints: smallest correct change; add or update a test; run `bun run ci:quality`;',
        'do not change public API shape, plan entitlements, or RLS semantics unless required;',
        'do not deploy to production from the agent session.',
      ].join(' '),
    }));
}

function overallStatus(counts: Record<OpsSeverity, number>): 'ok' | 'warn' | 'error' {
  if (counts.critical > 0 || counts.high > 0) return 'error';
  if (counts.medium > 0) return 'warn';
  return 'ok';
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

function formatPeriod(periodStart: string, periodEnd: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return `${fmt.format(new Date(periodStart))} to ${fmt.format(new Date(periodEnd))}`;
}

function sourceLabel(status: OpsSourceStatus): string {
  return status === 'ok'
    ? 'OK'
    : status === 'partial'
      ? 'Partial'
      : status === 'skipped'
        ? 'Skipped'
        : 'Error';
}

export function buildOpsReportMarkdown(input: {
  summary: OpsReportSummary;
  findings: OpsFinding[];
}): string {
  const { summary, findings } = input;
  const counts = summary.counts;
  const lines: string[] = [];

  lines.push('---');
  lines.push('report: weekly-ops');
  lines.push(`schema_version: ${summary.schemaVersion}`);
  lines.push(`environment: ${summary.environment}`);
  lines.push(`period_kind: ${summary.periodKind}`);
  lines.push(`period_start: ${summary.periodStart}`);
  lines.push(`period_end: ${summary.periodEnd}`);
  lines.push(`generated_at: ${summary.generatedAt}`);
  lines.push(`overall_status: ${summary.overallStatus}`);
  lines.push(`critical: ${counts.critical}`);
  lines.push(`high: ${counts.high}`);
  lines.push(`medium: ${counts.medium}`);
  lines.push(`low: ${counts.low}`);
  lines.push(`info: ${counts.info}`);
  lines.push('---');
  lines.push('');
  lines.push(`# Weekly operations report: ${formatPeriod(summary.periodStart, summary.periodEnd)}`);
  lines.push('');
  lines.push('## Executive summary');
  lines.push('');
  const headline =
    counts.critical + counts.high > 0
      ? `${counts.critical} critical and ${counts.high} high findings need action.`
      : counts.medium > 0
        ? `${counts.medium} medium findings are worth scheduling this week.`
        : 'No critical or high findings. The platform is healthy for the period.';
  lines.push(headline);
  lines.push('');
  lines.push(
    `Counts: **${counts.critical} critical**, **${counts.high} high**, **${counts.medium} medium**, ${counts.low} low, ${counts.info} info.`
  );
  lines.push('');
  lines.push('## Sources');
  lines.push('');
  lines.push('| Source | Status | Detail |');
  lines.push('| --- | --- | --- |');
  for (const source of summary.sources) {
    lines.push(
      `| ${escapeCell(source.label)} | ${sourceLabel(source.status)} | ${escapeCell(source.detail ?? '')} |`
    );
  }
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  if (findings.length === 0) {
    lines.push('No findings above informational level.');
    lines.push('');
  } else {
    findings
      .filter((finding) => finding.status === 'open')
      .sort(
        (a, b) =>
          SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
          a.source.localeCompare(b.source) ||
          a.id.localeCompare(b.id)
      )
      .forEach((finding, index) => {
        lines.push(`### ${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`);
        lines.push('');
        lines.push(`- id: \`${finding.id}\``);
        lines.push(`- source: ${finding.source}`);
        lines.push(`- category: ${finding.category}`);
        if (finding.firstSeen) lines.push(`- first_seen: ${finding.firstSeen}`);
        if (finding.lastSeen) lines.push(`- last_seen: ${finding.lastSeen}`);
        if (finding.count != null) lines.push(`- events: ${finding.count}`);
        lines.push(`- evidence: ${finding.detail}`);
        if (finding.impact) lines.push(`- impact: ${finding.impact}`);
        lines.push(`- suggested_action: ${finding.suggestedAction}`);
        if (finding.files?.length) lines.push(`- files: ${finding.files.join(', ')}`);
        if (finding.links?.length) {
          lines.push(`- links: ${finding.links.map((link) => `${link.label} (${link.href})`).join('; ')}`);
        }
        lines.push('');
      });
  }

  if (summary.metrics.length > 0) {
    lines.push('## Metrics');
    lines.push('');
    for (const group of summary.metrics) {
      lines.push(`### ${group.label}`);
      lines.push('');
      lines.push('| Metric | Value |');
      lines.push('| --- | ---: |');
      for (const row of group.rows) {
        lines.push(`| ${escapeCell(row.label)} | ${escapeCell(row.value)} |`);
      }
      lines.push('');
    }
  }

  lines.push('## Changes since the previous report');
  lines.push('');
  if (summary.changes.new.length === 0 && summary.changes.resolved.length === 0) {
    lines.push('No new or resolved findings.');
  } else {
    if (summary.changes.new.length > 0) {
      lines.push(`New: ${summary.changes.new.map((finding) => `\`${finding.id}\``).join(', ')}.`);
    }
    if (summary.changes.resolved.length > 0) {
      lines.push(
        `Resolved: ${summary.changes.resolved.map((finding) => `\`${finding.id}\``).join(', ')}.`
      );
    }
  }
  lines.push('');
  lines.push('## AI agent handoff');
  lines.push('');
  lines.push('Use the open findings as the work queue. For each finding:');
  lines.push('');
  lines.push('1. Reproduce or confirm the evidence.');
  lines.push('2. Make the smallest change that fixes the root cause.');
  lines.push('3. Add or update a test that would have caught it.');
  lines.push('4. Run `bun run ci:quality`.');
  lines.push('5. Mention the finding id in the PR description.');
  lines.push('');
  lines.push(
    'Do not change public API shape, plan entitlements, or RLS semantics unless the finding explicitly requires it. Do not deploy to production from the agent session.'
  );
  lines.push('');
  if (summary.nextActions.length > 0) {
    lines.push('### Copy-paste prompt');
    lines.push('');
    lines.push('```text');
    lines.push('You are working on Kame Space. Address the following operations findings.');
    lines.push('For each: reproduce the evidence, fix the root cause, add a test, run bun run ci:quality.');
    lines.push('Do not change public API shape, plan entitlements, or RLS unless required.');
    lines.push('');
    for (const action of summary.nextActions) {
      lines.push(`- [${action.priority.toUpperCase()}] ${action.findingIds.join(', ')}: ${action.title}`);
    }
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

export function buildOpsReport(input: BuildOpsReportInput): {
  summary: OpsReportSummary;
  markdown: string;
} {
  const healthFindings = input.healthChecks
    .map(findingFromCheck)
    .filter((finding): finding is OpsFinding => finding != null);
  const sentryFindings = input.sentry.issues.map(findingFromSentry);
  const sourceFindings: OpsFinding[] = [];

  if (input.sentry.status === 'error') {
    sourceFindings.push({
      id: 'source:sentry',
      source: 'sentry',
      severity: 'medium',
      category: 'observability',
      title: 'Sentry issue feed could not be read',
      detail: input.sentry.detail ?? 'The Sentry API request failed.',
      impact: 'Production errors may be missing from this report.',
      suggestedAction:
        'Check SENTRY_AUTH_TOKEN, SENTRY_ORG_SLUG, and SENTRY_PROJECT_SLUG in the edge environment, then regenerate the report.',
      status: 'open',
    });
  }

  const findings = [...healthFindings, ...sentryFindings, ...sourceFindings]
    .slice(0, OPS_REPORT_MAX_FINDINGS)
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        a.source.localeCompare(b.source) ||
        a.id.localeCompare(b.id)
    );

  const counts = emptyCounts();
  for (const finding of findings) counts[finding.severity] += 1;

  const previousById = new Map((input.previous?.findings ?? []).map((f) => [f.id, f]));
  const currentIds = new Set(findings.map((finding) => finding.id));
  const resolved = (input.previous?.findings ?? [])
    .filter((finding) => !currentIds.has(finding.id) && finding.status === 'open')
    .map((finding) => ({ ...finding, status: 'resolved' as const }));
  const newFindings = findings.filter((finding) => !previousById.has(finding.id));

  const sources: OpsSource[] = [
    {
      id: 'supabase-health',
      label: 'Supabase system health',
      status: 'ok',
      detail: `${input.healthChecks.length} checks evaluated`,
      checkedAt: input.generatedAt,
    },
    {
      id: 'supabase-metrics',
      label: 'Supabase weekly metrics',
      status: input.metrics ? 'ok' : 'error',
      detail: input.metrics ? 'Weekly aggregates loaded' : 'Metrics RPC failed',
      checkedAt: input.generatedAt,
    },
    {
      id: 'sentry',
      label: 'Sentry errors',
      status: input.sentry.status,
      detail:
        input.sentry.detail ??
        (input.sentry.status === 'skipped'
          ? 'Not configured'
          : `${input.sentry.issues.length} unresolved issues`),
      checkedAt: input.generatedAt,
    },
  ];

  const summary: OpsReportSummary = {
    schemaVersion: OPS_REPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    environment: input.environment,
    periodKind: input.periodKind,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    overallStatus: overallStatus(counts),
    counts,
    sources,
    findings,
    metrics: buildMetrics(input.metrics, input.capacity),
    changes: { resolved, new: newFindings },
    nextActions: buildNextActions(findings),
  };

  return { summary, markdown: buildOpsReportMarkdown({ summary, findings }) };
}

export function opsReportSubject(summary: OpsReportSummary): string {
  const period = formatPeriod(summary.periodStart, summary.periodEnd);
  const actionable = summary.counts.critical + summary.counts.high;
  return `[Kame Space] Weekly ops report: ${period} (${actionable} high, ${summary.counts.medium} medium)`;
}

export function buildOpsReportEmailHtml(input: {
  summary: OpsReportSummary;
  reportId: string;
  appUrl?: string | null;
}): string {
  const { summary } = input;
  const top = summary.findings
    .filter((finding) => finding.status === 'open')
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, 8);
  const reportUrl = input.appUrl
    ? `${input.appUrl.replace(/\/$/, '')}/admin/ops-reports/${input.reportId}`
    : null;
  const severityColor: Record<OpsSeverity, string> = {
    critical: '#b91c1c',
    high: '#c2410c',
    medium: '#a16207',
    low: '#0369a1',
    info: '#475569',
  };

  const findingRows = top
    .map(
      (finding) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${severityColor[finding.severity]};color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;">${finding.severity}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          <div style="font-weight:600;color:#0f172a;">${escapeHtml(finding.title)}</div>
          <div style="color:#475569;font-size:13px;margin-top:2px;">${escapeHtml(finding.detail)}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;vertical-align:top;">${escapeHtml(finding.suggestedAction)}</td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
    <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;">Kame Space operations</div>
        <h1 style="margin:8px 0 4px;font-size:20px;">Weekly operations report</h1>
        <div style="color:#475569;font-size:13px;">${escapeHtml(formatPeriod(summary.periodStart, summary.periodEnd))}</div>
      </div>
      <div style="padding:20px 24px;">
        <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:18px;">
          <tr>
            ${(['critical', 'high', 'medium'] as OpsSeverity[])
              .map(
                (severity) => `<td style="padding:10px;text-align:center;border:1px solid #e2e8f0;border-radius:8px;">
                  <div style="font-size:22px;font-weight:700;color:${severityColor[severity]};">${summary.counts[severity]}</div>
                  <div style="font-size:11px;text-transform:uppercase;color:#64748b;">${severity}</div>
                </td>`
              )
              .join('')}
          </tr>
        </table>
        ${
          top.length > 0
            ? `<table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                <thead><tr style="background:#f1f5f9;"><th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:#64748b;">Severity</th><th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:#64748b;">Finding</th><th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:#64748b;">Action</th></tr></thead>
                <tbody>${findingRows}</tbody>
              </table>`
            : '<p style="color:#166534;font-weight:600;">No critical, high, or medium findings for this period.</p>'
        }
        ${
          reportUrl
            ? `<p style="margin:20px 0 0;"><a href="${reportUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Open the full report</a></p>`
            : ''
        }
        <p style="margin:20px 0 0;color:#64748b;font-size:12px;">The full Markdown report and the agent handoff prompt are in the super-admin console.</p>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
