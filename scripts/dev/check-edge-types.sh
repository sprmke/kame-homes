#!/usr/bin/env bash
# Type-check the launch surface that would have caught P0-1 (missing public
# rate-limit imports) plus the booking-detail write path. A full-tree
# `deno check` of every handler still has a pre-existing typing backlog;
# `bun run test:edge` type-checks the shared test graph without `--no-check`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FUNCTIONS_DIR="$ROOT/supabase/functions"
cd "$FUNCTIONS_DIR"

if ! command -v deno >/dev/null 2>&1; then
  export PATH="$HOME/.deno/bin:$PATH"
fi

if ! command -v deno >/dev/null 2>&1; then
  echo "deno is required for check:edge-types (install via https://deno.land/)" >&2
  exit 1
fi

targets=(
  get-public-property/index.ts
  search-listings/index.ts
  get-public-parking/index.ts
  get-booked-dates/index.ts
  search-suggestions/index.ts
  get-sd-form/index.ts
  list-public-properties/index.ts
  update-booking-details/index.ts
  _shared/bookingAssetTypes.ts
  _shared/bookingDetailsPatch.ts
  _shared/cors.ts
  _shared/propertyScope.ts
  _shared/publicEndpointRateLimit.ts
  _shared/webCryptoKey.ts
)

echo "→ deno check (${#targets[@]} launch-surface edge modules)"
deno check --allow-import "${targets[@]}"
