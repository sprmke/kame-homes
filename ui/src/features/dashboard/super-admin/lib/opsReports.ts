export type OpsSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

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

export type OpsReportSummary = {
  schemaVersion: 1;
  generatedAt: string;
  environment: 'production' | 'non-production';
  periodKind: 'weekly' | 'manual';
  periodStart: string;
  periodEnd: string;
  overallStatus: 'ok' | 'warn' | 'error' | 'unknown';
  counts: Record<OpsSeverity, number>;
  sources: Array<{
    id: string;
    label: string;
    status: 'ok' | 'partial' | 'skipped' | 'error';
    detail?: string;
    checkedAt?: string;
  }>;
  findings: OpsFinding[];
  metrics: Array<{ label: string; rows: Array<{ label: string; value: string }> }>;
  changes: { resolved: OpsFinding[]; new: OpsFinding[] };
  nextActions: Array<{
    priority: OpsSeverity;
    title: string;
    findingIds: string[];
    prompt: string;
  }>;
};

export type OpsReportListRow = {
  id: string;
  period_kind: 'weekly' | 'manual';
  period_start: string;
  period_end: string;
  overall_status: 'ok' | 'warn' | 'error' | 'unknown';
  counts: Record<OpsSeverity, number>;
  generated_at: string;
  email_sent_at: string | null;
  email_error: string | null;
};

export type OpsReportRecord = OpsReportListRow & {
  summary: OpsReportSummary;
  markdown: string;
  generated_by: 'cron' | 'manual';
};

export const OPS_SEVERITIES: OpsSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function formatOpsPeriod(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${fmt.format(new Date(start))} to ${fmt.format(new Date(end))}`;
}
