/**
 * approvalEmailMatcher — pure-helper coverage (no Supabase / network).
 * Cutover plan 02 task 5.4: PMO approvals for in-flight bookings arrive by
 * forwarded mail during hypercare, so the subject/attachment matchers must
 * accept re-sent copy.
 * Run: deno test --no-check --allow-env supabase/functions/_shared/approvalEmailMatcher_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  extractEmailAddress,
  findApprovedAttachmentFilename,
  matchAttachment,
  parseApprovalSubject,
  parseDateTokenToDbFormat,
} from './approvalEmailMatcher.ts';

Deno.test('parseApprovalSubject: reads the legacy GAF subject', () => {
  assertEquals(parseApprovalSubject('Monaco 2604 - GAF Request (12-31-2026 to 01-03-2027)'), {
    kind: 'gaf',
    checkInDate: '12-31-2026',
    checkOutDate: '01-03-2027',
  });
});

Deno.test('parseApprovalSubject: reads the legacy pet subject', () => {
  assertEquals(parseApprovalSubject('Monaco 2604 - Pet Request (Nov 2, 2026 to 11-06-2026)'), {
    kind: 'pet',
    checkInDate: '11-02-2026',
    checkOutDate: '11-06-2026',
  });
});

Deno.test('parseApprovalSubject: forwarded and re-sent subjects still parse', () => {
  const expected = {
    kind: 'gaf' as const,
    checkInDate: '12-31-2026',
    checkOutDate: '01-03-2027',
  };
  for (const subject of [
    'Fwd: Monaco 2604 - GAF Request (12-31-2026 to 01-03-2027)',
    'RE: Fwd: Monaco 2604 - GAF Request (12-31-2026 to 01-03-2027)',
    'FWD: ⚠️ TEST - Monaco 2604 - GAF Request (12-31-2026 to 01-03-2027)',
  ]) {
    assertEquals(parseApprovalSubject(subject), expected);
  }
});

Deno.test('parseApprovalSubject: no hardcoded unit label', () => {
  assertEquals(parseApprovalSubject('Any Unit Name - GAF Request (01-01-2027 to 01-02-2027)'), {
    kind: 'gaf',
    checkInDate: '01-01-2027',
    checkOutDate: '01-02-2027',
  });
});

Deno.test('parseApprovalSubject: unmatched or undated subjects return null', () => {
  assertEquals(parseApprovalSubject('Booking confirmed'), null);
  assertEquals(parseApprovalSubject('Monaco 2604 - GAF Request (soon)'), null);
  assertEquals(parseApprovalSubject(''), null);
});

Deno.test('extractEmailAddress: unwraps a display name and lowercases', () => {
  assertEquals(extractEmailAddress('Azure PMO <PMO.AzureNorth@gmail.com>'), 'pmo.azurenorth@gmail.com');
  assertEquals(extractEmailAddress('pmo.azurenorth@gmail.com'), 'pmo.azurenorth@gmail.com');
  assertEquals(extractEmailAddress(''), '');
});

Deno.test('matchAttachment: tolerant of spacing, case and separators', () => {
  assertEquals(matchAttachment('Approved GAF.pdf'), 'gaf');
  assertEquals(matchAttachment('approved-gaf.PDF'), 'gaf');
  assertEquals(matchAttachment('Approved_Pet_Form.pdf'), 'pet');
  assertEquals(matchAttachment('ApprovedPet.pdf'), 'pet');
  assertEquals(matchAttachment('gaf.pdf'), null);
  assertEquals(matchAttachment('receipt.png'), null);
});

Deno.test('findApprovedAttachmentFilename: pet approvals also accept the GAF PDF', () => {
  assertEquals(
    findApprovedAttachmentFilename('pet', ['Approved Pet.pdf', 'Approved GAF.pdf']),
    'Approved Pet.pdf'
  );
  assertEquals(findApprovedAttachmentFilename('pet', ['notes.txt', 'Approved GAF.pdf']), 'Approved GAF.pdf');
  assertEquals(findApprovedAttachmentFilename('pet', ['Approved GAF.pdf']), 'Approved GAF.pdf');
  assertEquals(findApprovedAttachmentFilename('gaf', ['Approved Pet.pdf']), undefined);
});

Deno.test('parseDateTokenToDbFormat: keeps both stored formats', () => {
  assertEquals(parseDateTokenToDbFormat('12-31-2026'), '12-31-2026');
  assertEquals(parseDateTokenToDbFormat('2026-12-31'), '12-31-2026');
});
