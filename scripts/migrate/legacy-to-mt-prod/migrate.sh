#!/usr/bin/env bash
# migrate.sh — orchestrator for the legacy → mt-prod cutover migration.
# Plan: docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md §5 Phase 2
#
# Stages (each idempotent; artifacts + logs under backups/migration/<run-id>/):
#   preflight      — environment + connectivity checks (read-only)
#   dump           — read-only dumps from legacy (roles/schema/auth/storage/meta/public data)
#   restore        — restore dumps into a TARGET database (local rehearsal or mt-prod)
#   upgrade        — apply the develop migration chain (--include-all)
#   reset-cron-db  — rehearsal teardown: return cron.database_name to `postgres`
#   verify         — post-restore invariant checks (sql/90-verify.sql, not yet)
#
# R1 rehearsal target: a dedicated database inside the local Docker supabase DB
# container (default `legacy_r1`) so the current dev database is never touched.
#
# Usage:
#   ./scripts/migrate/legacy-to-mt-prod/migrate.sh preflight
#   ./scripts/migrate/legacy-to-mt-prod/migrate.sh dump [run-id]
#   TARGET_DB_NAME=legacy_r1 ./scripts/migrate/legacy-to-mt-prod/migrate.sh restore backups/migration/<run-id>
#   TARGET_DB_NAME=legacy_r1 ./scripts/migrate/legacy-to-mt-prod/migrate.sh upgrade backups/migration/<run-id>
#   ./scripts/migrate/legacy-to-mt-prod/migrate.sh reset-cron-db
#
# Remote stages (mt-prod) additionally require TARGET_DB_URL and stay kamewave-gated
# by the repo shell hooks — this script never bypasses that.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

STAGE="${1:-help}"
ARG2="${2:-}"
TARGET_DB_NAME="${TARGET_DB_NAME:-legacy_r1}"
DOCKER_DB_IMAGE="${DOCKER_DB_IMAGE:-postgres:17}"
PSQL_STOP_ON_ERROR="${PSQL_STOP_ON_ERROR:-1}"

run_sql_file() {
  # run_sql_file <label> <file> — per-file log under $RUN_DIR, abort on error.
  local label="$1" file="$2"
  local logf="$RUN_DIR/restore-${label}.log"
  cat "$file" | docker_psql_run "$TARGET_DB_NAME" > "$logf" 2>&1
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    log "restore: FAILED at $label (rc=$rc) — see $logf"
    grep -m5 -- "ERROR" "$logf" || true
    die "restore aborted"
  fi
  if grep -q -- "ERROR" "$logf"; then
    log "restore: $label completed WITH errors (see $logf)"
    grep -m3 -- "ERROR" "$logf" || true
  else
    log "restore: $label ok"
  fi
}

stage_dump() {
  load_legacy_db_url
  new_run_dir "$ARG2"
  log "dump: writing to $RUN_DIR (read-only against legacy)"

  if [[ "${SKIP_IF_DUMPED:-0}" == "1" && -s "$RUN_DIR/data.sql" ]]; then
    log "dump: SKIP_IF_DUMPED=1 and data.sql present — reusing existing dump"
    return 0
  fi

  supabase db dump --db-url "$LEGACY_DB_URL" --role-only -f "$RUN_DIR/roles.sql" 2>&1 | grep -v "Supabase CLI" || true
  supabase db dump --db-url "$LEGACY_DB_URL" -f "$RUN_DIR/schema.sql" 2>&1 | grep -v "Supabase CLI" || true
  supabase db dump --db-url "$LEGACY_DB_URL" --data-only --use-copy \
    -s public,auth,storage,supabase_migrations -x storage.objects -f "$RUN_DIR/data.sql" 2>&1 | grep -v "Supabase CLI" || true

  log "dump: auth/storage/migrations schemas via docker postgres:17 (Supabase CLI skips managed schemas)"
  docker run --rm -i -e DSN="$LEGACY_DB_URL" -v "$PWD/$RUN_DIR":/out "$DOCKER_DB_IMAGE" sh -c '
    pg_dump "$DSN" --schema=auth -f /out/auth-schema-and-data.sql &&
    pg_dump "$DSN" --schema=storage --schema-only -f /out/storage-schema.sql &&
    pg_dump "$DSN" --schema=storage --data-only -T "storage.objects" -f /out/storage-buckets-data.sql &&
    pg_dump "$DSN" --schema=storage --data-only --table=storage.objects -f /out/storage-objects-metadata.sql &&
    pg_dump "$DSN" --schema=supabase_migrations -f /out/migrations-schema-and-data.sql
  ' | sed 's/^/dump: /'

  log "dump: done ($(du -sh "$RUN_DIR" 2>/dev/null | cut -f1)) — result: $RUN_DIR"
}

stage_restore() {
  local dump_dir="$ARG2"
  RUN_DIR="${dump_dir%/}"
  [[ -n "$dump_dir" && -s "$dump_dir/data.sql" ]] \
    || die "restore: pass a dump run directory (with data.sql): migrate.sh restore backups/migration/<run-id>"
  load_legacy_db_url

  log "restore: target = local container database [$TARGET_DB_NAME] (dev db untouched)"
  [[ "$TARGET_DB_NAME" != "postgres" ]] \
    || die "restore: refusing to replace the dev database 'postgres' (TARGET_DB_NAME must be a rehearsal db)"

  # -1. pg_cron only runs against cron.database_name; point it at the rehearsal db
  #     for the rehearsal and revert afterwards (stage_reset_cron_db).
  log "restore: setting cron.database_name='$TARGET_DB_NAME' (temporary, rehearsal only)"
  echo "ALTER SYSTEM SET cron.database_name = '$TARGET_DB_NAME';" | docker_psql_run postgres | sed 's/^/cron-db: /'
  echo "SELECT pg_reload_conf();" | docker_psql_run postgres | sed 's/^/cron-db: /' | tail -1
  log "restore: restarting the postgres container so the cron launcher re-reads cron.database_name"
  docker restart "$(local_db_container)" >/dev/null
  sleep 6

  # 0. recreate the rehearsal database from zero (restore is idempotent-by-rebuild)
  echo "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$TARGET_DB_NAME' AND pid <> pg_backend_pid();" \
    | docker_psql_run postgres | sed 's/^/restore: /' | tail -1
  echo "DROP DATABASE IF EXISTS $TARGET_DB_NAME;" | docker_psql_run postgres | sed 's/^/restore: /' | tail -1
  echo "CREATE DATABASE $TARGET_DB_NAME;" | docker_psql_run postgres | sed 's/^/restore: /' | tail -1
  echo "ALTER DATABASE $TARGET_DB_NAME OWNER TO postgres;" | docker_psql_run postgres | sed 's/^/restore: /' | tail -1

  # 1. roles — ALTER ROLE statements only; superuser may alter reserved roles.
  PSQL_STOP_ON_ERROR=0
  cat "$dump_dir/roles.sql" | docker_psql_run "$TARGET_DB_NAME" > "$RUN_DIR/restore-roles.log" 2>&1 || true
  if grep -q -- "ERROR" "$RUN_DIR/restore-roles.log"; then
    warn "roles restore had errors (see restore-roles.log)"
  fi
  PSQL_STOP_ON_ERROR=1

  # 2. extensions (pg_cron/pg_net must be created while cron.database_name points here)
  echo "CREATE SCHEMA IF NOT EXISTS extensions; CREATE SCHEMA IF NOT EXISTS priv; CREATE SCHEMA IF NOT EXISTS vault; CREATE SCHEMA IF NOT EXISTS pgsodium; CREATE SCHEMA IF NOT EXISTS pgsodium_masks;" \
    | docker_psql_run "$TARGET_DB_NAME" | sed 's/^/schemas: /'
  echo "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_publication WHERE pubname='supabase_realtime') THEN CREATE PUBLICATION supabase_realtime; END IF; END \$\$;" \
    | docker_psql_run "$TARGET_DB_NAME" | sed 's/^/realtime: /'
  echo "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net;" \
    | docker_psql_run "$TARGET_DB_NAME" | sed 's/^/extensions: /'

  # 3. public schema DDL (policies, functions included)
  run_sql_file schema "$dump_dir/schema.sql"

  # 4. auth schema + data (single file: DDL + COPY)
  run_sql_file auth "$dump_dir/auth-schema-and-data.sql"

  # 5. storage schema + bucket rows + object metadata rows (contents excluded)
  run_sql_file storage-schema "$dump_dir/storage-schema.sql"
  run_sql_file storage-buckets "$dump_dir/storage-buckets-data.sql"
  if [[ -s "$dump_dir/storage-objects-metadata.sql" ]]; then
    run_sql_file storage-objects "$dump_dir/storage-objects-metadata.sql"
  fi

  # 6. supabase_migrations schema + history rows
  run_sql_file migrations "$dump_dir/migrations-schema-and-data.sql"

  # 7. public data only — strip the auth/storage/supabase_migrations COPY blocks
  #    (those tables already got their data from the files above)
  log "restore: filtering data.sql to public-only blocks"
  awk '
    /^COPY / && (/^COPY "(auth|storage|supabase_migrations)"\./) { skip=1; next }
    skip==1 { if ($0 == "\\.") { skip=0 }; next }
    { print }
  ' "$dump_dir/data.sql" > "$dump_dir/data.public-only.sql"
  run_sql_file data "$dump_dir/data.public-only.sql"

  log "restore: done — target [$TARGET_DB_NAME]"
}

stage_upgrade() {
  load_legacy_db_url
  RUN_DIR="${ARG2:-$RUN_ROOT/$(date +%Y%m%dT%H%M%S)-upgrade}"
  mkdir -p "$RUN_DIR"
  local url="postgresql://postgres:postgres@127.0.0.1:54322/${TARGET_DB_NAME}"
  guard_not_legacy "upgrade(local)" "$url"
  log "upgrade: applying develop migration chain (--include-all) to [$TARGET_DB_NAME]"
  supabase db push --db-url "$url" --include-all --dry-run > "$RUN_DIR/upgrade-dryrun.log" 2>&1 || true
  local n
  n="$(grep -c '^ •' "$RUN_DIR/upgrade-dryrun.log" || true)"
  log "upgrade: dry-run lists $n migrations to apply"
  set +e
  supabase db push --db-url "$url" --include-all 2>&1 | tee "$RUN_DIR/upgrade-push.log"
  local rc=${PIPESTATUS[0]}
  set -e
  if [[ $rc -ne 0 ]]; then
    die "upgrade: FAILED (rc=$rc) — see $RUN_DIR/upgrade-push.log. Per plan 2.4: fix with NEW guard migrations only, never edit shipped ones."
  fi
  log "upgrade: OK"
}

stage_reset_cron_db() {
  log "cron-db: reverting cron.database_name to 'postgres'"
  echo "ALTER SYSTEM RESET cron.database_name;" | docker_psql_run postgres | sed 's/^/cron-db: /'
  echo "SELECT pg_reload_conf();" | docker_psql_run postgres | sed 's/^/cron-db: /' | tail -1
  docker restart "$(local_db_container)" >/dev/null
  sleep 6
  log "cron-db: reverted (local dev cron database is 'postgres' again)"
}

stage_backup_target() {
  # Full backup of the migration TARGET (the linked project, fwor) — read-only, safe anytime.
  local ts dir
  ts=$(date +%Y%m%dT%H%M%S)
  dir="$RUN_ROOT/fwor-backup-$ts"
  mkdir -p "$dir"
  log "backup-target: full dump of the linked target into $dir"
  supabase db dump --linked --role-only -f "$dir/roles.sql" 2>&1 | grep -v "Supabase CLI" || true
  supabase db dump --linked -f "$dir/schema.sql" 2>&1 | grep -v "Supabase CLI" || true
  supabase db dump --linked --data-only --use-copy -f "$dir/data.sql" 2>&1 | grep -v "Supabase CLI" || true
  log "backup-target: public schema backed up; managed schemas (auth/storage/supabase_migrations) below"
  local dsn="${TARGET_DB_URL:-}"
  if [[ -z "$dsn" ]]; then
    local ref pw
    ref="$(read_env_value supabase/.env.local TARGET_DB_REF)"
    [[ -z "$ref" ]] && ref="$(cat supabase/.temp/project-ref 2>/dev/null || echo fworvijbrwpyngycotbz)"
    pw="$(read_env_value supabase/.env.local TARGET_DB_PASSWORD)"
    if [[ -n "$pw" ]]; then
      # project's actual pooler region: probe from supabase/.temp/pooler-url host if available
      local pooler_host
      pooler_host="$(awk -F'@' 'NF>1{print $2}' supabase/.temp/pooler-url 2>/dev/null | cut -d/ -f1)"
      [[ -z "$pooler_host" ]] && pooler_host="aws-0-ap-southeast-1.pooler.supabase.com"
      dsn="postgresql://postgres.${ref}:${pw}@${pooler_host}/postgres"
    else
      log "backup-target: no TARGET_DB_PASSWORD — managed-schema dump skipped"
    fi
  fi
  if [[ -n "$dsn" ]]; then
    for schema in auth storage supabase_migrations; do
      docker run --rm -i -e DSN="$dsn" -v "$PWD/$dir":/out postgres:17 sh -c 'pg_dump "$DSN" -n "$1" -f "/out/$1.pgdump"' sh "$schema" 2>&1 | grep -viE "warning" || true
      log "backup-target: $schema → $dir/$schema.pgdump"
    done
  fi
  log "backup-target: done → $dir"
  printf '%s\n' "$dir" > "$dir/BACKUP_DIR.txt"
}

stage_sql() {
  # stage_sql — run a sql/ file against the rehearsal DB with psql vars.
  # Usage: migrate.sh sql.run <name> (e.g. sql.run 30-rewrite-storage-urls)
  local query_file="$HERE/sql/${1%/}.sql"
  [[ -s "$query_file" ]] || die "sql: $query_file missing"
  load_legacy_db_url
  RUN_DIR="${RUN_DIR:-$RUN_ROOT/latest-rehearsal}"
  mkdir -p "$RUN_DIR"
  log "sql: running $1 against [$TARGET_DB_NAME]"
  local prepared="$RUN_DIR/prepared-$1.sql"
  sed -e "s/__LEGACY_PROJECT_REF__/$LEGACY_PROJECT_REF/g" \
      -e "s/__TARGET_HOST__/${PSQLVAR_TARGET_HOST:-replace-me.supabase.co}/g" \
      -e "s#__NEW_ORIGIN__#${PSQLVAR_NEW_ORIGIN:-$NEW_APP_ORIGIN}#g" \
      "$query_file" > "$prepared"
  cat "$prepared" | docker_psql_run "$TARGET_DB_NAME" | tee "$RUN_DIR/sql-$1.log"
  log "sql: done ($1)"
}

stage_shape() {
  RUN_DIR="${RUN_DIR:-$RUN_ROOT/latest-rehearsal}"
  mkdir -p "$RUN_DIR"
  load_legacy_db_url
  # Team emails: env > supabase/.env.prod.local > supabase/.env.local (never logged).
  local admin_emails
  admin_emails="${ADMIN_ALLOWED_EMAILS:-}"
  if [[ -z "$admin_emails" ]]; then
    admin_emails="$(read_env_value supabase/.env.prod.local ADMIN_ALLOWED_EMAILS)"
  fi
  if [[ -z "$admin_emails" ]]; then
    admin_emails="$(read_env_value supabase/.env.local ADMIN_ALLOWED_EMAILS)"
  fi
  local n_members
  n_members=$(printf '%s' "$admin_emails" | awk -F, '{print NF}')
  if [[ -z "$admin_emails" ]]; then n_members=0; fi
  log "shape: running on [$TARGET_DB_NAME] with $n_members team member(s) (emails in env file, not logged)"
  local prepared="$RUN_DIR/prepared-shape.sql"
  sed -e "s#https://app.kamehomes.space#${NEW_APP_ORIGIN}#g" \
      "$HERE/sql/20-shape-tenant-org.sql" > "$prepared"
  cat "$prepared" | docker_psql_run "$TARGET_DB_NAME" \
      -v admin_emails="$admin_emails" \
      -v cutover_at="${CUTOVER_AT:-}" \
    | tee "$RUN_DIR/shape.log"
  log "shape: done — owner/verification/plan assertions inside the SQL guard it"
}

stage_verify() {
  RUN_DIR="${RUN_DIR:-$RUN_ROOT/latest-rehearsal}"
  mkdir -p "$RUN_DIR"
  log "verify: running sql/90-verify.sql on [$TARGET_DB_NAME]"
  local legacy_finance
  legacy_finance="$(grep -E '^[0-9]+ finance_line_items$' "$RUN_DIR/../inventory"*.json 2>/dev/null | head -1 || echo '')"
  cat "$HERE/sql/90-verify.sql" | docker_psql_run "$TARGET_DB_NAME" \
      -v legacy_finance_line_items="${legacy_finance%% *}" \
    | tee "$RUN_DIR/verify.log"
  if grep -q -- "check" <(cat "$HERE/sql/90-verify.sql"); then
    log "verify: log at $RUN_DIR/verify.log"
  fi
}

case "$STAGE" in
  preflight)
    load_legacy_db_url
    log "preflight: legacy ref = $(ref_of_url "$LEGACY_DB_URL")"
    log "preflight: local container = $(local_db_container)"
    log "preflight: supabase CLI = $(supabase --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
    log "preflight: OK (read-only)"
    ;;
  dump)          stage_dump ;;
  backup.target) stage_backup_target ;;
  restore)       stage_restore ;;
  upgrade)       stage_upgrade ;;
  shape)         stage_shape ;;
  sql.run)       stage_sql "$ARG2" ;;
  reset-cron-db) stage_reset_cron_db ;;
  verify)        stage_verify ;;
  shape|rewrite|storage|config-import)
    die "stage '$STAGE' not implemented yet — interim: migrate.sh sql.run <30-rewrite-storage-urls|40-derived-rebuild>"
    ;;
  help|*)
    sed -n '2,26p' "$0"
    ;;
esac
