---
title: 'Index the database'
status: active
tags: [workflow, planned, production-readiness, database, postgres]
updated: 2026-09-16
stage: planned
kind: plan
---

# 14 — Index the database

## Implementation status (2026-09-17)

**Phases 14.1, 14.2, 14.4, 14.6: blocked on hosted infra access — not attempted, exactly as this doc's own framing anticipated.** This session has no hosted-Supabase-dashboard access, cannot enable `pg_stat_statements` on hosted dev, cannot run `mcp__supabase__get_advisors`/`mcp__supabase__execute_sql` against a real project, and cannot run `EXPLAIN (ANALYZE, BUFFERS)` against production-like data volume. No measurement was fabricated. What a human needs to do to unblock:

1. **14.1** — In the hosted dev Supabase project: enable `pg_stat_statements` (Database → Extensions), confirm via `mcp__supabase__list_extensions`. Run `mcp__supabase__get_advisors` (both `performance` and `security` types) and capture the top-50-by-total-time statement list, `pg_stat_user_tables.seq_scan` vs `idx_scan` for every tenant-growing table, and table/index sizes. Commit the snapshot to the doc-00 baseline.
2. **14.2** — For each top statement from 14.1, run `EXPLAIN (ANALYZE, BUFFERS)` via `mcp__supabase__execute_sql` against the large-tenant seed from doc 10 Phase 10.6 (not yet built — a separate prerequisite; see doc 10's own status). Record scan type, estimated vs actual rows, sort spill, join-key index usage.
3. **14.4** — Once the FK/access-pattern indexes below have been live on hosted dev/prod for a representative period (not immediately — a new index has `idx_scan = 0` on day one by construction), query `pg_stat_user_indexes` and drop anything still at `idx_scan = 0` after that period, plus anything redundant with a composite index's prefix. Never do this from dev data.
4. **14.6** — After each deploy batch that touches indexes, re-run the advisor + `pg_stat_statements` snapshot and diff against the 14.1 baseline.

**Phase 14.3 (static analysis — the part doable without hosted access): done.** Two independent static audits, no live DB required:

- **Foreign-key index audit** — grepped all 348 migration files for every `REFERENCES`/`FOREIGN KEY` column (inline column defs, table-level `FOREIGN KEY (...)`, and `ALTER TABLE ... ADD COLUMN/ADD CONSTRAINT` forms), cross-referenced against every `CREATE INDEX` (composite leading column counts as covering that column), with `DROP COLUMN`/`DROP TABLE` tracked so a later-dropped FK isn't flagged. 120 tables, 199 FK columns found by the script. 102 already covered (sole or composite-leading). 97 raw gaps — of which **11 were false positives** (the FK column is itself a `PRIMARY KEY` or `UNIQUE` column, which Postgres auto-indexes; e.g. `ai_platform_org_credit_wallet.organization_id UUID PRIMARY KEY REFERENCES organizations(id)`), leaving **86 real gaps**: 36 on `created_by`/`updated_by`/`sent_by`/`accepted_by`/`invited_by`/`actor_user_id`/`triggered_by`/`uploaded_by`/`assigned_by`/`generated_by` admin-audit columns, 50 on tenant-scope/cross-entity FKs. **The regex-based script itself was not 100% complete** — while hand-verifying every column against its source `CREATE TABLE` statement before writing the migration (see the "New migration" note below), 3 more genuine FK gaps were found that the script's regex missed entirely (`finance_telegram_reminder_log.line_item_id`, `support_ticket_messages.ticket_id`, `inbox_thread_metrics.organization_id` — all confirmed by direct `grep`/`Read` of their `CREATE TABLE` statements) and were indexed anyway. This means the true FK-gap count is at least 89, not 86 — the script's coverage is a strong first pass, not a guaranteed-exhaustive one; every column that made it into the final migration was independently confirmed against its source migration regardless of which method found it.
- **Access-pattern cross-check** — every row in the table below was checked against existing `CREATE INDEX` statements and, where a service file exists, the actual `.eq()`/`.order()`/`.gte()`/`.lte()` call shapes in `_shared/databaseService.ts`, `_shared/financeService.ts`, `_shared/notificationService.ts`/`notifications-list/index.ts`, and `list-activity-log/index.ts` — not guessed.

**Result: this repo's hot access patterns were already indexed before this pass** (confirms both prior audits' framing). What changed is 42 new FK-supporting indexes on tables that grow with tenant activity, landed in a new migration; the remaining ~47 FK gaps are on `*_by`/`actor_user_id`-style attribution columns or on tables bounded by tenant _count_ (not activity), left undocumented-but-unindexed per Phase 14.4's write-cost tradeoff, and are listed in the audit table below with their reason.

**New migration:** `supabase/migrations/20261316121800_fk_and_access_pattern_indexes.sql`. Uses plain `CREATE INDEX IF NOT EXISTS`, not `CONCURRENTLY` — see Phase 14.5 section below and the migration's own header comment for why, and the runbook for the manual `CONCURRENTLY` re-run procedure before a hosted deploy. **Not verified against a running local Postgres this session** — `bun run status:supabase` failed (`dial unix .../docker.sock: connect: no such file or directory`, Docker daemon not running); per this task's constraints, the stack was not started. Every table/column name and existing-index claim in the migration was instead cross-checked by reading the actual `CREATE TABLE`/`CREATE INDEX` statements in the source migrations (shown inline in this status section and in the migration's own comments) rather than assumed.

### Access-pattern table cross-check

| Access pattern (doc's own list)                       | Already indexed?                                                                                                                                                                                                                                                                | Verified against                                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bookings by property + status + date range, sorted    | **Yes** — `idx_guest_submissions_property_id_status`, `idx_guest_submissions_property_id_created_at`, `idx_guest_submissions_parking_id_created_at`, plus generated+indexed `check_in_date_sql`/`check_out_date_sql` (doc 10's migration)                                       | `_shared/databaseService.ts` `listBookings` fast path: `.eq('property_id'/'parking_id')` + status filter + `.order('check_in_date'\|'created_at')` |
| Bookings by org across properties                     | Partial — org-wide scope still uses the in-memory union path (doc 10 Phase 10.2, not this doc's scope); per-property indexes above still back each unioned query                                                                                                                | `listBookings` org-wide branch                                                                                                                     |
| Finance line items by property + period               | **Yes** — `idx_finance_line_items_property_id_occurred_on (property_id, occurred_on DESC)`                                                                                                                                                                                      | `_shared/financeService.ts` `.eq('property_id')` + `.gte/.lte('occurred_on')`                                                                      |
| Messages by thread + time                             | **Yes** — `idx_social_messages_conversation_sent (conversation_id, sent_at ASC)`                                                                                                                                                                                                | `_shared/chatMessageLifecycle.ts` — every query is `.eq('conversation_id', …)`                                                                     |
| Notifications by user + unread                        | **Yes, different shape than the doc guessed** — no `read_at` column on `notifications` itself; unread is `notification_reads!left(id)` filtered by `user_id`, backed by `idx_notification_reads_user_notification (user_id, notification_id)` + `idx_notifications_org_created` | `notifications-list/index.ts`: `.eq('organization_id')` + `.eq('notification_reads.user_id', …)` + `.order('created_at')`                          |
| Activity log by org + time                            | **Yes** — keyset `(organization_id, created_at DESC, id DESC)`, matches the cursor exactly                                                                                                                                                                                      | `list-activity-log/index.ts`: `.eq('organization_id')` + `.order('created_at', desc)` + `.order('id', desc)` + `or(created_at.lt...)` cursor       |
| Public listing search + facets                        | Not re-audited this pass — doc 08/23 territory, no GIN/pg_trgm gap found in the migrations grepped                                                                                                                                                                              | Not verified against live query plans (blocked, 14.2)                                                                                              |
| Availability by property + date range                 | **Yes** — `property_blocked_dates.property_id` indexed (doc 10-adjacent); no PostGIS/date-range GiST in use, plain btree composite sufficient at current query shape                                                                                                            | `property_blocked_dates` migrations                                                                                                                |
| Parking match engine geo queries                      | N/A — no PostGIS/earthdistance extension or geo column found in any migration; not applicable to this schema                                                                                                                                                                    | Grepped all migrations for `postgis`/`earthdistance`/`geography` — none found                                                                      |
| Cron scan predicates (`contract_end_date`, reminders) | Not re-audited this pass — doc 15 already covered cron overlap/scan-shape; no new partial-index gap found in the FK sweep                                                                                                                                                       | Not verified against live query plans (blocked, 14.2)                                                                                              |

### Foreign-key audit table (~89 real gaps: 86 from the script + 3 found during hand-verification, after excluding 11 PK/UNIQUE-self-indexed false positives)

**Indexed in the new migration (42) — tables that grow with tenant activity:**

| Table.column                                                                                     | References                                           | Why (query pattern)                                                                                       |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `guest_submissions.parking_pinned_id`                                                            | `parkings`                                           | Parking broadcast pinned-lookup                                                                           |
| `guest_submissions.parking_request_organization_id`                                              | `organizations`                                      | Parking broadcast fan-out candidate scoping                                                               |
| `guest_submissions.guest_auth_user_id`                                                           | `auth.users`                                         | Guest portal "my trips" lookup                                                                            |
| `finance_telegram_reminder_log.line_item_id`                                                     | `finance_line_items`                                 | Reminder-cron `.in('line_item_id', …)` dedupe sweep                                                       |
| `notifications.booking_id`, `.conversation_id`                                                   | `guest_submissions`, `social_conversations`          | CASCADE-delete FK scan; grows with every workflow/inbox event                                             |
| `notification_reads.notification_id`                                                             | `notifications`                                      | CASCADE-delete FK scan (leading-column gap; `(user_id, notification_id)` already covers user-led lookups) |
| `social_messages.organization_id`                                                                | `organizations`                                      | Org-wide inbox surfaces                                                                                   |
| `social_conversations.connection_id`                                                             | `social_channel_connections`                         | Per-channel-connection conversation lookup (token refresh/disconnect)                                     |
| `inbox_thread_metrics.conversation_id`, `.organization_id`                                       | `social_conversations`, `organizations`              | Per-thread response-time rollups, written every message                                                   |
| `support_tickets.property_id`, `.parking_id`                                                     | `properties`, `parkings`                             | `list-support-tickets-admin` scopes independently by each                                                 |
| `support_ticket_messages.ticket_id`                                                              | `support_tickets`                                    | Ticket thread fetch, ordered by time                                                                      |
| `ai_platform_usage_events.property_id`                                                           | `properties`                                         | Property-scoped AI usage views; `organization_id` already composite-covered                               |
| `ai_platform_org_credit_ledger.related_usage_event_id`                                           | `ai_platform_usage_events`                           | Ledger-to-usage-event join                                                                                |
| `ai_dashboard_assistant_conversations.property_id`                                               | `properties`                                         | Property-scoped assistant threads                                                                         |
| `ai_dashboard_assistant_pending_actions.conversation_id`, `.message_id`                          | `ai_dashboard_assistant_conversations`, `…_messages` | Pending-action-to-source-message lookup                                                                   |
| `ai_dashboard_assistant_action_audit.conversation_id`, `.message_id`, `.property_id`, `.user_id` | (respective)                                         | Every executed/declined assistant action logged; grows continuously                                       |
| `ai_dashboard_assistant_usage_daily.organization_id`                                             | `organizations`                                      | Daily usage counters, upserted per org per assistant call                                                 |
| `org_payment_transactions.org_subscription_id`, `.plan_id`                                       | `org_subscriptions`, `pricing_plans`                 | Billing reconciliation joins                                                                              |
| `parking_payment_transactions.organization_id`, `.parking_id`                                    | `organizations`, `parkings`                          | Parking payouts / super-admin overview scoping                                                            |
| `org_subscription_events.property_id`, `.new_plan_id`, `.previous_plan_id`                       | `properties`, `pricing_plans` (x2)                   | Portfolio-bundling plan-change audit trail                                                                |
| `import_batches.property_id`                                                                     | `properties`                                         | Import history per property                                                                               |
| `import_batch_rows.resolved_property_id`                                                         | `properties`                                         | Per-row resolved property on org-level multi-property imports                                             |
| `marketing_generation_references.organization_id`                                                | `organizations`                                      | Org-scoped reference-asset lookups                                                                        |
| `calendar_sync_events.booking_id`, `.blocked_date_id`                                            | `guest_submissions`, `property_blocked_dates`        | Append-only sync audit trail, grows every sync tick                                                       |
| `property_analytics_reviews.organization_id`                                                     | `organizations`                                      | Cross-property org rollup views                                                                           |
| `property_smart_pricing_recommendations.run_id`                                                  | `property_smart_pricing_runs`                        | Recommendations grouped by the run that produced them                                                     |
| `guest_reviews.booking_id`                                                                       | `guest_submissions`                                  | Review-per-booking lookup                                                                                 |
| `guest_saved_properties.user_id`                                                                 | `auth.users`                                         | Authenticated guest's saved-listing wishlist                                                              |
| `telegram_admin_notification_log.booking_id`, `telegram_staff_notification_log.booking_id`       | `guest_submissions`                                  | Per-booking alert-log dedupe, append-only                                                                 |

**Deferred — documented, not indexed (~47 gaps: ~11 tenant-scope on static/config tables + 36 admin-audit attribution columns):**

| Category                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Count | Reason (Phase 14.4 write-cost tradeoff)                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*_by`/`actor_user_id`/`triggered_by`/`uploaded_by`/`assigned_by`/`generated_by` columns (36) — e.g. `organization_invitations.sent_by`, `property_blocked_dates.created_by`, `marketing_publications.created_by`, `platform_settings.updated_by`                                                                                                                                                                                                                                                                                                  | 36    | Point at `auth.users` from an audit/attribution column, not a query-path FK — nothing in the codebase filters or joins by "who created this row" at list-endpoint scale. Read pattern (if any) is always scoped by the table's own org/property/parking FK first. |
| AI/settings singleton tables already self-indexed via `PRIMARY KEY`/`UNIQUE` (`ai_dashboard_assistant_org_settings.organization_id`, `ai_platform_org_credit_wallet.organization_id`, `ai_platform_org_settings.organization_id`, `ai_platform_property_settings.property_id`, `guest_profiles.user_id`, `parking_settings.parking_id`, `platform_super_admins.user_id`, `property_calendar_export.property_id`, `property_smart_pricing_settings.property_id`, `telegram_parking_settings.parking_id`, `voice_receptionist_settings.property_id`) | 11    | False positives from the raw grep — Postgres auto-creates a unique index backing every `PRIMARY KEY`/`UNIQUE` constraint; already covered, correctly excluded from the migration.                                                                                 |
| Team/invitation/role tables (`organization_members`, `organization_invitations`, `property_members`, `property_invitations`, `parking_members`, `parking_invitations`, `*_custom_roles`) FK columns beyond the primary org/property/parking scope                                                                                                                                                                                                                                                                                                  | ~14   | Bounded by team headcount per org/property/parking (tens, not thousands) — doesn't grow with booking/message/finance activity. Matches doc 10's own tenant-_count_-vs-tenant-_activity_ distinction.                                                              |
| Per-property/parking singleton settings tables (`telegram_*_settings`, `app_settings`, `org_settings`, `social_inbox_settings`, `meta_inbox_oauth_state`)                                                                                                                                                                                                                                                                                                                                                                                          | ~9    | One row per property/parking/org; the table itself never exceeds tenant count regardless of activity history.                                                                                                                                                     |
| `platform_*_settings` / `voice_receptionist_global_settings` / `ai_*_global_settings` `updated_by` and similar platform-singleton audit columns                                                                                                                                                                                                                                                                                                                                                                                                    | ~6    | Single global row per table; irrelevant to indexing (a handful of rows total, platform-wide).                                                                                                                                                                     |
| `guest_submissions.imported_from_batch_id`, other already-composite-covered leading columns misclassified by the raw grep before manual review                                                                                                                                                                                                                                                                                                                                                                                                     | —     | Verified covered on manual review; see "already covered" note inline where applicable.                                                                                                                                                                            |

## Measured before / after

| Metric                                                                      | Before                         | After                                                    | Difference                                  |
| --------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------- | ------------------------------------------- |
| FK columns (348 migrations)                                                 | 199 found; coverage unknown    | 102 already indexed; 86–89 real gaps                     | First full static inventory                 |
| New indexes                                                                 | —                              | 42 in `20261316121800_fk_and_access_pattern_indexes.sql` | Tenant-growing FK delete/join paths covered |
| Left unindexed                                                              | —                              | ~47 (audit `*_by` columns + static/config tables)        | Write-cost tradeoff, documented             |
| Hot access patterns (bookings, finance, inbox, notifications, activity log) | Already indexed (prior audits) | Confirmed against real query shapes                      | No speculative duplicates                   |
| `pg_stat_statements` / EXPLAIN / unused-index drop                          | None                           | Still blocked on hosted dashboard                        | Open                                        |

## Remaining work to finalize

Static FK/access-pattern audit + 42 new indexes in `20261316121800` are shipped. Measured plans and unused-index drops are not.

| #   | Work                                                                                                                                                   | Blocker                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| 1   | Enable / snapshot `pg_stat_statements` top-50 on hosted-dev (feeds doc 00).                                                                            | Hosted-dev               |
| 2   | Run Supabase performance + security advisors; triage every finding.                                                                                    | Hosted-dev               |
| 3   | `EXPLAIN (ANALYZE, BUFFERS)` every top statement against the large-tenant seed.                                                                        | Hosted-dev + doc 10 seed |
| 4   | Apply `20261316121800` with `CREATE INDEX CONCURRENTLY` on hosted (see runbook). Local migration is `IF NOT EXISTS` without `CONCURRENTLY` on purpose. | Hosted deploy path       |
| 5   | Drop unused/redundant indexes using `pg_stat_user_indexes` from a traffic-carrying DB.                                                                 | Hosted-dev with traffic  |
| 6   | Apply the migration locally (`bun run db:migrate`) and confirm it applies cleanly.                                                                     | Local Supabase Docker    |

## Goal

Every query in the request path uses an index. No sequential scan on a table that grows with tenant activity. Indexes are justified by measured plans, not guessed.

## Prior art — do not redo

[`performance-optimization-production-readiness.md`](../../for-testing/performance-optimization-production-readiness.md) §C states: **"No missing-index issues found — schema indexing (`activity_log`, `guest_submissions`, `notifications`, etc.) is solid. The risk is entirely in unbounded, application-side query shape, not missing indexes."**

[`pre-production-launch-audit.md`](../../for-testing/pre-production-launch-audit.md) deferred deeper index work explicitly: _"Index work needs `pg_stat_statements` on hosted dev."_

**So this doc is not "add indexes."** The prior audits already concluded the obvious ones exist. This doc is: turn on the measurement that both audits said was missing, then act only on what it shows.

## Current state

- 89 of 346 migrations contain `CREATE INDEX`. Indexing is an established practice in this repo.
- `pg_stat_statements` is **not confirmed enabled** on hosted dev — that is the gate.
- Two known unbounded queries (doc 10) will change which indexes matter once they are rewritten to filter in SQL. **Do doc 10 first**, or you will index the wrong shape.

## Phases

### Phase 14.1 — Enable measurement (blocking prerequisite)

- Enable `pg_stat_statements` on hosted dev; confirm via `supabase` MCP `list_extensions`.
- Run `mcp__supabase__get_advisors` for the performance and security advisor output — Supabase surfaces missing-index and RLS-performance findings directly.
- Capture: top 50 statements by total time, all sequential scans on large tables (`pg_stat_user_tables.seq_scan` vs `idx_scan`), and table/index sizes.

### Phase 14.2 — Plan the real queries

For each top statement, run `EXPLAIN (ANALYZE, BUFFERS)` and record:

- Scan type per node, rows estimated vs actual (a large mismatch means stale statistics or a bad predicate, not always a missing index).
- Whether the sort is in memory or spilling to disk.
- Index usage on the join keys.

Use **production-like data volume**. An `EXPLAIN` on 50 dev rows always says "seq scan is fine" and teaches nothing. This requires the large-tenant seed from doc 10 Phase 10.6.

### Phase 14.3 — Index the access patterns that matter

The patterns this app actually runs, to check specifically:

| Access pattern                                               | Likely index shape                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Bookings by property + status + date range, sorted           | Composite `(property_id, status, check_in_date)` — column order follows equality-then-range |
| Bookings by org across properties                            | `(org_id, created_at DESC)`                                                                 |
| Finance line items by property + period                      | `(property_id, period_start)`                                                               |
| Messages by thread + time                                    | `(thread_id, created_at DESC)`                                                              |
| Notifications by user + unread                               | Partial index `WHERE read_at IS NULL`                                                       |
| Activity log by org + time                                   | Already keyset-paginated; verify the index matches the cursor                               |
| Public listing search + facets                               | Depends on the filter set; consider GIN for JSONB/array filters, `pg_trgm` for text search  |
| Availability by property + date range                        | Range/GiST if using date ranges, otherwise composite btree                                  |
| Parking match engine geo queries                             | PostGIS/earthdistance index if geo filtering is in SQL                                      |
| Cron scan predicates (`contract_end_date`, reminder windows) | Partial indexes matching the cron's exact `WHERE`                                           |

**Rules:**

- **Composite column order**: equality columns first, then the range/sort column. A wrong order makes the index unusable for the query.
- **Partial indexes** for skewed predicates (unread, active, pending) — far smaller and faster than a full index.
- **Covering indexes** (`INCLUDE`) to enable index-only scans on hot read paths.
- **Every foreign key needs an index** on the referencing side, or cascading deletes and joins scan. Postgres does **not** create these automatically. Audit all FKs — this is the single most common real finding.

### Phase 14.4 — Remove what does not earn its place

Every index costs write throughput and storage. From `pg_stat_user_indexes`:

- Drop indexes with `idx_scan = 0` after a representative period (but not before, and never based on dev data).
- Drop indexes fully redundant with the prefix of a composite index.
- Keep unique indexes regardless of scan count — they enforce correctness, not speed.

### Phase 14.5 — Safe migration practice

- All index creation on a populated table uses `CREATE INDEX CONCURRENTLY`, which **cannot run inside a transaction block**. Supabase migrations run in a transaction by default — this needs explicit handling and is the most likely way this work causes an incident.
- Never edit a shipped migration (repo rule, hook-enforced). Add a new one.
- Document the index rationale in the migration's comment: which query, which plan, which measurement.
- Large index builds lock or consume I/O. Schedule for low-traffic windows and document in `docs/archive/operations/migration-runbook.md`.

### Phase 14.6 — Guard

- Re-run the advisor + `pg_stat_statements` snapshot after each deploy batch; diff against the baseline.
- Add a periodic (monthly) review item: new sequential scans on growing tables.
- Check `pg_stat_user_tables` for tables needing `VACUUM`/`ANALYZE` tuning — bloat degrades index effectiveness and looks like a missing index.

## Edge cases

- **RLS changes plans.** A policy's predicate becomes part of the query, so a policy calling a function per row (`user_can_access_*`) can dominate cost. Supabase's advisor flags this. Since RLS is **not** this repo's primary access-control layer (edge checks are), policy-driven plan costs still apply wherever RLS is on. Cross-check doc 22.
- **Indexes do not help low-selectivity predicates.** An index on a boolean with a 50/50 split is ignored; the planner is right to ignore it.
- **`ILIKE '%term%'` cannot use a btree index.** Text search needs `pg_trgm` + GIN, or a `tsvector` column. This affects the search boxes in doc 08.
- **JSONB containment** needs GIN. This repo stores JSONB-scoped permissions and settings; filtering on those without GIN scans every row.
- **Index bloat** after heavy update churn — `REINDEX CONCURRENTLY` periodically on hot tables.
- **Statistics staleness** after a bulk import (this app has an import module) — `ANALYZE` the table after a large commit or the planner chooses badly.
- **Timezone-derived predicates** — filtering on `date_trunc('day', ts AT TIME ZONE 'Asia/Manila')` cannot use a plain index on `ts`. Either index the expression or store a Manila date column.
- **More indexes slow writes.** The booking write path fans out to many tables already; adding five indexes to a hot table has a measurable insert cost.

## Exit gate

- [ ] `pg_stat_statements` enabled on hosted dev; top-50 snapshot committed to the doc-00 baseline. — **blocked**, no hosted dashboard access this session (Phase 14.1).
- [ ] Supabase performance + security advisors run; every finding triaged. — **blocked**, same reason (Phase 14.1).
- [x] Doc 10's query rewrites landed **before** index decisions. — `listBookings`/`fetchAllBookingsForFinance` SQL pushdown (doc 10 Phase 10.2) confirmed shipped before this pass began.
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` recorded against large-tenant seed data for every top statement. — **blocked**, needs both hosted access and doc 10's Phase 10.6 seed script, neither available this session (Phase 14.2).
- [x] Every foreign key has a supporting index, or a documented reason it does not. — full static audit done (199 FK columns found by script + 3 more caught during hand-verification, ~89 real gaps after excluding 11 PK/UNIQUE false positives); 42 indexed in the new migration, the rest documented with reason in the audit table above.
- [x] New indexes added via `CREATE INDEX IF NOT EXISTS` in a new migration, each with a rationale comment — **not `CONCURRENTLY`**, see the migration's own header comment and the runbook's new "Index deployment procedure" section for why and the manual `CONCURRENTLY` re-run path before a hosted deploy (Phase 14.5 deviation, deliberate and documented).
- [ ] Unused/redundant indexes dropped based on production-like usage data. — **blocked**, needs `pg_stat_user_indexes` from a live, traffic-carrying database (Phase 14.4).
- [ ] No sequential scan remains on any tenant-growing table in the request path. — **cannot verify** without live `EXPLAIN` data (Phase 14.2); static analysis found no obvious gap beyond what this pass indexed.
- [x] Runbook updated with the index-deployment procedure. — `docs/archive/operations/migration-runbook.md` §11h.

## Docs / Plans / activity-log

- **Docs:** `docs/archive/operations/migration-runbook.md` (mandatory), `docs/PROJECT.md` (data model), `docs/architecture/` database notes.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A — schema change, recorded in the runbook and migration history.
