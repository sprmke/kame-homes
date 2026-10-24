#!/usr/bin/env bash
# lib.sh — shared config, guards and helpers for legacy → mt-prod migration.
# Plan: docs/workflow/planned/legacy-prod-to-mt-prod-cutover.md §5 Phase 2
#
# Safety invariants:
#   - Write stages refuse a target whose project ref equals the legacy ref.
#   - PII dumps live only under backups/migration/ (gitignored).
#   - No secret value is ever logged — refs and hosts only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

LEGACY_PROJECT_REF="zfttdwtceyqszyeyhilc"
LEGACY_HOST_FRAGMENT="${LEGACY_PROJECT_REF}.supabase.co"
NEW_APP_ORIGIN="https://app.kamehomes.space"

RUN_ROOT="backups/migration"
RUN_DIR=""
LOG_FILE=""

log() {
  local line
  line="[$(date +%H:%M:%S)] $*"
  if [[ -n "$LOG_FILE" ]]; then
    printf '%s\n' "$line" | tee -a "$LOG_FILE"
  else
    printf '%s\n' "$line"
  fi
}

warn() { log "WARN: $*"; }
die()  { log "ERROR: $*"; exit 1; }

# PROD_DB_URL in supabase/.env.local holds the legacy session-pooler URI.
load_legacy_db_url() {
  if [[ -z "${LEGACY_DB_URL:-}" && -f "supabase/.env.local" ]]; then
    LEGACY_DB_URL="$(grep -E '^PROD_DB_URL=' supabase/.env.local | head -1 | cut -d= -f2- | tr -d '[:space:]\"'"'"'')"
  fi
  [[ -n "${LEGACY_DB_URL:-}" ]] || die "LEGACY_DB_URL missing (env or PROD_DB_URL=… in supabase/.env.local)"
  export LEGACY_DB_URL
}

# Project ref of a Supabase DB URL: pooler user `postgres.<ref>@aws-…`, or `db.<ref>.supabase.co`.
ref_of_url() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse
p = urlparse(sys.argv[1])
host = p.hostname or ""
user = p.username or ""
if host.endswith("pooler.supabase.com"):
    print(user.split(".", 1)[-1] if user.startswith("postgres.") else user)
elif host.endswith(".supabase.co"):
    print(host.split(".", 1)[0].removeprefix("db."))
else:
    print(f"local:{host}")
PY
}

# Guard: WRITE stage must not target the legacy project (read-only stages skip this).
guard_not_legacy() {
  local stage="$1" url="$2"
  local ref
  ref="$(ref_of_url "$url")"
  if [[ "$ref" == "$LEGACY_PROJECT_REF" ]]; then
    die "stage '$stage' refuses to run against the legacy project ($LEGACY_PROJECT_REF)"
  fi
}

new_run_dir() {
  local run_id="${1:-$(date +%Y%m%dT%H%M%S)}"
  RUN_DIR="$RUN_ROOT/$run_id"
  mkdir -p "$RUN_DIR"
  LOG_FILE="$RUN_DIR/migrate.log"
  : > "$LOG_FILE"
  log "run dir: $RUN_DIR"
}

# psql via the local supabase DB container (no psql binary on the host).
# SQL arrives on stdin: cat sql/file.sql | docker_psql_run <database>
# Superuser (supabase_admin) is required for reserved-role ALTER and ALTER SYSTEM;
# object ownership is corrected by the dumps' own OWNER TO / OWNER SET clauses.
PSQL_USER="${PSQL_USER:-supabase_admin}"
PSQL_STOP_ON_ERROR="${PSQL_STOP_ON_ERROR:-1}"

docker_psql_run() {
  local stop="-v ON_ERROR_STOP=$PSQL_STOP_ON_ERROR"
  docker exec -i "$(local_db_container)" psql -U "$PSQL_USER" -h 127.0.0.1 -d "$1" $stop 2>&1
}

local_db_container() {
  local name
  name="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1 || true)"
  [[ -n "$name" ]] || die "no running supabase_db_* container — start the local stack with ./dev.sh first"
  printf '%s' "$name"
}
