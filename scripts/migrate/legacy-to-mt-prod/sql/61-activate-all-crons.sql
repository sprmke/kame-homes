-- 61-activate-all-crons.sql — T0 step: turn on every scheduled job after the
-- legacy crons are unscheduled (05-legacy-freeze.sql) and the new stack owns
-- guest traffic.
--
-- Idempotent: safe to re-run. Use after 60-install-extensions-and-crons.sql.
-- Plan: docs/workflow/in-progress/kamespace-02-legacy-prod-to-mt-prod-cutover.md
--       §8 T0 step 3 and step 5

do $$
declare
  r record;
begin
  for r in select jobid from cron.job loop
    perform cron.alter_job(r.jobid, active => true);
  end loop;
end $$;

select jobname, schedule, active from cron.job order by jobname;
