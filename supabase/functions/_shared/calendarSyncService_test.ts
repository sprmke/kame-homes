/**
 * Unit tests for the Airbnb / OTA calendar-sync engine helpers.
 * Run: deno test --allow-net supabase/functions/_shared/calendarSyncService_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  airbnbConfirmationCodeFromDescription,
  assertExternalIcsUrlShape,
  buildExportCalendar,
  classifyEventKind,
  dateRangesOverlap,
  diffFeed,
  ExternalFetchError,
  fetchExternalIcs,
  hashFeedBody,
  nightsBetween,
  normalizeExternalIcsUrl,
  parseIcsCalendar,
  parseIcsDateToKey,
  phoneLast4FromDescription,
  unfoldIcsLines,
  ymdToMmDdYyyy,
  type CurrentBlockRow,
} from './calendarSyncService.ts';

const AIRBNB_RESERVATIONS = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN',
  'CALSCALE:GREGORIAN',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20260115',
  'DTSTART;VALUE=DATE:20260112',
  'UID:1a2b3c4d5e@airbnb.com',
  'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABCDE123\\n',
  ' Phone Number (Last 4 Digits): 6789',
  'SUMMARY:Reserved',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20260120',
  'DTSTART;VALUE=DATE:20260118',
  'UID:blocked-gap-1@airbnb.com',
  'SUMMARY:Airbnb (Not available)',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

Deno.test('unfoldIcsLines merges folded continuation lines', () => {
  const lines = unfoldIcsLines('DESCRIPTION:line one\n  still line one\nSUMMARY:two');
  assertEquals(lines[0], 'DESCRIPTION:line one still line one');
  assertEquals(lines[1], 'SUMMARY:two');
});

Deno.test('parseIcsDateToKey — VALUE=DATE and datetime forms', () => {
  assertEquals(parseIcsDateToKey('20260112', 'VALUE=DATE'), '2026-01-12');
  assertEquals(parseIcsDateToKey('20260230', 'VALUE=DATE'), null); // Feb 30 invalid
  // 2026-01-11 23:00 UTC → 2026-01-12 07:00 Manila
  assertEquals(parseIcsDateToKey('20260111T230000Z', ''), '2026-01-12');
  // bare local datetime keeps its wall-clock date
  assertEquals(parseIcsDateToKey('20260111T230000', ''), '2026-01-11');
});

Deno.test('parseIcsCalendar — Airbnb reservations + blocks, DTEND exclusive', () => {
  const parsed = parseIcsCalendar(AIRBNB_RESERVATIONS, 'airbnb', true);
  assert(parsed.valid);
  assert(!parsed.empty);
  assertEquals(parsed.events.length, 2);

  const res = parsed.events.find((e) => e.uid === '1a2b3c4d5e@airbnb.com')!;
  assertEquals(res.kind, 'reservation');
  assertEquals(res.startDate, '2026-01-12');
  assertEquals(res.endDate, '2026-01-15'); // exclusive checkout — 3 nights
  assertEquals(nightsBetween(res.startDate, res.endDate), 3);
  assertEquals(res.confirmationCode, 'HMABCDE123');
  assertEquals(res.phoneLast4, '6789');

  const block = parsed.events.find((e) => e.uid === 'blocked-gap-1@airbnb.com')!;
  assertEquals(block.kind, 'block');
  assertEquals(block.confirmationCode, null);
});

Deno.test('parseIcsCalendar — non-calendar body is invalid, not empty', () => {
  const html = parseIcsCalendar('<html><body>maintenance</body></html>', 'airbnb', false);
  assertEquals(html.valid, false);
  assertEquals(html.empty, false);
});

Deno.test('parseIcsCalendar — valid but empty VCALENDAR', () => {
  const body = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';
  const parsed = parseIcsCalendar(body, 'airbnb', false);
  assertEquals(parsed.valid, true);
  assertEquals(parsed.empty, true);
  assertEquals(parsed.events.length, 0);
});

Deno.test('parseIcsCalendar — bad single VEVENT is skipped, run continues', () => {
  const body = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20260101',
    'DTEND;VALUE=DATE:20260101', // zero-night
    'UID:bad@x',
    'SUMMARY:Reserved',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20260201',
    'DTEND;VALUE=DATE:20260203',
    'UID:good@x',
    'SUMMARY:Reserved',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const parsed = parseIcsCalendar(body, 'other', true);
  assertEquals(parsed.events.length, 1);
  assertEquals(parsed.events[0].uid, 'good@x');
  assert(parsed.warnings.some((w) => w.includes('bad@x')));
});

Deno.test('parseIcsCalendar — duplicate UID keeps the last', () => {
  const body = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20260101',
    'DTEND;VALUE=DATE:20260105',
    'UID:dup@x',
    'SUMMARY:Reserved',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20260110',
    'DTEND;VALUE=DATE:20260115',
    'UID:dup@x',
    'SUMMARY:Reserved',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const parsed = parseIcsCalendar(body, 'airbnb', true);
  assertEquals(parsed.events.length, 1);
  assertEquals(parsed.events[0].startDate, '2026-01-10');
});

Deno.test('classifyEventKind per provider', () => {
  assertEquals(classifyEventKind('airbnb', 'Reserved', false), 'reservation');
  assertEquals(classifyEventKind('airbnb', 'Airbnb (Not available)', true), 'block');
  assertEquals(classifyEventKind('booking_com', 'CLOSED - Not available', true), 'reservation');
  assertEquals(classifyEventKind('booking_com', 'CLOSED - Not available', false), 'block');
  assertEquals(classifyEventKind('vrbo', 'Reserved - John', true), 'reservation');
  assertEquals(classifyEventKind('other', 'Blocked', true), 'block');
});

Deno.test('description parsers', () => {
  assertEquals(
    airbnbConfirmationCodeFromDescription(
      'x https://www.airbnb.com/hosting/reservations/details/HM12AB34 y'
    ),
    'HM12AB34'
  );
  assertEquals(airbnbConfirmationCodeFromDescription('no url here'), null);
  assertEquals(phoneLast4FromDescription('Phone Number (Last 4 Digits): 4321'), '4321');
});

Deno.test('diffFeed — create / reschedule / touch / remove', () => {
  const events = parseIcsCalendar(AIRBNB_RESERVATIONS, 'airbnb', true).events;
  const current: CurrentBlockRow[] = [
    // same UID, different dates → reschedule
    {
      id: 'row-res',
      externalUid: '1a2b3c4d5e@airbnb.com',
      startDate: '2026-01-12',
      endDate: '2026-01-14',
      externalSummary: 'Reserved',
    },
    // gone from feed → remove
    {
      id: 'row-old',
      externalUid: 'cancelled@airbnb.com',
      startDate: '2026-02-01',
      endDate: '2026-02-03',
      externalSummary: 'Reserved',
    },
  ];
  const diff = diffFeed(events, current);
  assertEquals(
    diff.creates.map((e) => e.uid),
    ['blocked-gap-1@airbnb.com']
  );
  assertEquals(diff.reschedules.length, 1);
  assertEquals(diff.reschedules[0].event.endDate, '2026-01-15');
  assertEquals(
    diff.removes.map((r) => r.externalUid),
    ['cancelled@airbnb.com']
  );
  assertEquals(diff.touches.length, 0);
});

Deno.test('diffFeed — unchanged dates → touch, summaryChanged flag', () => {
  const events = parseIcsCalendar(AIRBNB_RESERVATIONS, 'airbnb', true).events;
  const current: CurrentBlockRow[] = [
    {
      id: 'row-res',
      externalUid: '1a2b3c4d5e@airbnb.com',
      startDate: '2026-01-12',
      endDate: '2026-01-15',
      externalSummary: 'old summary',
    },
  ];
  const diff = diffFeed(events, current);
  assertEquals(diff.reschedules.length, 0);
  assertEquals(diff.touches.length, 1);
  assertEquals(diff.touches[0].summaryChanged, true);
});

Deno.test('dateRangesOverlap — half-open, turnover day is free', () => {
  assert(dateRangesOverlap('2026-01-10', '2026-01-15', '2026-01-14', '2026-01-16'));
  assert(!dateRangesOverlap('2026-01-10', '2026-01-15', '2026-01-15', '2026-01-18')); // checkout == checkin
  assert(!dateRangesOverlap('2026-01-10', '2026-01-15', '2026-01-05', '2026-01-10'));
});

Deno.test(
  'buildExportCalendar — sorted, PII-free, folds long lines, excludes nothing given',
  () => {
    const ics = buildExportCalendar({
      calendarName: 'Monaco 2604 (GFM)',
      uidDomain: 'abcdefgh',
      lastModifiedIso: '2026-01-01T00:00:00.000Z',
      ranges: [
        {
          uidLocalPart: 'gfm-block-2',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
          summary: 'Blocked',
        },
        {
          uidLocalPart: 'gfm-booking-1',
          startDate: '2026-02-10',
          endDate: '2026-02-12',
          summary: 'Booked',
        },
      ],
    });
    assert(ics.startsWith('BEGIN:VCALENDAR\r\n'));
    assert(ics.trimEnd().endsWith('END:VCALENDAR'));
    // earlier start date comes first
    assert(ics.indexOf('gfm-booking-1') < ics.indexOf('gfm-block-2'));
    assert(ics.includes('DTSTART;VALUE=DATE:20260210'));
    assert(ics.includes('DTEND;VALUE=DATE:20260212'));
    // no guest data
    assert(!/DESCRIPTION/.test(ics));
    assert(!/ATTENDEE/.test(ics));
  }
);

Deno.test('ymdToMmDdYyyy / nightsBetween', () => {
  assertEquals(ymdToMmDdYyyy('2026-01-12'), '01-12-2026');
  assertEquals(nightsBetween('2026-01-12', '2026-01-15'), 3);
  assertEquals(nightsBetween('2026-01-15', '2026-01-15'), 0);
});

Deno.test('hashFeedBody — CRLF-insensitive, stable', async () => {
  const a = await hashFeedBody('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
  const b = await hashFeedBody('BEGIN:VCALENDAR\nEND:VCALENDAR\n');
  assertEquals(a, b);
});

Deno.test('normalizeExternalIcsUrl — webcal to https', () => {
  assertEquals(
    normalizeExternalIcsUrl('webcal://www.airbnb.com/calendar/ical/abc123.ics'),
    'https://www.airbnb.com/calendar/ical/abc123.ics'
  );
  assertEquals(
    assertExternalIcsUrlShape('webcal://www.airbnb.com/calendar/ical/abc123.ics', 'airbnb'),
    'https://www.airbnb.com/calendar/ical/abc123.ics'
  );
});

Deno.test('fetchExternalIcs — SSRF guard rejects non-https and private targets', async () => {
  for (const [url, provider] of [
    ['http://www.airbnb.com/x.ics', 'airbnb'],
    ['https://169.254.169.254/latest/meta-data', 'other'],
    ['https://localhost/cal.ics', 'other'],
    ['https://10.0.0.5/cal.ics', 'other'],
    ['https://[::1]/cal.ics', 'other'],
    ['https://evil.example.com/x.ics', 'airbnb'], // host not in Airbnb allowlist
  ] as const) {
    let threw = false;
    try {
      await fetchExternalIcs(url, { provider, timeoutMs: 500 });
    } catch (err) {
      threw = err instanceof ExternalFetchError;
    }
    assert(threw, `expected ${url} to be rejected`);
  }
});
