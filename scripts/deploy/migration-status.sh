#!/usr/bin/env bash
# Read-only: show applied vs. pending migrations for dev or prod
# (`supabase migration list --linked`). Never mutates schema — safe without
# kamewave for both dev and prod.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SUPABASE=("$ROOT/scripts/dev/bunx" --bun supabase@latest)
ENV_FILE="$ROOT/supabase/.env.dev.local"
# shellcheck source=scripts/dev/check-linked-project.sh
source "$ROOT/scripts/dev/check-linked-project.sh"

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy/migration-status.sh <dev|prod>

Read-only. Shows `supabase migration list --linked` for the requested
environment (dev re-links via DEV_PROJECT_REF from supabase/.env.dev.local;
prod uses whatever is currently linked and warns if it doesn't look like prod).
EOF
}

ENV_ARG="${1:-}"
if [[ "$ENV_ARG" != "dev" && "$ENV_ARG" != "prod" ]]; then
  usage >&2
  exit 1
fi

if [[ "$ENV_ARG" == "dev" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: Missing supabase/.env.dev.local (copy from supabase/.env.dev.example)." >&2
    exit 1
  fi
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
  DEV_REF="$(tr -d '[:space:]' <<<"${DEV_PROJECT_REF:-}")"
  if [[ -z "$DEV_REF" ]]; then
    echo "ERROR: DEV_PROJECT_REF is empty in supabase/.env.dev.local" >&2
    exit 1
  fi
  echo "→ supabase link --project-ref $DEV_REF"
  "${SUPABASE[@]}" link --project-ref "$DEV_REF" >/dev/null
fi

print_linked_project
if [[ "$ENV_ARG" == "prod" && "$LINKED_PROJECT_KIND" != "prod" ]]; then
  echo "WARNING: asked for prod migration status but linked project looks like '$LINKED_PROJECT_KIND'." >&2
  echo "Re-link to prod first: bunx supabase@latest link --project-ref <prod-ref>" >&2
fi

echo ""
echo "→ supabase migration list --linked"
"${SUPABASE[@]}" migration list --linked
