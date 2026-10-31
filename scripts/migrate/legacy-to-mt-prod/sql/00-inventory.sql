-- 00-inventory.sql — Phase 0.1 legacy row inventory (READ-ONLY)
-- Plan: docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md §5 Phase 0.1
--
-- Counts only; no PII columns are selected. Safe to run against the live
-- legacy Supabase project via the session pooler.
-- Executed by `bun scripts/migrate/legacy-to-mt-prod/inventory.ts`.
--
-- Outputs (as labeled result sets / JSON keys):
--   1. tables      — every table in `public` with exact row count
--   2. bookings_status — guest_submissions grouped by status
--   3. bookings_checkin_month — guest_submissions by check-in month (both MM-DD-YYYY and YYYY-MM-DD handled)
--   4. bookings_future — future check-ins (>= today, Asia/Manila)
--   5. auth — auth.users count, identities by provider
--   6. storage — storage.objects per bucket: count + total bytes
--   7. migrations  — supabase_migrations.schema_migrations version count + list
--   8. extensions  — installed extensions relevant to develop migrations

-- B 2: bookings by status
select status, count(*)::int as count
from public.guest_submissions
group by status
order by count desc;

-- B 3: bookings by check-in month. Legacy stores MM-DD-YYYY and newer rows
-- YYYY-MM-DD; normalize both, ignore unparseable.
select to_char(to_date(check_in_date, 'MM-DD-YYYY'), 'YYYY-MM') as month,
       count(*)::int as count
from public.guest_submissions
where check_in_date ~ '^\d{2}-\d{2}-\d{4}$'
group by 1

union all

select to_char(to_date(check_in_date, 'YYYY-MM-DD'), 'YYYY-MM') as month,
       count(*)::int as count
from public.guest_submissions
where check_in_date ~ '^\d{4}-\d{2}-\d{2}$'
group by 1
order by month;

-- B 4: future check-ins (today or later, Asia/Manila is UTC+8 → use (now() + interval '8 hours')::date)
select
  count(*) filter (where cast_parse >= (current_date))::int as future_bookings
from (
  select case
    when check_in_date ~ '^\d{2}-\d{2}-\d{4}$' then to_date(check_in_date, 'MM-DD-YYYY')
    when check_in_date ~ '^\d{4}-\d{2}-\d{2}$' then to_date(check_in_date, 'YYYY-MM-DD')
    else null end as cast_parse
  from public.guest_submissions
) s
where cast_parse is not null;

-- B 4b: future check-ins by status (feeds §6.3 in-flight handling at freeze)
select g.status, count(*)::int as count
from public.guest_submissions g
where case
    when g.check_in_date ~ '^\d{2}-\d{2}-\d{4}$' then to_date(g.check_in_date, 'MM-DD-YYYY')
    when g.check_in_date ~ '^\d{4}-\d{2}-\d{2}$' then to_date(g.check_in_date, 'YYYY-MM-DD')
    else null
  end >= (current_date)
group by g.status
order by count desc;

-- 1. tables: dynamic exact count of every public user table (temp function keeps this session-local)
create temp table temp_table_counts (table_name text, row_count bigint, size_bytes bigint);

do $$
declare
  t record;
  n bigint;
  sz bigint;
begin
  for t in
    select c.relname, c.oid
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')
  loop
    execute format('select count(*) from public.%I', t.relname) into n;
    sz := 0;
    begin
      select coalesce(sum(s.relpages), 0) * 8192 into sz
      from pg_class s where s.oid = t.oid;
    exception when others then
      sz := 0;
    end;
    insert into temp_table_counts values (t.relname, n, sz);
  end loop;
end $$;

select table_name, row_count, size_bytes from temp_table_counts order by table_name;

-- 5. auth
select count(*)::int as users from auth.users;
select provider, count(*)::int as identities from auth.identities group by provider order by 2 desc;

-- 6. storage buckets
select b.name as bucket,
       count(o.id)::int as objects,
       coalesce(sum(nullif(o.metadata->>'size','')::bigint), 0) as bytes
from storage.buckets b
left join storage.objects o on o.bucket_id = b.name
group by b.name
order by b.name;

-- 7. migration history
select count(*)::int as migration_count,
       min(version) as first_version,
       max(version) as last_version
from supabase_migrations.schema_migrations;

select version, name
from supabase_migrations.schema_migrations
order by version asc;

-- 8. extensions
select extname, extversion from pg_extension
where extname in ('pg_cron','pg_net','vault','pgcrypto','plpgsql','pgjwt','http','timescaledb','postgis','pg_stat_statements','pgsodium')
order by extname;
