-- 05-legacy-freeze.sql — run on LEGACY (zftt…) at T0 start (kamewave). Records freeze time.
-- Plan: kamespace-02 §8 step 3. Unschedule legacy pg_cron jobs so mt-prod crons do not duplicate.

-- Record freeze (idempotent table if missing)
create table if not exists public._legacy_cutover_meta (
  id text primary key default 'default',
  frozen_at timestamptz not null default now()
);

insert into public._legacy_cutover_meta (id, frozen_at)
values ('default', now())
on conflict (id) do update set frozen_at = excluded.frozen_at;

-- Unschedule all legacy cron jobs (names vary; unschedule by jobid is safest)
do $$
declare r record;
begin
  for r in select jobid from cron.job loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

select 'legacy-freeze' as step, count(*)::int as remaining_cron_jobs from cron.job;
