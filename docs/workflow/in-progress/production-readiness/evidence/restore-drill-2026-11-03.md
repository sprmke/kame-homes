---
title: 'Restore drill — production backup restored into a scratch database (2026-11-03)'
status: active
stage: in-progress
kind: evidence
readiness: partial
launch_gate: F
launch_blocker: true
last_verified: 'c8dfe00e 2026-11-03'
---

# Restore drill — 2026-11-03

First **measured** restore drill (plan 8.2 / docs 24 & 30 / PR-024). Backup is taken from the
production project (`fwor…`) read-only; the restore target is a throwaway database on the local
Docker cluster. Production was never written to.

## What was measured

| Step                       | Command                                                                                | Result                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Backup                     | `./scripts/deploy/backup-supabase.sh dev --expect-ref fworvijbrwpyngycotbz`            | **exit 0 in 80 s** — schema 664 KB, data 2.7 MB, roles 360 B                                                          |
| Restore (prod schema dump) | `psql -d restore_drill -f <schema.sql>`                                                | **2 s**, 37 errors — all expected in a vanilla DB (`auth.uid()`, `supabase_realtime`, `vault`, extension restriction) |
| Restore (prod data)        | `psql -d restore_drill -f <data.sql>` (dump sets `session_replication_role = replica`) | **< 1 s**, 8 errors — only the stubbed `auth`/`storage` columns                                                       |
| Row parity                 | counts after restore                                                                   | organizations **1/1**, properties **1/1**, guest_submissions **450/450**, activity_log **3/3**                        |

**Measured application-data RTO ≈ 3 s restore + 80 s backup round trip.** The dominant cost is the
dump, not the restore. Auth/storage rows need a real Supabase project (or `PROD_DB_URL` with the full
`pg_dump`), which is still an operator input (PR-025).

## Finding 1 — restoring into the **repo-migrated** schema fails (blocker)

Restoring the same data into a freshly migrated database (`supabase db reset`) aborts:

```
ERROR: new row for relation "guest_submissions" violates check constraint "valid_dates"
```

Two causes, both real:

| Cause                                                                           | Evidence                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production **does not have** the repo's `valid_dates` constraint at all (drift) | `pg_constraint` on prod lists `valid_times` (NOT VALID) but **no** `valid_dates`                                                                                                                                              |
| Production data contains rows the constraint rejects                            | `node scripts/dev/audit-booking-dates.mjs`: **43 / 450** bookings — 41 with `check_out < check_in`, 1 same-day (`2025-04-16`), 1 with ISO dates (`2026-01-15` → `2026-01-17`, created 2025-12-08, COMPLETED, source Facebook) |

Until this is reconciled, a disaster-recovery restore into a newly created project (the cutover path)
will fail on those 43 rows.

**Resolved 2026-11-03:** `valid_dates` was added with same-day support and the legacy rows
grandfathered (migration `20261317120000_same_day_stay_dates.sql`), so a production dump restores into
a freshly migrated project. Detail: [`same-day-stays-2026-11-03.md`](./same-day-stays-2026-11-03.md).

**Decision needed (product):** are same-day bookings legitimate (day use)? Two ways out:

1. Widen the constraint to `check_out >= check_in`, repair the 41 reversed rows (swap after checking
   `number_of_nights`), normalise the ISO row, then add the constraint `NOT VALID` and validate.
2. Keep strict `check_out > check_in`, repair all 43 rows, then enforce.

Repair touches booking dates that feed invoices and emails, so it needs an explicit call before running.

## Finding 2 — production schema drift (high)

The restore target built from `supabase/migrations` has objects the production database lacks
(`valid_dates` is one). Conversely `pg_cron`/`supabase_realtime` objects exist only on hosted.
Add a schema diff to the release checklist and re-run after every deploy window.

## Reproduction

```bash
# backup (read-only on prod)
./scripts/deploy/backup-supabase.sh dev --expect-ref fworvijbrwpyngycotbz

# data-quality audit (read-only SQL against the linked project)
node scripts/dev/audit-booking-dates.mjs

# restore drill target
docker exec -i supabase_db_guest-form-management psql -U postgres -d postgres -c "create database restore_drill"
docker exec -i supabase_db_guest-form-management psql -U postgres -d restore_drill -f - < backups/dev/<stamp>_data.sql
```

## Follow-ups

| #   | Item                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ~~Product decision on same-day bookings~~ — decided 2026-11-03: day use is allowed; `valid_dates` now permits equal dates and is validated, 41 legacy reversed rows grandfathered. See [`same-day-stays-2026-11-03.md`](./same-day-stays-2026-11-03.md) |
| 2   | `PROD_DB_URL` (or equivalent) so one drill covers auth/storage/cron metadata end to end                                                                                                                                                                 |
| 3   | Repeat the drill after each release and record the numbers here                                                                                                                                                                                         |
| 4   | Add `audit-booking-dates.mjs` to the deploy preflight                                                                                                                                                                                                   |

## Re-run after the strict constraint (2026-11-03)

With the 65 legacy rows repaired and `20261318120000_strict_valid_dates.sql` live (constraint
validated, no grandfather clause), a fresh production backup restored into a scratch database in
**2 s**: 0 `valid_dates` errors, 1 organization, 1 property, **450/450 bookings**, constraint back as
`convalidated = true`. The cutover/DR path this document flagged as broken is now clean.
