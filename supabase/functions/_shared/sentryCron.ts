import { scrubRecord } from './telemetryScrub.ts';

/**
 * Sentry cron check-ins.
 *
 * A scheduled job that stops running is the quietest possible failure: no request fails,
 * no user complains, the work simply does not happen. Sentry monitors catch it by expecting
 * a check-in inside the schedule window and alerting when one is missing.
 *
 * **Free tier allows exactly one monitor** (plan D13), so this is deliberately opt-in per
 * cron rather than applied to all of them. `sd-refund-cron` is the one that gets it: a
 * missed SD refund run leaves a guest waiting for money. Every other job keeps its existing
 * last-run/last-status coverage in `_shared/systemHealth/jobsRegistry.ts`, which costs
 * nothing and already renders on `/admin/health`.
 *
 * Wire format: an envelope whose item is a `check_in`, with `monitor_config` so the monitor
 * is created on first check-in instead of by hand in the dashboard.
 */

const CAPTURE_TIMEOUT_MS = 3000;

export type CronMonitorConfig = {
  /** Monitor slug, stable forever — renaming orphans the alert history. */
  slug: string;
  /** Crontab matching the `pg_cron` schedule, so Sentry can tell a late run from a dead one. */
  schedule: string;
  /** Defaults to Asia/Manila, matching every other scheduled job in this product. */
  timezone?: string;
  /** Expected upper bound; a run past this alerts. */
  maxRuntimeMinutes?: number;
  /** Grace before a missing check-in alerts. */
  checkinMarginMinutes?: number;
};

export type CronCheckInStatus = 'in_progress' | 'ok' | 'error';

type ParsedDsn = { envelopeUrl: string; publicKey: string };

let parsedDsn: ParsedDsn | null | undefined;

function parseDsn(raw: string): ParsedDsn | null {
  try {
    const url = new URL(raw);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\/+/, '').trim();
    if (!publicKey || !projectId) return null;
    return {
      envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey,
    };
  } catch {
    return null;
  }
}

function getDsn(): ParsedDsn | null {
  if (parsedDsn !== undefined) return parsedDsn;
  const raw = (Deno.env.get('SENTRY_DSN') ?? '').trim();
  parsedDsn = raw ? parseDsn(raw) : null;
  return parsedDsn;
}

/**
 * Sends one check-in. Never throws: a monitor that cannot report must not fail the job it
 * is monitoring.
 */
export async function sendCronCheckIn(
  config: CronMonitorConfig,
  status: CronCheckInStatus,
  options: { checkInId?: string; durationMs?: number; environment?: string } = {}
): Promise<void> {
  const dsn = getDsn();
  if (!dsn) return;

  try {
    const checkInId = options.checkInId ?? crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const payload = scrubRecord({
      check_in_id: checkInId,
      monitor_slug: config.slug,
      status,
      ...(options.durationMs !== undefined ? { duration: options.durationMs / 1000 } : {}),
      ...(status === 'in_progress'
        ? {
            monitor_config: {
              schedule: { type: 'crontab', value: config.schedule },
              timezone: config.timezone ?? 'Asia/Manila',
              checkin_margin: config.checkinMarginMinutes ?? 5,
              max_runtime: config.maxRuntimeMinutes ?? 10,
              ...(options.environment ? { environment: options.environment } : {}),
            },
          }
        : {}),
    });

    const body = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(body).length;
    const envelope =
      `${JSON.stringify({ event_id: crypto.randomUUID().replace(/-/g, ''), sent_at: timestamp })}\n` +
      `${JSON.stringify({ type: 'check_in', length: bytes })}\n` +
      `${body}\n`;

    const response = await fetch(dsn.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=gfm-cron/1.0, sentry_key=${dsn.publicKey}`,
      },
      body: envelope,
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[sentryCron] check-in rejected: ${response.status}`);
    }
  } catch (error) {
    console.error('[sentryCron] failed to send check-in', error);
  }
}

/**
 * Runs a cron body wrapped in an in-progress/ok/error check-in.
 *
 * `ok` on success, `error` on throw (then rethrows so the existing handler still reports and
 * responds). Duration is measured so a job that starts timing out is visible before it
 * fails outright.
 */
export async function withCronCheckIn<T>(
  config: CronMonitorConfig,
  run: () => Promise<T>
): Promise<T> {
  const checkInId = crypto.randomUUID();
  const startedAt = Date.now();

  await sendCronCheckIn(config, 'in_progress', { checkInId });

  try {
    const result = await run();
    await sendCronCheckIn(config, 'ok', { checkInId, durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await sendCronCheckIn(config, 'error', { checkInId, durationMs: Date.now() - startedAt });
    throw error;
  }
}

/** Test seam. */
export function resetSentryCronDsnForTests(): void {
  parsedDsn = undefined;
}
