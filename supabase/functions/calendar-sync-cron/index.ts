/**
 * calendar-sync-cron — poll external OTA iCal feeds and reconcile availability.
 * Plan: docs/workflow/done/airbnb-calendar-sync.md §7 / §10 / §11
 *
 * Global sweep (scheduled): POST {} — optional header `X-Calendar-Sync-Cron-Secret` when the
 *   env var CALENDAR_SYNC_CRON_SECRET is set. Iterates active feeds, oldest-attempted first,
 *   entitlement-filtered (`calendarSync`), honoring the per-feed minimum interval.
 *
 * Scoped "Sync now": POST { feedId } or { propertyId } + an authenticated JWT with the
 *   property `pricing.channels:edit` permission. Force-syncs that feed / all the property's
 *   feeds immediately (still serialised via the per-feed claim).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import {
  loadCalendarFeed,
  loadDueCalendarFeeds,
  runFeedSync,
  type CalendarFeedRow,
} from '../_shared/calendarSyncRun.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  catchPlanFeatureError,
  requirePropertyFeature,
  resolvePropertyEntitlements,
} from '../_shared/planEntitlements.ts';
import { isFeatureEnabled } from '../_shared/planFeatures.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { isFeatureAvailable, featureUnavailableResponse } from '../_shared/featureAvailability.ts';
import { captureSentryException } from '../_shared/sentry.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GLOBAL_BATCH = 100;
const TIME_BUDGET_MS = 55_000;

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function cronSecretOk(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'CALENDAR_SYNC_CRON_SECRET',
    headerName: 'x-calendar-sync-cron-secret',
  });
}

async function parseBody(req: Request): Promise<{ feedId?: string; propertyId?: string }> {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return {};
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const feedId = typeof body.feedId === 'string' ? body.feedId.trim() : undefined;
    const propertyId = typeof body.propertyId === 'string' ? body.propertyId.trim() : undefined;
    return { feedId, propertyId };
  } catch {
    return {};
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { success: false, error: 'Method not allowed' }, 405);

  const runId = crypto.randomUUID();

  try {
    const { feedId, propertyId } = await parseBody(req);
    const scoped = Boolean(feedId || propertyId);
    const supabase = createServiceClient();

    // ── Scoped "Sync now" ──────────────────────────────────────────────────
    if (scoped) {
      if (feedId && !UUID_RE.test(feedId))
        return json(req, { success: false, error: 'Invalid feedId' }, 400);
      if (propertyId && !UUID_RE.test(propertyId))
        return json(req, { success: false, error: 'Invalid propertyId' }, 400);

      let scopedFeed: CalendarFeedRow | null = null;
      let scopedPropertyId = propertyId;
      if (!scopedPropertyId && feedId) {
        scopedFeed = await loadCalendarFeed(supabase, feedId);
        scopedPropertyId = scopedFeed?.property_id;
      }
      if (!scopedPropertyId) {
        return json(req, { success: false, error: 'property_id is required' }, 400);
      }

      const { property, user } = await resolveScopedPropertyAccess(
        req,
        'pricing.channels:edit',
        scopedPropertyId
      );
      const featureBlocked = await featureUnavailableResponse(req, 'pricing.channel_sync.import', {
        user,
      });
      if (featureBlocked) return featureBlocked;
      try {
        await requirePropertyFeature(property.id, 'calendarSync');
      } catch (err) {
        const gate = catchPlanFeatureError(req, err);
        if (gate) return gate;
        throw err;
      }

      let feeds: CalendarFeedRow[] = [];
      if (feedId) {
        const feed = scopedFeed ?? (await loadCalendarFeed(supabase, feedId));
        if (!feed || feed.property_id !== property.id) {
          return json(req, { success: false, error: 'Feed not found' }, 404);
        }
        feeds = [feed];
      } else {
        const { data } = await supabase
          .from('property_calendar_feeds')
          .select(
            'id, property_id, provider, label, ics_url_encrypted, is_active, create_bookings, last_etag, last_modified_header, last_feed_hash, consecutive_failures, empty_pull_streak'
          )
          .eq('property_id', property.id)
          .eq('is_active', true);
        feeds = (data as CalendarFeedRow[] | null) ?? [];
      }

      const results = [];
      for (const feed of feeds) {
        results.push(await runFeedSync(feed, { runId, force: true, supabase }));
      }
      return json(req, {
        success: true,
        scoped: true,
        runId,
        feedsProcessed: results.length,
        results,
      });
    }

    // ── Global sweep ──────────────────────────────────────────────────────
    if (!cronSecretOk(req)) return json(req, { success: false, error: 'Unauthorized' }, 401);

    if (!(await isFeatureAvailable('pricing.channel_sync.import'))) {
      return json(req, { success: true, skipped: 'feature_unavailable', runId, scoped: false });
    }

    const feeds = await loadDueCalendarFeeds(supabase, GLOBAL_BATCH);
    const startedAt = Date.now();
    const summary = {
      feedsProcessed: 0,
      blocksCreated: 0,
      blocksRemoved: 0,
      blocksUpdated: 0,
      conflicts: 0,
      errors: 0,
      skippedNoEntitlement: 0,
    };
    const entitlementCache = new Map<string, boolean>();

    for (const feed of feeds) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        console.log('[calendar-sync-cron] time budget hit — remaining feeds pick up next tick');
        break;
      }

      let entitled = entitlementCache.get(feed.property_id);
      if (entitled === undefined) {
        try {
          entitled = isFeatureEnabled(
            await resolvePropertyEntitlements(feed.property_id),
            'calendarSync'
          );
        } catch (err) {
          console.error('[calendar-sync-cron] entitlement check failed:', err);
          entitled = false;
        }
        entitlementCache.set(feed.property_id, entitled);
      }
      if (!entitled) {
        summary.skippedNoEntitlement++;
        continue;
      }

      try {
        const res = await runFeedSync(feed, { runId, supabase });
        summary.feedsProcessed++;
        summary.blocksCreated += res.blocksCreated;
        summary.blocksRemoved += res.blocksRemoved;
        summary.blocksUpdated += res.blocksUpdated;
        summary.conflicts += res.conflicts;
        if (!res.ok) summary.errors++;
      } catch (err) {
        summary.errors++;
        console.error(`[calendar-sync-cron] feed ${feed.id} threw:`, err);
      }
    }

    console.log('[calendar-sync-cron]', JSON.stringify({ runId, ...summary }));
    return json(req, { success: true, scoped: false, runId, ...summary });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[calendar-sync-cron] fatal:', err);
    await captureSentryException(err, {
      logPrefix: 'cron:calendar-sync-cron',
      url: req.url,
      method: req.method,
      tags: { cron: 'calendar-sync-cron' },
      fingerprint: ['cron', 'calendar-sync-cron'],
    });
    return json(req, { success: false, error: (err as Error).message }, 500);
  }
});
