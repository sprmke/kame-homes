#!/usr/bin/env bash
# Flags Supabase `.select(` statements in supabase/functions/** with no `.range(`/
# `.limit(`/`.single(`/`.maybeSingle(`/`count: 'exact'` before the statement's
# terminating `;` — a heuristic line-scan, not a parser.
#
# This is a regression guard, not a fixer: ALLOWLIST below holds files where the
# heuristic itself is wrong (a query builder built once and reused/chained across
# branches, so the bound and the `.select(` land in statements the line-scan can't
# connect) or where a query is intentionally left unbounded pending a real fix — each
# entry names which. See docs/workflow/planned/production-readiness-checklist/
# 10-paginate-large-lists.md for the two confirmed worst offenders this guard was
# built alongside (`listBookings`, `fetchAllBookingsForFinance` — both already fixed).
#
# A prior version of this script reset its scan state on every new `.select(` match
# via an awk `next`, which skipped evaluating a single-line `await x.select(...);`
# statement entirely — the single most common unbounded-query shape in this codebase.
# That let ~150 files (mostly false positives from an unrelated 20-line-lookahead
# quirk) sit on the allowlist while real single-line gaps went undetected. Fixed by
# scanning every line unconditionally instead of skipping past `.select(` lines.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ALLOWLIST=(
  # Query builder is created once (`.select('id, name')`) and reused across two
  # mutually exclusive branches (`.eq('id', orgId).maybeSingle()` vs
  # `.eq('slug', orgSlug).maybeSingle()`), so the bound and the `.select(` are in
  # different statements — genuinely bounded, just not detectable by a line-scan.
  'ai-platform-credit-wallet/index.ts'
  'ai-platform-generation-overrides/index.ts'

  # `readRow` selects by `.eq('cache_key', cacheKey).maybeSingle()` — bounded to one row
  # by a unique key, not tenant growth. `sweepExpiredCacheRows` deletes-and-returns rows
  # already bounded by its own `.lt('expires_at', now)` predicate (only ever-shrinking
  # expired rows, capped by the query_cache table's own TTL sweep). Doc 12, Phase 12.3.
  '_shared/queryCache.ts'

  # Super-admin manual block list (`rate_limit_blocks`) — admin-curated, tiny table;
  # all active rows loaded into a 30s isolate cache (doc 23), not tenant growth.
  '_shared/rateLimit.ts'

  # Everything below is the corrected heuristic's honest current-state sweep (see the
  # header above) — NOT a hand-verified defect list. Some are real gaps; most are
  # false positives this line-scan can't resolve (a `.single()`/`.maybeSingle()` on a
  # stored/reused query builder, a config/catalog table, a query already bounded by
  # an upstream ID-array cap). Verifying and shrinking this list — moving a file to
  # a real `.range()`/`.limit()` fix, or to a documented false-positive entry above —
  # is the concrete follow-up doc 10 defers; do not add new files here without a
  # reason once this list is paid down.
  '_shared/aiUsageService.ts'
  '_shared/appSettings.ts'
  '_shared/approvalEmailMatcher.ts'
  '_shared/availabilityService.ts'
  '_shared/calendarSyncRun.ts'
  '_shared/contractExpiryCron.ts'
  '_shared/dashboardAssistantAttachedContext.ts'
  # Count-only `{ count: 'exact', head: true }` per status (doc 10 follow-up).
  # Still allowlisted: other `.select(` builders in this file (properties/org) have
  # no `.limit()` and the line-scan cannot see the head-count bound on a helper.
  '_shared/dashboardAssistantContext.ts'
  '_shared/dashboardAssistantExpireCron.ts'
  '_shared/dashboardAssistantOpsTools.ts'
  '_shared/dashboardAssistantPhase4Tools.ts'
  '_shared/dashboardAssistantSettings.ts'
  '_shared/dashboardAssistantTools.ts'
  '_shared/dashboardService.ts'
  '_shared/databaseService.ts'
  '_shared/developmentSerialize.ts'
  '_shared/financeExport.ts'
  '_shared/financeService.ts'
  '_shared/guestContactInfo.ts'
  '_shared/guestProfileService.ts'
  '_shared/guestStayGuide.ts'
  '_shared/hostAnnouncements.ts'
  '_shared/hostSerialize.ts'
  '_shared/hostVerificationReward.ts'
  # Availability load is now date-bounded (`check_in_date_sql`/`check_out_date_sql`
  # overlap with a 180-day horizon). Heuristic still flags it: no `.limit()`.
  '_shared/inboxAiGuestContext.ts'
  '_shared/maintenanceService.ts'
  '_shared/marketingGenerationBudget.ts'
  '_shared/marketingGenerationFeatureConfig.ts'
  '_shared/marketingGenerationJobs.ts'
  '_shared/metaInboxLifecycle.ts'
  '_shared/metaInboxScope.ts'
  '_shared/metaInboxWebhookHealth.ts'
  '_shared/orgAuth.ts'
  '_shared/orgNameConflict.ts'
  '_shared/orgSubscriptionCheckout.ts'
  '_shared/orgSuperhost.ts'
  '_shared/orgTeamListingAssignment.ts'
  '_shared/orgTeamService.ts'
  '_shared/orgTeamTemplates.ts'
  '_shared/ownerDefaultParking.ts'
  '_shared/parkingBlockedDates.ts'
  '_shared/parkingBroadcast.ts'
  '_shared/parkingBroadcastExpireCron.ts'
  '_shared/parkingBroadcastRanking.ts'
  '_shared/parkingPricing.ts'
  '_shared/parkingPropertyLink.ts'
  '_shared/parkingReminderCron.ts'
  '_shared/parkingScope.ts'
  '_shared/parkingTeamService.ts'
  '_shared/planEntitlements.ts'
  '_shared/preferredOwnerParkingDefaults.ts'
  '_shared/propertyBlockedDates.ts'
  '_shared/propertyCron.ts'
  '_shared/propertyNameConflict.ts'
  '_shared/propertyPricing.ts'
  '_shared/propertyScope.ts'
  '_shared/propertySettingsCloneGroups.ts'
  '_shared/propertySettingsClonePhase23.ts'
  '_shared/propertySettingsCloneRun.ts'
  '_shared/propertyTeamInviteEmail.ts'
  '_shared/propertyTeamService.ts'
  '_shared/propertyTeamTemplates.ts'
  '_shared/propertyTelegramCredentials.ts'
  '_shared/propertyTemplates.ts'
  '_shared/propertyTowerUnit.ts'
  '_shared/publicHostService.ts'
  '_shared/publicListingFacets.ts'
  '_shared/pushRecipients.ts'
  '_shared/recurringSeriesScheduleRebuild.ts'
  '_shared/settingsChangeNotifyRecipients.ts'
  '_shared/smartPricing.ts'
  '_shared/smartPricingRead.ts'
  '_shared/socialInboxService.ts'
  '_shared/subscriptionOrchestrator.ts'
  '_shared/superAdminApprovalsQueue.ts'
  '_shared/superAdminListingVerifications.ts'
  '_shared/superAdminOrgVerifications.ts'
  '_shared/superhostAssessment.ts'
  '_shared/superhostMetrics.ts'
  '_shared/telegramAdmin.ts'
  '_shared/telegramChat.ts'
  '_shared/telegramFinance.ts'
  '_shared/telegramMaintenance.ts'
  # Date-bounded via check_in_date_sql / check_out_date_sql (today occupancy +
  # next-N-days check-ins). Heuristic still flags it: no `.limit()`.
  '_shared/telegramStaff.ts'
  '_shared/voiceReceptionistService.ts'
  '_shared/webGuestChatService.ts'
  'analytics-ai-review-cron/index.ts'
  'calendar-sync-cron/index.ts'
  'calendar-sync-settings/index.ts'
  'create-organization/index.ts'
  'dashboard-assistant-conversations/index.ts'
  'decide-contract-consideration/index.ts'
  'delete-organization/index.ts'
  'generate-marketing-media/index.ts'
  'get-booked-dates/index.ts'
  'get-booking-ai-assistant-audit/index.ts'
  'get-organization-admin/index.ts'
  'get-support-ticket-admin/index.ts'
  'get-support-ticket/index.ts'
  'import-commit/index.ts'
  'import-preview/index.ts'
  'import-revert/index.ts'
  'import-update-row/index.ts'
  'list-help-center-articles/index.ts'
  'list-help-center-faqs/index.ts'
  'list-host-announcements/index.ts'
  'list-host-properties/index.ts'
  'list-org-listing-verifications/index.ts'
  'list-organizations/index.ts'
  'list-parkings/index.ts'
  'list-platform-properties/index.ts'
  'list-properties/index.ts'
  'list-public-developments/index.ts'
  'list-public-parkings/index.ts'
  'list-public-place-groups/index.ts'
  'list-public-pricing-plans/index.ts'
  'list-public-properties/index.ts'
  'list-support-tickets-admin/index.ts'
  'marketing-templates/index.ts'
  'notifications-list/index.ts'
  'notifications-mark-read/index.ts'
  'org-plan/index.ts'
  'org-subscriptions-admin/index.ts'
  'reopen-support-ticket/index.ts'
  'reply-support-ticket/index.ts'
  'sd-refund-cron/index.ts'
  'search-listings/index.ts'
  'social-inbox-ai-suggest/index.ts'
  'social-inbox-settings/index.ts'
  'social-inbox-templates/index.ts'
)

is_allowlisted() {
  local fn="$1"
  for allowed in "${ALLOWLIST[@]}"; do
    if [[ "$fn" == "$allowed" ]]; then
      return 0
    fi
  done
  return 1
}

search_files() {
  if command -v rg >/dev/null 2>&1; then
    rg -l '\.select\(' supabase/functions \
      --glob '*.ts' \
      --glob '!*_test.ts' \
      --glob '!tests/*.test.ts'
  else
    grep -RIl --include='*.ts' --exclude='*_test.ts' '\.select(' supabase/functions
  fi
}

fail=0
while IFS= read -r file; do
  fn="${file#supabase/functions/}"
  if is_allowlisted "$fn"; then
    continue
  fi

  # Scans every line: a `.select(` opens a pending window: `bounded` flips true if a
  # bounding call appears before the statement's terminating `;`. Deliberately does
  # NOT reset on a new `.select(` match — only a `;`-terminated line closes the
  # window — so a single-line `await x.select(...);` statement is evaluated on its
  # own line rather than skipped.
  awk '
    {
      if ($0 ~ /\.select\(/) { pending = 1; bounded = 0 }
      if (pending && $0 ~ /\.range\(|\.limit\(|\.single\(|\.maybeSingle\(|count:[ \t]*.exact./) bounded = 1
      if (pending && $0 ~ /;[ \t]*$/) {
        if (!bounded) print "unbounded"
        pending = 0
      }
    }
  ' "$file" | grep -q unbounded && {
    echo "POSSIBLY UNBOUNDED .select(): $fn — add a .range()/.limit(), or add to ALLOWLIST in scripts/dev/check-unbounded-select.sh with a reason" >&2
    fail=1
  }
done < <(search_files)

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
