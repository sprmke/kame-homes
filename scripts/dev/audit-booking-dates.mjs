#!/usr/bin/env node
/**
 * Read-only audit of `guest_submissions` date fields (production-readiness docs 19/35).
 *
 *   node scripts/dev/audit-booking-dates.mjs                # linked project (read-only SQL)
 *   LOCAL=1 node scripts/dev/audit-booking-dates.mjs        # local Docker stack
 *
 * Flags rows that would violate the repo's `valid_dates` constraint (MM-DD-YYYY and
 * check_out > check_in) so drift shows up before a restore drill fails on it.
 */
import { execFileSync } from 'node:child_process';

const LOCAL = process.env.LOCAL === '1';
const sql = `
select
  count(*) as total,
  count(*) filter (where check_in_date !~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                     or check_out_date !~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$') as bad_format,
  count(*) filter (where check_in_date ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                     and check_out_date ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                     and check_in_date = check_out_date) as same_day,
  count(*) filter (where check_in_date ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                     and check_out_date ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                     and to_date(check_out_date,'MM-DD-YYYY') < to_date(check_in_date,'MM-DD-YYYY')) as reversed
from public.guest_submissions;
`;

const args = ['supabase@latest', 'db', 'query', LOCAL ? '--local' : '--linked', LOCAL ? '' : '--read-only', sql]
  .filter(Boolean);

const out = execFileSync('./scripts/dev/bunx', ['--bun', ...args], { encoding: 'utf8' });
const json = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
const [row] = json.rows ?? [];
if (!row) {
  console.error('audit-booking-dates: no rows returned');
  process.exit(1);
}
console.table([row]);
const offenders = Number(row.bad_format) + Number(row.same_day) + Number(row.reversed);
if (offenders > 0) {
  console.error(
    `\naudit-booking-dates: ${offenders}/${row.total} rows would violate valid_dates ` +
      `(bad_format ${row.bad_format}, same_day ${row.same_day}, reversed ${row.reversed})`
  );
  process.exit(1);
}
console.log(`\naudit-booking-dates: OK — ${row.total} rows match valid_dates.`);
