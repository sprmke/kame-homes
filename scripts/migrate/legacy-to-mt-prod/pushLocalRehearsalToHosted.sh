#!/usr/bin/env bash
# Push an upgraded local rehearsal DB (legacy_r1) to hosted fwor (data-only).
# Requires: local stack up, KAMEWAVE=kamewave, TARGET_DB_URL or resolve-target-db-url.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
cd "$ROOT"
source "$HERE/lib.sh"

RUN_DIR="${1:-}"
[[ -n "$RUN_DIR" && -d "$RUN_DIR" ]] || die "usage: KAMEWAVE=kamewave pushLocalRehearsalToHosted.sh backups/migration/<run-id>"

TARGET_DB_URL="${TARGET_DB_URL:-$(bun "$HERE/resolve-target-db-url.mjs")}"
guard_not_legacy "push-hosted" "$TARGET_DB_URL"
require_kamewave_for_remote_target "push-hosted" "$TARGET_DB_URL"

LOCAL_DB="${LOCAL_REHEARSAL_DB:-legacy_r1}"
DUMP="$RUN_DIR/local-to-hosted-data.dump"

log "push-hosted: backup target (read-only) → $RUN_DIR/fwor-pre-push.dump"
docker run --rm -e DSN="$TARGET_DB_URL" -v "$PWD/$RUN_DIR":/out postgres:17 sh -c \
  'pg_dump "$DSN" -Fc -f /out/fwor-pre-push.dump -n public -n auth -n storage --data-only'

log "push-hosted: pg_dump local [$LOCAL_DB] → $DUMP"
docker run --rm -e PGPASSWORD=postgres -v "$PWD/$RUN_DIR":/out postgres:17 pg_dump \
  -h host.docker.internal -p 54322 -U postgres -d "$LOCAL_DB" \
  -Fc -f "/out/local-to-hosted-data.dump" -n public -n auth -n storage --data-only

log "push-hosted: truncate public/auth/storage data on target"
docker run --rm -i -e "TARGET_DB_URL=$TARGET_DB_URL" postgres:17 psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
SET session_replication_role = replica;
TRUNCATE storage.objects CASCADE;
TRUNCATE storage.buckets CASCADE;
TRUNCATE auth.identities CASCADE;
TRUNCATE auth.users CASCADE;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;
SET session_replication_role = DEFAULT;
SQL

log "push-hosted: pg_restore data-only (errors on skipped objects logged)"
set +e
docker run --rm -e "TARGET_DB_URL=$TARGET_DB_URL" -v "$PWD/$DUMP":/in.dump:ro postgres:17 \
  pg_restore --data-only --disable-triggers --no-owner --no-acl -d "$TARGET_DB_URL" /in.dump 2>&1 | sed 's/^/restore: /'
set -e

docker run --rm -i -e "TARGET_DB_URL=$TARGET_DB_URL" postgres:17 psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -c \
  "UPDATE platform_settings SET migration_cutover_at = COALESCE(migration_cutover_at, now()) WHERE id = 1;"

log_deploy_stage "push-hosted"
log "push-hosted: done"
