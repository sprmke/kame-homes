import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { HealthCheck } from './systemHealth/types.ts';
import {
  buildOpsReport,
  buildOpsReportEmailHtml,
  opsReportSubject,
  sentrySeverity,
  type OpsReportSummary,
  type OpsSourceStatus,
  type SentryIssue,
  type BuildOpsReportInput,
} from './opsReport.ts';
import { opsReportPeriod } from './opsReportRunner.ts';

const HEALTH_CHECKS: HealthCheck[] = [
  {
    id: 'env.missing-key',
    category: 'configuration',
    group: 'Edge env',
    label: 'Missing RESEND_API_KEY',
    status: 'error',
    detail: 'Required for booking email.',
    hint: 'Set RESEND_API_KEY in Supabase secrets.',
    fixHref: '/admin/health/configuration',
  },
  {
    id: 'traffic.email.bounce',
    category: 'integrations',
    group: 'Email',
    label: 'Email bounces',
    status: 'warn',
    detail: '3 bounces in 7 days.',
  },
  {
    id: 'db.rls',
    category: 'database',
    group: 'Database',
    label: 'RLS posture',
    status: 'ok',
  },
  {
    id: 'probe.meta',
    category: 'integrations',
    group: 'Meta',
    label: 'Meta token',
    status: 'unknown',
    detail: 'Probe has not run.',
  },
  {
    id: 'usage.off',
    category: 'usage',
    group: 'Usage',
    label: 'Voice receptionist',
    status: 'off',
  },
];

const SENTRY_ISSUES: SentryIssue[] = [
  {
    id: '1001',
    title: 'TypeError: cannot read properties of undefined',
    culprit: 'submit-form/index.ts',
    level: 'error',
    count: 42,
    userCount: 7,
    firstSeen: '2026-11-01T00:00:00Z',
    lastSeen: '2026-11-04T00:00:00Z',
    permalink: 'https://sentry.io/issues/1001',
  },
  {
    id: '1002',
    title: 'Slow query on bookings list',
    culprit: 'list-bookings/index.ts',
    level: 'warning',
    count: 3,
    userCount: 1,
    permalink: 'https://sentry.io/issues/1002',
  },
];

function baseInput(): BuildOpsReportInput {
  return {
    generatedAt: '2026-11-05T00:00:00.000Z',
    environment: 'production' as const,
    periodKind: 'weekly' as const,
    periodStart: '2026-10-26T16:00:00.000Z',
    periodEnd: '2026-11-02T16:00:00.000Z',
    healthChecks: HEALTH_CHECKS,
    metrics: {
      bookings: { created: 12, completed: 8, pending_review: 2 },
      emails: { processed: 40, suppressed: 1 },
      ai: { requests: 10, errors: 1, credits: 3.5 },
      ops: { db_size_bytes: 1024 * 1024 * 75, failing_jobs: 1, rate_limit_rows: 300 },
    },
    capacity: {
      db_size_bytes: 1024 * 1024 * 75,
      tables: [
        { name: 'guest_submissions', bytes: 1024 * 1024 * 20 },
        { name: 'activity_log', bytes: 1024 * 1024 * 5 },
      ],
      buckets: [{ name: 'property-media', bytes: 1024 * 1024 * 200 }],
    },
    sentry: { status: 'ok' as OpsSourceStatus, issues: SENTRY_ISSUES },
    previous: null,
  };
}

Deno.test('sentrySeverity maps provider levels to report severity', () => {
  assertEquals(sentrySeverity('fatal'), 'high');
  assertEquals(sentrySeverity('error'), 'high');
  assertEquals(sentrySeverity('warning'), 'medium');
  assertEquals(sentrySeverity('info'), 'low');
  assertEquals(sentrySeverity('debug'), 'info');
  assertEquals(sentrySeverity(null), 'info');
});

Deno.test('buildOpsReport counts findings and keeps stable ids', () => {
  const { summary } = buildOpsReport(baseInput());

  assertEquals(summary.counts, { critical: 0, high: 2, medium: 2, low: 1, info: 0 });
  assertEquals(summary.overallStatus, 'error');
  assertEquals(
    summary.findings.map((finding) => finding.id),
    [
      'sentry:1001',
      'health:env.missing-key',
      'sentry:1002',
      'health:traffic.email.bounce',
      'health:probe.meta',
    ]
  );
  assertEquals(summary.nextActions.length, 2);
  assertEquals(summary.sources.find((source) => source.id === 'sentry')?.status, 'ok');
});

Deno.test('buildOpsReport maps security errors to critical', () => {
  const input = baseInput();
  input.healthChecks = [
    {
      id: 'security.exposed-key',
      category: 'security',
      group: 'Security',
      label: 'Service key exposed',
      status: 'error',
      detail: 'A secret was found in a public bundle.',
    },
  ];
  const { summary } = buildOpsReport(input);
  assertEquals(summary.counts.critical, 1);
  assertEquals(summary.overallStatus, 'error');
  assertEquals(summary.findings[0]?.severity, 'critical');
});

Deno.test('buildOpsReport degrades to skipped Sentry without a source error', () => {
  const input = baseInput();
  input.sentry = { status: 'skipped', issues: [], detail: 'Not configured (SENTRY_AUTH_TOKEN)' };
  const { summary } = buildOpsReport(input);
  assertEquals(summary.sources.find((source) => source.id === 'sentry')?.status, 'skipped');
  assertEquals(
    summary.findings.some((finding) => finding.id === 'source:sentry'),
    false
  );
});

Deno.test('buildOpsReport records a Sentry outage as a medium finding', () => {
  const input = baseInput();
  input.sentry = { status: 'error', issues: [], detail: 'Sentry API 503' };
  const { summary } = buildOpsReport(input);
  const finding = summary.findings.find((item) => item.id === 'source:sentry');
  assertEquals(finding?.severity, 'medium');
  assertStringIncludes(finding?.detail ?? '', '503');
});

Deno.test('buildOpsReport computes new and resolved findings', () => {
  const first = buildOpsReport(baseInput()).summary;
  const input = baseInput();
  input.healthChecks = HEALTH_CHECKS.filter((check) => check.id !== 'env.missing-key');
  input.sentry = { status: 'ok', issues: [SENTRY_ISSUES[0]!] };
  const next = buildOpsReport({ ...input, previous: first }).summary;

  assertEquals(next.changes.resolved.map((finding) => finding.id), [
    'health:env.missing-key',
    'sentry:1002',
  ]);
  assertEquals(next.changes.new.map((finding) => finding.id), []);
});

Deno.test('buildOpsReportMarkdown has the agent handoff and every finding id', () => {
  const { summary, markdown } = buildOpsReport(baseInput());
  assertStringIncludes(markdown, '# Weekly operations report');
  assertStringIncludes(markdown, '## Sources');
  assertStringIncludes(markdown, '## Findings');
  assertStringIncludes(markdown, '## Metrics');
  assertStringIncludes(markdown, '## AI agent handoff');
  assertStringIncludes(markdown, 'Copy-paste prompt');
  for (const finding of summary.findings) {
    assertStringIncludes(markdown, finding.id);
  }
  assertStringIncludes(markdown, 'bun run ci:quality');
});

Deno.test('email subject and HTML summarise the period and escape content', () => {
  const input = baseInput();
  input.healthChecks = [
    {
      id: 'env.xss',
      category: 'configuration',
      group: 'Edge env',
      label: '<script>alert(1)</script>',
      status: 'error',
      detail: 'Unsafe <b>detail</b>',
    },
  ];
  const { summary } = buildOpsReport(input);
  const subject = opsReportSubject(summary);
  assertStringIncludes(subject, 'Weekly ops report');
  assertStringIncludes(subject, '2 high');

  const html = buildOpsReportEmailHtml({
    summary,
    reportId: '11111111-1111-1111-1111-111111111111',
    appUrl: 'https://kamespace.com',
  });
  assertStringIncludes(html, 'https://kamespace.com/admin/ops-reports/11111111-1111-1111-1111-111111111111');
  assertEquals(html.includes('<script>alert(1)</script>'), false);
  assertStringIncludes(html, '&lt;script&gt;alert(1)&lt;/script&gt;');
});

Deno.test('manual week is the current Monday-to-Monday window, weekly is the previous one', () => {
  const now = new Date('2026-11-05T03:00:00.000Z'); // Thursday 11:00 Manila
  const manual = opsReportPeriod({ periodKind: 'manual', now });
  assertEquals(manual.periodStart, '2026-11-01T16:00:00.000Z'); // Monday 00:00 Manila
  assertEquals(manual.periodEnd, '2026-11-08T16:00:00.000Z');

  const weekly = opsReportPeriod({ periodKind: 'weekly', now });
  assertEquals(weekly.periodStart, '2026-10-25T16:00:00.000Z');
  assertEquals(weekly.periodEnd, '2026-11-01T16:00:00.000Z');
});

Deno.test('summary JSON and markdown carry the same severity counts', () => {
  const { summary, markdown } = buildOpsReport(baseInput());
  for (const [severity, count] of Object.entries(summary.counts)) {
    assertStringIncludes(markdown, `${severity}: ${count}`);
  }
});
