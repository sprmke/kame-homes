-- 30-rewrite-storage-urls.sql — zftt host + legacy origin rewrite (idempotent).
-- Plan: docs/workflow/planned/legacy-prod-to-mt-prod-cutover.md §2.5
--
-- Scans every text/jsonb column in `public` and rewrites:
--   http(s)://<legacy ref>.supabase.co → https://<target host>
--   https://www.kamehomes.space        → <new origin>
--   https://kamehomes.space            → <new origin>
-- Prints a changed-row NOTICE per column; only rows that had a legacy URL count.
--
-- __LEGACY_PROJECT_REF__ / __TARGET_HOST__ / __NEW_ORIGIN__ are substituted by
-- migrate.sh (psql :'vars' do not expand inside dollar-quoted DO bodies), and
-- handling keeps every quote/percent literal as a %L/format-safe argument so
-- the DO body itself contains no hand-escaped quotes.

do $$
declare
  legacy_http   text := '__LEGACY_PROJECT_REF__';
  storage_base  text := 'https://__TARGET_HOST__';
  origin_www    text := 'https://www.kamehomes.space';
  origin_apex   text := 'https://kamehomes.space';
  new_origin    text := '__NEW_ORIGIN__';
  pat_storage_http  text;
  pat_storage_bare  text;
  pat_www           text;
  pat_apex          text;
  r record;
  changed bigint;
begin
  pat_storage_http := '%' || 'http://' || legacy_http || '%';
  pat_storage_bare := '%' || legacy_http || '%';
  pat_www := '%' || origin_www || '%';
  pat_apex := '%' || origin_apex || '%';

  -- text / varchar columns: in-place replace()
  for r in
    select c.table_name as tbl, c.column_name as col,
           c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying')
    order by c.table_name, c.column_name
  loop
    execute format(
      'update public.%I set %I = replace(replace(replace(replace(
        %I
          , %L, %L)
          , %L, %L)
          , %L, %L)
        , %L, %L)
       where %I is not null
         and (%I like %L or %I like %L or %I like %L or %I like %L)',
      r.table_name, r.column_name, r.column_name,
      'http://' || legacy_http, storage_base,
      legacy_http, storage_base,
      origin_www, new_origin,
      origin_apex, new_origin,
      r.column_name,
      r.column_name, pat_storage_http,
      r.column_name, pat_storage_bare,
      r.column_name, pat_www,
      r.column_name, pat_apex
    );
    get diagnostics changed = row_count;
    if changed > 0 then
      raise notice 'rewrite %.% (text): % rows', r.table_name, r.column_name, changed;
    end if;
  end loop;

  -- jsonb columns: canonical round-trip (jsonb drops duplicate keys / key order by design)
  for r in
    select c.table_name as tbl, c.column_name as col,
           c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('jsonb', 'json')
    order by c.table_name, c.column_name
  loop
    execute format(
      'update public.%I set %I = replace(replace(replace(replace(
        (%I)::text
          , %L, %L)
          , %L, %L)
          , %L, %L)
        , %L, %L)::jsonb
       where %I is not null
         and (%I::text like %L or %I::text like %L or %I::text like %L or %I::text like %L)',
      r.table_name, r.column_name, r.column_name,
      'http://' || legacy_http, storage_base,
      legacy_http, storage_base,
      origin_www, new_origin,
      origin_apex, new_origin,
      r.column_name,
      r.column_name, pat_storage_http,
      r.column_name, pat_storage_bare,
      r.column_name, pat_www,
      r.column_name, pat_apex
    );
    get diagnostics changed = row_count;
    if changed > 0 then
      raise notice 'rewrite %.% (jsonb): % rows', r.table_name, r.column_name, changed;
    end if;
  end loop;
end $$;
