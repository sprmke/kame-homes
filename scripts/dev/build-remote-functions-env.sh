#!/usr/bin/env bash
# Merge supabase/.env.dev.local with hosted dev API_URL + SERVICE_ROLE_KEY for `functions serve`.
set -euo pipefail
_script="${BASH_SOURCE[0]:-${0:-$0}}"
ROOT="${ROOT:-$(cd "$(dirname "$_script")/../.." && pwd)}"

# shellcheck source=/dev/null
source "$ROOT/scripts/dev/export-remote-supabase-runtime-env.sh"

mkdir -p "$ROOT/supabase/.temp"
OUT="$ROOT/supabase/.temp/functions-serve.env"

PUBLIC_API_URL=""
if [[ -f "$ROOT/supabase/.env.dev.local" ]]; then
  PUBLIC_API_URL="$(
    grep -E '^PUBLIC_API_URL=' "$ROOT/supabase/.env.dev.local" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' | sed 's/[[:space:]]*$//' || true
  )"
  if [[ -z "$PUBLIC_API_URL" ]]; then
    PUBLIC_API_URL="$(
      grep -E '^DEV_SUPABASE_URL=' "$ROOT/supabase/.env.dev.local" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' | sed 's/[[:space:]]*$//' || true
    )"
  fi
fi

{
  if [[ -f "$ROOT/supabase/.env.dev.local" ]]; then
    cat "$ROOT/supabase/.env.dev.local"
    echo ""
  fi
  echo "API_URL=${SUPABASE_URL}"
  echo "SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
  if [[ -n "$PUBLIC_API_URL" ]]; then
    echo "PUBLIC_API_URL=${PUBLIC_API_URL}"
  fi
} >"$OUT"

echo "$OUT"
