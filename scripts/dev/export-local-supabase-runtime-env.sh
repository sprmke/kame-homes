#!/usr/bin/env bash
# Export SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for `supabase functions serve`.
# The CLI --env-file skips env names starting with SUPABASE_; they must be in the shell.
set -euo pipefail
_script="${BASH_SOURCE[0]:-${0:-$0}}"
ROOT="${ROOT:-$(cd "$(dirname "$_script")/../.." && pwd)}"
_tmp="$(mktemp)"
trap 'rm -f "$_tmp"' EXIT

if ! "$ROOT/scripts/dev/run-with-ui-dev-env.sh" "$ROOT/scripts/dev/bunx" --bun supabase@latest status -o env >"$_tmp" 2>/dev/null; then
  echo "ERROR: supabase status failed. Run supabase start first." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$_tmp"
set +a

export SUPABASE_URL="${API_URL:-http://127.0.0.1:54321}"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"

if [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "ERROR: SERVICE_ROLE_KEY missing from supabase status." >&2
  exit 1
fi
