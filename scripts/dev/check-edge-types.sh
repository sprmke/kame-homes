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
  # Public page editors — added after the 2026-11-04 boot error (duplicate `const row`)
  # left Stay Guide / Showcase stuck on the skeleton.
  public-page-configs/index.ts
  _shared/bookingAssetTypes.ts
  _shared/bookingDetailsPatch.ts
  _shared/cors.ts
  _shared/propertyScope.ts
  _shared/publicEndpointRateLimit.ts
  _shared/webCryptoKey.ts
  # Cron / automation graph — added after the 2026-11-02 review-lifecycle failure
  # (missing import shipped because these modules were not in the launch surface).
  review-lifecycle-cron/index.ts
  review-automation-settings/index.ts
  _shared/reviewLifecycle.ts
  _shared/reviewAutomation.ts
  _shared/propertyAutomationToggles.ts
  send-parking-reminders/index.ts
  _shared/parkingReminderCron.ts
  _shared/parkingReminderEligibility.ts
  # Marketing media library — added after the 2026-11-04 deploy caught a
  # missing activity-log action key that only the bundler type-checks.
  marketing-media/index.ts
  marketing-media-sweeper/index.ts
  _shared/marketingMediaStorage.ts
  _shared/marketingMediaIngest.ts
  _shared/marketingMediaSweeper.ts
  # Weekly operations report — super-admin console, cron, and the shared health collector.
  ops-report/index.ts
  ops-report-cron/index.ts
  _shared/opsReport.ts
  _shared/opsReportSentry.ts
  _shared/opsReportRunner.ts
  _shared/systemHealth/collect.ts
  super-admin-system-health/index.ts
)

echo "→ deno check (${#targets[@]} launch and cron edge modules)"
deno check --allow-import "${targets[@]}"
