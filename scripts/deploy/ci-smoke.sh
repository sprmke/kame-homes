#!/usr/bin/env bash
# Post-deploy smoke for hosted Supabase (read-only).
# Usage: ./scripts/deploy/ci-smoke.sh <dev|prod>
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/deploy/ci-deploy-lib.sh
source "$ROOT/scripts/deploy/ci-deploy-lib.sh"

SUPABASE=("$ROOT/scripts/dev/bunx" --bun supabase@latest)

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy/ci-smoke.sh <dev|prod>

Environment:
  SUPABASE_ACCESS_TOKEN   Required
  SUPABASE_PROJECT_REF    Required
  SUPABASE_ANON_KEY       Required
  SMOKE_PROPERTY_SLUG     Required, active property used for read-only probes

Checks:
  1. Required public functions are deployed
  2. Real GET requests return successful JSON from the listing, property,
     availability, and search handlers
EOF
}

TARGET="${1:-}"
if [[ "$TARGET" != "dev" && "$TARGET" != "prod" || "${2:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  [[ "$TARGET" == "dev" || "$TARGET" == "prod" ]] || exit 1
  exit 0
fi

ci_deploy_require_env SUPABASE_ACCESS_TOKEN
ci_deploy_require_env SUPABASE_PROJECT_REF
ci_deploy_ensure_anon_key
ci_deploy_default_smoke_property_slug "$TARGET"

if [[ "$TARGET" == "dev" && -n "${LEGACY_PROD_PROJECT_REF:-}" ]]; then
  ci_deploy_assert_not_legacy_ref "$SUPABASE_PROJECT_REF" "$LEGACY_PROD_PROJECT_REF"
fi

REF="$SUPABASE_PROJECT_REF"
BASE="https://${REF}.supabase.co/functions/v1"

echo "Smoke: project $(ci_deploy_mask_ref "$REF")"

echo "→ supabase link --project-ref $REF"
export SUPABASE_ACCESS_TOKEN
"${SUPABASE[@]}" link --project-ref "$REF" >/dev/null

echo "→ supabase functions list"
FUNCS="$("${SUPABASE[@]}" functions list 2>/dev/null || true)"
for fn in list-public-properties get-public-property get-booked-dates search-listings; do
  if ! grep -q "$fn" <<<"$FUNCS"; then
    echo "ERROR: $fn not found in functions list." >&2
    echo "$FUNCS" >&2
    exit 1
  fi
done
echo "  required public functions present"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required for response-shape assertions." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

smoke_get() {
  local label="$1"
  local path="$2"
  local assertion="$3"
  local body_file="$TMP_DIR/${label}.json"
  local http_code

  http_code="$(
    curl --silent --show-error --output "$body_file" --write-out "%{http_code}" \
      --header "apikey: ${SUPABASE_ANON_KEY}" \
      --header "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      "${BASE}/${path}" || printf '000'
  )"
  echo "→ GET ${path%%\?*} → HTTP $http_code"
  if [[ "$http_code" != "200" ]]; then
    echo "ERROR: $label smoke request failed (HTTP $http_code)." >&2
    cat "$body_file" >&2 || true
    exit 1
  fi
  if ! jq -e "$assertion" "$body_file" >/dev/null; then
    echo "ERROR: $label returned an unexpected response shape." >&2
    cat "$body_file" >&2
    exit 1
  fi
}

SLUG="$(jq -rn --arg value "$SMOKE_PROPERTY_SLUG" '$value|@uri')"
smoke_get "properties" "list-public-properties?pageSize=1" \
  '.success == true and (.data | type == "array")'
smoke_get "property" "get-public-property?property=${SLUG}" \
  '.success == true and (.data.id | type == "string")'
smoke_get "availability" "get-booked-dates?property=${SLUG}" \
  '.success == true'
smoke_get "search" "search-listings?where=${SLUG}&pageSize=1" \
  '.success == true'

echo "Smoke OK."
