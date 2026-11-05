#!/usr/bin/env bash
# Doc 22 — probe deny-by-default tables as `anon` and `authenticated` on local Supabase.
# Intended to run after `bun run db:reset` (migration-replay workflow / manual).
#
# A table with no grant at all ("permission denied", SQLSTATE 42501) is the
# strongest form of deny and counts as a pass; RLS-filtered access that returns
# rows does not.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

container="$(docker ps --format '{{.Names}}' | grep 'supabase_db_' | head -1 || true)"
if [[ -z "$container" ]]; then
  echo "probe-rls-anon-local: no supabase_db_* container — run bun run start:supabase first"
  exit 1
fi

TABLES=(developments query_cache processed_emails)

probe_table() {
  local role="$1" tbl="$2"
  local stderr_file out rc
  stderr_file="$(mktemp)"
  set +e
  out="$(docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At \
    -c "SET ROLE ${role}; SELECT count(*)::int FROM public.${tbl};" 2>"$stderr_file")"
  rc=$?
  set -e

  if [[ "$rc" -ne 0 ]]; then
    if grep -qi "permission denied" "$stderr_file"; then
      echo "probe-rls-anon-local: OK ${tbl} denies ${role} (no grant)"
      rm -f "$stderr_file"
      return 0
    fi
    echo "probe-rls-anon-local: ERROR ${tbl} as ${role}: $(tail -2 "$stderr_file" | tr '\n' ' ')" >&2
    rm -f "$stderr_file"
    return 1
  fi
  rm -f "$stderr_file"

  # psql prints the SET line, then the count.
  local n="${out##*$'\n'}"
  n="${n//[[:space:]]/}"
  if [[ -z "$n" ]]; then
    echo "probe-rls-anon-local: ERROR ${tbl} as ${role}: no count returned" >&2
    return 1
  fi
  if [[ "$n" != "0" ]]; then
    echo "probe-rls-anon-local: FAIL ${tbl} returned $n rows as ${role} (expected 0)"
    return 1
  fi
  echo "probe-rls-anon-local: OK ${tbl} returns 0 rows as ${role}"
  return 0
}

fail=0
for role in anon authenticated; do
  for tbl in "${TABLES[@]}"; do
    probe_table "$role" "$tbl" || fail=1
  done
done

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "probe-rls-anon-local: OK (anon + authenticated see 0 rows on deny-by-default tables)"
