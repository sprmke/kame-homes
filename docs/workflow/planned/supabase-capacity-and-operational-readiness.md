---
title: 'Supabase capacity and operational readiness'
status: planned
tags: [supabase, capacity, performance, security, production-readiness, observability]
updated: 2026-10-27
stage: planned
kind: plan
readiness: unverified
launch_gate: A
launch_blocker: tbd
last_verified: none
---

# Supabase Capacity and Operational Readiness Plan

> **For agentic workers:** This is a plan only. Do not implement it without a new execution instruction. Production Supabase operations still require the unlock word `kamewave`.

## Goal

Make the Supabase side of Kame Homes safe to operate for hundreds to thousands of concurrent users, with booking, payment, PII storage, Auth, Realtime, AI, webhook, cron, and Edge Function traffic under measured capacity limits. Every tier, connection, cache, index, and retention decision must be backed by evidence and load-test results, not by guesswork.

## Architecture

The app runs a Vite SPA on Vercel, approximately 300 Supabase Edge Functions, Postgres, Auth, Storage, Realtime, `pg_cron` plus `pg_net`, and vendor calls from the edge. Postgres is the single stateful bottleneck. Edge Functions talk through PostgREST/HTTP, not direct Postgres sockets. Dev is hosted Supabase project `fworvijbrwpyngycotbz`; production Supabase is a separate future project and still requires the dual-track deploy rules.

## Current evidence

Captured 2026-10-27 against hosted dev, read-only.

| Area                            | Current evidence                                                                                                                                                                          | Interpretation                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Project                         | `Kame Homes - Dev`, `fworvijbrwpyngycotbz`, `ap-southeast-1`, `ACTIVE_HEALTHY`                                                                                                            | Singapore region, healthy project                                                                                |
| Compute                         | About 456.8 MB total RAM, matching the Nano footprint                                                                                                                                     | Too small even for idle development plus Supabase services                                                       |
| Memory commitment               | `Committed_AS` about 1.24 to 1.25 GB against a `CommitLimit` about 1.30 GB, roughly 96%                                                                                                   | Leading OOM-risk signal. This is what the Dashboard marks problematic                                            |
| Physical memory                 | `MemAvailable` about 194 MB; `MemFree` under 10 MB, cache about 172 MB                                                                                                                    | Very low headroom, but not yet an active outage                                                                  |
| Swap                            | About 1 GB swap, 31 to 32% used                                                                                                                                                           | Reclaim pressure is already happening without real users                                                         |
| CPU                             | About 2.4% busy and 1.7% iowait over a 192-second sample; load5 0.05                                                                                                                      | CPU is not the current problem                                                                                   |
| OOM and restarts                | `node_vmstat_oom_kill = 0`, `postgresql_restarts_total = 0`                                                                                                                               | No actual OOM yet. The warning is predictive, not an incident                                                    |
| Database size                   | `postgres` database about 29 MB; all databases about 43.2 MB; WAL about 128 MB                                                                                                            | Data volume is tiny                                                                                              |
| Disk                            | `/data` volume 2.08 GB with about 1.72 GB available                                                                                                                                       | No disk capacity issue today                                                                                     |
| Connections                     | `max_connections = 60`, pooler max 200 clients, PostgREST pool max 10, Auth absolute 10, 7 backends active at sample                                                                      | Not saturated, but all limits are very small                                                                     |
| Locks and queries               | No long-running queries, no blocked queries, no exclusive-lock problems, no replication slots                                                                                             | No immediate database incident                                                                                   |
| Query counters                  | Statistics reset about 84 days ago; 167,686 temp files and about 446 GB temp writes cumulatively                                                                                          | Historic background, deploy, backup, advisor, and diagnostic work must be separated from user load before action |
| `pg_stat_statements`            | Enabled; top call-time query was `realtime.list_changes` with about 2h 1m total execution across 969,034 calls; durable rate limiter `bump_rate_limit` used about 49s across 18,425 calls | Realtime and rate limiting are measurable background consumers                                                   |
| Role settings                   | `anon`, `authenticated`, and `service_role` have `statement_timeout = 20s` and `idle_in_transaction_session_timeout = 30s`                                                                | Good request-path guard already applied                                                                          |
| Postgres config                 | No custom overrides; `shared_buffers` about 224 MB, `work_mem` about 2.18 MB, `effective_cache_size` about 384 MB                                                                         | Do not tune blindly. First give the instance more RAM, then measure                                              |
| Backups                         | Daily physical backups completed in Singapore, latest 2026-10-25                                                                                                                          | Backups exist, but restore must be rehearsed before launch                                                       |
| Auth users                      | Metrics reported 15 users                                                                                                                                                                 | Dev/test accounts, not real user load                                                                            |
| Advisors                        | Security: 142 findings, 0 errors, 36 warnings, 106 informational. Performance: 282 findings, 33 warnings, 249 informational                                                               | Needs intentional triage. Many findings are expected for an idle, service-role-only dev schema                   |
| Public load test prior evidence | 50 VUs produced about 10 req/s at the backend with p95 11s; `get-public-property` median 12.4s                                                                                            | The public read path is the first known capacity failure point                                                   |
| Migration drift                 | 9 local migrations were not present on hosted dev at the read-only check                                                                                                                  | Deploy parity must be resolved before capacity work is trusted                                                   |

## Why the Dashboard says problematic

The chart is not saying users exhausted 1.16 GB of RAM. It compares Linux `Committed_AS` against `CommitLimit`. `Committed_AS` is the total memory the kernel has promised to processes, including pages not yet touched. Postgres increases it sharply when connections fork and each connection can inherit large copy-on-write mappings, and each sort or hash node can allocate up to `work_mem`.

The dev project is on a Nano-sized footprint, roughly 0.5 GB RAM, but its current commitments are around 1.25 GB against a 1.30 GB limit. Supabase's own services plus idle background work are enough to cause this. There are no real users and no OOM kill yet, so this is not an active outage, but the instance has almost no headroom. The correct first response is to move dev off Nano and then monitor before changing Postgres tuning.

## Decisions already made

1. Do not deploy or mutate production Supabase without `kamewave`.
2. Do not run production load tests. Hosted dev only, with third parties mocked.
3. Do not blanket-fix advisor findings. `RLS enabled no policy` and unused indexes are often intentional or unmeasured on an idle dev project.
4. Do not lower `max_connections`, `work_mem`, or other Postgres settings before a larger instance is in place and load is measured. Current values are not the root cause.
5. Dev is not production sizing. The future mt-prod project must be created fresh and load-tested.
6. This plan does not change guest behavior, plan entitlements, or team permissions. Plans and RBAC are N/A unless a capacity control later becomes host-visible.

## Draft capacity targets

These need product-owner confirmation before implementation, but they give the plan concrete acceptance numbers. Do not change them silently.

| Dimension                         | Launch target | 12-month target |
| --------------------------------- | ------------: | --------------: |
| Organizations                     |           100 |             500 |
| Properties plus parkings          |           500 |           5,000 |
| Registered users                  |         2,000 |          20,000 |
| Bookings per month                |           500 |          10,000 |
| Concurrent guest sessions         |           250 |           1,000 |
| Concurrent host sessions          |           100 |             500 |
| Public page views per day         |        50,000 |         500,000 |
| Edge Function invocations per day |       250,000 |       2,000,000 |
| Inbox messages per day            |         5,000 |          50,000 |
| AI requests per day               |         2,000 |          20,000 |
| Realtime concurrent channels      |           500 |           2,500 |

## Proposed tier strategy

| Environment    | Current              | Proposed                                             | Why                                                                                                                                                                                   |
| -------------- | -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted dev     | Nano-sized footprint | **Small (2 GB)**                                     | Micro (1 GB) is the paid minimum, but it is still small for realistic load testing. Small gives enough headroom to observe workload without constantly tripping baseline warnings     |
| Future mt-prod | Not created          | **Medium (4 GB) initial candidate**                  | Hundreds to thousands of concurrent users plus Auth, Realtime, Storage, and Edge Functions should not launch on Nano or Micro. Medium is the starting candidate, not the final answer |
| Scale-up       | N/A                  | **Large (8 GB) or higher only on measured triggers** | Dedicated CPU and higher pooler limits are justified only when load tests or production metrics show sustained CPU, connection, disk, or latency pressure                             |

Tier changes cause brief downtime, usually under two minutes. A completed backup and deploy freeze must precede a tier change.

---

## Phase 0: Stop the immediate memory risk and stabilize dev

**Status: not started. No work has been done.**

**Files and operator surfaces:**

- Supabase Dashboard, project Settings, Infrastructure
- `supabase/.env.dev.local`
- `docs/architecture/deployment.md`
- `docs/workflow/in-progress/production-readiness/evidence/`

**Steps:**

- [ ] Freeze Edge Function and migration deploys for the duration of the tier change.
- [ ] Confirm the latest physical backup is completed and downloadable.
- [ ] Operator upgrades hosted dev from the Nano footprint to Small. This is a Dashboard action, not a repo deploy.
- [ ] Record before and after metrics for:
  - `node_memory_MemTotal_bytes`
  - `node_memory_MemAvailable_bytes`
  - `node_memory_Committed_AS_bytes`
  - `node_memory_CommitLimit_bytes`
  - `node_memory_SwapFree_bytes`
  - `node_vmstat_oom_kill`
  - `postgresql_restarts_total`
- [ ] Run `get-health` and the existing public deploy verification after the change.
- [ ] Confirm the memory commitment ratio drops below 70% under normal background load.

**Acceptance:**

- Dev no longer reports the Memory commitment chart as problematic.
- No Postgres restart or OOM kill occurs during the change.
- Health and public smoke checks pass.
- Evidence is committed under the production-readiness evidence folder.

**Activity log: N/A. Platform infrastructure only; no org data changes.**

---

## Phase 1: Build a real observability baseline

**Files:**

- Create: `scripts/performance/capture-supabase-metrics.mjs`
- Create: `scripts/performance/capture-supabase-advisors.mjs`
- Create: `docs/workflow/in-progress/production-readiness/evidence/supabase/README.md`
- Modify: `scripts/README.md`
- Modify: `.github/workflows/cd-dev.yml`
- Reference: `docs/workflow/in-progress/production-readiness/checklist/27-error-tracking-and-logs.md`

**Steps:**

- [ ] Add a read-only metrics capture script that authenticates to the Supabase Metrics API with the service-role secret and stores a timestamped Prometheus snapshot outside git.
- [ ] Capture at least 24 hours on Small before any query or index work.
- [ ] Add advisor snapshots for security, performance, and health. Store only findings and IDs, never secrets or PII.
- [ ] Add a scheduled or CI dev capture step that fails only on connection errors, not on advisory findings.
- [ ] Set up an external Prometheus-compatible collector for hosted dev:
  - Scrape once per minute
  - Retain at least 30 days
  - Dashboards for Database, API gateway, Auth, Storage, Realtime, and Edge Functions
- [ ] Alert on the following initial thresholds:
  - Committed memory over 80% of commit limit for 15 minutes, page over 90% for 5 minutes
  - Any OOM kill
  - Swap usage above 50% for 30 minutes, page above 70%
  - Postgres restart count increases
  - CPU above 70% for 15 minutes
  - Disk IO balance below 20%
  - Database or pooler connections above 80% of maximum
  - PostgREST pool waiting or timeouts above zero for 5 minutes
  - Auth or Data API 5xx rate above 1% for 10 minutes
  - Edge p95 above agreed target for 10 minutes
- [ ] Route alerts to a channel a human actually watches and add a named owner and response action for each alert.
- [ ] Run a deliberate test alert and prove delivery end to end.

**Acceptance:**

- Metrics, advisors, and logs are captured continuously.
- Every alert has an owner, runbook link, and tested delivery.
- A weekly Supabase health review is documented.

**Plans and permissions: N/A. Internal observability only.**
**Activity log: N/A. Read-only monitoring.**

---

## Phase 2: Triage advisor findings without blanket changes

**Files:**

- Create: `supabase/migrations/` only after triage
- Modify: `docs/architecture/data-model.md`
- Modify: `docs/workflow/in-progress/production-readiness/checklist/14-index-the-database.md`
- Modify: `docs/workflow/in-progress/production-readiness/checklist/22-security-and-rls.md`

**Advisor triage matrix:**

| Finding                                              |                                                                      Count | Intended action                                                                                                                     | Do not do                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `rls_enabled_no_policy`                              |                                                                        106 | Keep as intentional deny-by-default for service-role-only tables. Record accepted list                                              | Do not add public policies just to silence the advisor                              |
| `function_search_path_mutable`                       |                                                                         24 | Pin `search_path` and fully qualify objects in new migrations                                                                       | Do not bulk-edit shipped migrations                                                 |
| `authenticated_security_definer_function_executable` |                                                                         10 | Verify these are only RLS predicate helpers. If needed, move helpers to a non-exposed schema while keeping policy execution working | Do not blindly revoke `authenticated` execute because RLS policies may depend on it |
| `auth_leaked_password_protection`                    |                                                                          1 | Enable leaked-password protection in Auth dashboard                                                                                 | Do not ship a workaround in app code                                                |
| `extension_in_public`                                |                                                                          1 | Plan moving `pg_trgm` to the `extensions` schema with search tests                                                                  | Do not alter the extension on a whim                                                |
| `auth_rls_initplan`                                  |                                                                         31 | Rewrite policy calls to use `(select auth.uid())` and equivalent init-plan-safe forms                                               | Do not disable RLS                                                                  |
| `duplicate_index`                                    |                                                                          2 | Compare definitions, keep one, drop the duplicate with `CONCURRENTLY` on hosted dev                                                 | Do not drop unique or constraint-backed indexes                                     |
| `unindexed_foreign_keys`                             |                                                                         73 | Classify into query path, cascade path, and audit-attribution path. Index only paths with measured cost or delete risk              | Do not add 73 indexes automatically                                                 |
| `unused_index`                                       | 175 advisor findings; local inspection showed more raw `idx_scan = 0` rows | Ignore on idle dev. Re-evaluate only after production-like traffic and seed load                                                    | Do not drop indexes based on dev data                                               |
| `auth_db_connections_absolute`                       |                                                                          1 | After compute upgrade, switch Auth database connection allocation to percentage-based in Dashboard                                  | Do not assume a compute upgrade alone scales Auth                                   |

**Steps:**

- [ ] Commit the advisor snapshot as the baseline.
- [ ] Build the accepted-risk table for intentional findings.
- [ ] Write one new migration for init-plan-safe RLS policies. Each policy must preserve behavior.
- [ ] Write one new migration for pinned function search paths. Functions must be schema-qualified.
- [ ] Investigate duplicate index definitions and write a concurrent-drop migration only if they are truly identical.
- [ ] Triage foreign keys into three buckets and add indexes only where a real query or delete path needs them.
- [ ] Enable leaked-password protection through the Auth Dashboard and verify with a known compromised password in a test account.
- [ ] Plan `pg_trgm` relocation as its own change because indexes and generated search functions must be revalidated.
- [ ] Add tests:
  - Local RLS regression probe as `anon`, `authenticated`, owner, unrelated member, and inactive member
  - Public listing search parity test
  - Migration replay test
- [ ] Re-run advisors after migration deploy and record the delta.

**Acceptance:**

- No new ERROR-level security findings.
- WARN findings are either fixed or explicitly accepted with a reason.
- RLS and search behavior is unchanged for legitimate users.
- No index is dropped based only on idle dev usage.

**Plans and permissions: N/A unless a capacity control becomes a plan feature later.**
**Activity log: N/A for schema hardening; record app-visible security changes if any are added.**

---

## Phase 3: Make the database query path scale

**Files:**

- `supabase/functions/_shared/databaseService.ts`
- `supabase/functions/_shared/dashboardService.ts`
- `supabase/functions/_shared/financeService.ts`
- `supabase/functions/_shared/contractExpiryCron.ts`
- `supabase/functions/_shared/publicSearch.ts`
- `supabase/functions/_shared/publicPropertyService.ts`
- `supabase/functions/_shared/queryCache.ts`
- `ui/src/pwa/sw.ts`
- `ui/vercel.json` or Vercel routing configuration
- `docs/architecture/edge-functions.md`

**Known remaining query-shape work:**

| Surface                                                    | Issue                                                                      | Required outcome                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `listBookings` org-wide and `status_priority` default path | Still falls back to fetching all matching rows before in-memory pagination | SQL or generated-column sort and paging, or a bounded date window           |
| `fetchAllBookingsForFinance` `basis: completed`            | Still materializes the completed set                                       | SQL aggregate or bounded streaming export                                   |
| `dashboardService.computeDashboardStats`                   | Unbounded booking scan, currently mitigated by a 45-second cache           | Replace scan with SQL aggregates, keep cache only if still useful           |
| `contractExpiryCron`                                       | Scans org/listing inventory every tick                                     | SQL filter for near-expiry and consideration windows                        |
| Exports and CSV                                            | Can materialize a full tenant history in Edge memory                       | Chunk or stream, hard cap rows, and surface truncation                      |
| AI context builders                                        | Must remain bounded to avoid prompt and memory blowups                     | Explicit date windows and row caps                                          |
| Rate limit table                                           | High write churn and small bloat already visible                           | Measure before redesign; add retention and consider partial indexes         |
| Realtime Postgres Changes                                  | Top cumulative query was `realtime.list_changes`                           | Inventory channels and move appropriate database-origin events to Broadcast |

**Steps:**

- [ ] Rank `pg_stat_statements` by total time, mean time, calls, rows, temp blocks written, and shared blocks read. Do not rank only by mean.
- [ ] Run `EXPLAIN (ANALYZE, BUFFERS)` on the top application statements using a production-like seed, not the current 5-booking dev data.
- [ ] Fix the booking list fallback paths.
- [ ] Replace dashboard count scans with SQL aggregates.
- [ ] Make finance summaries SQL aggregates and keep page totals separate from grand totals.
- [ ] Make exports chunked and hard-capped.
- [ ] Bound `contractExpiryCron` and every similar inventory scan.
- [ ] Add a large-tenant seed with at least 10,000 bookings, 50,000 finance rows, and 20,000 messages. PII must be synthetic.
- [ ] Add query regression tests that fail when a tenant-growing table is scanned unbounded.
- [ ] Extend `query_cache` only to measured hot reads. Every key must include org, property, filters, and permission scope.
- [ ] Serve-stale-on-error may be considered only for non-money analytics. Finance totals and availability must not serve stale values.
- [ ] Add connection-pool hygiene work:
  - Fix remaining per-call service-client factories one file at a time
  - Confirm retry backoff uses jitter
  - Keep scripts on the session pooler
  - Never open direct Postgres connections from Edge Functions
- [ ] Evaluate a read replica only after the load test proves a read bottleneck. Reads following writes must continue to use the primary.

**Acceptance:**

- Top 20 application statements have recorded plans.
- No request-path query materializes an unbounded tenant history.
- Large-tenant seed tests pass.
- PostgREST pool waiting and timeouts remain zero under load.

**Plans and permissions: N/A.**
**Activity log: N/A for read-path work; any new mutating capability must follow the audit-logging rule.**

---

## Phase 4: Fix the public read bottleneck

Prior evidence showed the public edge functions saturated around 10 req/s on the old dev compute and the Supabase front returned dynamic responses despite cache headers.

**Steps:**

- [ ] Decide and document the public cache architecture:
  - Preferred: cached public listing and search reads at the Vercel layer we control
  - Keep Supabase Edge Functions as the origin
  - Keep `query_cache` for expensive shared computation
- [ ] Cache only anonymous, non-PII public reads:
  - Listing and search responses can use short shared TTLs
  - Availability stays short TTL with no stale-while-revalidate
  - Guest, booking, payment, admin, and token responses remain `private, no-store`
- [ ] Add cache invalidation from property, pricing, media, review, and publish writes.
- [ ] Add per-IP and global abuse protection at the cached layer.
- [ ] Keep the service worker cache allowlist aligned with server cache classes.
- [ ] Re-run the public k6 scenario on Small at 25, 50, 100, and 200 VUs.
- [ ] Record first-fail component and concurrency.

**Acceptance:**

- Public listing and search p95 is under the agreed target at 2x launch concurrency.
- No cached response contains tenant or guest data.
- Availability never shows a booked night as free beyond the documented TTL.

**Plans and permissions: N/A.**
**Activity log: N/A for cache reads.**

---

## Phase 5: Harden sensitive Supabase features

### 5.1 Auth and identity

- [ ] Enable leaked-password protection.
- [ ] Verify Auth attack-protection settings and captcha enforcement.
- [ ] Confirm Auth database connections use percentage allocation after the compute upgrade.
- [ ] Verify sign-in, refresh, logout, and OAuth rate limits.
- [ ] Confirm Google OAuth redirect allowlists for dev and future prod domains.
- [ ] Keep dashboard JWT refresh behavior near expiry; do not refresh on every request.
- [ ] Add Auth failure-spike alerts and distinguish attack traffic from a broken deploy.

### 5.2 Booking workflow

- [ ] Move the workflow-fields patch plus status update into one Postgres RPC so a concurrent transition cannot persist fields for a losing request.
- [ ] Keep PDF and email timestamps outside the atomic core where appropriate.
- [ ] Add or verify idempotency for every transition and webhook retry.
- [ ] Move slow PDF and email side effects to a bounded queue or job pattern. The UI must show pending state honestly.
- [ ] Add circuit breakers for Resend, Meta, Telegram, and other non-critical vendors.
- [ ] Add a DB-level exclusion constraint for property and parking overlap after the existing-data audit and the pending-status product decision.
- [ ] Add a concurrency test that proves a double booking cannot be inserted.

### 5.3 Payments and webhooks

- [ ] Verify PayMongo webhook idempotency and reconciliation.
- [ ] Add a missed-webhook reconciliation cron.
- [ ] Keep payment settings behind the existing email OTP flow.
- [ ] Run payment load tests only with sandbox or mocked vendors.
- [ ] Add payment failure and refund-cron alerts.
- [ ] Rehearse the manual payout and clawback procedure.

### 5.4 Storage and guest PII

- [ ] Confirm every PII bucket is private and bucket size limits match `uploadLimits.ts`.
- [ ] Complete magic-byte MIME checks and filename sanitization on every remaining upload path.
- [ ] Define signed-URL TTLs per object class and log issuance for government IDs and receipts.
- [ ] Add tenant-scoped object paths where missing.
- [ ] Add deletion propagation for booking, property, and org deletes.
- [ ] Add an orphan-reconcile cron.
- [ ] Enable versioning or soft delete on PII buckets.
- [ ] Define retention per data class and add purge crons with audit events.
- [ ] Add Storage error-rate and egress alerts.

### 5.5 Realtime and inbox

- [ ] Inventory every realtime channel, its auth predicate, and expected concurrent count.
- [ ] Reduce Postgres Changes subscriptions where Broadcast is sufficient.
- [ ] Add connection and channel-count metrics.
- [ ] Verify disconnect cleanup and reconnect backoff.
- [ ] Virtualize large conversation and activity lists.
- [ ] Add Realtime API error and lag alerts.

### 5.6 AI and vendor cost controls

- [ ] Confirm per-feature monthly caps, concurrency reservations, and wallet enforcement.
- [ ] Add a platform daily cost circuit breaker.
- [ ] Add queueing and backpressure for generation jobs.
- [ ] Add vendor failover where possible and feature degradation where not.
- [ ] Add AI cost, failure, and timeout alerts.
- [ ] Keep AI request bodies and prompt data out of logs and PostHog.

### 5.7 Edge Functions

- [ ] Add duration and status metrics for the critical paths, not only error logs.
- [ ] Keep request IDs threaded from client through edge, PostHog, and user-visible 5xx errors.
- [ ] Add cold-start and warm latency separation.
- [ ] Add per-function error-rate alerts.
- [ ] Keep edge bundle and function size within CI budgets.
- [ ] Ensure no edge response or log leaks secrets, tokens, or guest PII.

**Acceptance for Phase 5:**

- Booking, payment, PII, Auth, Realtime, AI, and Edge Function failures are detected, bounded, and recoverable.
- A vendor failure degrades one feature without taking down the booking flow.
- No sensitive data path can be cached publicly.

**Plans and permissions:** capacity or degradation controls that become host-visible must be re-evaluated with the `plans-and-permissions` skill in the same change.
**Activity log:** each new purge, payout action, guest-visible mutation, or operational control must emit an activity event or document N/A.

---

## Phase 6: Capacity and load testing

**Files:**

- `scripts/performance/load-test/public-api.js`
- `scripts/performance/load-test/mixed.js`
- Create: `scripts/performance/load-test/authenticated-api.js`
- Create: `scripts/performance/load-test/write-path.js`
- `docs/workflow/in-progress/production-readiness/checklist/17-load-balancing-and-scalability.md`
- `docs/workflow/in-progress/production-readiness/evidence/`

**Scenario matrix:**

| Scenario                        |   Weight | Must cover                                              |
| ------------------------------- | -------: | ------------------------------------------------------- |
| Public browse and search        |     high | Landing, search, facets, listing detail, suggestions    |
| Guest booking form              |     high | Calendar availability, submit, success, document upload |
| Guest status polling            |     high | Booking status, parking payment status, trip page       |
| Host bookings list and detail   |   medium | Pagination, filters, status transition                  |
| Host finance and analytics      |   medium | Summary, chart data, export                             |
| Inbox send and realtime fan-out |   medium | Threads, messages, read receipts                        |
| Auth flows                      |   medium | Sign in, refresh, sign out, OTP                         |
| AI request                      |      low | Quota, queue, failure, degradation                      |
| Cron during peak                | separate | Every scheduled job while traffic is active             |

**Steps:**

- [ ] Confirm draft capacity targets with the product owner.
- [ ] Deploy the large-tenant synthetic seed to hosted dev.
- [ ] Mock all third parties at the edge. Never load-test live Resend, Meta, PayMongo, Gemini, Groq, Telegram, or Google Maps.
- [ ] Run public-only tests at 25, 50, 100, and 200 VUs.
- [ ] Run mixed read tests at 50, 100, 200, and 400 VUs.
- [ ] Run a controlled write-path test with booking submits and transitions at 25, 50, and 100 VUs.
- [ ] Record every run:
  - Requests per second
  - p50, p95, p99, max latency
  - Error rate and status distribution
  - Cache hit rate
  - Database CPU, IO, memory, swap, connections
  - PostgREST waiting and timeouts
  - Realtime channels
  - Edge cold and warm latency
  - First failing component
- [ ] Identify the first failing component at each tier.
- [ ] Re-run after each major fix and compare against the last run.
- [ ] Use 2x launch concurrency as the non-regression target.

**Initial latency targets:**

| Path                       |                                       Target |
| -------------------------- | -------------------------------------------: |
| Public page                |                             p95 under 500 ms |
| Cached public API          |                             p95 under 300 ms |
| Uncached public API        |                           p95 under 1 second |
| Authenticated list read    |                           p95 under 1 second |
| Booking transition         |                          p95 under 2 seconds |
| Payment webhook processing |                          p95 under 2 seconds |
| AI request start           | p95 under 2 seconds, completion may be async |
| Error rate                 |    under 0.1% for reads, under 1% for writes |

**Acceptance:**

- The first failing component and concurrency are documented.
- At 2x launch target, no core booking or payment path exceeds latency or error budgets.
- Compute and pooler recommendations are based on measured headroom, not the Dashboard warning alone.

**Activity log: load-test writes against synthetic data only. N/A for real org activity.**

---

## Phase 7: Backups, recovery, and maintenance

**Files:**

- `scripts/deploy/backup-supabase.sh`
- `scripts/deploy/rollback-supabase.sh`
- `docs/archive/operations/incident-response.md`
- `docs/archive/operations/production-deployment.md`
- `docs/archive/operations/migration-runbook.md`
- `docs/workflow/in-progress/production-readiness/checklist/30-availability-and-recovery.md`

**Steps:**

- [ ] Define and document uptime, RPO, and RTO targets.
- [ ] Evaluate PITR against the agreed RPO and cost.
- [ ] Verify daily physical backup schedules for dev and future mt-prod.
- [ ] Store an encrypted copy outside the primary Supabase account or region.
- [ ] Add backup integrity and failure alerts.
- [ ] Rehearse a full restore on a fresh project:
  - Postgres schema and data
  - Auth users
  - Storage objects
  - Vault secrets
  - Cron schedules
  - Edge Function configuration
- [ ] Measure actual RTO and compare to target.
- [ ] Add cron disable and enable tooling for restore.
- [ ] Document single-tenant recovery and soft-delete paths.
- [ ] Verify Storage object backup separately because database backups do not contain objects.
- [ ] Verify maintenance mode and feature-availability controls cover booking, payments, inbox, AI, and marketing.
- [ ] Add quarterly restore drills to the operations calendar.

**Acceptance:**

- A rehearsed restore meets RTO.
- Backup failures alert a human.
- Storage is included in the recovery path.
- One feature can be degraded without taking down the core booking flow.

**Plans and permissions: N/A.**
**Activity log: restore and purge actions must be recorded when they touch tenant data.**

---

## Phase 8: Deploy and environment readiness

**Files:**

- `scripts/deploy/deploy-supabase-dev.sh`
- `scripts/deploy/migration-status.sh`
- `.github/workflows/cd-dev.yml`
- `docs/architecture/deployment.md`
- `docs/workflow/in-progress/ci-cd-environments/README.md`
- `docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md`

**Steps:**

- [ ] Resolve the 9-migration drift between local and hosted dev. Do not deploy until the intended set is known.
- [ ] Confirm the concurrent-session work in the current dirty tree is committed or explicitly excluded before any environment change.
- [ ] Add an automated migration drift check to CD dev.
- [ ] Keep dev deploys on `fworvijbrwpyngycotbz` only.
- [ ] Keep legacy prod untouched.
- [ ] When mt-prod is created:
  - Region Singapore
  - Start at Medium candidate
  - PITR decision made before first real user
  - Backups configured before data migration
  - Network restrictions and SSL enforcement reviewed
  - Secrets provisioned through Vault and environment secrets
- [ ] Run advisors, metrics, smoke tests, and load tests on mt-prod before cutover.
- [ ] Add a production release checklist that includes Supabase tier, disk, connection config, backup, advisors, and load-test results.

**Acceptance:**

- Dev and mt-prod schema lineage is known and reproducible.
- No production mutation happens without `kamewave`.
- mt-prod does not launch on Nano or Micro.
- Launch is blocked until capacity and recovery gates pass.

**Plans and permissions: N/A.**
**Activity log: N/A for deploy tooling.**

---

## Phase 9: Documentation and handoff

**Files:**

- `docs/PROJECT.md`
- `docs/architecture/overview.md`
- `docs/architecture/deployment.md`
- `docs/architecture/edge-functions.md`
- `docs/architecture/storage.md`
- `docs/architecture/ai-platform.md`
- `docs/guides/testing/README.md`
- `docs/archive/operations/`

**Steps:**

- [ ] Document the Supabase capacity model and current evidence.
- [ ] Document the final connection topology with verified numbers.
- [ ] Document the advisor accepted-risk matrix.
- [ ] Document scaling triggers and tier decision matrix.
- [ ] Document the load-test results and first-fail components.
- [ ] Document backup and restore drill results.
- [ ] Update the incident runbook with Supabase-specific actions.
- [ ] Add a quarterly Supabase health review checklist.
- [ ] Add a pre-launch Supabase gate to the production-readiness launch audit.

**Acceptance:**

- A new operator can understand current limits, alerts, scaling actions, and recovery steps without asking for context.

---

## Priority order

| Priority | Work                                                               | Reason                                                                             |
| -------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| P0       | Upgrade dev to Small and capture post-upgrade evidence             | Removes the immediate OOM-risk warning and makes all later measurements meaningful |
| P0       | Set up continuous metrics and alerting                             | Capacity work is blind without a baseline                                          |
| P1       | Advisor triage and RLS performance fixes                           | Real warnings found today, but most need intentional handling                      |
| P1       | Public read cache and query-shape fixes                            | First known performance failure point                                              |
| P1       | Booking atomicity and idempotency                                  | Core product correctness under concurrency                                         |
| P2       | Sensitive feature hardening: Auth, Storage, payments, Realtime, AI | Required before real users, not memory related                                     |
| P2       | Load tests with synthetic seed                                     | Only trustworthy way to choose mt-prod tier                                        |
| P2       | Restore rehearsal and PITR decision                                | A backup that has never been restored is not proven                                |
| P3       | Index cleanup and retention tuning                                 | Needs production-like traffic first                                                |

## Review focus

The most likely failure modes this plan must pin down with tests:

1. A connection or fork burst pushes committed memory over the limit even after a tier upgrade.
2. Public traffic reaches Postgres because cache headers are ignored by the Supabase front.
3. A tenant list or export materializes years of bookings in Edge Function memory.
4. A concurrent booking transition leaves persisted fields on a losing request.
5. A payment webhook retry double-applies or silently drops fulfillment.
6. Realtime subscriptions scale linearly with open dashboards and dominate query time.
7. A storage restore is missing objects because only Postgres was restored.
8. An idle-dev advisor finding causes someone to drop a needed index or add an unsafe public policy.
9. A compute upgrade hides an Auth bottleneck because Auth still uses an absolute connection allocation.
10. Dev migration drift causes capacity test results to describe code that is not actually deployed.

## Open decisions for the product owner

1. Confirm the launch and 12-month capacity targets.
2. Approve dev moving to Small and mt-prod starting at Medium.
3. Confirm whether pending parking and property payment states should occupy inventory during the payment window.
4. Confirm backup RPO and RTO, including whether PITR is approved.
5. Confirm the public cache architecture and acceptable listing freshness.
6. Confirm whether slow PDF and email side effects become visibly pending instead of blocking the transition response.
7. Confirm retention windows for guest IDs, receipts, pet documents, notifications, activity, AI usage, and rate-limit rows.
8. Confirm the alert owner and on-call rotation.

## Do not start without

- [ ] Product-owner confirmation of capacity targets and tier direction.
- [ ] A clean or explicitly accounted working tree.
- [ ] Dev migration drift resolved.
- [ ] A completed backup before any tier change or deploy.
- [ ] A new instruction to begin implementation.
