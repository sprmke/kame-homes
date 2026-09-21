#!/usr/bin/env bash
# Doc 22 — probe deny-by-default tables as `anon` and `authenticated` on local Supabase.
# Intended to run after `bun run db:reset` (migration-replay workflow / manual).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

container="$(docker ps --format '{{.Names}}' | grep 'supabase_db_' | head -1 || true)"
if [[ -z "$container" ]]; then
  echo "probe-rls-anon-local: no supabase_db_* container — run bun run start:supabase first"
  exit 1
fi

probe_role() {
  local role="$1"
  local sql
  sql=$(cat <<SQL
SET ROLE ${role};
SELECT 'developments' AS tbl, count(*)::int AS n FROM public.developments
UNION ALL
SELECT 'query_cache', count(*)::int FROM public.query_cache
UNION ALL
SELECT 'processed_emails', count(*)::int FROM public.processed_emails;
SQL
)
  local out
  out="$(docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -c "$sql")"
  local fail=0
  while IFS='|' read -r tbl n; do
    if [[ "$n" != "0" ]]; then
      echo "probe-rls-anon-local: FAIL $tbl returned $n rows as ${role} (expected 0)"
      fail=1
    fi
  done <<<"$out"
  return "$fail"
}

fail=0
probe_role anon || fail=1
probe_role authenticated || fail=1

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "probe-rls-anon-local: OK (anon + authenticated see 0 rows on deny-by-default tables)"
