---
title: 'Scheduled jobs (cron) and how to test them'
status: active
tags: [operations]
updated: 2026-08-02
---

# Scheduled jobs (cron) and how to test them

This document explains **how automation is scheduled** for the new booking flow (Phase 4), what each job does at a low level, and **how to test** everything safely on **local Supabase** and on **Supabase Cloud**.

Related canonical references:

- [[NEW_FLOW_PLAN|New Booking Flow — Implementation Plan]] — product intent, Phase 4 notes, Q6.6 manual triggers
- `.cursor/rules/booking-workflow.mdc` — status machine and side-effect matrix
- `supabase/config.toml` — `verify_jwt` and why `schedule` is not committed for local CLI
- Implementations: `supabase/functions/gmail-listener/index.ts`, `supabase/functions/gmail-backfill-approvals/index.ts`, `supabase/functions/sd-refund-cron/index.ts`, `supabase/functions/telegram-marketing-cron/index.ts`
- Admin manual triggers: `ui/src/features/dashboard/bookings/hooks/useTransitionBooking.ts` (`useRunGmailPoll`, `useRunSdRefundCron`) and `ui/src/features/dashboard/bookings/components/WorkflowPanel.tsx`

---

## 1. What is scheduled in this project?

There are Edge Functions meant to run on a **recurring schedule** in production (Gmail + SD refund + parking broadcast expire run **every ~5 minutes**; Telegram marketing runs **3× per day** in Asia/Manila; contract expiry runs **daily**):

| Job                          | Edge function                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gmail approval listener**  | `gmail-listener`                 | Poll Gmail for Azure replies whose PDF attachment normalizes to **`approvedgaf.pdf`** (spaces, underscores, and hyphens in the filename are ignored), match them to a booking in **`PENDING_DOCUMENTS` / `PENDING_GAF`** (or pet statuses for pet), upload the PDF to Storage, then call **`WorkflowOrchestrator.transition()`** (same path as admin transitions). **After each poll**, reconciles **`PENDING_DOCUMENTS`** rows with **`gaf_manual_incomplete` / `pet_manual_incomplete`** but an existing **`approved_*_pdf_url`** (admin marked sub-step incomplete; original Gmail message is already in **`processed_emails`**).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **SD refund cron**           | `sd-refund-cron`                 | **Global** (`POST` with empty/`{}` body): every **`READY_FOR_CHECKIN`** row whose Manila check-out is within the **lead** window (**`SD_REFUND_CRON_EMAIL_LEAD_MINUTES`**, default **120** min before check-out): sends the guest **Check-out & SD Refund** email if not already sent (**independent** of balance settlement). **Status** → **`READY_FOR_CHECKOUT`** only when **settlement** is complete (orchestrator). **Scoped** (`POST` JSON `{ "bookingId" }` + **admin JWT**): same rules for **one** id. **Stale check-outs:** automated guest email is **not** sent when check-out is older than **`SD_REFUND_CRON_MAX_CHECKOUT_AGE_DAYS`** (default **30**; **`0`** = never suppress); transition + calendar + sheet still run when settlement is met.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Telegram marketing**       | `telegram-marketing-cron`        | **Global** `POST` **`{}`**: sends **default** or **urgency** Telegram copy from **`telegram_marketing_settings`** using the same single-property availability model as marketing (see **[[telegram-marketing-reminders]]**). **Schedule:** Manila **10:00 / 15:00 / 21:00** → UTC cron **`0 2,7,13 * * *`**. Optional header **`X-Telegram-Cron-Secret`** when Edge secret **`TELEGRAM_CRON_SECRET`** is set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Contract expiry**          | `contract-expiry-cron`           | **Global** `POST` **`{}`**: Unit handoff Phase B — T−15/T−7/T−1 owner notices, T+0 listing `INACTIVE`, T+3 grace reminder, T+5 access lock, grant-expiry revoke. State in **`organizations.settings.verification.{property\|parking}Lifecycle`**. **Scheduled via `public.sync_contract_expiry_cron_job()`** (migration **`20261316121300_contract_expiry_cron_schedule.sql`**) — job `contract-expiry-daily-manila`, daily **`0 1 * * *`** UTC (09:00 Asia/Manila). Hosted environments require matching Edge **`CONTRACT_EXPIRY_CRON_SECRET`** and Vault **`contract_expiry_cron_secret`** values; the sync function fails closed and does not schedule until `project_url`, `anon_key`, and that secret exist. Re-run `SELECT public.sync_contract_expiry_cron_job();` after configuring Vault. The function emits a `system.cron_run` activity summary; inspect failed runs and `cron.job_run_details` during incident triage.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Superhost assessment**     | `superhost-assessment-cron`      | **Global** `POST` **`{}`**: quarterly org Superhost evaluation (Jan/Apr/Jul/Oct 1 Asia/Manila; no-op on other days). Patches **`organizations.settings.superhost`**, logs **`superhost_assessment_runs`**, emails owner on earn/lose. Inbox response metrics from **`inbox_thread_metrics`** (upserted on guest inbound / host reply). Optional **`SUPERHOST_ASSESSMENT_CRON_SECRET`** / header **`X-Superhost-Assessment-Cron-Secret`**. Snippet: **`supabase/snippets/superhost-assessment-cron.sql`**. **Scheduled via `public.sync_superhost_assessment_cron_job()`** (migration **`20261231130200_superhost_assessment_cron.sql`**) — job `superhost-assessment-quarterly-manila`, daily **`0 16 * * *`** UTC. Super-admin manual: **`reassess-org-superhost`** or **Org subscriptions → Run Superhost cron / Reassess**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Parking broadcast expire** | `expire-parking-broadcasts`      | **Global** `POST` **`{}`**: sweeps `guest_submissions` in **`PENDING_HOST_ACCEPTANCE`** past `parking_broadcast_expires_at` (TTL: 15 min same-day check-in / 1 hr advance, Asia/Manila) to **`NO_HOST_AVAILABLE`**, marks pending `parking_booking_broadcasts` rows `expired`, and emails the guest once (guarded `UPDATE ... WHERE status = 'PENDING_HOST_ACCEPTANCE'` makes re-runs idempotent). Optional **`PARKING_BROADCAST_EXPIRE_CRON_SECRET`** / header **`X-Parking-Broadcast-Expire-Cron-Secret`**. **Scheduled via `public.sync_parking_broadcast_expire_cron_job()`** (migration `20261018120000_parking_broadcast_expire_cron.sql`, mirrors `sync_telegram_maintenance_hourly_cron_job()`) — job name `parking-broadcast-expire-every-5m`, every 5 min. The migration self-invokes the sync function, so once Vault has `project_url` + `anon_key` (§11.3) and the migration is deployed, the job activates automatically; on environments without Vault/pg_cron (e.g. a fresh local `db reset`) the call safely no-ops (`{ok:false, error}`). To (re)activate manually after Vault secrets change, run `SELECT public.sync_parking_broadcast_expire_cron_job();` in the SQL editor. Legacy manual-copy-paste snippet (kept for reference only): **`supabase/snippets/parking-broadcast-expire-cron.sql`**.                                                                      |
| **Meta webhook healthcheck** | `meta-inbox-webhook-healthcheck` | **Global** `POST` **`{}`**: verifies each connected Facebook Page still has this app subscribed to the expected webhook fields, re-subscribes dropped hooks in place, and records `webhook_last_verified_at` / `webhook_verify_attempts` on `social_channel_connections` without deleting conversations. Optional **`META_INBOX_WEBHOOK_HEALTHCHECK_CRON_SECRET`** / header **`X-Meta-Inbox-Webhook-Healthcheck-Cron-Secret`**. **Scheduled via `public.sync_meta_inbox_webhook_healthcheck_cron_job()`** (migration `20261101120000_meta_inbox_webhook_health.sql`) — job name `meta-inbox-webhook-healthcheck-every-10m`, every 10 min. The migration self-invokes the sync function, so once Vault has `project_url` + `anon_key` (and optionally `meta_inbox_webhook_healthcheck_cron_secret`) the job activates automatically; on environments without Vault/pg_cron it safely returns `{ok:false, error}`. Re-run `SELECT public.sync_meta_inbox_webhook_healthcheck_cron_job();` after changing Vault secrets.                                                                                                                                                                                                                                                                                                                                                                         |
| **Calendar sync**            | `calendar-sync-cron`             | **Global** `POST` **`{}`**: pulls every active **`property_calendar_feeds`** row whose org has the `calendarSync` entitlement (`loadDueCalendarFeeds(100)`, oldest `last_attempted_at` first, ~55 s budget) — fetch `.ics` → parse → `diffFeed` → apply `property_blocked_dates` `source='ical_import'` create/reschedule/touch/remove → conflict pass → persist feed poll-state + **`calendar_sync_events`**. Emits `calendar_sync_failing` at `consecutive_failures = 4` and `calendar_conflict` on overlap with a live booking / manual block. Reservation promotion (`create_bookings`) is Phase 2. Optional **`CALENDAR_SYNC_CRON_SECRET`** / header **`X-Calendar-Sync-Cron-Secret`**. **Scheduled via `public.sync_calendar_sync_cron_job()`** (migration `20261213120500_calendar_sync_cron.sql`) — job name `calendar-sync-every-30m`, `*/30 * * * *`. Self-invoking (same Vault `project_url` + `anon_key` pattern as parking broadcast expire; safe no-op without Vault/pg_cron). Re-run `SELECT public.sync_calendar_sync_cron_job();` after changing Vault secrets. Host **Sync now** hits `POST /functions/v1/calendar-sync-cron/{feedId}` with a session JWT (scoped, `pricing.channels:edit` + `calendarSync`).                                                                                                                                                               |
| **Smart Pricing autopilot**  | `smart-pricing-cron`             | **Global** `POST` **`{}`**: sweeps **`property_smart_pricing_settings`** rows with **`enabled = true` AND `mode = 'autopilot'`** (`limit 100`, oldest `last_run_at` first, ~55 s budget). Per property: skip unless `resolvePropertyEntitlements().smartPricing`; recompute the forward window via **`_shared/smartPricingRun.ts#computeSmartPricingForProperty`** (settings + `loadPropertyPricing` + learned history from `guest_submissions`) → `runAutopilotForProperty` replaces **`property_smart_pricing_recommendations`** (`applied=true`) + logs a `cron` **`property_smart_pricing_runs`** row. Optional weekly **`smart_pricing` AI rationale pass** when `ai_rationale_enabled` (throttled ≥ 6 days via last `ai_used` run). Material change (≥ 5 nights changed **or** abs avg Δ ≥ 3%) raises one `smart_pricing_updated` notification, deduped `smart_pricing:<propertyId>:<manila-date>`. Optional **`SMART_PRICING_CRON_SECRET`** / header **`X-Smart-Pricing-Cron-Secret`**. **Scheduled via `public.sync_smart_pricing_cron_job()`** (migration **`20261305120500_smart_pricing_cron.sql`**) — job name `smart-pricing-autopilot-nightly`, **`30 17 * * *`** UTC (01:30 Asia/Manila). Self-invoking (same Vault `project_url` + `anon_key` pattern); safe no-op without Vault/pg_cron. Re-run `SELECT public.sync_smart_pricing_cron_job();` after changing Vault secrets. |
| **Analytics AI review**      | `analytics-ai-review-cron`       | **Global** `POST` **`{}`**: weekly sweep, oldest-reviewed-first (`limit 50`, ~55 s budget) over **`ACTIVE`** properties with a live **`analyticsInsights`** entitlement and enough booking history (`sufficiency.enough`). Regenerates the AI Performance Review (**`_shared/analyticsAiReview.ts`**, Gemini `host_analytics` feature) grounded in the last-30-day **`AnalyticsBundle`** + recent **`activity_log`** evidence, writes **`property_analytics_reviews`** (`is_latest` flip). Notifies **`analytics_review_updated`** (deduped `analytics_review:<propertyId>:<manila-date>`) when the score moves **≥ 8 points**. Optional **`ANALYTICS_AI_REVIEW_CRON_SECRET`** / header **`X-Analytics-Ai-Review-Cron-Secret`**. **Scheduled via `public.sync_analytics_ai_review_cron_job()`** (migration **`20261311120000_analytics_ai_review_cron.sql`**) — job `analytics-ai-review-weekly-manila`, **`0 16 * * 0`** UTC (Monday 00:00 Asia/Manila). Self-invoking (same Vault `project_url` + `anon_key` pattern); safe no-op without Vault/pg_cron. Re-run `SELECT public.sync_analytics_ai_review_cron_job();` after changing Vault secrets. Host on-demand: **`analytics-ai-review`** POST (1/hour/property).                                                                                                                                                                        |
| **Analytics pageview prune** | `property-page-views-prune-cron` | **Global** `POST` **`{}`**: monthly retention prune for **`property_page_views`** (high-volume append-only Host Analytics pageview log) — deletes rows with `viewed_at` older than **180 days** in bounded 5,000-row batches, capped at 20 batches per run (100k rows; a large backlog continues next month). Optional **`PROPERTY_PAGE_VIEWS_PRUNE_CRON_SECRET`** / header **`X-Property-Page-Views-Prune-Cron-Secret`**. **Scheduled via `public.sync_property_page_views_prune_cron_job()`** (migration **`20261313120000_property_page_views_prune_cron.sql`**) — job `property-page-views-prune-monthly-manila`, **`0 17 1 * *`** UTC (01:00 Asia/Manila on the 2nd). Self-invoking (same Vault `project_url` + `anon_key` pattern); safe no-op without Vault/pg_cron. Re-run `SELECT public.sync_property_page_views_prune_cron_job();` after changing Vault secrets.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Activity log retention**   | `activity-log-retention-cron`    | **Global** `POST` **`{}`**: monthly retention purge for **`activity_log`** (append-only org activity / audit timeline) — reads **`platform_settings.activity_log_retention_months`** (default **24**, floor 6), calls **`purge_activity_log(months, 200000)`** which sets the `activity_log.allow_purge` GUC (the append-only trigger's only escape hatch) and batch-deletes rows past the window (5,000/batch, 200k cap/run). Optional **`ACTIVITY_LOG_RETENTION_CRON_SECRET`** / header **`X-Activity-Log-Retention-Cron-Secret`**. **Scheduled via `public.sync_activity_log_retention_cron_job()`** (migration **`20261315120200_activity_log_retention_cron.sql`**) — job `activity-log-retention-monthly-manila`, **`0 18 1 * *`** UTC (02:00 Asia/Manila on the 2nd; offset from the pageview prune at 17:00 UTC). Self-invoking (same Vault `project_url` + `anon_key` pattern); safe no-op without Vault/pg_cron. Re-run `SELECT public.sync_activity_log_retention_cron_job();` after changing Vault secrets.                                                                                                                                                                                                                                                                                                                                                                       |
| **Marketing AI video sweep** | `marketing-generation-sweeper`   | **Global** `POST` **`{}`**: every-minute sweep for in-flight AI-generated video jobs (`marketing_generation_jobs`) — reclaims stale `finalizing` claims (>2min), re-polls + finalizes `processing` Veo operations due for a check (>10s since last poll), fails jobs past `expires_at` (no charge), repairs `completed` rows whose usage write never landed (>5min), prunes reference uploads unused for 90 days. Optional **`MARKETING_GENERATION_CRON_SECRET`** / header **`X-Marketing-Generation-Cron-Secret`**. **Scheduled via `public.sync_marketing_generation_cron_job()`** (migration **`20261316120300_marketing_generation_cron.sql`**) — job `marketing-generation-sweeper-every-1m`, **`* * * * *`**. Self-invoking; safe no-op without Vault/pg_cron. Re-run `SELECT public.sync_marketing_generation_cron_job();` after changing Vault secrets. Local test: `curl -X POST http://127.0.0.1:54321/functions/v1/marketing-generation-sweeper -H 'X-Marketing-Generation-Cron-Secret: <secret>'` (or no header if the secret env var is unset locally).                                                                                                                                                                                                                                                                                                                          |
| **Platform billing**         | `platform-billing-cron`          | **Global** `POST` **`{}`**: org subscription dunning (billing is org-level only) — creates renewal Payment Links **`renewal_link_lead_days`** before **`current_period_end`**, marks unpaid subscriptions **`past_due`** at period end, **`suspended`** after grace period (clawing back pooled team seats), sends Resend reminder/receipt emails via **`subscriptionOrchestrator`**. Free/default plans excluded. Optional **`PLATFORM_BILLING_CRON_SECRET`** / header **`X-Platform-Billing-Cron-Secret`**. **Scheduled via `public.sync_platform_billing_cron_job()`** (migration **`20261024140000_platform_billing_cron.sql`**, daily **`0 6 * * *`** UTC). Super-admin manual trigger: **Org subscriptions** page **Run billing cron** or **`org-subscriptions-admin`** PATCH **`{ action: "run_billing_cron" }`**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Query cache sweep**        | `query-cache-sweep-cron`         | **Global** `POST` **`{}`**: deletes expired rows from **`query_cache`** (doc 12, Phase 12.3's DB-backed read-through cache for expensive per-request aggregates — currently wired only into **`dashboard-stats`**) via **`_shared/queryCache.ts#sweepExpiredCacheRows`**, keeping the cache table itself from becoming the next unbounded table. Optional **`QUERY_CACHE_SWEEP_CRON_SECRET`** / header **`X-Query-Cache-Sweep-Cron-Secret`**. **Scheduled via `public.sync_query_cache_sweep_cron_job()`** (migration **`20261316121700_query_cache_table.sql`**) — job `query-cache-sweep-nightly`, **`17 2 * * *`** UTC (10:17 Asia/Manila). Self-invoking (same Vault `project_url` + `anon_key` pattern); safe no-op without Vault/pg_cron. Re-run `SELECT public.sync_query_cache_sweep_cron_job();` after changing Vault secrets. Cache invalidation on write is separate — see `_shared/workflowOrchestrator.ts`'s `purgeCacheByScope` calls, not this cron.                                                                                                                                                                                                                                                                                                                                                                                                                           |

The Gmail and SD jobs defer to **`WorkflowOrchestrator`**; Telegram does **not** touch booking state.

### 1.0b Trigger-driven (not scheduled): `push-fanout`

`push-fanout` uses the same **Vault + `pg_net`** plumbing but is fired by `AFTER INSERT` + guarded `AFTER UPDATE` triggers on `public.notifications` (`trg_notifications_push_fanout_ins` / `_upd` → `notify_push_fanout()`), not `pg_cron`. Migrations `20261303120100_push_fanout_trigger.sql` + `20261303120300_push_fanout_on_coalesce.sql` (triggers) + `20261303120000_push_subscriptions.sql` (table). Needs Vault secrets **`project_url`**, **`anon_key`** (shared with the crons above) and **`push_fanout_secret`** (= the Supabase Edge secret `PUSH_FANOUT_SECRET`, sent as header `X-Push-Fanout-Secret`). Also set Edge secrets `VAPID_KEYS` + `VAPID_SUBJECT`. Non-fatal: `notify_push_fanout()` has `EXCEPTION WHEN OTHERS THEN RETURN NEW`, and on any environment without pg_net/Vault the trigger is a silent no-op. See [`../../architecture/pwa.md`](../../architecture/pwa.md) §5.

### 1.1 One-time historical approval backfill (`gmail-backfill-approvals`)

**Not scheduled.** This is an **admin-only** `POST` (`verifyAdminJwt`) used once (or in small batches) after Gmail is connected, so older Azure approval threads are recovered **without** turning the listener into a full-inbox scanner.

**Recommended order**

1. Deploy Edge Functions and complete **Connect Gmail** (or legacy `GMAIL_OAUTH_*` secrets) so `getGmailAccessTokenUnified()` works.
2. Run **`gmail-listener`** once (admin “Run Gmail poll” or curl). That initializes **`gmail_listener_state.history_id`** at the **current** mailbox cursor so ongoing cron only sees **new** mail.
3. Run **`gmail-backfill-approvals`** with defaults (`dryRun: true`) from an admin session; inspect JSON `results`.
4. Re-run with **`dryRun: false`** in conservative batches (`limitBookings`, `maxMessagesPerKind`, `lookbackDays` in the JSON body). Repeat until `no_match` / `would_apply` counts stabilize.
5. Enable **`pg_cron`** for **`gmail-listener`** only after backfill (or in parallel—backfill uses **Gmail `messages.list` search**, not `historyId`, so it does not fight the cursor).

**Body (all optional)**

| Field                | Default    | Notes                                                                                  |
| -------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `dryRun`             | **`true`** | When true, only reports `would_apply` / `no_match`; no Storage or orchestrator writes. |
| `lookbackDays`       | `180`      | Passed into Gmail `newer_than:` (max 3650).                                            |
| `limitBookings`      | `60`       | Candidate rows from DB (max 300).                                                      |
| `maxMessagesPerKind` | `6`        | Cap per booking task per Gmail search (max 20).                                        |

**Candidate bookings:** `PENDING_DOCUMENTS`, `PENDING_GAF`, `PENDING_PET_REQUEST` — same URL + attachment rules as **`gmail-listener`**. Rows missing only pet when `has_pets` is false are skipped. **`processed_emails`** dedupes by `message_id` so reruns are safe.

**curl (local, dry run)**

```bash
curl -sS -X POST "${SUPABASE_URL}/functions/v1/gmail-backfill-approvals" \
  -H "Authorization: Bearer ${ADMIN_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'
```

Replace `dryRun` with `false` when ready to apply. Use a **service** admin JWT from the same allow list as `/bookings`.

---

## 2. How Supabase scheduling works (hosted platform)

On **Supabase Cloud**, recurring invocations are implemented with **Postgres extensions**, not by “magic” inside the Edge runtime:

1. **`pg_cron`** — runs a SQL snippet on a cron expression (e.g. `*/5 * * * *` = every 5 minutes).
2. **`pg_net`** — performs an **HTTP POST** from the database to your Edge Function URL.
3. **Vault (recommended)** — stores secrets such as project URL and the key used in the `Authorization` header for the HTTP call.

Official guide: [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).

Typical pattern (simplified from Supabase docs):

- Store `https://<project-ref>.supabase.co` and your **`anon` key** (or another key your gateway accepts) in Vault.
- Schedule a job that runs:

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
         || '/functions/v1/sd-refund-cron',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
  ),
  body := '{}'::jsonb
);
```

Repeat with `/functions/v1/gmail-listener` for the second job (either two `cron.schedule` names or one job that calls both sequentially—your choice). Add a third job for **`/functions/v1/telegram-marketing-cron`** on **`0 2,7,13 * * *`** (Manila 10:00 / 15:00 / 21:00); see **`supabase/snippets/telegram-marketing-cron.sql`** and **[[telegram-marketing-reminders|Telegram marketing reminders]]**.

**Important:** The HTTP call is a **normal** request to the **public** Functions URL. Security is layered as:

- Kong / Edge gateway **`verify_jwt`** setting for that function (see §4).
- Optional **custom checks** inside the function body (this repo’s scheduled functions **do not** call `verifyAdminJwt`; see §4).

### 2a. Overlap / concurrent-run safety (per job)

`pg_net.http_post(...)` is fire-and-forget and non-blocking — Postgres does not wait for the edge function to finish, and nothing in `pg_cron` itself prevents a job's next scheduled tick from firing an HTTP POST to the same function while a prior invocation is still running (e.g. a slow external API call, a large batch). Audited as part of [production-readiness-checklist doc 15](../../workflow/planned/production-readiness-checklist/15-database-connection-pooling.md) (Phase 15.4) — no job in this repo uses an explicit `pg_try_advisory_lock`/`pg_try_advisory_xact_lock` guard. Per-job status:

| Job                              | Interval  | Overlap guard                                                                                                                                                                                                                                                                                  |
| -------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calendar-sync-cron`             | 30 min    | **Yes** — `_shared/calendarSyncRun.ts#claimFeed()` does a conditional `UPDATE ... WHERE last_attempted_at IS NULL OR < cutoff`, so a feed already claimed by a concurrent run is skipped (0 rows), not double-processed.                                                                       |
| `sd-refund-cron`                 | 5 min     | No explicit claim, but safe in practice: the booking status machine (`canTransition`) rejects re-processing a booking already past `READY_FOR_CHECKIN`, and the check-out email is separately gated on `sd_refund_form_emailed_at`. Redundant scanning on overlap, not duplicate side effects. |
| `superhost-assessment-cron`      | quarterly | None confirmed. Narrow window given the interval; not traced end-to-end for a matching idempotency guard.                                                                                                                                                                                      |
| `contract-expiry-cron`           | daily     | None confirmed. Same caveat as above.                                                                                                                                                                                                                                                          |
| `property-page-views-prune-cron` | —         | None confirmed. Low risk — a prune job re-running redundantly is not destructive.                                                                                                                                                                                                              |
| `smart-pricing-cron`             | —         | None confirmed.                                                                                                                                                                                                                                                                                |
| `activity-log-retention-cron`    | monthly   | Not individually re-audited this pass; low risk given interval + the underlying purge RPC's own idempotent `DELETE ... WHERE created_at < cutoff` shape.                                                                                                                                       |
| `query-cache-sweep-cron`         | nightly   | **Yes, trivially** — `sweepExpiredCacheRows` is `DELETE ... WHERE expires_at < now()`; a concurrent or overlapping run deletes a subset of the same already-expired rows, never double-deletes meaningfully or corrupts state.                                                                 |

If a human is closing out doc 15 fully, the four "None confirmed" rows are the concrete remaining work — either trace each job's write path for an existing idempotency property (the way `sd-refund-cron` was), or add a `claimFeed`-style conditional-update guard / advisory-lock wrapper at the top of the handler.

---

## 3. Why `config.toml` does not define `schedule` locally

In **`supabase/config.toml`** you will see:

```toml
[functions.gmail-listener]
verify_jwt = false

[functions.sd-refund-cron]
verify_jwt = false
# Cloud-only schedule — set in Supabase Dashboard / SQL (pg_cron), NOT here
```

Reasons:

1. **Local Supabase CLI** historically **rejects** or mishandles a `[functions.*] schedule = "..."` key depending on CLI version; the repo keeps schedules **out of** `config.toml` so `supabase start` stays reliable.
2. **Hosted** schedules are owned by the **project database** (`pg_cron`), not the repo file—so production schedule is created **once** in the cloud (SQL Editor or migration), not only by git push.

**Local dev:** nothing fires every 5 minutes automatically. You **manually** invoke the functions (§6–§7).

---

## 4. Authentication and `verify_jwt` for scheduled + Telegram cron

Current repo behavior:

| Function                  | `[functions.*] verify_jwt` in `config.toml` | Handler calls `verifyAdminJwt`?                                                                                                                                                      |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gmail-listener`          | `false`                                     | **No**                                                                                                                                                                               |
| `sd-refund-cron`          | `false`                                     | **Only when** JSON body includes **`bookingId`** (admin “Run SD refund cron now” from `/bookings/:id`). **Global** scheduled runs omit `bookingId` and do **not** require admin JWT. |
| `telegram-marketing-cron` | `false`                                     | **No** — optional shared secret: when **`TELEGRAM_CRON_SECRET`** is set, require header **`X-Telegram-Cron-Secret`** matching that value.                                            |

Effects:

- **Scheduled `pg_net` POST** can use the **`anon` JWT** in `Authorization` (as in Supabase’s scheduling doc) with **`body := '{}'::jsonb`** and still reach the handler for the **global** scan (no `bookingId`).
- **Admin UI “Run SD refund cron now”** sends `{ "bookingId" }` plus the admin **`access_token`**; the function calls **`verifyAdminJwt`** so only allow-listed Google accounts can scope a run to one booking.

**Operational implication:** Treat unscoped `sd-refund-cron` and **`telegram-marketing-cron`** URLs like **semi-internal** APIs (cron + keys). Scoped SD calls are gated by **`verifyAdminJwt`**. Prefer **`TELEGRAM_CRON_SECRET`** for Telegram cron in production.

---

## 5. Environment variables and secrets

### 5.1 Shared (all Edge Functions on Supabase)

Automatically provided in hosted Edge runtime (and in local serve when linked to local stack):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Both jobs use the **service role** client inside the handler for DB + Storage (see `createClient` in each `index.ts`). **`telegram-marketing-cron`** uses the same service role for reads and Telegram HTTPS only.

### 5.2 `sd-refund-cron` only

| Variable                               | Default | Purpose                                                                                                                                                                                                                                                   |
| -------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SD_REFUND_CRON_EMAIL_LEAD_MINUTES`    | `120`   | Minutes **before** parsed check-out (Manila) when the cron may send the guest check-out email (not gated on settlement).                                                                                                                                  |
| `SD_REFUND_CRON_MAX_CHECKOUT_AGE_DAYS` | `30`    | If **now − check-out** exceeds this many days, the cron **does not** send the automated guest check-out email; settlement-based transition still runs. Set **`0`** to never suppress by age. Configure per org in **Email automations** when unset in DB. |

### 5.3 `gmail-listener` only

| Variable                             | Purpose                                                                                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GMAIL_API_WEB_CLIENT_JSON`          | _(Web OAuth path)_ OAuth **Web application** client JSON. With `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY` and a row in `gmail_mail_integration`, the listener uses the DB refresh token first. |
| `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY`   | 32-byte key (64 hex or base64) matching the value used when storing tokens via **Connect Gmail** on **`/settings`**.                                                                   |
| `GMAIL_OAUTH_ALLOWED_RETURN_ORIGINS` | _(Web OAuth path)_ Comma-separated SPA origins for `google-mail-oauth-start` (defaults include local Vite).                                                                            |
| `GMAIL_OAUTH_CLIENT_JSON`            | _(Legacy)_ OAuth client JSON (`installed` or `web`). Produced by `bun run gmail-auth` → typically written into `supabase/.env.local`.                                                  |
| `GMAIL_OAUTH_TOKEN_JSON`             | _(Legacy)_ Token JSON including **`refresh_token`**. Same script flow. Used when no DB-stored refresh exists for `GMAIL_API_WEB_CLIENT_JSON`.                                          |
| `EMAIL_TO`                           | Documents Approver address. `gmail-listener` skips approvals when message `From` does not match (when set).                                                                            |

If tokens are missing or `refresh_token` is revoked, the listener returns JSON with `needsReAuth: true` (and logs); see §7.3. Prefer **Reconnect Gmail** on **`/settings`** when using the web OAuth path.

### 5.4 Telegram (`telegram-marketing-cron` + `submit-form` / `cancel-booking`)

| Variable               | Purpose                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`   | Bot API token from BotFather.                                                                                                                         |
| `TELEGRAM_CHAT_ID`     | Destination chat (group supergroup id is usually negative).                                                                                           |
| `TELEGRAM_CRON_SECRET` | _(Optional)_ When set, **`telegram-marketing-cron`** rejects requests unless header **`X-Telegram-Cron-Secret`** matches (use with Vault + `pg_net`). |

Full product behavior and deployment steps: **[[telegram-marketing-reminders|Telegram marketing reminders]]**.

### 5.5 `expire-parking-broadcasts` only

| Variable                               | Default   | Purpose                                                                                                                                                                                             |
| -------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PARKING_BROADCAST_EXPIRE_CRON_SECRET` | _(unset)_ | _(Optional)_ When set, the function rejects requests unless header **`X-Parking-Broadcast-Expire-Cron-Secret`** matches (use with Vault + `pg_net`, same pattern as `CONTRACT_EXPIRY_CRON_SECRET`). |

### 5.6 `calendar-sync-cron` / `calendar-sync-settings` only

| Variable                             | Default   | Purpose                                                                                                                                                                                                                                                    |
| ------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CALENDAR_SYNC_CRON_SECRET`          | _(unset)_ | _(Optional)_ When set, the **global** `calendar-sync-cron` sweep rejects requests unless header **`X-Calendar-Sync-Cron-Secret`** matches (Vault key `calendar_sync_cron_secret`, same pattern as above). Scoped "Sync now" is JWT-gated and ignores this. |
| `CALENDAR_SYNC_MIN_INTERVAL_MINUTES` | `30`      | _(Optional)_ Minimum minutes between automatic polls of a single feed (`claimFeed` guard). The `*/30` cron cadence and this default match; lower it only for testing. Forced "Sync now" bypasses it with a 5 s window.                                     |
| `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY`   | _(req.)_  | Reused by `_shared/secretsCrypto.ts` to encrypt/decrypt `property_calendar_feeds.ics_url_encrypted` (AES-256-GCM). Already required for Gmail OAuth + other per-property secrets.                                                                          |

---

## 6. How local development runs these functions

From repo root, **`./dev.sh`** (recommended):

1. Runs **`supabase start`** (DB, Auth, Storage) with env from `ui/.env.development` where needed for `config.toml`.
2. Runs **`supabase functions serve --env-file supabase/.env.local`** so Edge code sees `ADMIN_ALLOWED_EMAILS`, Gmail JSON, Google service account, Resend, etc.
3. Starts the Vite UI.

**Functions base URL (local):**

```text
http://127.0.0.1:54321/functions/v1
```

(Use the same host your `ui/.env.development` `VITE_SUPABASE_URL` points at; it must end with `/functions/v1` for this project’s admin hooks.)

**There is no local pg_cron** hitting these URLs unless you add one yourself—use **curl** or the **admin Workflow panel** buttons (“Run Gmail poll now”, “Run SD refund cron now”). For **`telegram-marketing-cron`**, use curl against **`/functions/v1/telegram-marketing-cron`** (see **[[telegram-marketing-reminders|Telegram marketing reminders]]** §5). For **`meta-inbox-webhook-healthcheck`**, call **`/functions/v1/meta-inbox-webhook-healthcheck`** with the anon key plus optional **`X-Meta-Inbox-Webhook-Healthcheck-Cron-Secret`** if you set `META_INBOX_WEBHOOK_HEALTHCHECK_CRON_SECRET`; a manual operator repair uses authenticated **`POST /functions/v1/meta-inbox-resubscribe`** from the inbox UI.

---

## 7. Testing `sd-refund-cron` (step by step)

### 7.1 Preconditions

- Local stack up (`./dev.sh` or `supabase start` + `functions serve` with `supabase/.env.local`).
- A row in **`guest_submissions`** you can edit (SQL Editor in Studio, or seed data).
- Optional: set `SD_REFUND_CRON_EMAIL_LEAD_MINUTES` high (e.g. `10080` = one week) in `supabase/.env.local` so a future test check-out falls inside the window immediately, or set check-out a few hours ahead with the default **120** (restart `functions serve` after changing env).

### 7.2 Prepare a booking that should transition

1. Set **`status`** = **`READY_FOR_CHECKIN`**.
2. Set **`check_out_date`** in **`MM-DD-YYYY`** form (this is what the cron parser expects first—see `parseCheckoutManila` in `sd-refund-cron/index.ts`).
3. Set **`check_out_time`** so that **now (Manila) ≥ check-out − lead** (default lead **120 min**). Example: check-out **90 minutes from now** → email path runs on next cron even **without** settlement; keep settlement incomplete to verify email-only, then add receipt + paid amount to verify transition.
4. Ensure **`check_out_time`** is not empty; if empty, the code falls back to **`11:00 AM`**.

### 7.3 Invoke the function

**Option A — Admin UI (recommended)**

1. Sign in to admin, open any booking (or the one you edited).
2. In **Workflow panel**, use **“Run SD refund cron now”**.
3. Expect a toast summarizing `transitioned` / `scanned`; list invalidates.

**Option B — curl (global scan, same as `pg_cron`)**

```bash
curl -sS -X POST \
  "http://127.0.0.1:54321/functions/v1/sd-refund-cron" \
  -H "Authorization: Bearer $(grep '^SUPABASE_ANON_KEY=' supabase/.env.local | cut -d= -f2- | tr -d '\"')" \
  -H "Content-Type: application/json" \
  -d '{}'
```

(Use the **anon** key from local Supabase status output or `.env.local`; with `verify_jwt = false` the header may still be required by some gateways—if a bare POST works locally, that matches your CLI version.)

**Option C — curl (scoped to one booking, matches admin UI)**

Use a **signed-in admin** `access_token` (same as the browser session) and your booking UUID:

```bash
curl -sS -X POST \
  "http://127.0.0.1:54321/functions/v1/sd-refund-cron" \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"<BOOKING_UUID>"}'
```

### 7.4 Assert results

- **HTTP 200** and JSON roughly:  
  `{ "success": true, "scoped": false|true, "scanned": N, "transitioned": 0|1, "skipped": ..., "checkoutEmailsSent": ..., "transitionedSdEmailSent": ..., "transitionedSdEmailSuppressed": ..., "results": [ ... ] }`
- DB: that booking’s **`status`** is now **`READY_FOR_CHECKOUT`** (not `PENDING_SD_REFUND`; guest SD form comes next).
- If Google env vars are configured: **Calendar** event color/summary and **Sheet** row updated per workflow matrix (orchestrator).
- Re-run the same cron: booking should appear **only** in `scanned` if still `READY_FOR_CHECKIN` for others; the already-moved row is no longer a candidate—**idempotent** for the same booking.

### 7.5 Negative / edge cases to try

| Scenario                                                                       | Expected                                                                                                                                       |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead window **not open yet** (check-out still more than **lead** minutes away) | `skipped` with reason like `not_yet_due_Xmin` in `results`.                                                                                    |
| Settlement incomplete (email may have sent already)                            | `skipped` with `missing_guest_balance_*` / `guest_balance_not_fully_paid` **or** result `action: 'checkout_email_sent'` if only the email ran. |
| **`READY_FOR_CHECKIN`** but **unparseable** `check_out_date`                   | `skipped`, `unparseable_checkout_datetime`.                                                                                                    |
| **No** rows in `READY_FOR_CHECKIN`                                             | `scanned: 0`, `transitioned: 0`.                                                                                                               |
| Orchestrator throws (e.g. misconfigured Google)                                | That booking `action: 'failed'` in `results`, run still **200** with partial successes.                                                        |

---

## 8. Testing `gmail-listener` (step by step)

This path is **longer** because it touches **Gmail OAuth**, **Gmail history IDs**, **Storage**, and **workflow transitions**.

### 8.1 Preconditions

- `GMAIL_OAUTH_CLIENT_JSON` and `GMAIL_OAUTH_TOKEN_JSON` set in **`supabase/.env.local`** (from `bun run gmail-auth` per `admin-auth.mdc`).
- **`EMAIL_TO`** set to the address that appears in the Gmail **`From`** header on Azure approval replies (same as Documents Approver in Settings).
- Migrations applied so tables exist: **`gmail_listener_state`**, **`processed_emails`** (see project migrations).
- Storage bucket **`approved-gafs`** / **`approved-pet-forms`** available (declared in `config.toml` + migrations).
- A booking row in **`PENDING_GAF`** (for GAF approval) or **`PENDING_PET_REQUEST`** (for pet approval) with **`check_in_date` / `check_out_date`** matching the **subject line** you will use in the test email.

### 8.2 Subject and attachment contract

The listener parses subjects of the form (after optional prefixes like test/urgent/update/reply — see code `parseApprovalSubject`):

- `Monaco 2604 - GAF Request (MM-DD-YYYY to MM-DD-YYYY)`
- `Monaco 2604 - Pet Request (MM-DD-YYYY to MM-DD-YYYY)`

It also accepts month-name date format commonly seen in email threads, e.g.:

- `Re: Monaco 2604 - GAF Request (May 13, 2026 to May 14, 2026)`

Attachment filename matching is case-insensitive and tolerant to spaces/underscores/hyphens:

- GAF approvals accept `APPROVED GAF.pdf` variants (e.g. `APPROVED_GAF.pdf`, `approved-gaf.pdf`).
- Pet approvals accept `APPROVED PET.pdf` / `APPROVED PET FORM.pdf` variants, and also allow `APPROVED GAF.pdf` for backward compatibility with existing approver behavior.

Sender **`From`** must match **`EMAIL_TO`** (when configured). If not, listener records `sender_not_allowed:<email>` and skips.

If multiple bookings match the same dates + expected status, the listener **skips** and records **`ambiguous_multiple_bookings`** (per Q6.5).

### 8.3 First run — history cursor initialization

On a **fresh** DB (no row in `gmail_listener_state` or null `history_id`):

1. POST `gmail-listener` once.
2. Expected JSON: **`"initialized": true`**, **`historyId`** set.
3. **No backlog** is processed on purpose: the cursor is set to **current** mailbox `historyId` so old inbox mail does not mass-transition production by accident.

**Test implication:** After first init, you must **receive a new message** (or advance history) for the listener to see `messageAdded` entries.

### 8.4 Second run — happy path (GAF)

1. Ensure exactly **one** booking in **`PENDING_GAF`** with dates matching your planned subject.
2. From the monitored mailbox, ensure an inbound email (or send yourself a thread) with the **exact** subject pattern and **`APPROVED GAF.pdf`**.
3. POST `gmail-listener` again (admin button or curl).
4. Expect JSON with **`messagesScanned` > 0**, **`applied` ≥ 1** if a message matched.
5. Verify:
   - **`processed_emails`** has the Gmail **`message_id`** with status `applied` (or `skipped` / `failed`).
   - **`gmail_listener_state`** updated `history_id` / `last_poll_at`.
   - For bookings on **`PENDING_DOCUMENTS`**, top-level **`status`** often stays **`PENDING_DOCUMENTS`** while **`approved_gaf_pdf_url`** (or **`approved_pet_pdf_url`**) is written — the admin pipeline then shows **Pending GAF** / **Pending Pet** as **Complete** from that URL. (Legacy **`PENDING_GAF`** rows behave similarly until an admin advances the parent status.)
   - **`approved_gaf_pdf_url`** (or pet URL) set; file in Storage.

### 8.5 Pet approval path

Same as GAF but:

- Booking must be in **`PENDING_PET_REQUEST`**.
- Subject uses **`Pet Request`**.
- Transition should land in **`READY_FOR_CHECKIN`** with pet PDF URL and optional ready-for-check-in email when orchestrator says so.

### 8.6 Gmail API 404 cases

**`users.history.list` returns 404** (cursor too old):

- Listener **resets** cursor to current profile `historyId`, returns JSON like **`historyReset: true`**.
- **Mail between old cursor and reset can be missed** — documented in logs; recover with **manual upload** + admin transition per workflow panel.

**`messages.get` returns 404** for an ID listed in `history` (message added):

- Gmail sometimes emits **`messageAdded`** IDs that are **not fetchable** as a full message (deleted draft, superseded thread artifact, or similar). The listener treats these as **`skipped`** with reason **`gmail_message_not_found_404`** — not **`failed`**.
- The real reply in the same batch is still processed when its ID is valid; **`failed`** in the run summary should stay **0** for this case.

### 8.7 OAuth failure

If token exchange fails (`invalid_grant`):

- Response **`success: false`**, **`needsReAuth: true`** for invalid grant; fix by re-running **`bun run gmail-auth`** and updating secrets.

### 8.8 Idempotency

- **`processed_emails`** prevents double-applying the same **`message_id`**.
- Re-posting the listener for the same Gmail message should **skip** as already processed.

---

## 9. Hosted (production / staging) testing checklist

1. **Deploy** Edge Functions (`gmail-listener`, `sd-refund-cron`) to the project.
2. **Set secrets** in Supabase Dashboard (same names as local `.env.local` for Gmail, SD cron lead minutes, Google, etc.).
3. **Create pg_cron jobs** via SQL (Vault + `net.http_post`) for each function on `*/5 * * * *` or your preferred cadence.
4. Confirm **first** `gmail-listener` run in a new environment: expect **`initialized: true`**; plan a **test mail** after.
5. Use **Dashboard → Edge Functions → Logs** (or Log Explorer) to watch `[gmail-listener]` / `[sd-refund-cron]` log lines.
6. Use **admin manual buttons** on a real booking if cron delay makes iteration slow—same HTTP handlers as cron.

---

## 10. Quick reference — URLs and files

| Item                          | Location                                                               |
| ----------------------------- | ---------------------------------------------------------------------- |
| SD cron logic                 | `supabase/functions/sd-refund-cron/index.ts`                           |
| Gmail listener logic          | `supabase/functions/gmail-listener/index.ts`                           |
| Orchestrator (single fan-out) | `supabase/functions/_shared/workflowOrchestrator.ts`                   |
| Status rules                  | `supabase/functions/_shared/statusMachine.ts`                          |
| Manual HTTP from UI           | `ui/src/features/dashboard/bookings/hooks/useTransitionBooking.ts`     |
| Local functions + env         | `./dev.sh` → `supabase functions serve --env-file supabase/.env.local` |
| Supabase scheduling doc       | https://supabase.com/docs/guides/functions/schedule-functions          |

---

## 11. SQL scripts (enable / verify / remove)

Use this section when you want repeatable SQL snippets for local dev or hosted projects.

### 11.1 Verify cron prerequisites

```sql
select extname, extversion
from pg_extension
where extname in ('pg_cron', 'pg_net')
order by extname;
```

Expected: **`pg_net`** is almost always present on local Supabase. **`pg_cron`** may be **missing** after a **`db reset`** / fresh volume — it is not recreated by every migration set. If `pg_cron` does not appear in the result above, install it once (same database your app uses, usually `postgres`):

```sql
create extension if not exists pg_cron;
```

Then re-run the `select` to confirm both extensions.

### 11.2 Enable local cron jobs (copy-paste)

Replace `<LOCAL_ANON_KEY>` with your local anon key from `supabase status` (`bunx supabase@latest status -o env` → `ANON_KEY`, or Studio → **Project Settings → API** for local).

```sql
select cron.schedule(
  'local-gmail-listener-every-5m',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'http://kong:8000/functions/v1/gmail-listener',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<LOCAL_ANON_KEY>',
      'Authorization', 'Bearer <LOCAL_ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'local-sd-refund-cron-every-5m',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'http://kong:8000/functions/v1/sd-refund-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<LOCAL_ANON_KEY>',
      'Authorization', 'Bearer <LOCAL_ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Run the block in **Studio → SQL** (`http://127.0.0.1:54323`) on the **`postgres`** database. If you apply it from a host shell, use **`docker exec -i`** (with `-i`) so a heredoc or pipe reaches `psql`; without `-i`, the script is ignored.

`pg_cron` runs **inside** the DB container: use **`http://kong:8000/functions/v1/...`** so `pg_net` hits Kong on the Docker network. Use **`http://127.0.0.1:54321/functions/v1/...`** only from the **host** (curl, browser) — not inside `cron.schedule` SQL.

### 11.3 Enable hosted cron jobs (Vault pattern)

Store project URL and key in Vault once:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<ANON_OR_SCHEDULE_KEY>', 'anon_key');
```

Create jobs:

```sql
select cron.schedule(
  'gmail-listener-every-5m',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/gmail-listener',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'sd-refund-cron-every-5m',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/sd-refund-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 11.4 Verify installed jobs and run history

```sql
select jobid, jobname, schedule, active, command
from cron.job
where command ilike '%gmail-listener%' or command ilike '%sd-refund-cron%'
order by jobid desc;
```

```sql
select runid, jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid in (
  select jobid
  from cron.job
  where command ilike '%gmail-listener%' or command ilike '%sd-refund-cron%'
)
order by runid desc
limit 50;
```

### 11.5 Disable/remove jobs

By job name:

```sql
select cron.unschedule('local-gmail-listener-every-5m');
select cron.unschedule('local-sd-refund-cron-every-5m');
```

Hosted names:

```sql
select cron.unschedule('gmail-listener-every-5m');
select cron.unschedule('sd-refund-cron-every-5m');
```

Or by `jobid`:

```sql
select cron.unschedule(<jobid>);
```

---

## 12. FAQ

**Q: Does my laptop need to stay on for cron to run?**  
**A:** No. On Supabase Cloud, **`pg_cron`** runs in the **hosted database**. Your machine only matters for **local** testing.

**Q: Why does the admin UI send a JWT if the function doesn’t verify it?**  
**A:** The UI reuses the same **`FUNCTIONS_URL`** pattern as other admin mutations; scheduled jobs use **`anon`** (or your chosen Vault secret). Tightening auth (e.g. `verifyAdminJwt` for non-cron requests only) would be a future hardening pass.

**Q: Can I test SD cron without touching Gmail?**  
**A:** Yes. SD cron has **no** Gmail dependency—only DB dates + orchestrator + Google Calendar/Sheet if enabled.

---

_Last updated to match repo behavior as of the Phase 4 `gmail-listener` + `sd-refund-cron` implementation and `supabase/config.toml` (`verify_jwt = false` for both)._
