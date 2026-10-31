#!/usr/bin/env bash
# Export SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from supabase/.env.dev.local
# for `functions serve` against a hosted dev project (no local `supabase start`).
set -euo pipefail
_script="${BASH_SOURCE[0]:-${0:-$0}}"
ROOT="${ROOT:-$(cd "$(dirname "$_script")/../.." && pwd)}"
ENV_FILE="$ROOT/supabase/.env.dev.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Missing supabase/.env.dev.local" >&2
  echo "Copy supabase/.env.dev.example → supabase/.env.dev.local and fill in DEV_* values." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

export SUPABASE_URL="${DEV_SUPABASE_URL:?Set DEV_SUPABASE_URL in supabase/.env.dev.local}"
export SUPABASE_SERVICE_ROLE_KEY="${DEV_SERVICE_ROLE_KEY:?Set DEV_SERVICE_ROLE_KEY in supabase/.env.dev.local}"

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "ERROR: DEV_SUPABASE_URL and DEV_SERVICE_ROLE_KEY must be non-empty." >&2
  exit 1
fi
