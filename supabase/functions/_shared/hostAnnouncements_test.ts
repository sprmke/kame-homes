/**
 * Host announcements unit tests.
 * Run: deno test --allow-env supabase/functions/_shared/hostAnnouncements_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  ensureHostAnnouncementBodyHtml,
  hostAnnouncementBodyPlainText,
  hostAnnouncementContentKey,
  isHostAnnouncementLive,
  mergeLiveHostAnnouncements,
  stampHostAnnouncementsForSave,
  validateHostAnnouncements,
  type HostAnnouncementRecord,
} from './hostAnnouncements.ts';

function sampleAnnouncement(
  overrides: Partial<HostAnnouncementRecord> = {}
): HostAnnouncementRecord {
  return {
    id: 'ann-test1',
    title: 'Maintenance',
    body: 'Scheduled downtime tonight.',
    severity: 'warning',
    active: true,
    startsAt: null,
    endsAt: null,
    linkUrl: null,
    linkLabel: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

Deno.test('isHostAnnouncementLive respects active flag and schedule window', () => {
  const now = Date.parse('2026-09-01T12:00:00.000Z');
  assert(!isHostAnnouncementLive(sampleAnnouncement({ active: false }), now));
  assert(
    !isHostAnnouncementLive(sampleAnnouncement({ startsAt: '2026-09-02T00:00:00.000Z' }), now)
  );
  assert(!isHostAnnouncementLive(sampleAnnouncement({ endsAt: '2026-09-01T00:00:00.000Z' }), now));
  assert(isHostAnnouncementLive(sampleAnnouncement(), now));
});

Deno.test('mergeLiveHostAnnouncements sorts critical before warning', () => {
  const now = Date.parse('2026-09-01T12:00:00.000Z');
  const merged = mergeLiveHostAnnouncements(
    [sampleAnnouncement({ id: 'a', severity: 'info' })],
    [
      {
        developmentName: 'Azure North Residences',
        announcements: [sampleAnnouncement({ id: 'b', severity: 'critical' })],
      },
    ],
    now
  );
  assertEquals(merged.length, 2);
  assertEquals(merged[0]?.severity, 'critical');
  assertEquals(merged[0]?.scope, 'development');
  assertEquals(merged[1]?.severity, 'info');
  assertEquals(merged[1]?.scope, 'platform');
});

Deno.test('stampHostAnnouncementsForSave preserves updatedAt when unchanged', () => {
  const existing = [
    sampleAnnouncement({ id: 'a', updatedAt: '2026-08-01T00:00:00.000Z' }),
    sampleAnnouncement({ id: 'b', title: 'Old', updatedAt: '2026-08-02T00:00:00.000Z' }),
  ];
  const incoming = [
    sampleAnnouncement({ id: 'a' }),
    sampleAnnouncement({ id: 'b', title: 'New title' }),
  ];
  const stamped = stampHostAnnouncementsForSave(incoming, existing, '2026-09-01T00:00:00.000Z');
  assertEquals(stamped[0]?.updatedAt, '2026-08-01T00:00:00.000Z');
  assertEquals(stamped[1]?.updatedAt, '2026-09-01T00:00:00.000Z');
  assertEquals(hostAnnouncementContentKey(stamped[0]!), hostAnnouncementContentKey(existing[0]!));
});

Deno.test('validateHostAnnouncements rejects unsafe link URLs', () => {
  assertEquals(
    validateHostAnnouncements([sampleAnnouncement({ linkUrl: 'javascript:alert(1)' })]),
    'Link URL must start with http:// or https://'
  );
  assertEquals(
    validateHostAnnouncements([sampleAnnouncement({ linkUrl: 'https://example.com/docs' })]),
    null
  );
});

Deno.test('validateHostAnnouncements treats a visually-empty WYSIWYG body as missing', () => {
  assertEquals(
    validateHostAnnouncements([sampleAnnouncement({ body: '<p></p>' })]),
    'Each announcement needs a message'
  );
  assertEquals(
    validateHostAnnouncements([sampleAnnouncement({ body: '<p>Scheduled downtime.</p>' })]),
    null
  );
});

Deno.test('hostAnnouncementBodyPlainText strips markup and decodes entities', () => {
  assertEquals(
    hostAnnouncementBodyPlainText('<p>Hello <strong>world</strong> &amp; friends</p>'),
    'Hello world & friends'
  );
});

Deno.test('ensureHostAnnouncementBodyHtml wraps legacy plain text but leaves HTML alone', () => {
  assertEquals(
    ensureHostAnnouncementBodyHtml('Line one\n\nLine two'),
    '<p>Line one</p><p>Line two</p>'
  );
  assertEquals(
    ensureHostAnnouncementBodyHtml('<p>Already rich text</p>'),
    '<p>Already rich text</p>'
  );
});
