---
title: 'Database operations'
status: active
tags: [workflow, planned, production-readiness, database, migrations]
updated: 2026-09-16
stage: planned
kind: plan
---

# 19 — Database

Schema, migrations, data integrity, and operational safety. Query performance is doc 14; pooling is doc 15; backups are doc 30.

## Prior art — do not redo

| Shipped                          | Where                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Migration version conflict check | `scripts/` + `check-migration-versions.sh` in CI (launch audit P1-1, after five duplicate timestamps were found) |
| Migration security check         | `check-migration-security.sh` — catches missing REVOKE on `SECURITY DEFINER` RPCs                                |
| Weekly migration replay          | `.github/workflows/migration-replay.yml` — `db:reset` + `db lint --local`                                        |
| RPC privilege hardening          | Launch audit P0-5 — PUBLIC/anon execute revoked on AI wallet + RLS helper RPCs                                   |
| PII backup table dropped         | P0-4                                                                                                             |
| Shipped-migration edit block     | Claude Code hook                                                                                                 |
| Backup before deploy             | `bun run backup:supabase:dev/:prod`, automatic pre-deploy                                                        |

Migration hygiene is genuinely strong here. The gaps are data integrity constraints and lifecycle/retention.

## Current state

- 346 migrations, 71 with `ENABLE ROW LEVEL SECURITY`.
- Booking status is `TEXT` + `CHECK`, deliberately not a Postgres `ENUM` (documented choice — enum changes are hard to reverse; keep it).
- No documented data retention or archival policy.

## Phases

### Phase 19.1 — Constraint audit

Walk every table and verify the database itself enforces what the app assumes. Application-layer-only invariants break the moment a script, an AI tool call, or a manual fix touches the data.

| Constraint            | Check                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOT NULL`            | On every column the app never expects to be null. The `property_id IS NULL` bug (P1-2) was exactly this class                                                                     |
| Foreign keys          | Present on every relationship, with a deliberate `ON DELETE` action                                                                                                               |
| `CHECK`               | Status values, non-negative money, date ordering (`check_out > check_in`), percentage ranges                                                                                      |
| `UNIQUE`              | Slugs (per scope), emails where required, provider event IDs for webhook dedupe, natural keys                                                                                     |
| Exclusion constraints | Overlapping booking/parking date ranges for the same unit — the strongest possible defense against double-booking, enforced by the DB rather than by a race-prone read-then-write |
| Defaults              | Timestamps, status, tenant scoping columns                                                                                                                                        |

**The exclusion-constraint item is the highest-value one**: double-booking is the worst failure mode for this product, and application-level overlap checks (`parkingDateOverlap.ts`, availability service) are vulnerable to concurrent requests.

### Phase 19.2 — Tenant scoping integrity

Every tenant-scoped table must have a non-nullable `org_id` / `property_id` / `parking_id`, with an FK. A NULL scope column is a cross-tenant leak waiting for a query that forgets to filter (doc 22).

Write a verification query listing every table lacking a scope column, and justify each exception (platform-level tables, lookup tables).

### Phase 19.3 — Money and precision

- Confirm all monetary columns are `NUMERIC`, never `float`. A float-typed peso amount silently produces rounding errors in payouts and refunds.
- Confirm currency is stored explicitly where multi-currency is possible.
- Confirm rounding rules are applied in one place (`bookingFinance.ts` / `financeService.ts`), not per call site.

### Phase 19.4 — Migration practice for production

The repo has good CI checks; add the production-safety layer:

- Every migration must be **backward compatible** with the currently deployed client (expand → migrate → contract, never a destructive step in the same release as the code change).
- Document the safe pattern for: adding a NOT NULL column (add nullable → backfill → set not null), renaming (add new → dual-write → migrate → drop), dropping a column (stop reading → wait a release → drop).
- Long-running DDL (index builds, table rewrites) must be flagged and scheduled (doc 14 Phase 14.5).
- Every migration needs a documented rollback or an explicit "forward-only" note.

### Phase 19.5 — Data lifecycle and retention

Currently undefined. Needed before launch because this system stores guest PII:

| Data                                        | Retention                                                                                    | Basis                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Guest PII (IDs, receipts, vaccination docs) | Define a limit and purge                                                                     | Privacy obligation; these are the most sensitive objects in the system |
| Booking records                             | Long (financial/legal)                                                                       |                                                                        |
| Activity log                                | Partitioning already deferred in [`activity-log-followups.md`](../activity-log-followups.md) |                                                                        |
| AI usage ledger                             | Define                                                                                       | Grows fastest                                                          |
| Inbox messages                              | Define                                                                                       |                                                                        |
| Notifications                               | Short; purge read + old                                                                      |                                                                        |
| Rate-limit rows                             | Sweep aggressively                                                                           | Otherwise the limiter's table becomes the bottleneck                   |
| Query/AI caches                             | TTL sweep (doc 12)                                                                           |                                                                        |

Each needs a cron, and each purge of guest data needs an audit trail.

### Phase 19.6 — Environment parity and seeding

- Local, hosted dev, and (future) prod must share one schema lineage, proven by the existing replay workflow.
- The large-tenant seed (doc 10) becomes a committed fixture.
- `sync:prod-data` must scrub PII when pulling into dev — verify it does; if not, that is a privacy finding, not a convenience gap.

## Edge cases

- **`CHECK` constraint added to a table with violating rows** fails the migration. Always audit existing data first and add `NOT VALID` then `VALIDATE CONSTRAINT` for large tables.
- **`ON DELETE CASCADE` on a tenant FK** means deleting an org silently deletes everything. That may be intended for GDPR-style deletion and catastrophic for an accidental delete. Choose per relationship and document it; pair with the org danger-zone work in [`super-admin-console-followups.md`](../super-admin-console-followups.md).
- **Timezone columns** — `timestamptz` everywhere; `timestamp` without zone plus a Manila-facing product is a guaranteed date bug.
- **Enum-as-TEXT + CHECK** (the repo's choice) means adding a status requires updating the constraint **and** both status machines (`_shared/statusMachine.ts` and the client mirror). Read `.cursor/rules/booking-workflow.mdc` before any status change.
- **JSONB permission blobs** have no schema enforcement. A typo in a permission key silently grants or denies nothing. Validate on write and consider a `CHECK` with a JSON schema.
- **Migration + RLS ordering** — enabling RLS without a policy locks everyone out including the app. Since edge functions use the service role (which bypasses RLS), this can pass tests and break only direct-client paths.
- **Concurrent migration runs** from two CI jobs corrupt the migration table. Serialize deploys.

## Exit gate

- [ ] Constraint audit complete; NOT NULL, FK, CHECK, UNIQUE gaps closed or justified per table.
- [ ] Overlap/double-booking prevented by a DB-level exclusion constraint, with a concurrency test proving it.
- [ ] Every tenant-scoped table has a non-nullable scope column with an FK.
- [ ] All money columns `NUMERIC`; rounding centralized.
- [ ] Expand/migrate/contract policy documented; every future migration backward compatible with the deployed client.
- [ ] Retention policy defined per data class, with purge crons and audit trails for PII purges.
- [ ] `sync:prod-data` verified to scrub PII.
- [ ] Large-tenant seed committed.

## Docs / Plans / activity-log

- **Docs:** `docs/archive/operations/migration-runbook.md` (mandatory), `docs/PROJECT.md` (data model), `.cursor/rules/booking-workflow.mdc` if status constraints change.
- **Plans / Team RBAC:** N/A.
- **activity-log:** invoke `audit-logging` — PII purge and org deletion must emit events.
