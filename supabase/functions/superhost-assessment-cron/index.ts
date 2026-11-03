/**
 * superhost-assessment-cron — Quarterly Superhost assessment (Jan/Apr/Jul/Oct 1, Asia/Manila).
 * Trigger: hosted pg_cron + pg_net (see supabase/snippets/superhost-assessment-cron.sql).
 *
 * Auth: `X-Superhost-Assessment-Cron-Secret` when SUPERHOST_ASSESSMENT_CRON_SECRET is set,
 * or super-admin JWT (manual run from Org subscriptions).
 *
 * Super-admin POST body `{ "force": true }` runs batch assessment on any day (QA / support).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  runSuperhostAssessmentCron,
  verifySuperhostAssessmentCronSecret,
} from '../_shared/superhostAssessment.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';
import { captureSentryException } from '../_shared/sentry.ts';
import {
  handleOptions,
  jsonError,
  jsonResponse,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { recordJobHeartbeat } from '../_shared/systemHealth/jobHeartbeat.ts';

serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const heartbeatStartedAt = Date.now();
  let cronRun = false;
  try {
    requireHttpMethod(req, 'POST');

    const cronSecretOk = verifySuperhostAssessmentCronSecret(req);
    cronRun = cronSecretOk;
    let isSuperAdmin = false;
    if (!cronSecretOk) {
      try {
        await verifySuperAdminJwt(req);
        isSuperAdmin = true;
      } catch {
        return jsonError(req, 'Unauthorized', 401);
      }
    }

    let force = false;
    try {
      const body = await readJsonBody(req);
      force = body.force === true;
    } catch {
      // empty body is fine for scheduled cron
    }

    if (force && !isSuperAdmin) {
      return jsonError(req, 'force requires super-admin JWT', 403);
    }

    const supabase = createServiceClient();
    const result = await runSuperhostAssessmentCron(supabase, { force: force && isSuperAdmin });
    console.log('[superhost-assessment-cron]', JSON.stringify(result));
    if (cronRun) {
      await recordJobHeartbeat('superhost-assessment-cron', {
        ok: true,
        startedAt: heartbeatStartedAt,
      });
    }
    return jsonResponse(req, { success: true, ...result });
  } catch (error) {
    if (cronRun) {
      await recordJobHeartbeat('superhost-assessment-cron', {
        ok: false,
        startedAt: heartbeatStartedAt,
        error,
      });
    }
    console.error('superhost-assessment-cron:', error);
    // Nothing else observes a scheduled run: without this the job fails, the endpoint returns
    // 500, and no human is ever told. Same shape as the other hand-rolled cron handlers.
    await captureSentryException(error, {
      logPrefix: 'cron:superhost-assessment-cron',
      url: req.url,
      method: req.method,
      traceHeader: req.headers.get('sentry-trace'),
      tags: { cron: 'superhost-assessment-cron' },
      fingerprint: ['cron', 'superhost-assessment-cron'],
    });
    return jsonError(req, (error as Error).message);
  }
});
