#!/usr/bin/env bash
# Batch 8 — remaining deployable WIP (guest trip, for-hosts v3, social remotion, locks).
# Skip: scripts/dev/batch-commit-run-*.sh (local helpers only).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

commit() {
  local msg=$1
  shift
  git add "$@"
  git commit -m "$msg"
}

commit "feat(supabase): add guest trip access and trip edge handlers" \
  supabase/functions/_shared/guestTrip.ts \
  supabase/functions/_shared/guestTripAccess.ts \
  supabase/functions/_shared/guestTripAccess_test.ts \
  supabase/functions/get-guest-trip/index.ts \
  supabase/functions/issue-guest-trip-link/index.ts \
  supabase/functions/_shared/guestProfileService.ts

commit "feat(ui): add guest trip hub page and helpers" \
  ui/src/features/guest/trip

commit "feat(guest-form): link success and sd flows to trip hub" \
  ui/src/features/guest/lib/guestPublicPaths.ts \
  ui/src/features/guest/property/routes/index.tsx \
  ui/src/features/guest/form/components/GuestFormSuccess.tsx \
  ui/src/features/guest/sd-form/pages/GuestReviewPage.tsx \
  ui/src/features/guest/sd-form/pages/SdFormPage.tsx

commit "feat(ui): add account trips list and message trip resume" \
  ui/src/features/guest/account/components/GuestAccountMobileNav.tsx \
  ui/src/features/guest/account/components/GuestMessagesHub.tsx \
  ui/src/features/guest/account/lib/guestAccountApi.ts \
  ui/src/features/guest/account/lib/guestAccountNav.ts \
  ui/src/features/guest/account/lib/guestAccountPaths.ts \
  ui/src/features/guest/account/routes/index.tsx \
  ui/src/features/guest/account/hooks/useGuestTrips.ts \
  ui/src/features/guest/account/pages/GuestTripsPage.tsx

commit "feat(bookings): add guest trip link actions on booking detail" \
  ui/src/features/dashboard/bookings/hooks/useBookingTripLink.ts \
  ui/src/features/dashboard/bookings/lib/bookingDetailActions.ts \
  ui/src/features/dashboard/bookings/lib/bookingDetailActions.test.ts \
  ui/src/features/dashboard/bookings/pages/BookingDetailPage.tsx

commit "feat(ui): add for-hosts v3 landing preview route" \
  ui/src/features/guest/marketing/pages/ForHostsV3Page.tsx \
  ui/src/features/guest/marketing/for-hosts/v3 \
  ui/src/features/guest/marketing/routes/index.tsx

commit "chore(*): extend marketing social remotion kit" \
  marketing/social \
  .agent/skills/social-creative/SKILL.md

commit "docs(docs): add guest trip hub route guides and workflow note" \
  docs/guides/routes/account/trips.md \
  docs/guides/routes/trip.md \
  docs/workflow/in-progress/guest-trip-hub.md \
  bun.lock \
  deno.lock \
  package.json \
  ui/package.json

echo "batch-commit-run-8 done"
