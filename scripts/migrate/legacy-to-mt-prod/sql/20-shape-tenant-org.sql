-- 20-shape-kame-homes.sql — tenant shaping after the develop upgrade (idempotent, slug-keyed).
-- Plan: docs/workflow/planned/legacy-prod-to-mt-prod-cutover.md §5 Phase 3.
--
-- Owner-confirmed decisions (2026-10-25):
--   org name/slug   = "Kame Homes" / "kame-homes"   (§12.1 — supersedes the rebrand
--                     plan's Q1 note; the Kame Space rename is a later plan's job)
--   owner email     = kamehome.azurenorth@gmail.com (§3.2 assert, never "oldest user")
--   plan            = comped managed (§3.5, price snapshot 0)
--   parking         = booking add-on only (§12b todo covers the vertical question)
--
-- psql vars (set by the `shape` stage of migrate.sh):
--   :admin_emails — CSV of emails to seat on the org team (owner auto-skipped);
--                    sourced from ADMIN_ALLOWED_EMAILS in supabase/.env.prod.local.
--   :cutover_at   — ISO timestamp set at the real T0; leave unset in rehearsals
--                   so the watermark stays NULL.
--
-- Runs only against the rehearsal/mt-prod target (guard_not_legacy refuses legacy).

begin;

-- ── 3.1 org: rename to final brand + slug + logo + description ──────────────

update public.organizations o
set name        = 'Kame Homes',
    slug        = 'kame-homes',
    description = coalesce(o.description, 'Kame Homes — hosts for the Azure North residences.'),
    logo_url    = coalesce(o.logo_url, a.email_logo_url),
    updated_at  = now()
from public.app_settings a
where o.slug in ('kame-home', 'kame-home-')
  and a.property_id = (select id from public.properties where slug in ('monaco-2604', 'kame-home'));

-- no-op when already shaped; also catches a name-only legacy state
update public.organizations
set name = 'Kame Homes', slug = 'kame-homes', updated_at = now()
where name in ('Kame Home', 'KAME HOME') or slug in ('kame-home', 'kame_home');

-- ── 3.2 owner assert: never silently accept the backfill "oldest user" fallback ──

do $$
declare
  owner_ok int;
begin
  select count(*)::int into owner_ok
  from public.organizations o
  join auth.users u on u.id = o.owner_id
  where o.slug = 'kame-homes'
    and lower(u.email) = lower('kamehome.azurenorth@gmail.com');

  if owner_ok = 0 then
    raise exception
      'shape: org kame-homes is not owned by the expected owner email — inspect organizations.owner_id before continuing (plan §3.2)';
  end if;
end $$;

-- ── 3.3 property: house rules stay in legacy app_settings (property-scoped);
--       ensure the plain columns + minimum settings are right. ────────────────

-- Final tenant shape: Kame Home / kame-home (owner-confirmed 2026-11-03).
update public.properties
set slug            = 'kame-home',
    name            = 'Kame Home',
    status          = 'ACTIVE',
    max_guests      = coalesce(max_guests, 6),
    tower           = coalesce(tower, 'Monaco'),
    unit_number     = coalesce(nullif(trim(unit_number), ''), '2604'),
    tower_and_unit  = coalesce(nullif(trim(tower_and_unit), ''), 'Monaco 2604'),
    residence_name  = case
                        when lower(trim(coalesce(residence_name, ''))) in ('', 'azure north')
                          then 'Azure North Residences'
                        else residence_name
                      end,
    type            = coalesce(type, 'CONDO'),
    settings        = settings || '{
      "checkInWindow": "14:00",
      "checkOutWindow": "11:00",
      "houseRules": "No smoking indoors. Keep bicycle/parking area clear. Quiet hours 22:00–06:00."
    }'::jsonb,
    updated_at = now()
where slug in ('monaco-2604', 'kame-home');

-- ── 3.4 team: seat every ADMIN_ALLOWED_EMAILS member (owner excluded) ────────

insert into public.organization_members (organization_id, user_id, role_id, status, invited_by)
select o.id, u.id, 'ADMIN', 'active', o.owner_id
from public.organizations o
join auth.users u on u.id != o.owner_id
where o.slug = 'kame-homes'
  and lower(u.email) in (
    select trim(lower(tok))
    from unnest(string_to_array(coalesce(:'admin_emails', ''), ',')) as tok
    where trim(tok) <> ''
  )
on conflict do nothing;

-- ── 3.5 comped managed plan via org_subscriptions (price snapshot 0) ─────────

insert into public.org_subscriptions (
  organization_id, plan_id, pricing_model, price_php_snapshot,
  status, current_period_start, current_period_end, source
)
select o.id, pl.id, 'subscription', 0, 'active', now(), now() + interval '1 year', 'admin'
from public.organizations o
join public.pricing_plans pl on pl.code = 'managed'
where o.slug = 'kame-homes'
  and not exists (
    select 1 from public.org_subscriptions os
    where os.organization_id = o.id and os.status in ('active', 'trialing')
  );

-- ── verification: approve the tenant (super-admin posture) ───────────────────

update public.organizations
set settings = settings || '{
  "verification": {
    "baseStatus": "approved",
    "enhancedStatus": "approved"
  }
}'::jsonb
where slug = 'kame-homes';

-- ── cutover watermark (set at the real T0; rehearsal leaves it untouched) ────

do $$
declare
  v text;
begin
  v := coalesce(current_setting('cutover_at', true), '');
  if trim(v) <> '' then
    update public.platform_settings
    set migration_cutover_at = v::timestamptz
    where id = 1;
  end if;
end $$;

-- ── activity trail: one 'org.migrated_from_legacy' row per org ───────────────

insert into public.activity_log (
  organization_id, scope, actor_type, actor_display_name, actor_role,
  action, category, severity, target_type, target_id, target_label, summary, changes, source
)
select o.id, 'org', 'system', 'Migration', 'system',
       'org.migrated_from_legacy', 'organization', 'info',
       'organization', o.id::text, o.name,
       'Tenant migrated from legacy production.',
       jsonb_build_object('legacy_project_ref', 'zfttdwtceyqszyeyhilc',
                          'owner_email_confirmed', true,
                          'slug_from', 'kame-home', 'slug_to', 'kame-homes'),
       'cron'
from public.organizations o
where o.slug = 'kame-homes'
  and not exists (
    select 1 from public.activity_log al
    where al.organization_id = o.id and al.action = 'org.migrated_from_legacy'
  );

commit;
