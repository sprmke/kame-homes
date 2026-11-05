import { createServiceClient } from './orgAuth.ts';
import {
  buildOpsReport,
  buildOpsReportEmailHtml,
  opsReportSubject,
  type OpsEnvironment,
  type OpsPeriodKind,
  type OpsReportSummary,
} from './opsReport.ts';
import { fetchSentryIssues } from './opsReportSentry.ts';
import { sendResendEmail } from './sendResendEmail.ts';
import { collectSystemHealthChecks } from './systemHealth/collect.ts';
import type { SystemHealthSnapshot } from './systemHealth/snapshotChecks.ts';
import { isProductionEnv } from './systemHealth/types.ts';

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type OpsReportRow = {
  id: string;
  environment: OpsEnvironment;
  period_kind: OpsPeriodKind;
  period_start: string;
  period_end: string;
  overall_status: 'ok' | 'warn' | 'error' | 'unknown';
  counts: Record<string, number>;
  summary: OpsReportSummary;
  markdown: string;
  generated_by: 'cron' | 'manual';
  generated_at: string;
  email_sent_at: string | null;
  email_recipients: string[] | null;
  email_error: string | null;
};

function manilaWeekStart(now: Date): Date {
  const manila = new Date(now.getTime() + MANILA_OFFSET_MS);
  const daysSinceMonday = (manila.getUTCDay() + 6) % 7;
  return new Date(
    Date.UTC(
      manila.getUTCFullYear(),
      manila.getUTCMonth(),
      manila.getUTCDate() - daysSinceMonday,
      0,
      0,
      0,
      0
    ) - MANILA_OFFSET_MS
  );
}

export function opsReportPeriod(input: { periodKind: OpsPeriodKind; now?: Date }): {
  periodStart: string;
  periodEnd: string;
} {
  const now = input.now ?? new Date();
  const thisWeek = manilaWeekStart(now);
  if (input.periodKind === 'weekly') {
    return {
      periodStart: new Date(thisWeek.getTime() - WEEK_MS).toISOString(),
      periodEnd: thisWeek.toISOString(),
    };
  }
  return {
    periodStart: thisWeek.toISOString(),
    periodEnd: new Date(thisWeek.getTime() + WEEK_MS).toISOString(),
  };
}

function env(key: string): string | undefined {
  return Deno.env.get(key);
}

function validRecipients(): string[] {
  const raw = env('OPS_REPORT_RECIPIENTS') ?? env('SUPER_ADMIN_EMAILS') ?? '';
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const part of raw.split(',')) {
    // Env files may wrap the whole allowlist in single or double quotes.
    const email = part
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    seen.add(email);
    recipients.push(email);
    if (recipients.length >= 20) break;
  }
  return recipients;
}

export async function generateOpsReport(input: {
  periodKind: OpsPeriodKind;
  generatedBy: 'cron' | 'manual';
  now?: Date;
}): Promise<OpsReportRow> {
  const supabase = createServiceClient();
  const now = input.now ?? new Date();
  const environment: OpsEnvironment = isProductionEnv(env) ? 'production' : 'non-production';
  const { periodStart, periodEnd } = opsReportPeriod({ periodKind: input.periodKind, now });

  const [snapshotResult, capacityResult, metricsResult] = await Promise.all([
    supabase.rpc('get_system_health_snapshot'),
    supabase.rpc('get_system_health_capacity'),
    supabase.rpc('get_ops_weekly_metrics', {
      p_since: periodStart,
      p_until: now.toISOString(),
    }),
  ]);

  if (snapshotResult.error) {
    throw new Error(`health snapshot failed: ${snapshotResult.error.message}`);
  }
  const snapshot = snapshotResult.data as SystemHealthSnapshot;
  const { checks } = collectSystemHealthChecks({
    snapshot,
    get: env,
    isProd: environment === 'production',
  });

  const sentry = await fetchSentryIssues({
    get: env,
    periodStart,
    periodEnd: input.periodKind === 'weekly' ? periodEnd : now.toISOString(),
  });

  const previousResult = await supabase
    .from('ops_reports')
    .select('summary')
    .lt('period_start', periodStart)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  const previous =
    previousResult.data && typeof previousResult.data.summary === 'object'
      ? (previousResult.data.summary as OpsReportSummary)
      : null;

  const { summary, markdown } = buildOpsReport({
    generatedAt: now.toISOString(),
    environment,
    periodKind: input.periodKind,
    periodStart,
    periodEnd,
    healthChecks: checks,
    metrics: metricsResult.error ? null : (metricsResult.data as Record<string, unknown>),
    capacity: capacityResult.error ? null : (capacityResult.data as Record<string, unknown>),
    sentry,
    previous,
  });

  const { data, error } = await supabase
    .from('ops_reports')
    .upsert(
      {
        environment,
        period_kind: input.periodKind,
        period_start: periodStart,
        period_end: periodEnd,
        overall_status: summary.overallStatus,
        counts: summary.counts,
        summary,
        markdown,
        generated_by: input.generatedBy,
        generated_at: now.toISOString(),
      },
      { onConflict: 'environment,period_start,period_end' }
    )
    .select('*')
    .single();

  if (error) throw new Error(`ops report save failed: ${error.message}`);
  return data as OpsReportRow;
}

export async function sendOpsReportEmail(input: {
  reportId: string;
  force?: boolean;
}): Promise<{ sent: boolean; reason?: string; recipients?: string[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ops_reports')
    .select('*')
    .eq('id', input.reportId)
    .maybeSingle();
  if (error) throw new Error(`ops report read failed: ${error.message}`);
  if (!data) throw new Error('ops report not found');
  const row = data as OpsReportRow;

  if (row.email_sent_at && !input.force) {
    return { sent: false, reason: 'already_sent' };
  }

  const recipients = validRecipients();
  if (recipients.length === 0) {
    const message = 'No recipients configured (OPS_REPORT_RECIPIENTS or SUPER_ADMIN_EMAILS)';
    await supabase.from('ops_reports').update({ email_error: message }).eq('id', row.id);
    return { sent: false, reason: 'no_recipients', error: message };
  }

  const from = env('RESEND_FROM_EMAIL')?.trim();
  if (!from) {
    const message = 'RESEND_FROM_EMAIL is not configured';
    await supabase.from('ops_reports').update({ email_error: message }).eq('id', row.id);
    return { sent: false, reason: 'missing_from', error: message };
  }

  try {
    await sendResendEmail({
      from,
      to: recipients,
      subject: opsReportSubject(row.summary),
      html: buildOpsReportEmailHtml({
        summary: row.summary,
        reportId: row.id,
        appUrl: env('PUBLIC_GUEST_APP_ORIGIN') ?? null,
      }),
      errorLabel: 'weekly ops report',
      tags: [
        { name: 'type', value: 'ops_report' },
        { name: 'period_kind', value: row.period_kind },
      ],
    });
    await supabase
      .from('ops_reports')
      .update({
        email_sent_at: new Date().toISOString(),
        email_recipients: recipients,
        email_error: null,
      })
      .eq('id', row.id);
    return { sent: true, recipients };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from('ops_reports')
      .update({ email_error: message.slice(0, 500) })
      .eq('id', row.id);
    return { sent: false, reason: 'send_failed', error: message };
  }
}

export async function runWeeklyOpsReport(now?: Date): Promise<Record<string, unknown>> {
  const report = await generateOpsReport({
    periodKind: 'weekly',
    generatedBy: 'cron',
    now,
  });
  const delivery = report.email_sent_at
    ? { sent: false, reason: 'already_sent' as const }
    : await sendOpsReportEmail({ reportId: report.id });
  return {
    reportId: report.id,
    periodStart: report.period_start,
    periodEnd: report.period_end,
    overallStatus: report.overall_status,
    counts: report.counts,
    delivery,
  };
}
