# Adversarial auth live — hosted-dev — 2026-10-19

Command:

```
SUPABASE_URL=https://fworvijbrwpyngycotbz.supabase.co \
SUPABASE_ANON_KEY=… \
deno test --allow-net --allow-env supabase/functions/tests/adversarialAuthLive.test.ts
```

**16 passed, 0 failed** (~28s).

Includes: list-organizations/properties/parkings, list-bookings, super-admin-overview, dashboard-stats, malformed JWT, telegram-admin-cron and activity-log-retention-cron without secret, org-settings, list-organizations-admin, list-support-tickets-admin, list-support-tickets, list-activity-log, property-access, get-health positive control.
