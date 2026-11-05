#!/usr/bin/env bash
# Local-only large-tenant seed. See seed-large-tenant.sql for what it creates.
#
#   ALLOW_LOCAL_SEED=1 ./scripts/performance/seed-large-tenant.sh            # validate, roll back
#   ALLOW_LOCAL_SEED=1 ./scripts/performance/seed-large-tenant.sh --commit   # keep the rows
#
# Refuses anything other than the local Supabase database (127.0.0.1:54322 or the
# supabase_db_guest-form-management container). Never point this at hosted Supabase.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SQL="$ROOT/scripts/performance/seed-large-tenant.sql"

if [[ "${ALLOW_LOCAL_SEED:-}" != "1" ]]; then
  echo "Refusing to seed: set ALLOW_LOCAL_SEED=1 (local database only)." >&2
  exit 2
fi

COMMIT=0
if [[ "${1:-}" == "--commit" ]]; then
  COMMIT=1
fi

if command -v psql >/dev/null 2>&1; then
  PGPASSWORD=postgres psql \
    -h 127.0.0.1 -p 54322 -U postgres -d postgres \
    -v ON_ERROR_STOP=1 -v commit="$COMMIT" -f "$SQL"
elif docker ps --format '{{.Names}}' | grep -qx 'supabase_db_guest-form-management'; then
  docker exec -i supabase_db_guest-form-management psql \
    -U postgres -d postgres \
    -v ON_ERROR_STOP=1 -v commit="$COMMIT" -f - < "$SQL"
else
  echo "No local psql and no supabase_db_guest-form-management container found." >&2
  exit 2
fi
