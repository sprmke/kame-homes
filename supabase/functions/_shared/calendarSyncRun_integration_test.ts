/**
 * Integration test for the Phase 2 calendar-sync ingestion pipeline — runs `runFeedSync`
 * against the **local** Supabase Postgres with a stubbed ICS fetcher.
 *
 * Run (local stack must be up):
 *   deno test --allow-net --allow-env --allow-read --no-check \
 *     --env-file=supabase/.temp/functions-serve.env \
 *     supabase/functions/_shared/calendarSyncRun_integration_test.ts
 *
 * Every test seeds its own property_calendar_feeds row and cleans up after itself.
 */

import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { createServiceClient } from './orgAuth.ts';
import { encryptIntegrationSecret } from './secretsCrypto.ts';
import { runFeedSync, type CalendarFeedRow, type IcsFetcher } from './calendarSyncRun.ts';
import type { FetchIcsResult } from './calendarSyncService.ts';

const sb = createServiceClient();

function ics(events: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Test//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function vevent(
  uid: string,
  start: string,
  end: string,
  summary: string,
  description?: string
): string {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${summary}`,
    ...(description ? [`DESCRIPTION:${description}`] : []),
    'END:VEVENT',
  ].join('\r\n');
}

function stubFetch(body: string, over?: Partial<FetchIcsResult>) {
  return (): Promise<FetchIcsResult> =>
    Promise.resolve({
      status: 200,
      notModified: false,
      body,
      etag: null,
      lastModified: null,
      ...over,
    });
}

async function firstPropertyId(): Promise<string> {
  const { data } = await sb.from('properties').select('id').limit(1).maybeSingle();
  assert(data?.id, 'need at least one property in the local DB');
  return data!.id as string;
}

async function seedFeed(propertyId: string, createBookings: boolean): Promise<CalendarFeedRow> {
  const enc = await encryptIntegrationSecret('https://example.com/calendar.ics');
  const { data, error } = await sb
    .from('property_calendar_feeds')
    .insert({
      property_id: propertyId,
      provider: 'airbnb',
      label: `itest-${crypto.randomUUID().slice(0, 8)}`,
      ics_url_encrypted: enc,
      create_bookings: createBookings,
    })
    .select(
      'id, property_id, provider, label, ics_url_encrypted, is_active, create_bookings, last_etag, last_modified_header, last_feed_hash, consecutive_failures, empty_pull_streak'
    )
    .single();
  if (error) throw new Error(`seedFeed: ${error.message}`);
  return data as CalendarFeedRow;
}

async function cleanupFeed(feedId: string): Promise<void> {
  // property_blocked_dates + calendar_sync_events cascade on feed delete;
  // guest_submissions.external_feed_id is SET NULL, so delete those rows explicitly.
  await sb.from('guest_submissions').delete().eq('external_feed_id', feedId);
  await sb.from('property_calendar_feeds').delete().eq('id', feedId);
}

async function feedRow(feedId: string) {
  const { data } = await sb.from('property_calendar_feeds').select('*').eq('id', feedId).single();
  return data as Record<string, unknown>;
}

/**
 * `claimFeed` serialises runs on `last_attempted_at` (even `force` keeps a 5 s window).
 * Between sequential runs in a test, push the timestamp back so the next claim succeeds.
 */
async function reopenClaim(feedId: string): Promise<void> {
  await sb
    .from('property_calendar_feeds')
    .update({ last_attempted_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', feedId);
}

/** Reload the feed row shaped as CalendarFeedRow, with the claim window reopened. */
async function refetch(base: CalendarFeedRow): Promise<CalendarFeedRow> {
  await reopenClaim(base.id);
  return { ...base, ...(await feedRow(base.id)) } as CalendarFeedRow;
}

async function blocks(feedId: string) {
  const { data } = await sb
    .from('property_blocked_dates')
    .select('start_date,end_date,source,external_uid,external_summary')
    .eq('feed_id', feedId)
    .order('start_date');
  return data ?? [];
}

async function bookings(feedId: string) {
  const { data } = await sb
    .from('guest_submissions')
    .select(
      'id,status,check_in_date,check_out_date,number_of_nights,primary_guest_name,guest_email,booking_source,external_source,external_uid'
    )
    .eq('external_feed_id', feedId)
    .order('check_in_date');
  return data ?? [];
}

async function events(feedId: string) {
  const { data } = await sb
    .from('calendar_sync_events')
    .select('action,external_uid,detail')
    .eq('feed_id', feedId)
    .order('created_at');
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.test(
  'Phase 1: block-only feed — create, reschedule, remove; feed health tracked',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, false);
    try {
      // pull 1 — two block events
      let r = await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(
          ics([
            vevent('blkA@abnb', '20270301', '20270305', 'Airbnb (Not available)'),
            vevent('blkB@abnb', '20270401', '20270403', 'Blocked'),
          ])
        ),
      });
      assertEquals(r.status, 'synced');
      assertEquals(r.blocksCreated, 2);
      assertEquals(r.bookingsCreated, 0, 'create_bookings=false must not make bookings');
      let b = await blocks(feed.id);
      assertEquals(b.length, 2);
      assertEquals(
        b.every((x) => x.source === 'ical_import'),
        true
      );

      // pull 2 — blkA dates change, blkB gone, new blkC
      const fresh = await refetch(feed);
      r = await runFeedSync(fresh, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(
          ics([
            vevent('blkA@abnb', '20270302', '20270306', 'Airbnb (Not available)'),
            vevent('blkC@abnb', '20270501', '20270502', 'Blocked'),
          ])
        ),
      });
      assertEquals(r.blocksCreated, 1);
      assertEquals(r.blocksUpdated, 1);
      assertEquals(r.blocksRemoved, 1);
      b = await blocks(feed.id);
      assertEquals(b.map((x) => x.external_uid).sort(), ['blkA@abnb', 'blkC@abnb']);
      const a = b.find((x) => x.external_uid === 'blkA@abnb')!;
      assertEquals(String(a.start_date), '2027-03-02');
      assertEquals(String(a.end_date), '2027-03-06');

      const fh = await feedRow(feed.id);
      assertEquals(fh.consecutive_failures, 0);
      assert(fh.last_success_at, 'last_success_at set');
      assert(fh.last_feed_hash, 'last_feed_hash set');
    } finally {
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test(
  'Phase 2: reservation ingestion — create PENDING_REVIEW booking + block + notification',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, true);
    try {
      const r = await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(
          ics([
            vevent(
              'resv1@abnb',
              '20270610',
              '20270613',
              'Reserved',
              'Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMWXYZ99\\nPhone Number (Last 4 Digits): 4321'
            ),
            vevent('ownblk@abnb', '20270620', '20270622', 'Airbnb (Not available)'),
          ])
        ),
      });
      assertEquals(r.status, 'synced');
      assertEquals(
        r.blocksCreated,
        2,
        'both the reservation and the owner-block get an ical_import block'
      );
      assertEquals(r.bookingsCreated, 1, 'only the reservation VEVENT becomes a booking');

      const bk = await bookings(feed.id);
      assertEquals(bk.length, 1);
      const row = bk[0];
      assertEquals(row.status, 'PENDING_REVIEW');
      assertEquals(row.booking_source, 'Airbnb');
      assertEquals(row.external_source, 'airbnb');
      assertEquals(row.external_uid, 'resv1@abnb');
      assertEquals(row.guest_email, null, 'no guest email until completion');
      assertEquals(String(row.check_in_date), '06-10-2027', 'stored MM-DD-YYYY');
      assertEquals(String(row.check_out_date), '06-13-2027');
      assertEquals(row.number_of_nights, 3);
      assertEquals(row.primary_guest_name, 'Airbnb HMWXYZ99', 'confirmation code from DESCRIPTION');

      const ev = await events(feed.id);
      assert(
        ev.some((e) => e.action === 'booking_created'),
        'booking_created event written'
      );

      const { data: notif } = await sb
        .from('notifications')
        .select('type,dedupe_key')
        .eq('type', 'booking_external_imported')
        .eq('dedupe_key', `booking:${row.id}:external_imported`)
        .maybeSingle();
      assert(notif, 'booking_external_imported notification emitted');
      if (notif) await sb.from('notifications').delete().eq('dedupe_key', notif.dedupe_key);
    } finally {
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test(
  'Phase 2: reschedule while PENDING_REVIEW reverts to PENDING_REVIEW; blocked after review',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, true);
    try {
      await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(ics([vevent('rsx@abnb', '20270701', '20270704', 'Reserved')])),
      });
      let bk = await bookings(feed.id);
      const id = bk[0].id as string;

      // dates change on the OTA — still PENDING_REVIEW → guarded update applies
      let fresh = await refetch(feed);
      let r = await runFeedSync(fresh, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(ics([vevent('rsx@abnb', '20270705', '20270709', 'Reserved')])),
      });
      assertEquals(r.bookingsUpdated, 1);
      bk = await bookings(feed.id);
      assertEquals(String(bk[0].check_in_date), '07-05-2027');
      assertEquals(bk[0].number_of_nights, 4);
      assertEquals(bk[0].status, 'PENDING_REVIEW');

      // host advances the booking, THEN the OTA reschedules again → guarded update = 0 rows
      await sb.from('guest_submissions').update({ status: 'READY_FOR_CHECKIN' }).eq('id', id);
      fresh = await refetch(feed);
      r = await runFeedSync(fresh, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(ics([vevent('rsx@abnb', '20270710', '20270714', 'Reserved')])),
      });
      assertEquals(r.bookingsUpdated, 0, 'must not force a booking that is past review');
      bk = await bookings(feed.id);
      assertEquals(String(bk[0].check_in_date), '07-05-2027', 'dates unchanged after review');
      const ev = await events(feed.id);
      assert(
        ev.some(
          (e) =>
            e.action === 'skipped' &&
            (e.detail as Record<string, unknown>)?.reason === 'reschedule_after_review'
        ),
        'logs reschedule_after_review'
      );
    } finally {
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test(
  'Phase 2: cancellation — cancel while pending; skip when past check-in (stale feed drop)',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, true);
    try {
      // two reservations
      await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(
          ics([
            vevent('cancelme@abnb', '20270801', '20270803', 'Reserved'),
            vevent('keepme@abnb', '20270810', '20270812', 'Reserved'),
          ])
        ),
      });
      let bk = await bookings(feed.id);
      assertEquals(bk.length, 2);
      const staleId = bk.find((x) => x.external_uid === 'keepme@abnb')!.id as string;
      // simulate this stay already checked in
      await sb.from('guest_submissions').update({ status: 'READY_FOR_CHECKIN' }).eq('id', staleId);

      // next pull: BOTH uids gone from the feed
      const fresh = await refetch(feed);
      const r = await runFeedSync(fresh, {
        runId: crypto.randomUUID(),
        force: true,
        // one unrelated event so the feed isn't "empty" (empty-feed guard)
        fetchIcs: stubFetch(ics([vevent('other@abnb', '20271201', '20271203', 'Reserved')])),
      });
      assertEquals(r.bookingsCancelled, 1, 'only the pending one is cancelled');
      assertEquals(r.bookingsCreated, 1, 'the unrelated new event is ingested');

      bk = await bookings(feed.id);
      const cancelled = bk.find((x) => x.external_uid === 'cancelme@abnb')!;
      assertEquals(cancelled.status, 'CANCELLED');
      const stale = bk.find((x) => x.external_uid === 'keepme@abnb')!;
      assertEquals(stale.status, 'READY_FOR_CHECKIN', 'past-check-in feed drop must NOT cancel');

      const ev = await events(feed.id);
      assert(
        ev.some(
          (e) =>
            e.action === 'skipped' &&
            (e.detail as Record<string, unknown>)?.reason === 'past_checkin_feed_drop'
        ),
        'logs past_checkin_feed_drop'
      );
      assert(
        ev.some((e) => e.action === 'booking_cancelled'),
        'logs booking_cancelled'
      );
    } finally {
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test('Engine: 304 not-modified and byte-identical body are no-ops', async () => {
  const pid = await firstPropertyId();
  const feed = await seedFeed(pid, true);
  try {
    const body = ics([vevent('x@abnb', '20270901', '20270903', 'Reserved')]);
    await runFeedSync(feed, { runId: crypto.randomUUID(), force: true, fetchIcs: stubFetch(body) });
    assertEquals((await bookings(feed.id)).length, 1);

    // identical body → unchanged (hash short-circuit), no dup
    let fresh = await refetch(feed);
    let r = await runFeedSync(fresh, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(body),
    });
    assertEquals(r.status, 'unchanged');
    assertEquals((await bookings(feed.id)).length, 1);

    // 304 → not_modified, failure counters stay clean
    fresh = await refetch(feed);
    r = await runFeedSync(fresh, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch('', { notModified: true, status: 304 }),
    });
    assertEquals(r.status, 'not_modified');
    assertEquals((await feedRow(feed.id)).consecutive_failures, 0);
  } finally {
    await cleanupFeed(feed.id);
  }
});

Deno.test(
  'Engine: HTTP error bumps failure count and leaves imported blocks untouched',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, false);
    try {
      await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(ics([vevent('keep@abnb', '20271001', '20271003', 'Blocked')])),
      });
      assertEquals((await blocks(feed.id)).length, 1);

      const fresh = await refetch(feed);
      const r = await runFeedSync(fresh, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: () => Promise.reject(new Error('boom')),
      });
      assertEquals(r.ok, false);
      assertEquals(r.status, 'error');
      assertEquals(
        (await blocks(feed.id)).length,
        1,
        'a failed pull never deletes existing blocks'
      );
      assertEquals((await feedRow(feed.id)).consecutive_failures, 1);
    } finally {
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test('Engine: empty-feed guard — a single empty pull does NOT mass-remove', async () => {
  const pid = await firstPropertyId();
  const feed = await seedFeed(pid, false);
  try {
    await runFeedSync(feed, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('e1@abnb', '20271101', '20271103', 'Blocked')])),
    });
    assertEquals((await blocks(feed.id)).length, 1);

    const fresh = await refetch(feed);
    const r = await runFeedSync(fresh, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([])), // valid but empty
    });
    assertEquals(r.status, 'skipped');
    assertEquals((await blocks(feed.id)).length, 1, 'first empty pull is not trusted');
    assertEquals((await feedRow(feed.id)).empty_pull_streak, 1);
  } finally {
    await cleanupFeed(feed.id);
  }
});

Deno.test(
  'Feed health: calendar_sync_failing fires once at exactly 4 consecutive failures',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, false);
    const boom: IcsFetcher = () => Promise.reject(new Error('unreachable'));
    const dedupe = `feed:${pid}:${feed.label}:failing`;
    const notifCount = async (): Promise<number> => {
      const { count } = await sb
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'calendar_sync_failing')
        .eq('dedupe_key', dedupe);
      return count ?? 0;
    };
    try {
      for (let i = 1; i <= 5; i++) {
        const fresh = await refetch(feed);
        const r = await runFeedSync(fresh, {
          runId: crypto.randomUUID(),
          force: true,
          fetchIcs: boom,
        });
        assertEquals(r.ok, false);
        assertEquals((await feedRow(feed.id)).consecutive_failures, i, `failures after run ${i}`);
        const n = await notifCount();
        if (i < 4) assertEquals(n, 0, `no notification before the 4th failure (run ${i})`);
        else assertEquals(n, 1, `exactly one notification, not re-fired (run ${i})`);
      }
    } finally {
      await sb.from('notifications').delete().eq('dedupe_key', dedupe);
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test(
  'Conflict pass: imported reservation overlapping a manual block is kept + flagged',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, true);
    const { data: manual } = await sb
      .from('property_blocked_dates')
      .insert({
        property_id: pid,
        start_date: '2027-12-02',
        end_date: '2027-12-06',
        source: 'manual',
        note: 'itest-manual',
      })
      .select('id')
      .single();
    try {
      const r = await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(ics([vevent('ov@abnb', '20271201', '20271204', 'Reserved')])),
      });
      assertEquals(r.blocksCreated, 1, 'the overlapping import is still applied');
      assert(r.conflicts >= 1, 'conflict detected');
      const ev = await events(feed.id);
      assert(
        ev.some((e) => e.action === 'conflict_detected'),
        'conflict_detected event written'
      );
    } finally {
      await sb.from('property_blocked_dates').delete().eq('id', manual?.id);
      await sb.from('notifications').delete().like('dedupe_key', 'conflict:ov@abnb:%');
      await cleanupFeed(feed.id);
    }
  }
);
