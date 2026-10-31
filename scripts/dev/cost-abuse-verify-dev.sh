#!/usr/bin/env bash
# Run all cost/abuse verification scripts against hosted dev (V-2 bundle).
# Usage:
#   BASE_URL=https://<dev-ref>.supabase.co/functions/v1 \
#   SUPABASE_URL=https://<dev-ref>.supabase.co \
#   ANON_KEY=<dev-anon> \
#   STORAGE_OBJECT_PATH=valid-ids/<sample-path> \
#   ./scripts/dev/cost-abuse-verify-dev.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "Set BASE_URL to hosted dev functions root (…/functions/v1)." >&2
  exit 1
fi
if [[ "$BASE_URL" == *"zfttdwtceyqszyeyhilc"* ]]; then
  echo "Refusing legacy production project ref." >&2
  exit 1
fi

echo "== Cron secret inventory (local grep) =="
./scripts/dev/audit-cron-secrets.sh

echo ""
echo "== Public endpoint abuse smoke =="
./scripts/dev/abuse-public-endpoints.sh

echo ""
echo "== CORS origin probe =="
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-https://dev.kamehomes.space}" ./scripts/dev/check-cors-origins.sh

if [[ -n "${SUPABASE_URL:-}" && -n "${ANON_KEY:-}" && -n "${STORAGE_OBJECT_PATH:-}" ]]; then
  echo ""
  echo "== Storage anon read (A11) =="
  ./scripts/dev/abuse-storage-anon-read.sh
else
  echo ""
  echo "Skip A11: set SUPABASE_URL, ANON_KEY, STORAGE_OBJECT_PATH after storage --key-shapes audit."
fi

if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo ""
  echo "== Guest-doc storage key shapes =="
  bun scripts/media/storage-audit.ts --key-shapes
fi

echo ""
echo "All automated checks finished. See docs/guides/testing/cost-abuse-verification.md for manual steps."
