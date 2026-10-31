select
  runid,
  jobid,
  status,
  return_message,
  start_time,
  end_time
from cron.job_run_details
where jobid in (
  select jobid
  from cron.job
  where command ilike '%gmail-listener%'
     or command ilike '%sd-refund-cron%'
)
order by runid desc
limit 50;