---
title: 'Index the database'
status: active
tags: [workflow, planned, production-readiness, database, postgres]
updated: 2026-09-16
stage: planned
kind: plan
---

# 14 — Index the database

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

- [ ] `pg_stat_statements` enabled on hosted dev; top-50 snapshot committed to the doc-00 baseline.
- [ ] Supabase performance + security advisors run; every finding triaged.
- [ ] Doc 10's query rewrites landed **before** index decisions.
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` recorded against large-tenant seed data for every top statement.
- [ ] Every foreign key has a supporting index, or a documented reason it does not.
- [ ] New indexes added via `CONCURRENTLY` in new migrations, each with a rationale comment.
- [ ] Unused/redundant indexes dropped based on production-like usage data.
- [ ] No sequential scan remains on any tenant-growing table in the request path.
- [ ] Runbook updated with the index-deployment procedure.

## Docs / Plans / activity-log

- **Docs:** `docs/archive/operations/migration-runbook.md` (mandatory), `docs/PROJECT.md` (data model), `docs/architecture/` database notes.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A — schema change, recorded in the runbook and migration history.
