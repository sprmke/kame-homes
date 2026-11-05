import type { OpsSourceStatus, SentryIssue } from './opsReport.ts';

export type SentryFetchResult = {
  status: OpsSourceStatus;
  issues: SentryIssue[];
  detail?: string;
};

type EnvGet = (key: string) => string | undefined;

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Read-only Sentry issue feed for the weekly report.
 * Missing configuration is a `skipped` source, not an error. A provider failure is an
 * `error` source so the report still generates and the operator sees the gap.
 */
export async function fetchSentryIssues(input: {
  get: EnvGet;
  periodStart: string;
  periodEnd: string;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<SentryFetchResult> {
  const token = clean(input.get('SENTRY_AUTH_TOKEN'));
  const org = clean(input.get('SENTRY_ORG_SLUG'));
  const project = clean(input.get('SENTRY_PROJECT_SLUG'));
  const missing = [
    !token ? 'SENTRY_AUTH_TOKEN' : null,
    !org ? 'SENTRY_ORG_SLUG' : null,
    !project ? 'SENTRY_PROJECT_SLUG' : null,
  ].filter((key): key is string => key != null);

  if (missing.length > 0) {
    return {
      status: 'skipped',
      issues: [],
      detail: `Not configured (${missing.join(', ')})`,
    };
  }

  const baseUrl = (clean(input.get('SENTRY_BASE_URL')) ?? 'https://sentry.io').replace(/\/$/, '');
  const params = new URLSearchParams({
    query: 'is:unresolved',
    start: input.periodStart,
    end: input.periodEnd,
    limit: '25',
    sort: 'freq',
  });
  const url = `${baseUrl}/api/0/projects/${encodeURIComponent(org!)}/${encodeURIComponent(project!)}/issues/?${params}`;

  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        status: 'error',
        issues: [],
        detail: `Sentry API ${response.status}${body ? `: ${body.replace(/\s+/g, ' ').slice(0, 180)}` : ''}`,
      };
    }

    const raw = (await response.json().catch(() => null)) as unknown;
    if (!Array.isArray(raw)) {
      return { status: 'error', issues: [], detail: 'Sentry API returned an unexpected shape' };
    }

    const issues = raw
      .map((row): SentryIssue | null => {
        if (!row || typeof row !== 'object') return null;
        const issue = row as Record<string, unknown>;
        if (typeof issue.id !== 'string' || typeof issue.title !== 'string') return null;
        return {
          id: issue.id,
          title: issue.title,
          culprit: typeof issue.culprit === 'string' ? issue.culprit : null,
          level: typeof issue.level === 'string' ? issue.level : null,
          count: typeof issue.count === 'number' || typeof issue.count === 'string' ? issue.count : null,
          userCount: typeof issue.userCount === 'number' ? issue.userCount : null,
          firstSeen: typeof issue.firstSeen === 'string' ? issue.firstSeen : null,
          lastSeen: typeof issue.lastSeen === 'string' ? issue.lastSeen : null,
          permalink: typeof issue.permalink === 'string' ? issue.permalink : null,
          shortId: typeof issue.shortId === 'string' ? issue.shortId : null,
          status: typeof issue.status === 'string' ? issue.status : null,
        };
      })
      .filter((issue): issue is SentryIssue => issue != null);

    return {
      status: 'ok',
      issues,
      detail: `${issues.length} unresolved issues in the period`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', issues: [], detail: `Sentry request failed: ${message.slice(0, 180)}` };
  }
}
