#!/usr/bin/env node
/**
 * Generate booking-import CSV + Excel fixtures under temp/import-booking/ for manual wizard QA.
 * Not wired to the UI — run: node scripts/dev/generate-import-booking-fixtures.mjs
 *
 * Excel files use SheetJS (cached under temp/.vendor/). Google Sheets is not a
 * native upload format — export as Excel (.xlsx) or CSV from Sheets and use those.
 */

import { createRequire } from 'node:module';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(ROOT, 'temp/import-booking');
const SHEETJS_VERSION = '0.20.3';
const SHEETJS_CACHE = join(ROOT, 'temp/.vendor', `xlsx-${SHEETJS_VERSION}`);
const SHEETJS_ENTRY = join(SHEETJS_CACHE, 'package', 'xlsx.js');
const SHEETJS_TGZ_URL = `https://cdn.sheetjs.com/xlsx-${SHEETJS_VERSION}/xlsx-${SHEETJS_VERSION}.tgz`;

async function ensureSheetJs() {
  if (existsSync(SHEETJS_ENTRY)) {
    return createRequire(import.meta.url)(SHEETJS_ENTRY);
  }

  mkdirSync(SHEETJS_CACHE, { recursive: true });
  const tgzPath = join(SHEETJS_CACHE, 'xlsx.tgz');
  console.log(`Downloading SheetJS ${SHEETJS_VERSION} for Excel fixtures…`);
  const res = await fetch(SHEETJS_TGZ_URL);
  if (!res.ok) {
    throw new Error(`Failed to download SheetJS (${res.status})`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tgzPath));
  execFileSync('tar', ['-xzf', tgzPath, '-C', SHEETJS_CACHE], { stdio: 'inherit' });
  if (!existsSync(SHEETJS_ENTRY)) {
    throw new Error(`SheetJS extract missing entry at ${SHEETJS_ENTRY}`);
  }
  return createRequire(import.meta.url)(SHEETJS_ENTRY);
}

const HEADERS = [
  'guest_display_name',
  'primary_guest_name',
  'guest_email',
  'guest_phone_number',
  'guest_address',
  'check_in_date',
  'check_out_date',
  'check_in_time',
  'check_out_time',
  'number_of_adults',
  'number_of_children',
  'number_of_nights',
  'booking_source',
  'booking_rate',
  'down_payment',
  'security_deposit',
  'need_parking',
  'has_pets',
  'guest2_name',
  'guest3_name',
  'guest_special_requests',
];

/** @param {Record<string, string>} overrides */
function validRow(overrides = {}) {
  return {
    guest_display_name: 'Juan Dela Cruz',
    primary_guest_name: 'Juan Dela Cruz',
    guest_email: 'juan.delacruz@example.com',
    guest_phone_number: '09171234567',
    guest_address: 'San Fernando, Pampanga',
    check_in_date: '2026-01-15',
    check_out_date: '2026-01-18',
    check_in_time: '14:00',
    check_out_time: '11:00',
    number_of_adults: '2',
    number_of_children: '1',
    number_of_nights: '3',
    booking_source: 'Airbnb',
    booking_rate: '7500',
    down_payment: '3750',
    security_deposit: '2000',
    need_parking: 'yes',
    has_pets: 'no',
    guest2_name: 'Maria Dela Cruz',
    guest3_name: '',
    guest_special_requests: 'Late check-in',
    ...overrides,
  };
}

function escapeCell(value) {
  const s = value ?? '';
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** @param {string[]} headers @param {Record<string, string>[]} rows */
function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h] ?? '')).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

/** @param {any} XLSX @param {string[]} headers @param {Record<string, string>[]} rows */
function toXlsxBuffer(XLSX, headers, rows) {
  const aoa = [headers, ...rows.map((row) => headers.map((h) => row[h] ?? ''))];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/** @type {Array<{ file: string; note: string; headers?: string[]; rows: Record<string, string>[]; alsoXlsx?: boolean }>} */
const FIXTURES = [
  {
    file: '01-all-valid-5-rows.csv',
    note: 'Happy path — five ready rows (mixed sources, parking/pets).',
    alsoXlsx: true,
    rows: [
      validRow(),
      validRow({
        guest_display_name: 'Maria Santos',
        primary_guest_name: 'Maria Santos',
        guest_email: 'maria.santos@example.com',
        guest_phone_number: '09281234567',
        guest_address: 'Quezon City, Metro Manila',
        check_in_date: '2026-02-10',
        check_out_date: '2026-02-12',
        number_of_nights: '2',
        booking_source: 'Booking.com',
        booking_rate: '5200',
        need_parking: 'no',
        guest2_name: 'Pedro Santos',
        guest_special_requests: '',
      }),
      validRow({
        guest_display_name: 'Carlos Reyes',
        primary_guest_name: 'Carlos Reyes',
        guest_email: 'carlos.reyes@example.com',
        check_in_date: '2026-03-01',
        check_out_date: '2026-03-05',
        number_of_nights: '4',
        booking_source: 'Direct',
        need_parking: 'yes',
        has_pets: 'yes',
        guest2_name: '',
        guest_special_requests: 'Traveling with a small dog',
      }),
      validRow({
        guest_display_name: 'Ana Lim',
        primary_guest_name: 'Ana Lim',
        guest_email: 'ana.lim@example.com',
        check_in_date: '2026-04-20',
        check_out_date: '2026-04-25',
        number_of_nights: '5',
        guest2_name: 'James Lim',
        guest3_name: 'Lia Lim',
      }),
      validRow({
        guest_display_name: 'Sofia Garcia',
        primary_guest_name: 'Sofia Garcia',
        guest_email: 'sofia.garcia@example.com',
        check_in_date: '2026-05-03',
        check_out_date: '2026-05-04',
        number_of_nights: '1',
        booking_source: 'Agoda',
        booking_rate: '2800',
        guest2_name: '',
      }),
    ],
  },
  {
    file: '02-missing-required-fields.csv',
    note: 'Required columns empty — preview should flag missing email/name/address/dates.',
    rows: [
      validRow({ guest_email: '', primary_guest_name: '', guest_address: '' }),
      validRow({ check_in_date: '', check_out_date: '' }),
      validRow({ guest_display_name: '', guest_phone_number: '' }),
    ],
  },
  {
    file: '03-invalid-email.csv',
    note: 'Bad email shapes — invalid_email.',
    rows: [
      validRow({ guest_email: 'not-an-email' }),
      validRow({ guest_email: 'missing-at-domain.com' }),
      validRow({ guest_email: 'spaces in@email.com' }),
    ],
  },
  {
    file: '04-invalid-phone.csv',
    note: 'Phone with no digits — invalid_phone.',
    rows: [
      validRow({ guest_phone_number: 'none' }),
      validRow({ guest_phone_number: 'TBD' }),
      validRow({ guest_phone_number: '---' }),
    ],
  },
  {
    file: '05-invalid-date-format.csv',
    note: 'Unparseable dates — invalid_date.',
    rows: [
      validRow({ check_in_date: 'soon', check_out_date: '2026-01-20' }),
      validRow({ check_in_date: '2026-02-01', check_out_date: 'next week' }),
      validRow({ check_in_date: '32/13/2026', check_out_date: '2026-02-05' }),
    ],
  },
  {
    file: '06-checkout-not-after-checkin.csv',
    note: 'Check-out on or before check-in — date_order.',
    rows: [
      validRow({ check_in_date: '2026-06-10', check_out_date: '2026-06-10' }),
      validRow({ check_in_date: '2026-06-15', check_out_date: '2026-06-12' }),
      validRow({ check_in_date: '2026-07-01', check_out_date: '2026-06-30' }),
    ],
  },
  {
    file: '07-invalid-boolean.csv',
    note: 'need_parking / has_pets not yes-no-true-false — invalid_boolean.',
    alsoXlsx: true,
    rows: [
      validRow({ need_parking: 'maybe', has_pets: 'no' }),
      validRow({ need_parking: 'yes', has_pets: 'sometimes' }),
      validRow({ need_parking: '2', has_pets: 'dog' }),
    ],
  },
  {
    file: '08-invalid-numbers.csv',
    note: 'Non-numeric adults/rate/deposit — invalid_integer / invalid_decimal.',
    rows: [
      validRow({ number_of_adults: 'two', number_of_children: '1' }),
      validRow({ booking_rate: 'TBD', down_payment: 'half' }),
      validRow({ security_deposit: 'N/A', number_of_nights: 'few' }),
    ],
  },
  {
    file: '09-mixed-valid-and-errors.csv',
    note: 'Mix of ready and needs-fixing rows — skip toggle + Continue gate.',
    rows: [
      validRow({ guest_email: 'good1@example.com' }),
      validRow({ guest_email: 'bad-email', primary_guest_name: 'Bad Email Row' }),
      validRow({ guest_email: 'good2@example.com', need_parking: 'true', has_pets: 'false' }),
      validRow({ check_in_date: '2026-08-01', check_out_date: '2026-07-30' }),
      validRow({ guest_email: 'good3@example.com', booking_source: 'Facebook' }),
    ],
  },
  {
    file: '10-boolean-variants-valid.csv',
    note: 'Boolean columns in alternate spellings — all should pass preview.',
    rows: [
      validRow({ need_parking: 'yes', has_pets: 'no' }),
      validRow({ need_parking: 'true', has_pets: 'false', guest_email: 'b1@example.com' }),
      validRow({ need_parking: 'Y', has_pets: 'N', guest_email: 'b2@example.com' }),
      validRow({ need_parking: '1', has_pets: '0', guest_email: 'b3@example.com' }),
      validRow({ need_parking: 'NO', has_pets: 'YES', guest_email: 'b4@example.com' }),
    ],
  },
  {
    file: '11-date-format-variants-valid.csv',
    note: 'Alternate date formats that normalize — all should pass preview.',
    rows: [
      validRow({ check_in_date: '01/15/2026', check_out_date: '01/18/2026', guest_email: 'd1@example.com' }),
      validRow({ check_in_date: '15-01-2026', check_out_date: '18-01-2026', guest_email: 'd2@example.com' }),
      validRow({ check_in_date: 'Jan 20, 2026', check_out_date: 'Jan 22, 2026', guest_email: 'd3@example.com' }),
      validRow({ check_in_date: '2026/03/01', check_out_date: '2026/03/04', guest_email: 'd4@example.com' }),
    ],
  },
  {
    file: '12-human-readable-headers.csv',
    note: 'Non-snake headers — triggers manual column mapping / AI match step.',
    alsoXlsx: true,
    headers: [
      'Guest display name',
      'Primary guest',
      'Email',
      'Mobile',
      'Home address',
      'Arrival',
      'Departure',
      'Check-in time',
      'Check-out time',
      'Adults',
      'Children',
      'Nights',
      'Channel',
      'Total rate',
      'Deposit paid',
      'SD amount',
      'Parking?',
      'Pets?',
      'Guest 2',
      'Guest 3',
      'Notes',
    ],
    rows: [
      {
        'Guest display name': 'Liza Morales',
        'Primary guest': 'Liza Morales',
        Email: 'liza.morales@example.com',
        Mobile: '09181112222',
        'Home address': 'Pasig City',
        Arrival: '2026-09-01',
        Departure: '2026-09-03',
        'Check-in time': '15:00',
        'Check-out time': '11:00',
        Adults: '2',
        Children: '0',
        Nights: '2',
        Channel: 'Airbnb',
        'Total rate': '6000',
        'Deposit paid': '3000',
        'SD amount': '1500',
        'Parking?': 'no',
        'Pets?': 'no',
        'Guest 2': '',
        'Guest 3': '',
        Notes: 'Human header row',
      },
    ],
  },
  {
    file: '13-extra-unknown-columns.csv',
    note: 'Canonical headers plus extra columns — map or skip extras.',
    headers: [...HEADERS, 'loyalty_tier', 'host_internal_code'],
    rows: [
      {
        ...validRow({ guest_email: 'extra1@example.com' }),
        loyalty_tier: 'gold',
        host_internal_code: 'UNIT-12A',
      },
      {
        ...validRow({ guest_email: 'extra2@example.com' }),
        loyalty_tier: 'silver',
        host_internal_code: 'REF-9988',
      },
    ],
  },
  {
    file: '14-minimal-required-only.csv',
    note: 'Only required fields filled — optional columns blank.',
    rows: [
      {
        guest_display_name: 'Min A',
        primary_guest_name: 'Min A',
        guest_email: 'min.a@example.com',
        guest_phone_number: '09170000001',
        guest_address: 'Manila',
        check_in_date: '2026-10-01',
        check_out_date: '2026-10-02',
        check_in_time: '',
        check_out_time: '',
        number_of_adults: '',
        number_of_children: '',
        number_of_nights: '',
        booking_source: '',
        booking_rate: '',
        down_payment: '',
        security_deposit: '',
        need_parking: '',
        has_pets: '',
        guest2_name: '',
        guest3_name: '',
        guest_special_requests: '',
      },
    ],
  },
  {
    file: '15-ragged-trailing-columns.csv',
    note: 'Parser tolerance — some rows have fewer trailing empty fields.',
    rows: [
      validRow({ guest_email: 'ragged1@example.com' }),
      validRow({ guest_email: 'ragged2@example.com', guest3_name: '', guest_special_requests: '' }),
    ],
  },
  {
    file: '16-commas-in-address.csv',
    note: 'Quoted fields with commas — parse + valid row.',
    rows: [
      validRow({
        guest_email: 'comma1@example.com',
        guest_address: 'Unit 5, Tower B, BGC, Taguig',
        guest_special_requests: 'Need crib, extra pillows',
      }),
    ],
  },
  {
    file: '17-large-55-rows.csv',
    note: 'Pagination — 55 valid rows for preview table paging.',
    rows: Array.from({ length: 55 }, (_, i) =>
      validRow({
        guest_display_name: `Guest ${i + 1}`,
        primary_guest_name: `Guest ${i + 1}`,
        guest_email: `guest${i + 1}@example.com`,
        guest_phone_number: `0917${String(1000000 + i).slice(-7)}`,
        check_in_date: '2026-11-01',
        check_out_date: '2026-11-03',
        need_parking: i % 2 === 0 ? 'yes' : 'no',
        has_pets: i % 3 === 0 ? 'yes' : 'no',
      })
    ),
  },
  {
    file: '18-all-errors.csv',
    note: 'Every row fails — Continue disabled, zero ready count.',
    rows: [
      validRow({ guest_email: 'bad1', need_parking: 'maybe' }),
      validRow({ guest_email: 'bad2', check_out_date: '2026-01-01', check_in_date: '2026-01-10' }),
      validRow({ guest_email: '', guest_phone_number: 'abc' }),
    ],
  },
  {
    file: '19-match-step-needs-review.csv',
    note:
      'Match step — duplicate-prone headers (two emails, two check-in dates, two check-outs) plus opaque extras; forces Columns step.',
    alsoXlsx: true,
    headers: [
      'Contact email',
      'Guest email address',
      'Legal name',
      'Name on booking',
      'Listing profile name',
      'Mobile',
      'City and province',
      'Check-in',
      'Start date',
      'Check-out',
      'End date',
      'Adults',
      'Children',
      'Nights',
      'Channel',
      'Total rate',
      'Deposit paid',
      'SD amount',
      'Parking',
      'Pets',
      'Companion 2',
      'Companion 3',
      'Notes',
      'PMS ref',
      'Room code',
    ],
    rows: [
      {
        'Contact email': 'juan.delacruz@example.com',
        'Guest email address': 'juan.delacruz@example.com',
        'Legal name': 'Juan Dela Cruz',
        'Name on booking': 'Juan DC',
        'Listing profile name': 'Juan Dela Cruz',
        Mobile: '09171234567',
        'City and province': 'San Fernando, Pampanga',
        'Check-in': '2026-01-15',
        'Start date': '2026-01-15',
        'Check-out': '2026-01-18',
        'End date': '2026-01-18',
        Adults: '2',
        Children: '1',
        Nights: '3',
        Channel: 'Airbnb',
        'Total rate': '7500',
        'Deposit paid': '3750',
        'SD amount': '2000',
        Parking: 'yes',
        Pets: 'no',
        'Companion 2': 'Maria Dela Cruz',
        'Companion 3': '',
        Notes: 'Late check-in',
        'PMS ref': 'IMP-8842',
        'Room code': 'T1-1204',
      },
      {
        'Contact email': 'maria.santos@example.com',
        'Guest email address': 'maria.backup@example.com',
        'Legal name': 'Maria Santos',
        'Name on booking': 'Maria S',
        'Listing profile name': 'Maria Santos',
        Mobile: '09281234567',
        'City and province': 'Quezon City',
        'Check-in': '2026-02-10',
        'Start date': '2026-02-10',
        'Check-out': '2026-02-12',
        'End date': '2026-02-12',
        Adults: '2',
        Children: '0',
        Nights: '2',
        Channel: 'Booking.com',
        'Total rate': '5200',
        'Deposit paid': '2600',
        'SD amount': '1500',
        Parking: 'no',
        Pets: 'no',
        'Companion 2': '',
        'Companion 3': '',
        Notes: '',
        'PMS ref': 'IMP-8843',
        'Room code': 'T1-0802',
      },
    ],
  },
];

const XLSX = await ensureSheetJs();
mkdirSync(OUT_DIR, { recursive: true });

const indexLines = [
  '# Booking import test fixtures',
  '',
  'Generated locally — not part of the app UI. Regenerate:',
  '',
  '```bash',
  'node scripts/dev/generate-import-booking-fixtures.mjs',
  '```',
  '',
  'Accepted upload formats: **`.csv`**, **`.xlsx`**, **`.xls`**.',
  '',
  'Google Sheets is not uploaded natively — in Sheets use **File → Download → Microsoft Excel (.xlsx)** or **Comma-separated values (.csv)**, then upload that file.',
  '',
  'Excel fixtures use the **first worksheet** only (same as the importer).',
  '',
  '| File | Scenario |',
  '| --- | --- |',
];

for (const fixture of FIXTURES) {
  const headers = fixture.headers ?? HEADERS;
  const body = toCsv(headers, fixture.rows);
  writeFileSync(join(OUT_DIR, fixture.file), body, 'utf8');
  indexLines.push(`| \`${fixture.file}\` | ${fixture.note} |`);
  console.log(`wrote ${fixture.file} (${fixture.rows.length} rows)`);

  if (fixture.alsoXlsx) {
    const xlsxName = fixture.file.replace(/\.csv$/i, '.xlsx');
    const buf = toXlsxBuffer(XLSX, headers, fixture.rows);
    writeFileSync(join(OUT_DIR, xlsxName), buf);
    indexLines.push(
      `| \`${xlsxName}\` | Same rows as \`${fixture.file}\` — Excel (.xlsx) format smoke test. |`
    );
    console.log(`wrote ${xlsxName} (${fixture.rows.length} rows)`);
  }
}

writeFileSync(join(OUT_DIR, 'README.md'), `${indexLines.join('\n')}\n`, 'utf8');
console.log(`\nFixtures in ${OUT_DIR}`);
