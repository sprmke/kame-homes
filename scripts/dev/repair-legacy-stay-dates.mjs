#!/usr/bin/env node
/**
 * Reconstruct stay dates for bookings whose stored `check_in_date` /
 * `check_out_date` / `number_of_nights` disagree with each other.
 *
 * The guest form names uploads `${prefix}_${checkInDate}_${checkOutDate}_${guest}_${file}`
 * (ui/src/utils/text/helpers.ts — the March-2025 version too), and the same pair
 * appears on both the payment receipt and the valid ID. For every inconsistent row
 * where that pair is self-consistent (`end - start == number_of_nights`) and the
 * stored check-out matches the file's end, the file pair is the dated evidence of
 * the stay the guest submitted; only the stored check-in is wrong.
 *
 * Rows are left alone when the stored span already equals `number_of_nights`
 * (a real reschedule where the upload is simply stale) or when no dated file exists.
 *
 *   node scripts/dev/repair-legacy-stay-dates.mjs            # dry run (read-only)
 *   node scripts/dev/repair-legacy-stay-dates.mjs --apply    # production write
 *
 * `--apply` is a production write: take a backup and get explicit approval first.
 */
import { execFileSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');
const DATE_PAIR = /_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_/;

function runQuery(sql) {
  const out = execFileSync(
    './scripts/dev/bunx',
    ['--bun', 'supabase@latest', 'db', 'query', '--linked', '--read-only', sql],
    { encoding: 'utf8' }
  );
  const start = out.indexOf('{');
  return JSON.parse(out.slice(start, out.lastIndexOf('}') + 1)).rows ?? [];
}

const rows = runQuery(`
  select id, created_at, check_in_date, check_out_date, number_of_nights, status,
         payment_receipt_url, valid_id_url
  from public.guest_submissions
  order by created_at
`);

const toYmd = (mdy) => {
  const [m, d, y] = mdy.split('-');
  return `${y}-${m}-${d}`;
};
/** YYYY-MM-DD -> MM-DD-YYYY, the column's canonical format. */
const toMdy = (ymd) => {
  const [y, m, d] = ymd.split('-');
  return `${m}-${d}-${y}`;
};
const span = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const fixes = [];
const inconsistent = [];
const covered = new Set();

for (const row of rows) {
  const storedIn = /^\d{2}-\d{2}-\d{4}$/.test(row.check_in_date) ? toYmd(row.check_in_date) : row.check_in_date;
  const storedOut = /^\d{2}-\d{2}-\d{4}$/.test(row.check_out_date) ? toYmd(row.check_out_date) : row.check_out_date;
  if (Number.isNaN(Date.parse(storedIn)) || Number.isNaN(Date.parse(storedOut))) continue;
  if (span(storedIn, storedOut) === row.number_of_nights) continue; // internally consistent
  inconsistent.push({ row, storedIn, storedOut });

  const pairs = [row.payment_receipt_url, row.valid_id_url]
    .map((url) => DATE_PAIR.exec(url ?? ''))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]);
  const distinct = new Set(pairs.map((p) => p.join('→')));
  if (pairs.length === 0 || distinct.size !== 1) continue;

  const [start, end] = pairs[0];
  if (end !== storedOut) continue; // checkout itself moved (real reschedule)
  if (span(start, end) !== row.number_of_nights) continue;
  if (start >= end) continue;

  fixes.push({
    id: row.id,
    status: row.status,
    created: String(row.created_at).slice(0, 10),
    current: row.check_in_date,
    // The column is MM-DD-YYYY text; the filename carries YYYY-MM-DD.
    corrected: toMdy(start),
    checkOut: row.check_out_date,
    nights: row.number_of_nights,
    drift: span(start, toYmd(row.check_in_date)),
  });
  covered.add(row.id);
}

const leftovers = inconsistent.filter((r) => !covered.has(r.row.id));

console.log(
  `inconsistent rows: ${inconsistent.length} | reconstructable: ${fixes.length} | needs a human: ${leftovers.length}`
);
if (leftovers.length) {
  console.log('\nneeds a human (stored span != nights, no matching dated file):');
  console.table(
    leftovers.map(({ row, storedIn, storedOut }) => ({
      id: row.id.slice(0, 8),
      booked: String(row.created_at).slice(0, 10),
      stored: `${storedIn} → ${storedOut}`,
      span: span(storedIn, storedOut),
      nights: row.number_of_nights,
      status: row.status,
    }))
  );
}
console.table(
  fixes.map((f) => ({
    id: f.id.slice(0, 8),
    booked: f.created,
    'DB check-in': f.current,
    'real check-in': f.corrected,
    'check-out': f.checkOut,
    nights: f.nights,
    'moved (d)': f.drift,
  }))
);

if (!APPLY) {
  console.log('\ndry run: nothing written.');
  process.exit(0);
}

// One atomic statement with a per-row guard on the exact current values, so a row that
// changed since the dry run is skipped instead of overwritten.
const values = fixes
  .map((f) => `('${f.id}','${f.current}','${f.corrected}','${f.checkOut}')`)
  .join(',\n');

const sql = `
update public.guest_submissions g
set check_in_date = v.new_in
from (values
${values}
) as v(id, expected_in, new_in, expected_out)
where g.id = v.id::uuid
  and g.check_in_date = v.expected_in
  and g.check_out_date = v.expected_out
returning g.id;
`;

console.log(`\napplying ${fixes.length} guarded updates…`);
const out = execFileSync(
  './scripts/dev/bunx',
  ['--bun', 'supabase@latest', 'db', 'query', '--linked', '--yes', sql],
  { encoding: 'utf8' }
);
const json = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
const updated = (json.rows ?? []).length;
console.log(`updated ${updated}/${fixes.length} rows`);
if (updated !== fixes.length) {
  console.error('WARNING: not every row was updated — re-run the dry run to inspect.');
  process.exit(1);
}
