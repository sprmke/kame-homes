#!/usr/bin/env node
/**
 * Read-only audit of `guest_submissions` date fields (production-readiness docs 19/35).
 *
 *   node scripts/dev/audit-booking-dates.mjs                # linked project (read-only SQL)
 *   LOCAL=1 node scripts/dev/audit-booking-dates.mjs        # local Docker stack
 *
 * Mirrors the `valid_dates` CHECK added by 20261317120000_same_day_stay_dates.sql:
 *   - same-day stays are valid (day use, one occupied night)
 *   - both MM-DD-YYYY and YYYY-MM-DD are accepted (informational only)
 *   - check-out before check-in is a failure, except rows created before the 2025-06-01
 *     grandfather cutoff (41 legacy rows with no reliable repair)
 *
 * Exits non-zero only when a row created on/after the cutoff would break a fresh restore.
 */
import { execFileSync } from 'node:child_process';

const LOCAL = process.env.LOCAL === '1';
const sql = `
select
  count(*) as total,
  count(*) filter (where check_in_date !~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                     or check_out_date !~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$') as non_canonical_format,
  count(*) filter (where check_in_date ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                     and check_out_date ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                     and check_in_date = check_out_date) as same_day,
  count(*) filter (where check_in_date ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                     and check_out_date ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                     and to_date(check_out_date,'MM-DD-YYYY') < to_date(check_in_date,'MM-DD-YYYY')) as reversed,
  count(*) filter (where (check_in_date ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                     and check_out_date ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                     and to_date(check_out_date,'MM-DD-YYYY') < to_date(check_in_date,'MM-DD-YYYY'))
                     and created_at >= '2025-06-01') as reversed_since_cutoff
from public.guest_submissions;
`;

const args = [
  'supabase@latest',
  'db',
  'query',
  LOCAL ? '--local' : '--linked',
  LOCAL ? '' : '--read-only',
  sql,
].filter(Boolean);

const out = execFileSync('./scripts/dev/bunx', ['--bun', ...args], { encoding: 'utf8' });
const json = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
const [row] = json.rows ?? [];
if (!row) {
  console.error('audit-booking-dates: no rows returned');
  process.exit(1);
}
console.table([row]);

const blocking = Number(row.reversed_since_cutoff);
if (blocking > 0) {
  console.error(
    `\naudit-booking-dates: ${blocking}/${row.total} rows created on/after 2025-06-01 have ` +
      'check-out before check-in and would block a restore into a freshly migrated project.'
  );
  process.exit(1);
}

console.log(
  `\naudit-booking-dates: OK — ${row.total} rows restore cleanly ` +
    `(${row.reversed} pre-2025-06 reversed rows grandfathered, ` +
    `${row.same_day} same-day stays, ${row.non_canonical_format} non-canonical format).`
);
