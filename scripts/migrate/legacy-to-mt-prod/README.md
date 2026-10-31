# Legacy → mt-prod migration tooling

Runbook entry point. **Rationale + phases:** [`docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md`](../../../docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md) · **Operational runbook:** [`docs/archive/operations/legacy-to-mt-prod-migration.md`](../../../docs/archive/operations/legacy-to-mt-prod-migration.md)

**Source:** LEGACY `zfttdwtceyqszyeyhilc` (session pooler URI in `supabase/.env.local` as `PROD_DB_URL`)
**Target:** rehearsal = local Docker db (`TARGET_DB_NAME`, default `legacy_r1`); go-live = mt-prod (ref TBD)

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
verify/compareCounts.ts     legacy inventory vs target inventory per table (allowlists develop-drops)
config/                     D6 dev-config export/import (TODO)
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

## Guards

- `guard_not_legacy` refuses every write stage whose target project ref is `zfttdwtceyqszyeyhilc`.
- `restore` refuses `TARGET_DB_NAME=postgres` (never replaces the dev DB).
- Dumps live ONLY in gitignored `backups/migration/`; delete after hypercare (plan §7).
