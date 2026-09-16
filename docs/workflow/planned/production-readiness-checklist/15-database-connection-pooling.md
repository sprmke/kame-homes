---
title: 'Database connection pooling'
status: active
tags: [workflow, planned, production-readiness, database, supabase]
updated: 2026-09-16
stage: planned
kind: plan
---

# 15 — Database connection pooling

## Goal

The database never runs out of connections under load, and no edge function, cron, or script holds a connection longer than it needs.

## Current state — what this app actually does

This is worth stating plainly because the generic advice does not apply cleanly:

**Edge functions do not open Postgres connections.** All 300 functions use `supabase-js` (`_shared/supabaseJs.ts`) over **PostgREST/HTTP**. PostgREST maintains its own server-side pool. So the classic "300 serverless instances exhaust `max_connections`" failure mode is largely **not** this app's risk profile.

Where direct connections _do_ happen:

| Path                                                | Connection type       | Risk                                    |
| --------------------------------------------------- | --------------------- | --------------------------------------- |
| `supabase-js` from edge functions                   | HTTP → PostgREST pool | Low; bounded by PostgREST config        |
| `pg_cron` + `pg_net` scheduled jobs                 | In-database           | Low, but concurrent jobs share the pool |
| Backup/restore scripts (`DEV_DB_URL`/`PROD_DB_URL`) | Direct `psql`         | Long-lived, can hold locks              |
| `supabase db` CLI / migrations                      | Direct                | Migration locks block writes            |
| Any future direct-connection consumer               | Direct                | The real future risk                    |

The centralization work is already done and is an asset here: recent commits centralized `supabase-js` usage through `_shared/supabaseJs.ts`, so there is one place to configure client behavior.

## Phases

### Phase 15.1 — Document and verify the actual topology

Write the connection model into `docs/PROJECT.md`: who connects, how, through which pooler, with which limits. Then verify against the hosted project:

- Current `max_connections` and the pooler mode (transaction vs session) for the Supabase project tier.
- PostgREST's `db-pool` setting.
- Peak concurrent connections observed (`pg_stat_activity` sampling, or the Supabase dashboard).

Without this, every other phase is guesswork.

### Phase 15.2 — Client instantiation hygiene

Audit `_shared/supabaseJs.ts` consumers for per-request client creation. Creating a `supabase-js` client per request is cheap (it is an HTTP wrapper, not a pool), but:

- Service-role clients must be created once per instance, not per call, to avoid re-parsing config and to keep auth state predictable.
- **Never** leak a service-role client into a path that should be user-scoped — that is an authorization bug, not a performance one (doc 21/22).
- Confirm the realtime/websocket client is separate and not instantiated per request.

### Phase 15.3 — Transaction and lock discipline

Connections are exhausted by long transactions far more often than by high connection counts.

- Set `statement_timeout` (e.g. 10–30 s for request paths) and `idle_in_transaction_session_timeout` at the role level so a stuck statement cannot hold a connection indefinitely.
- Audit multi-step writes that should be atomic. `supabase-js` has no multi-statement transaction over PostgREST — atomicity requires a Postgres function (RPC). The booking transition path (`workflowOrchestrator`) performs several writes plus side effects; confirm which parts must be atomic and whether a partial failure can leave inconsistent state.

**This is the most valuable finding class in this doc** — it presents as data corruption, not as a pool problem.

### Phase 15.4 — Cron and batch discipline

- `pg_cron` jobs: bound each job's runtime; a long-running job holds a connection and can overlap with its next scheduled run. Add a guard so a job does not start if the prior run is still going.
- Batch operations (imports, backfills, doc 09's media backfill) must chunk with a pause, not run as one giant transaction.
- Scheduled jobs via `pg_net` make outbound HTTP; a slow endpoint holds the job open. Set timeouts.

### Phase 15.5 — Direct-connection scripts

For `scripts/deploy/*` and backup/restore:

- Use the **session** pooler or a direct connection (not the transaction pooler) — `pg_dump`/`pg_restore` and migrations need session-level features that transaction pooling does not support. Using the wrong port is a common, confusing failure.
- Ensure scripts always close connections, including on error paths.
- Migrations take an advisory lock; a failed migration can leave it held. Document how to detect and clear it in the runbook.

### Phase 15.6 — Load test and headroom

Run a load test (doc 17) and record connection counts at peak. Define the scaling trigger: at what concurrent-user level does the current tier's pool saturate, and what is the action (raise pool size, upgrade tier, add read replicas).

## Edge cases

- **Transaction-mode pooling breaks session features** — prepared statements, `SET` session variables, `LISTEN/NOTIFY`, and advisory locks behave differently or fail. If any RPC relies on session state, it must not run through the transaction pooler.
- **Connection storms after an incident** — when the DB recovers, every retrying client reconnects at once and knocks it down again. Retries need exponential backoff **with jitter** (doc 18).
- **Realtime connections are separate** from the Postgres pool, with their own limits. Many open dashboard tabs each hold realtime subscriptions; that is the more likely connection ceiling for this app, and it scales with host activity.
- **`SECURITY DEFINER` RPCs** run with elevated rights; a long-running one is both a pool risk and a privilege risk. The launch audit already revoked PUBLIC execute on several (P0-5) — keep that discipline.
- **Idle-in-transaction from a crashed function** holds locks until timeout. The timeout setting in 15.3 is the only real defense.
- **Read replicas change consistency.** If added, a read-after-write on a replica can show stale data immediately after a mutation. Route reads that follow a write to the primary.

## Exit gate

- [ ] Connection topology documented in `docs/PROJECT.md` with verified pooler mode and limits.
- [ ] `statement_timeout` and `idle_in_transaction_session_timeout` set at the role level.
- [ ] Multi-step writes audited; any that require atomicity moved into an RPC, or the partial-failure behavior documented and made idempotent.
- [ ] Cron jobs bounded with overlap guards; batch jobs chunked.
- [ ] Deploy/backup scripts use the correct pooler mode and close connections on error paths.
- [ ] Peak connection usage measured under load test; scaling trigger documented.
- [ ] Realtime connection limits documented alongside the Postgres pool.

## Docs / Plans / activity-log

- **Docs:** `docs/PROJECT.md`, `docs/archive/operations/migration-runbook.md`, `docs/archive/operations/scheduled-jobs-and-testing.md`, `scripts/README.md`.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
