-- 90-verify.sql — post-restore + post-upgrade invariants (READ-ONLY).
-- Plan: docs/workflow/planned/legacy-prod-to-mt-prod-cutover.md §5.7
--
-- Each check raises a NOTICE per block; the runner (verify.ts) treats a
-- returned failure row as terminal. Counts only — no PII.
--
-- Expected-by-contract parameters are passed via psql :vars where the caller
-- knows them (e.g. counts from the legacy inventory JSON).

-- V1. no guest_submissions without a property
select 'V1 orphans' as check,
       count(*)::int as failures
from public.guest_submissions
where property_id is null;

-- V2. all statuses in the canonical set (mirror of _shared/statusMachine.ts)
select 'V2 status-enum' as check,
       count(*)::int as failures
from public.guest_submissions
where status not in (
  'PENDING_REVIEW','PENDING_DOCUMENTS','PENDING_GAF','PENDING_PET_REQUEST',
  'PENDING_PARKING_REQUEST','READY_FOR_CHECKIN','READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND','COMPLETED','CANCELLED','IMPORTED'
);

-- V3. status distribution (informational — compare against legacy inventory)
select 'V3 statuses' as check_name, status, count(*)::int as count
from public.guest_submissions group by status order by count desc;

-- V4. future bookings present and blocking calendar logic
select 'V4 future-bookings' as check,
       count(*)::int as count
from public.guest_submissions
where (case
    when check_in_date ~ '^\d{2}-\d{2}-\d{4}$' then to_date(check_in_date, 'MM-DD-YYYY')
    when check_in_date ~ '^\d{4}-\d{2}-\d{2}$' then to_date(check_in_date, 'YYYY-MM-DD')
    else null
  end) >= current_date
  and status not in ('CANCELLED','IMPORTED');

-- V5. every guest_submissions references an existing property
select 'V5 property-fk' as check, count(*)::int as failures
from public.guest_submissions g
left join public.properties p on p.id = g.property_id
where g.property_id is not null and p.id is null;

-- V6. org/property shape (multi-tenancy backfill sanity)
select 'V6 shape' as check, count(*)::int as failures
from (
  select 1 as x
  where not exists (select 1 from public.organizations)
     or not exists (select 1 from public.properties where slug = 'monaco-2604')
) q;

-- V7. legacy host references remaining (pre-rewrite informational)
select 'V7 zftt-references (pre-rewrite)' as check,
       count(*)::int as count
from (
  select 1 as hit
  from public.guest_submissions
  where to_jsonb(guest_submissions)::text like '%zfttdwtceyqszyeyhilc%'
  limit 1
) q;

-- V8. app_settings rows now property-scoped
select 'V8 app-settings' as check, count(*)::int as failures
from public.app_settings
where property_id is null;

-- V9. org owner exists in auth.users
select 'V9 org-owner' as check, count(*)::int as failures
from public.organizations o
left join auth.users u on u.id = o.owner_id
where o.owner_id is null or u.id is null;

-- V10. migrated finance line items match legacy count (expects :legacy_finance_line_items)
select 'V10 finance-line-items' as check,
       (select count(*)::int from public.finance_line_items) as actual,
       coalesce((select nullif(:legacy_finance_line_items, '')::int), -1) as expected
where coalesce((select nullif(:legacy_finance_line_items, '')::int), 0) <> (select count(*) from public.finance_line_items);
