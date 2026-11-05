import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { fetchSentryIssues } from './opsReportSentry.ts';

function env(map: Record<string, string>) {
  return (key: string) => map[key];
}

Deno.test('fetchSentryIssues skips cleanly when configuration is missing', async () => {
  const result = await fetchSentryIssues({
    get: env({}),
    periodStart: '2026-11-01T00:00:00Z',
    periodEnd: '2026-11-08T00:00:00Z',
  });
  assertEquals(result.status, 'skipped');
  assertEquals(result.issues, []);
  assertStringIncludes(result.detail ?? '', 'SENTRY_AUTH_TOKEN');
  assertStringIncludes(result.detail ?? '', 'SENTRY_ORG_SLUG');
  assertStringIncludes(result.detail ?? '', 'SENTRY_PROJECT_SLUG');
});

Deno.test('fetchSentryIssues parses unresolved issues and builds a project URL', async () => {
  let requested = '';
  const result = await fetchSentryIssues({
    get: env({
      SENTRY_AUTH_TOKEN: 'token',
      SENTRY_ORG_SLUG: 'kame',
      SENTRY_PROJECT_SLUG: 'space',
    }),
    periodStart: '2026-11-01T00:00:00Z',
    periodEnd: '2026-11-08T00:00:00Z',
    fetchImpl: (async (url: string) => {
      requested = String(url);
      return new Response(
        JSON.stringify([
          {
            id: '1',
            title: 'TypeError',
            culprit: 'submit-form/index.ts',
            level: 'error',
            count: 4,
            userCount: 2,
            firstSeen: '2026-11-01T00:00:00Z',
            lastSeen: '2026-11-02T00:00:00Z',
            permalink: 'https://sentry.io/issues/1',
          },
          { id: 2, title: 'bad shape' },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch,
  });

  assertStringIncludes(requested, 'https://sentry.io/api/0/projects/kame/space/issues/');
  assertStringIncludes(requested, 'query=is%3Aunresolved');
  assertStringIncludes(requested, 'start=2026-11-01T00%3A00%3A00Z');
  assertStringIncludes(requested, 'end=2026-11-08T00%3A00%3A00Z');
  assertEquals(result.status, 'ok');
  assertEquals(result.issues.length, 1);
  assertEquals(result.issues[0]?.id, '1');
  assertEquals(result.issues[0]?.count, 4);
});

Deno.test('fetchSentryIssues reports a provider error without leaking the token', async () => {
  const result = await fetchSentryIssues({
    get: env({
      SENTRY_AUTH_TOKEN: 'super-secret-token',
      SENTRY_ORG_SLUG: 'kame',
      SENTRY_PROJECT_SLUG: 'space',
    }),
    periodStart: '2026-11-01T00:00:00Z',
    periodEnd: '2026-11-08T00:00:00Z',
    fetchImpl: (async () => new Response('upstream down', { status: 503 })) as typeof fetch,
  });

  assertEquals(result.status, 'error');
  assertEquals(result.issues, []);
  assertStringIncludes(result.detail ?? '', '503');
  assertEquals((result.detail ?? '').includes('super-secret-token'), false);
});
