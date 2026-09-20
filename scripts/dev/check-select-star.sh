#!/usr/bin/env bash
# Guards production-readiness doc 13 (compress API payloads) Phase 13.5: flags new
# `.select('*')`/`.select("*")` in supabase/functions/** outside an explicit
# allowlist. `select('*')` over-fetches every column — including large/JSONB
# fields the caller never renders — which is the "shrink payloads" problem doc 13
# names as the real win (JSON compresses well; over-fetching doesn't).
#
# This is a one-way allowlist, same shape as check-unbounded-select.sh: every
# current `select('*')` call site as of doc 13 (2026-09-17) is listed below, so
# this guard passes on the current tree and only blocks a NEW unreviewed
# `select('*')` addition. It is not a claim that every allowlisted site is
# actually fine to leave wide — most are (small/narrow tables: org, property,
# parking, team-member, settings, plan-catalog rows with row counts in the tens,
# not thousands, or single-row/insert-returning reads), but the widest table in
# the schema (`guest_submissions`, used across financeService.ts/dashboardService.ts/
# bookingFinance.ts's many interlocking helpers) is allowlisted as a documented
# DEFERRED risk, not a verified-safe one — see doc 13's Implementation status
# section for the full classification and why each remaining site wasn't narrowed
# this pass.
#
# Not a parser — a ripgrep/grep line-scan for the literal `select('*')` /
# `select("*")` call. It cannot see column lists built dynamically (a `SELECT_*`
# constant string, computed column arrays) — those would evade this guard as
# written; none exist in this codebase as of this pass (verified by grep).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Every function file with a `select('*')`/`select("*")` call site as of doc 13
# (2026-09-17). Keep in sync with the grep this guard runs — if you narrow a
# `select('*')` to explicit columns, remove that file from this list so the guard
# actually protects the win. If you add a genuinely new `select('*')`, add it here
# only after confirming (via docs/workflow/planned/production-readiness-checklist/
# 13-compress-api-payloads.md's classification table) that the table is small/
# narrow or the row is single-record — a list endpoint over a wide/growing table
# should select explicit columns instead of being added here.
ALLOWLIST=(
  '_shared/appSettings.ts'
  '_shared/approvalEmailMatcher.ts'
  '_shared/bookingAiReviewService.ts'
  '_shared/bookingDetailsPatch.ts'
  '_shared/bookingDocumentShareToken.ts'
  '_shared/chatMessageLifecycle.ts'
  '_shared/customPages.ts'
  '_shared/dashboardAssistantPhase4Tools.ts'
  '_shared/dashboardAssistantSettings.ts'
  '_shared/dashboardAssistantTools.ts'
  '_shared/dashboardAssistantVerificationTools.ts'
  '_shared/dashboardService.ts'
  '_shared/databaseService.ts'
  '_shared/financeExport.ts'
  '_shared/financeService.ts'
  '_shared/guestFormCompletion.ts'
  '_shared/guestStayGuide.ts'
  '_shared/inboxSendReplyAction.ts'
  '_shared/listingAuthorizationService.ts'
  '_shared/maintenanceService.ts'
  '_shared/marketingPublishAction.ts'
  '_shared/metaInboxAutoReply.ts'
  '_shared/metaInboxBackfill.ts'
  '_shared/metaInboxScope.ts'
  '_shared/metaInboxWebhookHealth.ts'
  '_shared/orgAuth.ts'
  '_shared/orgProfileService.ts'
  '_shared/orgSettings.ts'
  '_shared/orgTeamService.ts'
  '_shared/parkingBlockedDates.ts'
  '_shared/parkingBroadcastActions.ts'
  '_shared/parkingBroadcastExpireCron.ts'
  '_shared/parkingEndorsementEmail.ts'
  '_shared/parkingPaymentOrchestrator.ts'
  '_shared/parkingScope.ts'
  '_shared/parkingTeamService.ts'
  '_shared/platformPaymentSettings.ts'
  '_shared/propertyBlockedDates.ts'
  '_shared/propertyProfileService.ts'
  '_shared/propertySettingsCloneHelpers.ts'
  '_shared/propertyTeamService.ts'
  '_shared/propertyTemplates.ts'
  '_shared/publicPageConfigs.ts'
  '_shared/recurringSeriesScheduleRebuild.ts'
  '_shared/settingsVerification.ts'
  '_shared/smartPricing.ts'
  '_shared/socialInboxDb.ts'
  '_shared/socialInboxService.ts'
  '_shared/subscriptionOrchestrator.ts'
  '_shared/superAdminVerification.ts'
  '_shared/supportTicketCreate.ts'
  '_shared/telegramAdmin.ts'
  '_shared/telegramFinance.ts'
  '_shared/telegramMaintenance.ts'
  '_shared/telegramStaff.ts'
  '_shared/voiceReceptionistService.ts'
  '_shared/webGuestChatService.ts'
  '_shared/webInboxAutoReply.ts'
  'approve-org-verification/index.ts'
  'create-development/index.ts'
  'create-help-center-faq/index.ts'
  'create-host-playbook-article/index.ts'
  'create-organization/index.ts'
  'create-parking/index.ts'
  'create-property/index.ts'
  'dashboard-assistant-confirm/index.ts'
  'dashboard-stats/index.ts'
  'get-booking/index.ts'
  'get-development/index.ts'
  'get-org-verification-assets/index.ts'
  'get-support-ticket-admin/index.ts'
  'get-support-ticket/index.ts'
  'list-org-listing-verifications/index.ts'
  'list-organizations/index.ts'
  'list-parkings/index.ts'
  'list-properties/index.ts'
  'list-support-tickets/index.ts'
  'marketing-templates/index.ts'
  'meta-inbox-backfill/index.ts'
  'org-subscriptions-admin/index.ts'
  'parking-settings/index.ts'
  'platform-parking-settings/index.ts'
  'platform-payment-settings/index.ts'
  'platform-settings/index.ts'
  'pricing-plans/index.ts'
  'publish-to-meta/index.ts'
  'reject-org-verification/index.ts'
  'reopen-support-ticket/index.ts'
  'reply-support-ticket-admin/index.ts'
  'reply-support-ticket/index.ts'
  'social-inbox-send/index.ts'
  'social-inbox-settings/index.ts'
  'social-inbox-templates/index.ts'
  'submit-org-verification/index.ts'
  'submit-parking-booking-request/index.ts'
  'update-booking-details/index.ts'
  'update-development/index.ts'
  'update-help-center-faq/index.ts'
  'update-host-playbook-article/index.ts'
  'update-parking/index.ts'
  'update-property/index.ts'
  'update-support-ticket-status/index.ts'
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

SELECT_STAR_PATTERN="\\.select\\(['\"]\\*['\"]\\)"

search_files_with_select_star() {
  if command -v rg >/dev/null 2>&1; then
    rg -l "$SELECT_STAR_PATTERN" supabase/functions \
      --glob '*.ts' \
      --glob '!*_test.ts' \
      --glob '!tests/*.test.ts'
  else
    grep -RIl --include='*.ts' --exclude='*_test.ts' -E "$SELECT_STAR_PATTERN" supabase/functions
  fi
}

fail=0

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  fn="${file#supabase/functions/}"
  if is_allowlisted "$fn"; then
    continue
  fi
  echo "NEW select('*'): $fn — narrow to explicit columns, or add to ALLOWLIST in" \
    "scripts/dev/check-select-star.sh with a reason (small/narrow table or" \
    "single-row read — see doc 13's classification table before allowlisting a" \
    "list endpoint over a wide/growing table)." >&2
  fail=1
done < <(search_files_with_select_star)

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "OK — select('*') sites match the doc-13 allowlist."
