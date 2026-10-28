-- 30-rewrite-storage-urls.sql — legacy URL rewrite across all public text/jsonb columns (idempotent).
-- Plan: docs/workflow/planned/legacy-prod-to-mt-prod-cutover.md §2.5.
--
-- Rewrites, in every BASE TABLE column of `public`:
--   http(s)://<legacy project ref>.supabase.co   → https://<target host>
--   https://www.kamehomes.space                  → <new origin>
--   https://kamehomes.space                      → <new origin>
--   https://app.kamehomes.space                  → <new origin>   (covers a stale plan-earlier default)
--
-- Replaces only rows that HAD a legacy URL (LIKE-guarded), so re-runs are no-ops.
-- __LEGACY_PROJECT_REF__ / __TARGET_HOST__ / __NEW_ORIGIN__ are substituted by migrate.sh
-- (psql :'vars' do not expand inside dollar-quoted DO bodies).

create or replace function pg_temp.legacy_rewrite_url(v text)
returns text
language plpgsql
as $fn$
declare
  legacy_ref text := '__LEGACY_PROJECT_REF__';
  storage_origin text := '__LEGACY_PROJECT_REF__' || '.supabase.co';
  new_storage_base text := 'https://__TARGET_HOST__';
  new_origin text := '__NEW_ORIGIN__';
begin
  if v is null then
    return null;
  end if;
  v := replace(v, 'http://' || storage_origin, new_storage_base);
  v := replace(v, 'http://' || legacy_ref, new_storage_base);
  v := replace(v, 'https://' || storage_origin, new_storage_base);
  v := replace(v, 'https://www.kamehomes.space', new_origin);
  v := replace(v, 'https://kamehomes.space', new_origin);
  v := replace(v, 'https://app.kamehomes.space', new_origin);
  return v;
end;
$fn$;

do $$
declare
  r record;
  changed bigint;
begin
  -- text / varchar columns
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying')
    order by c.table_name, c.column_name
  loop
    execute format(
      'update public.%I set %I = pg_temp.legacy_rewrite_url(%I)
        where %I is not null
          and (%I like %L or %I like %L or %I like %L or %I like %L)',
      r.table_name, r.column_name, r.column_name,
      r.column_name,
      r.column_name, '%zfttdwtceyqszyeyhilc.supabase.co%',
      r.column_name, '%//www.kamehomes.space%',
      r.column_name, '%//kamehomes.space%',
      r.column_name, '%//app.kamehomes.space%'
    );
    get diagnostics changed = row_count;
    if changed > 0 then
      raise notice 'rewrite %.% (text): % rows', r.table_name, r.column_name, changed;
    end if;
  end loop;

  -- jsonb columns (canonical round-trip; jsonb drops duplicate keys / key order by design)
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('jsonb', 'json')
    order by c.table_name, c.column_name
  loop
    execute format(
      'update public.%I set %I = pg_temp.legacy_rewrite_url((%I)::text)::jsonb
        where %I is not null
          and (%I::text like %L or %I::text like %L or %I::text like %L or %I::text like %L)',
      r.table_name, r.column_name, r.column_name,
      r.column_name,
      r.column_name, '%zfttdwtceyqszyeyhilc.supabase.co%',
      r.column_name, '%//www.kamehomes.space%',
      r.column_name, '%//kamehomes.space%',
      r.column_name, '%//app.kamehomes.space%'
    );
    get diagnostics changed = row_count;
    if changed > 0 then
      raise notice 'rewrite %.% (jsonb): % rows', r.table_name, r.column_name, changed;
    end if;
  end loop;

  drop function pg_temp.legacy_rewrite_url(text);
end $$;
