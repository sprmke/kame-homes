# Legacy → mt-prod migration tooling

Runbook entry point. **Rationale + phases:** [`docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md`](../../../docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md) · **Operational runbook:** [`docs/archive/operations/legacy-to-mt-prod-migration.md`](../../../docs/archive/operations/legacy-to-mt-prod-migration.md)

**Source:** LEGACY `zfttdwtceyqszyeyhilc` (session pooler URI in `supabase/.env.local` as `PROD_DB_URL`)
**Target:** `fworvijbrwpyngycotbz` (production since 2026-10-27; also the hosted dev project for now). Local rehearsal for R1/R2 is `TARGET_DB_NAME` (default `legacy_r1`).

## Layout

```
inventory.ts                Phase 0.1 — read-only legacy inventory (Bun + pg; counts-only JSON)
migrate.sh                  orchestrator: preflight | dump | restore | upgrade | sql.run | reset-cron-db
lib.sh                      env load, project-ref guards, docker psql helpers
sql/
  00-inventory.sql          read-only counts (tables bookings auth storage migrations extensions)
  10-post-restore-fixups.sql legacy data anomalies (host-sign-off items documented inline)
  30-rewrite-storage-urls.sql  storage-host + legacy-origin rewrite across all public text/jsonb columns
  40-derived-rebuild.sql    sequence bumps + search index repopulation (no-op updates fire triggers)
  90-verify.sql             post-restore invariants (SQL written; runner wiring TODO)
storage/copyBuckets.ts      resumable bucket copy (Bun; modes: manifest | dry-run | copy)
storage/repairHostedBlobs.ts  repair ghosts from fwor manifest → legacy fetch → target upsert
storage/syncHostedStorageFromLegacy.ts  hosted fwor sync: copy-booking-paths + copy-legacy-buckets + verify-booking-paths
storage/legacyStorageSyncLib.ts  shared legacy/target URL helpers + booking path inventory
verify/compareCounts.ts     legacy inventory vs target inventory per table (allowlists develop-drops)
config/                     D6 dev-config export/import
sql/50-cleanup-guest-auth.sql      post-restore: drop legacy guest sign-ins
sql/60-install-extensions-and-crons.sql  pg_cron/pg_net + 26 jobs, outbound parked
sql/61-activate-all-crons.sql      T0: activate every parked job
sql/70-clean-prod-test-data.sql    remove readiness-QA orgs/users from a prod project
```

`sql.run` usage: `PSQLVAR_TARGET_HOST=<mt-prod host> ./migrate.sh sql.run <file-name-without-.sql>` (preprocesses `__LEGACY_PROJECT_REF__`/`__TARGET_HOST__`/`__NEW_ORIGIN__` placeholders and runs the file on `$TARGET_DB_NAME`).

## R1 rehearsal (proven 2026-10-24)

```bash
./scripts/migrate/legacy-to-mt-prod/migrate.sh preflight
# dump (read-only against legacy):
./scripts/migrate/legacy-to-mt-prod/migrate.sh dump r1-20261024
# restore into a LOCAL rehearsal db (dev db untouched; supabase run stack must be up):
TARGET_DB_NAME=legacy_r1 ./scripts/migrate/legacy-to-mt-prod/migrate.sh restore backups/migration/r1-20261024
# apply the 322 unapplied develop migrations:
TARGET_DB_NAME=legacy_r1 ./scripts/migrate/legacy-to-mt-prod/migrate.sh upgrade backups/migration/r1-20261024
# storage manifest + public-object dry run (read-only):
RUN_DIR=backups/migration/r1-20261024 DB_NAME=legacy_r1 \
LEGACY_OBJECT_BASE_URL=https://zfttdwtceyqszyeyhilc.supabase.co/storage/v1/object \
  bun scripts/migrate/legacy-to-mt-prod/storage/copyBuckets.ts dry-run
```

- Restore → upgrade → rewrite (PSQLVAR_TARGET_HOST=…) → derived-rebuild all completed cleanly **twice (R1 + R2)**; counts
  match the legacy inventory per table/bucket (`verify/compareCounts.ts`, allowlisting tables the develop
  chain intentionally drops: `gmail_*`, `guest_submissions_backup_20260501`).
- `cron.database_name` is temporarily pointed at the rehearsal db during restore and reverted via
  `reset-cron-db` after the rehearsal. Postgres container restart included in both.
- Storage rehearsal lesson: with `LEGACY_SERVICE_ROLE_KEY` (in gitignored `supabase/.env.local`)
  **all 1,471 legacy objects are verified reachable**: 0 missing, exact size match, including the
  four private buckets (`approved-gafs`, `approved-pet-forms`, `sd-refund-receipts`, `templates`).
  Public reads can also use `?apikey=x` without auth. Pass `LEGACY_OBJECT_BASE_URL` ending at
  `/storage/v1` (the script appends `/object|/public` itself).

## Hosted mt-dev (fwor) storage sync

When Postgres `storage.objects` was loaded on **fwor** without a full hosted blob copy, booking previews break even though the Dashboard lists files.

```bash
# Requires LEGACY_* in supabase/.env.local and DEV_* in supabase/.env.dev.local
bun scripts/migrate/legacy-to-mt-prod/storage/syncHostedStorageFromLegacy.ts copy-booking-paths
bun scripts/migrate/legacy-to-mt-prod/storage/syncHostedStorageFromLegacy.ts copy-legacy-buckets
bun scripts/migrate/legacy-to-mt-prod/storage/syncHostedStorageFromLegacy.ts verify-booking-paths
```

Results land in `backups/migration/latest-rehearsal/storage-sync-*.{json,log}`. After edge changes to `storageSignedUrl` / `get-booking-asset-url`, deploy functions to fwor (`bun run deploy:supabase:dev:functions` or deploy that function only).

## Extensions and scheduled jobs (production baseline)

Cron migrations no-op when `pg_cron` is absent, so a project can show all migrations applied with zero jobs. Fix and verify:

```bash
# 1) install pg_cron/pg_net, rebuild all 26 jobs, park outbound jobs
psql "$(bun scripts/migrate/legacy-to-mt-prod/resolve-target-db-url.mjs)" \
  -v ON_ERROR_STOP=1 -f scripts/migrate/legacy-to-mt-prod/sql/60-install-extensions-and-crons.sql
# 2) at the T0 go call, after legacy crons stop
psql "$(bun scripts/migrate/legacy-to-mt-prod/resolve-target-db-url.mjs)" \
  -v ON_ERROR_STOP=1 -f scripts/migrate/legacy-to-mt-prod/sql/61-activate-all-crons.sql
```

Check with `select jobname, schedule, active from cron.job order by active desc, jobname;` and `select * from cron.job_run_details order by start_time desc limit 10;`.

## Guards

- `guard_not_legacy` refuses every write stage whose target project ref is `zfttdwtceyqszyeyhilc`.
- `restore` refuses `TARGET_DB_NAME=postgres` (never replaces the dev DB).
- Dumps live ONLY in gitignored `backups/migration/`; delete after hypercare (plan §7).
