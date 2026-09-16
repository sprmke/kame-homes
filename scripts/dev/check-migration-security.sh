#!/usr/bin/env bash
# Enforce forward-only migration security conventions after the audit baseline.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! command -v rg >/dev/null 2>&1; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.cargo/bin:$PATH"
fi

count_matches() {
  local pattern="$1"
  local path="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -c "$pattern" "$path" || true
  else
    grep -cE "$pattern" "$path" || true
  fi
}

BASELINE_VERSION=20261316121200
failed=0

for path in supabase/migrations/*.sql; do
  filename="${path##*/}"
  version="${filename%%_*}"
  [[ "$version" =~ ^[0-9]+$ ]] || continue
  (( 10#$version >= 10#$BASELINE_VERSION )) || continue

  definer_count="$(count_matches '^[[:space:]]*SECURITY DEFINER' "$path")"
  revoke_count="$(count_matches '^[[:space:]]*REVOKE (ALL|EXECUTE) ON FUNCTION .* FROM PUBLIC' "$path")"
  if (( definer_count > revoke_count )); then
    echo "MISSING PUBLIC revoke for SECURITY DEFINER function: $path" >&2
    failed=1
  fi

  table_count="$(count_matches '^[[:space:]]*CREATE TABLE( IF NOT EXISTS)? public\.' "$path")"
  rls_count="$(count_matches '^[[:space:]]*ALTER TABLE public\..* ENABLE ROW LEVEL SECURITY' "$path")"
  if (( table_count > rls_count )); then
    echo "MISSING RLS enable for public table: $path" >&2
    failed=1
  fi
done

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "OK — new migrations satisfy SECURITY DEFINER and RLS gates."
