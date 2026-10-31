#!/usr/bin/env bash
# Back up the linked <dev|prod> Supabase project's application schema/data,
# custom roles, and managed auth/storage/cron metadata into backups/<env>/.
# Storage object bytes are covered by Supabase Storage backups, not pg_dump.
# Read-only
# against the remote project — never mutates anything. Runs automatically as
# the first step of deploy-supabase.sh / deploy-supabase-dev.sh unless
# --skip-backup is passed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SUPABASE=("$ROOT/scripts/dev/bunx" --bun supabase@latest)
# shellcheck source=scripts/dev/check-linked-project.sh
source "$ROOT/scripts/dev/check-linked-project.sh"

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy/backup-supabase.sh <dev|prod> [--dry-run]

Dumps the schema and data of the CURRENTLY LINKED <dev|prod> Supabase project
into backups/<env>/<UTC-timestamp>_{schema,data}.sql (gitignored). Read-only
against the remote project.

Production also requires PROD_DB_URL so auth, storage, and cron metadata can be
captured with PostgreSQL 17 pg_dump. Dev captures the same metadata when
DEV_DB_URL is configured and warns when it is not.

Options:
  --dry-run   Print the dump commands and target paths; do not execute
  -h, --help  Show this help

Examples:
  bun run backup:supabase:dev
  bun run backup:supabase:prod
  ./scripts/deploy/backup-supabase.sh dev --dry-run
EOF
}

ENV_ARG=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    dev | prod)
      ENV_ARG="$1"
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ENV_ARG" ]]; then
  echo "Missing required argument: dev or prod" >&2
  usage >&2
  exit 1
fi

print_linked_project
if [[ -z "$LINKED_PROJECT_REF" ]]; then
  echo "" >&2
  echo "ERROR: No linked Supabase project (missing supabase/.temp/project-ref)." >&2
  echo "Link first: bunx supabase@latest link --project-ref <${ENV_ARG}-ref>" >&2
  exit 1
fi
if [[ "$LINKED_PROJECT_KIND" != "$ENV_ARG" && "$LINKED_PROJECT_KIND" != "unknown" ]]; then
  echo "" >&2
  echo "ERROR: You asked to back up '$ENV_ARG' but the linked project looks like '$LINKED_PROJECT_KIND' ($LINKED_PROJECT_REF)." >&2
  echo "Re-link to $ENV_ARG first, then re-run." >&2
  exit 1
fi
if [[ "$LINKED_PROJECT_KIND" == "unknown" ]]; then
  echo "WARNING: could not classify the linked project as dev or prod (add DEV_PROJECT_REF/PROD_PROJECT_REF to supabase/.env.dev.local to enable this check)." >&2
  echo "Proceeding to back up whatever is linked ($LINKED_PROJECT_REF) as '$ENV_ARG'." >&2
fi

BACKUP_DIR="$ROOT/backups/$ENV_ARG"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SCHEMA_FILE="$BACKUP_DIR/${STAMP}_schema.sql"
DATA_FILE="$BACKUP_DIR/${STAMP}_data.sql"
ROLES_FILE="$BACKUP_DIR/${STAMP}_roles.sql"
MANAGED_DATA_FILE="$BACKUP_DIR/${STAMP}_managed_data.sql"

DB_URL=""
if [[ "$ENV_ARG" == "prod" ]]; then
  DB_URL="${PROD_DB_URL:-}"
  [[ -z "$DB_URL" ]] && DB_URL="$(read_env_file_var "$ROOT/supabase/.env.local" "PROD_DB_URL")"
else
  DB_URL="${DEV_DB_URL:-}"
  [[ -z "$DB_URL" ]] && DB_URL="$(read_env_file_var "$ROOT/supabase/.env.dev.local" "DEV_DB_URL")"
fi

if [[ "$ENV_ARG" == "prod" && -z "$DB_URL" && "$DRY_RUN" != true ]]; then
  echo "ERROR: PROD_DB_URL is required for a complete production backup." >&2
  exit 1
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "[dry-run] mkdir -p $BACKUP_DIR"
  echo "[dry-run] supabase db dump --linked -f $SCHEMA_FILE"
  echo "[dry-run] supabase db dump --linked --data-only -f $DATA_FILE"
  echo "[dry-run] supabase db dump --linked --role-only -f $ROLES_FILE"
  if [[ -n "$DB_URL" ]]; then
    echo "[dry-run] PostgreSQL 17 pg_dump auth, storage, cron data -f $MANAGED_DATA_FILE"
  fi
  exit 0
fi

mkdir -p "$BACKUP_DIR"

echo "→ supabase db dump --linked -f $SCHEMA_FILE"
"${SUPABASE[@]}" db dump --linked -f "$SCHEMA_FILE"

echo "→ supabase db dump --linked --data-only -f $DATA_FILE"
"${SUPABASE[@]}" db dump --linked --data-only -f "$DATA_FILE"

echo "→ supabase db dump --linked --role-only -f $ROLES_FILE"
"${SUPABASE[@]}" db dump --linked --role-only -f "$ROLES_FILE"

if [[ -n "$DB_URL" ]]; then
  echo "→ pg_dump managed auth/storage/cron metadata"
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$DB_URL" \
      --data-only --no-owner --no-privileges \
      --schema=auth --schema=storage --schema=cron \
      --file="$MANAGED_DATA_FILE"
  elif command -v docker >/dev/null 2>&1; then
    docker run --rm postgres:17-alpine pg_dump "$DB_URL" \
      --data-only --no-owner --no-privileges \
      --schema=auth --schema=storage --schema=cron \
      >"$MANAGED_DATA_FILE"
  else
    echo "ERROR: pg_dump or Docker is required for managed-schema backup." >&2
    exit 1
  fi
else
  echo "WARNING: DEV_DB_URL is unset; auth/storage/cron metadata was not captured." >&2
fi

echo ""
echo "Backup complete ($ENV_ARG):"
echo "  schema: $SCHEMA_FILE"
echo "  data:   $DATA_FILE"
echo "  roles:  $ROLES_FILE"
if [[ -f "$MANAGED_DATA_FILE" ]]; then
  echo "  managed data: $MANAGED_DATA_FILE"
fi
