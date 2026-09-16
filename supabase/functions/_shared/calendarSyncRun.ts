/**
 * Airbnb / OTA calendar sync — DB orchestration around the pure engine (`calendarSyncService.ts`).
 * Plan: docs/workflow/done/airbnb-calendar-sync.md §7
 *
 * `runFeedSync()` is called by `calendar-sync-cron` for the global sweep and for a scoped
 * "Sync now". It fetches one feed, diffs it against the `ical_import` blocked rows it owns,
 * applies block create/update/remove, runs a conflict pass, persists feed health, and writes
 * a `calendar_sync_events` audit row per action.
 *
 * Phase 1: availability only — `create_bookings` is ignored here (forced off by the settings
 * endpoint). Phase 2 adds `guest_submissions` orchestration in this same wrapper.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { resolveAppSettings } from './appSettings.ts';
import { manilaTodayYmd } from './calendarAvailabilityManila.ts';
import { createServiceClient } from './orgAuth.ts';
import { createNotification } from './notificationService.ts';
import { buildActorContext } from './activityLog.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';
import {
  buildExportCalendar, // re-exported for the ical-export function's convenience
  dateRangesOverlap,
  diffFeed,
  ExternalFetchError,
  fetchExternalIcs,
  hashFeedBody,
  nightsBetween,
  parseIcsCalendar,
  ymdToMmDdYyyy,
  type CalendarFeedProvider,
  type CurrentBlockRow,
  type ExportBusyRange,
  type FetchIcsOptions,
  type FetchIcsResult,
  type ParsedCalendarEvent,
} from './calendarSyncService.ts';

/** Injectable fetch seam — the SSRF-guarded `fetchExternalIcs` in prod, a stub in tests. */
export type IcsFetcher = (url: string, opts: FetchIcsOptions) => Promise<FetchIcsResult>;
import { resolveGuestFormSettings } from './guestFormSettings.ts';
import { decryptIntegrationSecret } from './secretsCrypto.ts';
import { DEFAULT_CHECK_IN_TIME, DEFAULT_CHECK_OUT_TIME } from './utils.ts';
import { WorkflowOrchestrator } from './workflowOrchestrator.ts';

export { buildExportCalendar };

// ─── Outbound feed (GFM → OTA) ───────────────────────────────────────────────

export interface ExportRangesResult {
  ranges: ExportBusyRange[];
  lastModifiedIso: string | null;
}

/**
 * Busy nights to publish for a property: every non-cancelled / non-imported booking + every
 * MANUAL owner block. Imported (`ical_import`) blocks are never re-published. When
 * `excludeProvider` is set, bookings that originated from that OTA are also dropped (loop
 * prevention for the per-provider export URL); bookings from *other* OTAs are still published.
 */
export async function loadExportRanges(
  supabase: SupabaseClient,
  propertyId: string,
  excludeProvider: CalendarFeedProvider | null
): Promise<ExportRangesResult> {
  let newest = 0;
  const bump = (iso: unknown) => {
    const t = typeof iso === 'string' ? Date.parse(iso) : NaN;
    if (Number.isFinite(t) && t > newest) newest = t;
  };
  const ranges: ExportBusyRange[] = [];

  const { data: bookings, error: bErr } = await supabase
    .from('guest_submissions')
    .select('id, check_in_date, check_out_date, status, external_source, updated_at')
    .eq('property_id', propertyId)
    .not('status', 'in', '("CANCELLED","IMPORTED")');
  if (bErr) throw new Error(`export bookings: ${bErr.message}`);
  for (const b of bookings ?? []) {
    if (excludeProvider && b.external_source === excludeProvider) continue;
    const s = toYmd(b.check_in_date);
    const e = toYmd(b.check_out_date);
    if (!s || !e || e <= s) continue;
    bump(b.updated_at);
    ranges.push({
      uidLocalPart: `gfm-booking-${b.id}`,
      startDate: s,
      endDate: e,
      summary: 'Booked',
    });
  }

  const { data: blocks, error: blErr } = await supabase
    .from('property_blocked_dates')
    .select('id, start_date, end_date, created_at')
    .eq('property_id', propertyId)
    .eq('source', 'manual');
  if (blErr) throw new Error(`export blocks: ${blErr.message}`);
  for (const bl of blocks ?? []) {
    bump(bl.created_at);
    ranges.push({
      uidLocalPart: `gfm-block-${bl.id}`,
      startDate: String(bl.start_date),
      endDate: String(bl.end_date),
      summary: 'Blocked',
    });
  }

  return { ranges, lastModifiedIso: newest > 0 ? new Date(newest).toISOString() : null };
}

export const CALENDAR_SYNC_FAILING_THRESHOLD = 4;
export const CALENDAR_SYNC_MIN_INTERVAL_MINUTES_DEFAULT = 30;

export interface CalendarFeedRow {
  id: string;
  property_id: string;
  provider: CalendarFeedProvider;
  label: string | null;
  ics_url_encrypted: string;
  is_active: boolean;
  create_bookings: boolean;
  last_etag: string | null;
  last_modified_header: string | null;
  last_feed_hash: string | null;
  consecutive_failures: number;
  empty_pull_streak: number;
}

export interface RunFeedResult {
  feedId: string;
  runId: string;
  ok: boolean;
  status: 'synced' | 'not_modified' | 'unchanged' | 'skipped' | 'error';
  blocksCreated: number;
  blocksUpdated: number;
  blocksRemoved: number;
  /** Phase 2 (`create_bookings`): guest_submissions rows created / rescheduled / cancelled. */
  bookingsCreated: number;
  bookingsUpdated: number;
  bookingsCancelled: number;
  conflicts: number;
  error?: string;
}

const FEED_SELECT =
  'id, property_id, provider, label, ics_url_encrypted, is_active, create_bookings, last_etag, last_modified_header, last_feed_hash, consecutive_failures, empty_pull_streak';

export function calendarSyncMinIntervalMinutes(): number {
  const raw = Number(Deno.env.get('CALENDAR_SYNC_MIN_INTERVAL_MINUTES'));
  return Number.isFinite(raw) && raw > 0 ? raw : CALENDAR_SYNC_MIN_INTERVAL_MINUTES_DEFAULT;
}

/** Load one active feed by id. */
export async function loadCalendarFeed(
  supabase: SupabaseClient,
  feedId: string
): Promise<CalendarFeedRow | null> {
  const { data, error } = await supabase
    .from('property_calendar_feeds')
    .select(FEED_SELECT)
    .eq('id', feedId)
    .maybeSingle();
  if (error) throw new Error(`load feed: ${error.message}`);
  return (data as CalendarFeedRow | null) ?? null;
}

/** Active feeds for the global sweep, oldest-attempted first (guarantees progress under a time budget). */
export async function loadDueCalendarFeeds(
  supabase: SupabaseClient,
  limit: number
): Promise<CalendarFeedRow[]> {
  const { data, error } = await supabase
    .from('property_calendar_feeds')
    .select(FEED_SELECT)
    .eq('is_active', true)
    .order('last_attempted_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(`load due feeds: ${error.message}`);
  return (data as CalendarFeedRow[] | null) ?? [];
}

/**
 * Claim a feed for this run: a guarded UPDATE on `last_attempted_at` that only succeeds when the
 * feed has not been attempted within `minIntervalMs`. Acts as both the rate-limit and a
 * cross-invocation lock (a concurrent run that already claimed it gets 0 rows back).
 * `force` (scoped "Sync now") bypasses the interval but still serialises via the timestamp.
 */
async function claimFeed(
  supabase: SupabaseClient,
  feedId: string,
  minIntervalMs: number,
  force: boolean
): Promise<boolean> {
  const cutoffIso = new Date(Date.now() - (force ? 5_000 : minIntervalMs)).toISOString();
  const { data, error } = await supabase
    .from('property_calendar_feeds')
    .update({ last_attempted_at: new Date().toISOString() })
    .eq('id', feedId)
    .or(`last_attempted_at.is.null,last_attempted_at.lt.${cutoffIso}`)
    .select('id');
  if (error) throw new Error(`claim feed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

async function writeEvent(
  supabase: SupabaseClient,
  row: {
    feedId: string;
    runId: string;
    action: string;
    externalUid?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    summary?: string | null;
    blockedDateId?: string | null;
    detail?: Record<string, unknown> | null;
  }
): Promise<void> {
  const { error } = await supabase.from('calendar_sync_events').insert({
    feed_id: row.feedId,
    run_id: row.runId,
    action: row.action,
    external_uid: row.externalUid ?? null,
    start_date: row.startDate ?? null,
    end_date: row.endDate ?? null,
    summary: row.summary ?? null,
    blocked_date_id: row.blockedDateId ?? null,
    detail: row.detail ?? null,
  });
  if (error) console.error('[calendarSyncRun] writeEvent failed (non-fatal):', error.message);
}

async function loadFeedBlocks(
  supabase: SupabaseClient,
  feedId: string
): Promise<CurrentBlockRow[]> {
  const { data, error } = await supabase
    .from('property_blocked_dates')
    .select('id, external_uid, start_date, end_date, external_summary')
    .eq('feed_id', feedId);
  if (error) throw new Error(`load feed blocks: ${error.message}`);
  return (data ?? [])
    .filter((r) => typeof r.external_uid === 'string' && r.external_uid)
    .map((r) => ({
      id: r.id as string,
      externalUid: r.external_uid as string,
      startDate: String(r.start_date),
      endDate: String(r.end_date),
      externalSummary: (r.external_summary as string | null) ?? null,
    }));
}

/** MM-DD-YYYY | YYYY-MM-DD text → YYYY-MM-DD, else null. */
function toYmd(value: unknown): string | null {
  const s = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

interface ConflictPartner {
  kind: 'booking' | 'manual_block' | 'other_feed';
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

async function findConflicts(
  supabase: SupabaseClient,
  propertyId: string,
  feedId: string,
  startDate: string,
  endDate: string
): Promise<ConflictPartner[]> {
  const partners: ConflictPartner[] = [];

  const { data: bookings } = await supabase
    .from('guest_submissions')
    .select('id, primary_guest_name, check_in_date, check_out_date, status')
    .eq('property_id', propertyId)
    .not('status', 'in', '("CANCELLED","IMPORTED")');
  for (const b of bookings ?? []) {
    const bs = toYmd(b.check_in_date);
    const be = toYmd(b.check_out_date);
    if (!bs || !be) continue;
    if (dateRangesOverlap(startDate, endDate, bs, be)) {
      partners.push({
        kind: 'booking',
        id: b.id as string,
        label: (b.primary_guest_name as string | null) ?? 'booking',
        startDate: bs,
        endDate: be,
      });
    }
  }

  const { data: blocks } = await supabase
    .from('property_blocked_dates')
    .select('id, start_date, end_date, source, feed_id, note')
    .eq('property_id', propertyId);
  for (const bl of blocks ?? []) {
    if (bl.feed_id === feedId) continue; // our own imported rows never conflict with themselves
    const bs = String(bl.start_date);
    const be = String(bl.end_date);
    if (!dateRangesOverlap(startDate, endDate, bs, be)) continue;
    partners.push({
      kind: bl.source === 'manual' ? 'manual_block' : 'other_feed',
      id: bl.id as string,
      label:
        bl.source === 'manual' ? (bl.note as string | null) || 'owner block' : 'another OTA feed',
      startDate: bs,
      endDate: be,
    });
  }

  return partners;
}

async function emitConflictNotification(
  propertyId: string,
  feedLabel: string,
  event: ParsedCalendarEvent,
  partner: ConflictPartner
): Promise<void> {
  try {
    const organizationId = await resolveOrganizationIdForProperty(propertyId);
    if (!organizationId) return;
    await createNotification({
      organizationId,
      propertyId,
      type: 'calendar_conflict',
      title: 'Calendar conflict',
      body: `${feedLabel}: an imported reservation (${event.startDate} → ${event.endDate}) overlaps ${partner.label} (${partner.startDate} → ${partner.endDate}). Both are kept — resolve on the platform that shouldn't have it.`,
      dedupeKey: `conflict:${event.uid}:${partner.id}`,
      metadata: {
        feed_label: feedLabel,
        external_uid: event.uid,
        conflict_kind: partner.kind,
        conflict_partner_id: partner.id,
        check_in_date: event.startDate,
        check_out_date: event.endDate,
      },
    });
  } catch (err) {
    console.error('[calendarSyncRun] conflict notification failed (non-fatal):', err);
  }
}

async function emitFailingNotification(
  propertyId: string,
  feedLabel: string,
  reason: string
): Promise<void> {
  try {
    const organizationId = await resolveOrganizationIdForProperty(propertyId);
    if (!organizationId) return;
    await createNotification({
      organizationId,
      propertyId,
      type: 'calendar_sync_failing',
      title: 'Calendar sync is failing',
      body: `${feedLabel} has failed to sync ${CALENDAR_SYNC_FAILING_THRESHOLD}+ times in a row (${reason}). Check the calendar URL in Pricing → Channel sync.`,
      dedupeKey: `feed:${propertyId}:${feedLabel}:failing`,
      metadata: { feed_label: feedLabel, reason },
    });
  } catch (err) {
    console.error('[calendarSyncRun] failing notification failed (non-fatal):', err);
  }
}

async function markFeedFailure(
  supabase: SupabaseClient,
  feed: CalendarFeedRow,
  runId: string,
  reason: string
): Promise<void> {
  const nextFailures = (feed.consecutive_failures ?? 0) + 1;
  await supabase
    .from('property_calendar_feeds')
    .update({
      last_error: reason,
      consecutive_failures: nextFailures,
      updated_at: new Date().toISOString(),
    })
    .eq('id', feed.id);
  await writeEvent(supabase, {
    feedId: feed.id,
    runId,
    action: 'error',
    detail: { reason, consecutive_failures: nextFailures },
  });
  if (nextFailures === CALENDAR_SYNC_FAILING_THRESHOLD) {
    await emitFailingNotification(feed.property_id, feed.label ?? feed.provider, reason);
  }
}

async function markFeedSuccess(
  supabase: SupabaseClient,
  feedId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await supabase
    .from('property_calendar_feeds')
    .update({
      last_success_at: new Date().toISOString(),
      last_error: null,
      consecutive_failures: 0,
      updated_at: new Date().toISOString(),
      ...patch,
    })
    .eq('id', feedId);
}

/**
 * Sync one feed. Never throws for expected failure modes (network, bad body) — those become
 * `{ ok:false, status:'error' }` with feed health updated. Programming errors still throw.
 */
export async function runFeedSync(
  feed: CalendarFeedRow,
  opts: {
    runId: string;
    force?: boolean;
    supabase?: SupabaseClient;
    /** Test seam — defaults to the SSRF-guarded `fetchExternalIcs`. */
    fetchIcs?: IcsFetcher;
  } = {
    runId: crypto.randomUUID(),
  }
): Promise<RunFeedResult> {
  const supabase = opts.supabase ?? createServiceClient();
  const fetchIcs = opts.fetchIcs ?? fetchExternalIcs;
  const runId = opts.runId;
  const base: RunFeedResult = {
    feedId: feed.id,
    runId,
    ok: true,
    status: 'skipped',
    blocksCreated: 0,
    blocksUpdated: 0,
    blocksRemoved: 0,
    bookingsCreated: 0,
    bookingsUpdated: 0,
    bookingsCancelled: 0,
    conflicts: 0,
  };

  const claimed = await claimFeed(
    supabase,
    feed.id,
    calendarSyncMinIntervalMinutes() * 60_000,
    !!opts.force
  );
  if (!claimed) {
    await writeEvent(supabase, {
      feedId: feed.id,
      runId,
      action: 'skipped',
      detail: { reason: 'min_interval_or_locked' },
    });
    return { ...base, status: 'skipped' };
  }

  const feedLabel = feed.label ?? feed.provider;

  // 1. Fetch (SSRF-guarded)
  let url: string;
  try {
    url = await decryptIntegrationSecret(feed.ics_url_encrypted);
  } catch {
    await markFeedFailure(supabase, feed, runId, 'could not decrypt stored calendar URL');
    return { ...base, ok: false, status: 'error', error: 'decrypt_failed' };
  }

  let fetched;
  try {
    fetched = await fetchIcs(url, {
      provider: feed.provider,
      etag: feed.last_etag,
      lastModified: feed.last_modified_header,
    });
  } catch (err) {
    const reason = err instanceof ExternalFetchError ? `${err.code}: ${err.message}` : String(err);
    await markFeedFailure(supabase, feed, runId, reason);
    return { ...base, ok: false, status: 'error', error: reason };
  }

  if (fetched.notModified) {
    await markFeedSuccess(supabase, feed.id, { empty_pull_streak: 0 });
    return { ...base, status: 'not_modified' };
  }

  // 2. Hash — skip a full diff when the body is byte-identical to last time.
  const feedHash = await hashFeedBody(fetched.body);
  if (feedHash === feed.last_feed_hash) {
    await markFeedSuccess(supabase, feed.id, {
      last_etag: fetched.etag,
      last_modified_header: fetched.lastModified,
      empty_pull_streak: 0,
    });
    return { ...base, status: 'unchanged' };
  }

  // 3. Parse — pass create_bookings so the classifier can promote reservation VEVENTs
  //    (matters for Booking.com, whose feed does not label the two differently).
  const parsed = parseIcsCalendar(fetched.body, feed.provider, feed.create_bookings);
  if (!parsed.valid) {
    await markFeedFailure(supabase, feed, runId, 'response was not a valid iCalendar body');
    return { ...base, ok: false, status: 'error', error: 'not_icalendar' };
  }
  for (const w of parsed.warnings) {
    await writeEvent(supabase, {
      feedId: feed.id,
      runId,
      action: 'skipped',
      detail: { reason: w },
    });
  }

  // 4. Empty-feed truncation guard — accept "everything cancelled" only after 2 empty pulls.
  if (parsed.empty) {
    const streak = (feed.empty_pull_streak ?? 0) + 1;
    if (streak < 2) {
      await markFeedSuccess(supabase, feed.id, {
        last_etag: fetched.etag,
        last_modified_header: fetched.lastModified,
        last_feed_hash: feedHash,
        empty_pull_streak: streak,
      });
      await writeEvent(supabase, {
        feedId: feed.id,
        runId,
        action: 'skipped',
        detail: { reason: 'empty_feed_pull_1' },
      });
      return { ...base, status: 'skipped' };
    }
  }

  // 5. Diff against current imported blocks for this feed.
  const current = await loadFeedBlocks(supabase, feed.id);
  const diff = diffFeed(parsed.events, current);
  const result = { ...base, status: 'synced' as const };

  // 5a. Creates
  for (const ev of diff.creates) {
    const { data, error } = await supabase
      .from('property_blocked_dates')
      .insert({
        property_id: feed.property_id,
        start_date: ev.startDate,
        end_date: ev.endDate,
        note: `${feedLabel} — ${ev.summary || ev.kind}`,
        source: 'ical_import',
        feed_id: feed.id,
        external_uid: ev.uid,
        external_summary: ev.summary || null,
        last_seen_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();
    if (error) {
      // 23505 = a concurrent run already created it; treat as a touch, not a failure.
      if (error.code !== '23505') {
        await writeEvent(supabase, {
          feedId: feed.id,
          runId,
          action: 'error',
          externalUid: ev.uid,
          detail: { reason: `insert block: ${error.message}` },
        });
        continue;
      }
    }
    result.blocksCreated++;
    await writeEvent(supabase, {
      feedId: feed.id,
      runId,
      action: 'block_created',
      externalUid: ev.uid,
      startDate: ev.startDate,
      endDate: ev.endDate,
      summary: ev.summary,
      blockedDateId: (data?.id as string | undefined) ?? null,
    });
    await runConflictPass(supabase, feed, runId, ev, result);
  }

  // 5b. Reschedules (in-place update — keeps the row id + FK links)
  for (const { row, event: ev } of diff.reschedules) {
    const { error } = await supabase
      .from('property_blocked_dates')
      .update({
        start_date: ev.startDate,
        end_date: ev.endDate,
        external_summary: ev.summary || null,
        note: `${feedLabel} — ${ev.summary || ev.kind}`,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) {
      await writeEvent(supabase, {
        feedId: feed.id,
        runId,
        action: 'error',
        externalUid: ev.uid,
        detail: { reason: `update block: ${error.message}` },
      });
      continue;
    }
    result.blocksUpdated++;
    await writeEvent(supabase, {
      feedId: feed.id,
      runId,
      action: 'block_updated',
      externalUid: ev.uid,
      startDate: ev.startDate,
      endDate: ev.endDate,
      summary: ev.summary,
      blockedDateId: row.id,
      detail: {
        from: { start: row.startDate, end: row.endDate },
        to: { start: ev.startDate, end: ev.endDate },
      },
    });
    await runConflictPass(supabase, feed, runId, ev, result);
  }

  // 5c. Touches (refresh last_seen_at / summary only)
  for (const { row, event: ev, summaryChanged } of diff.touches) {
    await supabase
      .from('property_blocked_dates')
      .update({
        last_seen_at: new Date().toISOString(),
        ...(summaryChanged ? { external_summary: ev.summary || null } : {}),
      })
      .eq('id', row.id);
  }

  // 5d. Removes — the cancellation / silent-drop signal. Guarded by the empty-feed check above
  //     and by parsed.valid; a healthy pull with >=1 event OR the 2nd empty pull reaches here.
  for (const row of diff.removes) {
    const { error } = await supabase
      .from('property_blocked_dates')
      .delete()
      .eq('id', row.id)
      .eq('feed_id', feed.id);
    if (error) {
      await writeEvent(supabase, {
        feedId: feed.id,
        runId,
        action: 'error',
        externalUid: row.externalUid,
        detail: { reason: `delete block: ${error.message}` },
      });
      continue;
    }
    result.blocksRemoved++;
    await writeEvent(supabase, {
      feedId: feed.id,
      runId,
      action: 'block_removed',
      externalUid: row.externalUid,
      startDate: row.startDate,
      endDate: row.endDate,
    });
  }

  // 5e. Phase 2 — promote reservation VEVENTs to real guest_submissions rows.
  //     Only when the feed opted in. Each row is created/rescheduled in PENDING_REVIEW and
  //     never auto-advanced; cancellations route through WorkflowOrchestrator with a
  //     past-check-in guard so completed stays that Airbnb drops don't flip to CANCELLED.
  if (feed.create_bookings) {
    try {
      await reconcileExternalBookings(supabase, feed, runId, parsed.events, result);
    } catch (err) {
      console.error('[calendarSyncRun] external booking reconcile failed (non-fatal):', err);
      await writeEvent(supabase, {
        feedId: feed.id,
        runId,
        action: 'error',
        detail: {
          reason: `booking reconcile: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
    }
  }

  // 6. Persist feed health
  await markFeedSuccess(supabase, feed.id, {
    last_etag: fetched.etag,
    last_modified_header: fetched.lastModified,
    last_feed_hash: feedHash,
    empty_pull_streak: 0,
  });

  return result;
}

// ─── Phase 2: reservation → guest_submissions ────────────────────────────────

interface ExternalBookingRow {
  id: string;
  external_uid: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
}

/** Statuses at/after check-in — a feed drop here is a stale completed stay, not a cancel. */
const PAST_CHECKIN_STATUSES = new Set([
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
]);

async function loadExternalBookings(
  supabase: SupabaseClient,
  feedId: string
): Promise<ExternalBookingRow[]> {
  const { data, error } = await supabase
    .from('guest_submissions')
    .select('id, external_uid, status, check_in_date, check_out_date')
    .eq('external_feed_id', feedId)
    .neq('status', 'CANCELLED');
  if (error) throw new Error(`load external bookings: ${error.message}`);
  return (data ?? [])
    .filter((r) => typeof r.external_uid === 'string' && r.external_uid)
    .map((r) => ({
      id: r.id as string,
      external_uid: r.external_uid as string,
      status: String(r.status ?? ''),
      check_in_date: String(r.check_in_date ?? ''),
      check_out_date: String(r.check_out_date ?? ''),
    }));
}

async function emitExternalImportedNotification(
  propertyId: string,
  feedLabel: string,
  ev: ParsedCalendarEvent,
  bookingId: string
): Promise<void> {
  try {
    const organizationId = await resolveOrganizationIdForProperty(propertyId);
    if (!organizationId) return;
    await createNotification({
      organizationId,
      propertyId,
      type: 'booking_external_imported',
      title: 'New booking imported',
      body: `${feedLabel}: a reservation for ${ev.startDate} → ${ev.endDate} was imported and is waiting for review.`,
      bookingId,
      dedupeKey: `booking:${bookingId}:external_imported`,
      metadata: {
        feed_label: feedLabel,
        external_uid: ev.uid,
        check_in_date: ev.startDate,
        check_out_date: ev.endDate,
      },
    });
  } catch (err) {
    console.error('[calendarSyncRun] external-imported notification failed (non-fatal):', err);
  }
}

async function reconcileExternalBookings(
  supabase: SupabaseClient,
  feed: CalendarFeedRow,
  runId: string,
  events: ParsedCalendarEvent[],
  result: RunFeedResult
): Promise<void> {
  const feedLabel = feed.label ?? feed.provider;
  const reservations = events.filter((e) => e.kind === 'reservation');
  const byUid = new Map(reservations.map((e) => [e.uid, e]));

  const current = await loadExternalBookings(supabase, feed.id);
  const currentByUid = new Map(current.map((r) => [r.external_uid, r]));

  const [formSettings, appSettings] = await Promise.all([
    resolveGuestFormSettings(feed.property_id).catch(() => null),
    resolveAppSettings(feed.property_id).catch(() => null),
  ]);
  const checkInTime = formSettings?.checkInTime || DEFAULT_CHECK_IN_TIME;
  const checkOutTime = formSettings?.checkOutTime || DEFAULT_CHECK_OUT_TIME;
  // NOT NULL columns an OTA reservation can't supply — mirror what submit-form stores for
  // an Airbnb booking ('' receipt, GAF fields from the property's own defaults). guest_email
  // is left NULL (migration 20261214120050) — the guest-form completion link fills the rest.
  const gafDefaults = {
    unit_owner: appSettings?.gafUnitOwner || '',
    tower_and_unit_number: appSettings?.gafTowerAndUnitNumber || '',
    owner_onsite_contact_person: appSettings?.gafGuestsOnsiteContactPerson || '',
    owner_contact_number: appSettings?.gafOwnerContactNumber || '',
  };

  // Creates + reschedules
  for (const ev of reservations) {
    const existing = currentByUid.get(ev.uid);
    const startMdy = ymdToMmDdYyyy(ev.startDate);
    const endMdy = ymdToMmDdYyyy(ev.endDate);
    const nights = nightsBetween(ev.startDate, ev.endDate);

    if (!existing) {
      const displayName = ev.confirmationCode
        ? `Airbnb ${ev.confirmationCode}`
        : ev.phoneLast4
          ? `Airbnb guest ··${ev.phoneLast4}`
          : 'Airbnb guest';
      const { data, error } = await supabase
        .from('guest_submissions')
        .insert({
          property_id: feed.property_id,
          status: 'PENDING_REVIEW',
          status_updated_at: new Date().toISOString(),
          booking_source: 'Airbnb',
          external_source: feed.provider,
          external_uid: ev.uid,
          external_feed_id: feed.id,
          external_raw: ev.raw,
          primary_guest_name: displayName,
          guest_facebook_name: displayName,
          guest_email: null,
          guest_phone_number: '',
          guest_address: '',
          find_us: 'Airbnb',
          payment_receipt_url: '',
          check_in_date: startMdy,
          check_out_date: endMdy,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          number_of_nights: nights,
          number_of_adults: 1,
          down_payment: 0,
          security_deposit: 0,
          ...gafDefaults,
        })
        .select('id')
        .maybeSingle();
      if (error) {
        // 23505 — a concurrent run already inserted it; skip.
        if (error.code !== '23505') {
          await writeEvent(supabase, {
            feedId: feed.id,
            runId,
            action: 'error',
            externalUid: ev.uid,
            detail: { reason: `insert booking: ${error.message}` },
          });
        }
        continue;
      }
      const bookingId = (data?.id as string | undefined) ?? null;
      result.bookingsCreated++;
      await writeEvent(supabase, {
        feedId: feed.id,
        runId,
        action: 'booking_created',
        externalUid: ev.uid,
        startDate: ev.startDate,
        endDate: ev.endDate,
        summary: ev.summary,
        detail: { booking_id: bookingId },
      });
      if (bookingId)
        await emitExternalImportedNotification(feed.property_id, feedLabel, ev, bookingId);
      continue;
    }

    // Reschedule — dates changed on the OTA. Guarded revert to PENDING_REVIEW so the host
    // re-reviews; never touches a stay that has already progressed past review.
    const curStart = toYmd(existing.check_in_date);
    const curEnd = toYmd(existing.check_out_date);
    if (curStart === ev.startDate && curEnd === ev.endDate) continue; // touch — nothing to do

    const { data: updated, error } = await supabase
      .from('guest_submissions')
      .update({
        check_in_date: startMdy,
        check_out_date: endMdy,
        number_of_nights: nights,
        external_raw: ev.raw,
        status: 'PENDING_REVIEW',
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .in('status', ['PENDING_REVIEW', 'PENDING_DOCUMENTS', 'PENDING_GAF'])
      .select('id');
    if (error) {
      await writeEvent(supabase, {
        feedId: feed.id,
        runId,
        action: 'error',
        externalUid: ev.uid,
        detail: { reason: `reschedule booking: ${error.message}` },
      });
      continue;
    }
    if ((updated?.length ?? 0) === 0) {
      // Past review — log but don't force it back.
      await writeEvent(supabase, {
        feedId: feed.id,
        runId,
        action: 'skipped',
        externalUid: ev.uid,
        detail: { reason: 'reschedule_after_review', status: existing.status },
      });
      continue;
    }
    result.bookingsUpdated++;
    await writeEvent(supabase, {
      feedId: feed.id,
      runId,
      action: 'booking_rescheduled',
      externalUid: ev.uid,
      startDate: ev.startDate,
      endDate: ev.endDate,
      detail: {
        booking_id: existing.id,
        from: { start: curStart, end: curEnd },
        to: { start: ev.startDate, end: ev.endDate },
      },
    });
  }

  // Cancellations — UID gone from a healthy feed.
  const today = manilaTodayYmd();
  for (const row of current) {
    if (byUid.has(row.external_uid)) continue;

    const checkoutYmd = toYmd(row.check_out_date);
    const stale =
      PAST_CHECKIN_STATUSES.has(row.status) || (checkoutYmd != null && checkoutYmd < today);
    if (stale) {
      await writeEvent(supabase, {
        feedId: feed.id,
        runId,
        action: 'skipped',
        externalUid: row.external_uid,
        detail: { reason: 'past_checkin_feed_drop', status: row.status, booking_id: row.id },
      });
      continue;
    }

    try {
      await WorkflowOrchestrator.transition(
        row.id,
        'CANCELLED',
        {},
        {},
        false,
        buildActorContext('cron', { cron: 'calendar-sync-cron' })
      );
      result.bookingsCancelled++;
      await writeEvent(supabase, {
        feedId: feed.id,
        runId,
        action: 'booking_cancelled',
        externalUid: row.external_uid,
        detail: { booking_id: row.id, reason: 'feed_drop' },
      });
    } catch (err) {
      await writeEvent(supabase, {
        feedId: feed.id,
        runId,
        action: 'error',
        externalUid: row.external_uid,
        detail: { reason: `cancel booking: ${err instanceof Error ? err.message : String(err)}` },
      });
    }
  }
}

async function runConflictPass(
  supabase: SupabaseClient,
  feed: CalendarFeedRow,
  runId: string,
  ev: ParsedCalendarEvent,
  result: RunFeedResult
): Promise<void> {
  const partners = await findConflicts(
    supabase,
    feed.property_id,
    feed.id,
    ev.startDate,
    ev.endDate
  );
  for (const partner of partners) {
    result.conflicts++;
    await writeEvent(supabase, {
      feedId: feed.id,
      runId,
      action: 'conflict_detected',
      externalUid: ev.uid,
      startDate: ev.startDate,
      endDate: ev.endDate,
      summary: ev.summary,
      detail: { partner },
    });
    await emitConflictNotification(feed.property_id, feed.label ?? feed.provider, ev, partner);
  }
}
