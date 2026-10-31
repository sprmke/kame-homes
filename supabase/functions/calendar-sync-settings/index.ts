/**
 * calendar-sync-settings — property Channel sync config (Pricing → Channel sync modal).
 * Plan: docs/workflow/done/airbnb-calendar-sync.md §10
 *
 * GET   ?property=<id|slug>  → { feeds[], export{}, recentEvents[] }   (pricing.channels:view)
 * PATCH { action, ... }                                                 (pricing.channels:edit + calendarSync plan)
 *   addFeed         { provider?: 'airbnb', label?, icsUrl }  — Airbnb only for new feeds
 *   updateFeed      { feedId, label?, icsUrl?, isActive? }
 *   removeFeed      { feedId, deleteData?: boolean }
 *   setExportEnabled { enabled: boolean }
 *   syncNow         { feedId }
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  assertExternalIcsUrlShape,
  ExternalFetchError,
  normalizeExternalIcsUrl,
  type CalendarFeedProvider,
} from '../_shared/calendarSyncService.ts';
import { loadCalendarFeed, runFeedSync } from '../_shared/calendarSyncRun.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '../_shared/secretsCrypto.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import { featureUnavailableResponse } from '../_shared/featureAvailability.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FEED_COLUMNS =
  'id, property_id, provider, label, is_active, create_bookings, last_attempted_at, last_success_at, last_error, consecutive_failures, created_at';

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.length > 8 ? '…' + u.pathname.slice(-6) : u.pathname;
    return `${u.protocol}//${u.hostname}${tail}?••••`;
  } catch {
    return '••••';
  }
}

function feedHealth(row: {
  consecutive_failures?: number | null;
  last_error?: string | null;
}): 'ok' | 'warning' | 'error' {
  const n = row.consecutive_failures ?? 0;
  if (n >= 4) return 'error';
  if (n >= 1) return 'warning';
  return 'ok';
}

async function ensureExportRow(
  supabase: ReturnType<typeof createServiceClient>,
  propertyId: string
) {
  const { data } = await supabase
    .from('property_calendar_export')
    .select('token, is_enabled, rotated_at, last_served_at')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (data) return data;
  const token = newToken();
  const { data: created, error } = await supabase
    .from('property_calendar_export')
    .insert({ property_id: propertyId, token, is_enabled: false })
    .select('token, is_enabled, rotated_at, last_served_at')
    .single();
  if (error) throw new Error(`create export row: ${error.message}`);
  return created;
}

function exportUrls(req: Request, propertySlug: string, token: string): Record<string, string> {
  const origin = new URL(req.url).origin;
  const base = `${origin}/functions/v1/ical-export?property=${encodeURIComponent(propertySlug)}&token=${token}`;
  return {
    all: base,
    airbnb: `${base}&as=airbnb`,
    booking_com: `${base}&as=booking_com`,
    vrbo: `${base}&as=vrbo`,
  };
}

serveAuthenticated('calendar-sync-settings', async (req) => {
  const supabase = createServiceClient();

  // ── GET ────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { property } = await resolveScopedPropertyAccess(req, 'pricing.channels:view');
    // Preview-open: hosts below Pro can browse the Channel sync UI; writes stay plan-gated.
    const [{ data: feedRows }, exportRow] = await Promise.all([
      supabase
        .from('property_calendar_feeds')
        .select(FEED_COLUMNS + ', ics_url_encrypted')
        .eq('property_id', property.id)
        .order('created_at', { ascending: true }),
      ensureExportRow(supabase, property.id),
    ]);

    const feeds = feedRows ?? [];
    const feedIds = feeds.map((f) => f.id as string);
    const { data: events } = feedIds.length
      ? await supabase
          .from('calendar_sync_events')
          .select(
            'id, feed_id, action, external_uid, start_date, end_date, summary, detail, created_at'
          )
          .in('feed_id', feedIds)
          .order('created_at', { ascending: false })
          .limit(30)
      : { data: [] };

    const shapedFeeds = await Promise.all(
      feeds.map(async (f) => {
        const enc = f.ics_url_encrypted as string | undefined;
        let maskedUrl = '••••';
        if (enc) {
          try {
            maskedUrl = maskUrl(await decryptIntegrationSecret(enc));
          } catch {
            maskedUrl = '••••';
          }
        }
        return {
          id: f.id,
          provider: f.provider,
          label: f.label,
          isActive: f.is_active,
          createBookings: f.create_bookings,
          maskedUrl,
          hasUrl: Boolean(enc),
          health: feedHealth(f),
          lastAttemptedAt: f.last_attempted_at,
          lastSuccessAt: f.last_success_at,
          lastError: f.last_error,
          consecutiveFailures: f.consecutive_failures,
          createdAt: f.created_at,
        };
      })
    );

    return jsonSuccess(req, {
      feeds: shapedFeeds,
      export: {
        enabled: exportRow.is_enabled,
        rotatedAt: exportRow.rotated_at,
        lastServedAt: exportRow.last_served_at,
        urls: exportUrls(req, property.slug, exportRow.token),
      },
      recentEvents: events ?? [],
    });
  }

  if (req.method !== 'PATCH') return jsonError(req, 'Method not allowed', 405);

  // ── PATCH ───────────────────────────────────────────────────────────────
  const access = await resolveScopedPropertyAccess(req, 'pricing.channels:edit');
  const { property, user } = access;
  const body = await readJsonBody(req);
  const action = String(body.action ?? '');

  const importActions = new Set(['addFeed', 'updateFeed', 'removeFeed', 'syncNow']);
  if (importActions.has(action)) {
    const blocked = await featureUnavailableResponse(req, 'pricing.channel_sync.import', {
      user,
    });
    if (blocked) return blocked;
  }
  if (action === 'setExportEnabled' && body.enabled === true) {
    const blocked = await featureUnavailableResponse(req, 'pricing.channel_sync', { user });
    if (blocked) return blocked;
  }

  const emitCalendarActivity = (
    calAction:
      'integrations.connected' | 'integrations.disconnected' | 'integrations.config_changed',
    metadata: Record<string, unknown>
  ) =>
    logAssetActivity({
      req,
      user,
      action: calAction,
      propertyId: property.id,
      organizationId: access.org.id,
      accessKind: access.accessKind,
      memberId: access.memberId,
      targetType: 'integration',
      targetId: property.id,
      targetLabel: property.name,
      metadata: { provider: 'calendar_sync', ...metadata },
    });

  // Opt-out: turning Share with Airbnb off must work without the Pro plan (hosts who
  // landed on an auto-enabled row need to disable it without hitting the upgrade modal).
  if (action === 'setExportEnabled' && body.enabled === false) {
    await ensureExportRow(supabase, property.id);
    const { error } = await supabase
      .from('property_calendar_export')
      .update({ is_enabled: false })
      .eq('property_id', property.id);
    if (error) throw new Error(error.message);
    await emitCalendarActivity('integrations.config_changed', {
      setting: 'export_enabled',
      enabled: false,
    });
    return jsonSuccess(req, { enabled: false });
  }

  try {
    await requirePropertyFeature(property.id, 'calendarSync');
  } catch (err) {
    const gate = catchPlanFeatureError(req, err);
    if (gate) return gate;
    throw err;
  }

  try {
    switch (action) {
      case 'addFeed': {
        // Product surface is Airbnb-only for now (Booking.com / VRBO / Other stay in the schema
        // for existing rows + future expansion, but new connections must be Airbnb).
        const provider = String(body.provider ?? 'airbnb') as CalendarFeedProvider;
        if (provider !== 'airbnb') {
          return jsonError(req, 'Only Airbnb calendar sync is available right now', 400);
        }
        const rawUrl = String(body.icsUrl ?? '');
        if (!normalizeExternalIcsUrl(rawUrl)) {
          return jsonError(req, 'Paste the calendar URL', 400);
        }
        const icsUrl = assertExternalIcsUrlShape(rawUrl, provider);
        const label =
          typeof body.label === 'string' && body.label.trim()
            ? body.label.trim().slice(0, 120)
            : null;
        const { data, error } = await supabase
          .from('property_calendar_feeds')
          .insert({
            property_id: property.id,
            provider,
            label,
            ics_url_encrypted: await encryptIntegrationSecret(icsUrl),
            created_by: user.id,
          })
          .select(FEED_COLUMNS)
          .single();
        if (error) throw new Error(error.message);

        let initialSync = null;
        const inserted = await loadCalendarFeed(supabase, data.id as string);
        if (inserted) {
          try {
            initialSync = await runFeedSync(inserted, {
              runId: crypto.randomUUID(),
              force: true,
              supabase,
            });
          } catch (syncErr) {
            console.error('[calendar-sync-settings] initial sync failed (non-fatal):', syncErr);
            initialSync = {
              feedId: inserted.id,
              runId: crypto.randomUUID(),
              ok: false,
              status: 'error' as const,
              blocksCreated: 0,
              blocksUpdated: 0,
              blocksRemoved: 0,
              bookingsCreated: 0,
              bookingsUpdated: 0,
              bookingsCancelled: 0,
              conflicts: 0,
              error: syncErr instanceof Error ? syncErr.message : String(syncErr),
            };
          }
        }

        await emitCalendarActivity('integrations.connected', {
          feed_provider: provider,
          feed_id: data.id,
          label,
        });
        return jsonSuccess(req, { feed: data, initialSync });
      }

      case 'updateFeed': {
        const feedId = String(body.feedId ?? '');
        if (!UUID_RE.test(feedId)) return jsonError(req, 'Invalid feedId', 400);
        const existing = await loadCalendarFeed(supabase, feedId);
        if (!existing || existing.property_id !== property.id)
          return jsonError(req, 'Feed not found', 404);

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof body.label === 'string') patch.label = body.label.trim().slice(0, 120) || null;
        if (typeof body.isActive === 'boolean') patch.is_active = body.isActive;
        if (typeof body.icsUrl === 'string' && body.icsUrl.trim()) {
          const icsUrl = assertExternalIcsUrlShape(body.icsUrl, existing.provider);
          patch.ics_url_encrypted = await encryptIntegrationSecret(icsUrl);
          // A URL change resets health so a previously-failing feed retries cleanly.
          patch.consecutive_failures = 0;
          patch.last_error = null;
          patch.last_feed_hash = null;
          patch.last_etag = null;
          patch.last_modified_header = null;
        }
        const { data, error } = await supabase
          .from('property_calendar_feeds')
          .update(patch)
          .eq('id', feedId)
          .select(FEED_COLUMNS)
          .single();
        if (error) throw new Error(error.message);
        await emitCalendarActivity('integrations.config_changed', {
          feed_id: feedId,
          fields: Object.keys(patch).filter((k) => k !== 'updated_at'),
        });
        return jsonSuccess(req, { feed: data });
      }

      case 'removeFeed': {
        const feedId = String(body.feedId ?? '');
        if (!UUID_RE.test(feedId)) return jsonError(req, 'Invalid feedId', 400);
        const existing = await loadCalendarFeed(supabase, feedId);
        if (!existing || existing.property_id !== property.id)
          return jsonError(req, 'Feed not found', 404);

        const deleteData = body.deleteData === true;
        if (!deleteData) {
          // Keep imported blocks as historical owner blocks (they may be real stays).
          await supabase
            .from('property_blocked_dates')
            .update({ source: 'manual', feed_id: null, external_uid: null })
            .eq('feed_id', feedId);
        }
        // ON DELETE CASCADE removes calendar_sync_events + any remaining ical_import blocks.
        const { error } = await supabase.from('property_calendar_feeds').delete().eq('id', feedId);
        if (error) throw new Error(error.message);
        await emitCalendarActivity('integrations.disconnected', {
          feed_id: feedId,
          feed_provider: existing.provider,
          deleted_imported_blocks: deleteData,
        });
        return jsonSuccess(req, { removed: feedId, keptImportedBlocks: !deleteData });
      }

      case 'setExportEnabled': {
        if (typeof body.enabled !== 'boolean')
          return jsonError(req, 'enabled must be boolean', 400);
        await ensureExportRow(supabase, property.id);
        const { error } = await supabase
          .from('property_calendar_export')
          .update({ is_enabled: body.enabled })
          .eq('property_id', property.id);
        if (error) throw new Error(error.message);
        await emitCalendarActivity('integrations.config_changed', {
          setting: 'export_enabled',
          enabled: body.enabled,
        });
        return jsonSuccess(req, { enabled: body.enabled });
      }

      case 'syncNow': {
        const feedId = String(body.feedId ?? '');
        if (!UUID_RE.test(feedId)) return jsonError(req, 'Invalid feedId', 400);
        const feed = await loadCalendarFeed(supabase, feedId);
        if (!feed || feed.property_id !== property.id) return jsonError(req, 'Feed not found', 404);
        const result = await runFeedSync(feed, {
          runId: crypto.randomUUID(),
          force: true,
          supabase,
        });
        return jsonSuccess(req, { result });
      }

      default:
        return jsonError(req, `Unknown action "${action}"`, 400);
    }
  } catch (err) {
    if (err instanceof ExternalFetchError) return jsonError(req, err.message, 400);
    return jsonError(req, (err as Error).message, 400);
  }
});
