-- 40-derived-rebuild.sql — post-upgrade derived state rebuild (idempotent).
-- Plan: docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md §2.5 / §5.7
--
-- 1. Sequences: bump every owned sequence past max(...) so new inserts cannot
--    collide with restored explicit ids.
-- 2. Search index: repopulate the trigger-maintained public_listing_search index
--    (triggers were created after the rows were restored, so fire them by
--    no-op-updating the base tables).

-- 1. sequences past max(id)
do $$
declare
  r record;
  maxv bigint;
begin
  for r in
    select
      c.relname as seq_name,
      format('%I.%I', tn.nspname, tc.relname) as tbl_ident,
      a.attname as col_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_depend d on d.objid = c.oid and d.deptype = 'a'
    join pg_class tc on tc.oid = d.refobjid
    join pg_namespace tn on tn.oid = tc.relnamespace
    join pg_attribute a on a.attrelid = tc.oid and a.attnum = d.refobjsubid
    where c.relkind = 'S' and n.nspname = 'public'
  loop
    execute format('select coalesce(max(%I), 0) from %s', r.col_name, r.tbl_ident) into maxv;
    if maxv > 0 then
      execute format('select setval(%L, %s, true)', format('public.%I', r.seq_name), maxv);
    end if;
  end loop;
  raise notice 'sequences: bumped past max id';
end $$;

-- 2. search index repopulation (no-op updates fire the AFTER UPDATE/INSERT triggers)
update public.properties set id = id;
update public.developments set id = id;
update public.parkings set id = id;
update public.app_settings set property_id = property_id;
update public.guest_reviews set property_id = property_id;
update public.guest_reviews set star_rating = star_rating;

-- informational
select 'public_listing_search rows' as check_name, count(*)::int as count
from public.public_listing_search;
