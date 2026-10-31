# SQL snippets

Reference SQL for **hosted Supabase** (`pg_cron` / `pg_net`) — not migrations.

| File                            | Purpose                                  |
| ------------------------------- | ---------------------------------------- |
| `telegram-marketing-cron.sql`   | Legacy marketing cron bootstrap          |
| `telegram-staff-cron.sql`       | Staff daily summary cron                 |
| `telegram-admin-cron.sql`       | Admin notify cron                        |
| `local-scheduled-jobs.sql`      | Local Docker: Gmail + SD refund every 5m |
| `cron-job-run-details.sql`      | Inspect recent cron runs                 |
| `cron-gmail-sd-run-details.sql` | Inspect Gmail / SD cron runs             |

Prefer migrations + admin UI for production. See **`docs/archive/operations/scheduled-jobs-and-testing.md`**.
