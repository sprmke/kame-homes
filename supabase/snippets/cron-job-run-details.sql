select runid, jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid in (1,2)
order by runid desc
limit 20;