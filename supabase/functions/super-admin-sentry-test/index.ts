/**
 * super-admin-sentry-test — the fire-drill endpoint behind `/admin/health`.
 *
 * Sends one tagged event to Sentry so an operator can confirm that a real error travels
 * the whole path: capture, ingest, release tag, environment and alert delivery. Doing that
 * with a genuine production fault is not an option, and a browser-only test never exercises
 * the edge client.
 *
 * Captures explicitly and answers 200 rather than throwing. A deliberate throw would be
 * reported correctly, but it would also add a 500 to this endpoint's error rate and to the
 * alert that already fired for the test — the point is one clean event, not a fake incident.
 *
 * `fingerprint: ['sentry_test']` means repeated drills group into one issue instead of
 * creating a new one per click.
 */

import { jsonSuccess } from '../_shared/httpResponse.ts';
import { captureSentryException } from '../_shared/sentry.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';

serveSuperAdmin('super-admin-sentry-test', async (req, user) => {
  const requestId = req.headers.get('x-request-id') ?? undefined;
  const startedAt = Date.now();

  const error = new Error('Sentry fire drill: edge test error. Safe to resolve.');
  error.name = 'SentryFireDrill';

  await captureSentryException(error, {
    logPrefix: 'super-admin-sentry-test',
    requestId,
    url: req.url,
    method: req.method,
    userAgent: req.headers.get('user-agent') ?? undefined,
    userId: user.id,
    traceHeader: req.headers.get('sentry-trace'),
    tags: { drill: 'true', runtime: 'deno-edge-function' },
    fingerprint: ['sentry_test'],
    extra: { triggered_by: 'admin-health', drill: true },
  });

  // Platform diagnostic, so it belongs in the super-admin audit trail and not in any org's
  // activity feed.
  await logSuperAdminAction(user, {
    action: 'system.sentry_test_sent',
    targetType: 'platform',
    summary: 'Sent a Sentry test error from /admin/health',
    metadata: { runtime: 'edge', requestId: requestId ?? null },
  });

  return jsonSuccess(req, {
    sent: true,
    runtime: 'edge',
    elapsedMs: Date.now() - startedAt,
    note: 'Look for fingerprint sentry_test in the kame-homes-edge project.',
  });
});
