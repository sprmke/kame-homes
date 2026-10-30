#!/usr/bin/env bash
# One-shot batch: commit all staged deployable work in thematic commits.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

commit_msg() {
  git commit -m "$1"
}

git reset HEAD
git add -A
git reset -- ui/e2e/artifacts undefined 2>/dev/null || true

commit_paths() {
  local msg=$1
  shift
  git reset HEAD
  git add -A -- "$@" 2>/dev/null || true
  if git diff --cached --quiet; then
    echo "skip (empty): $msg"
    return 0
  fi
  git commit -m "$msg"
}

commit_paths "feat(supabase): add feature availability migration and edge handlers" \
  supabase/migrations/20261316128800_feature_availability_overrides.sql \
  supabase/functions/_shared/featureAvailability.ts \
  supabase/functions/_shared/featureAvailabilityAdminValidation.ts \
  supabase/functions/_shared/featureAvailabilityCatalog.ts \
  supabase/functions/_shared/featureAvailabilityPublicEntries.ts \
  supabase/functions/_shared/featureAvailabilityResolve.ts \
  supabase/functions/_shared/featureAvailabilityResolve_test.ts \
  supabase/functions/_shared/featureAvailability_test.ts \
  supabase/functions/feature-availability \
  supabase/functions/get-feature-availability \
  supabase/functions/tests/featureAvailabilityAdmin.test.ts \
  supabase/functions/tests/getFeatureAvailability.test.ts \
  supabase/config.toml

commit_paths "feat(supabase): enforce feature availability on host edge modules" \
  supabase/functions/_shared/dashboardAssistantGuidanceTools.ts \
  supabase/functions/_shared/dashboardAssistantOpsTools.ts \
  supabase/functions/_shared/dashboardAssistantParity.ts \
  supabase/functions/_shared/dashboardAssistantTools.ts \
  supabase/functions/_shared/inboxSendReplyAction.ts \
  supabase/functions/_shared/metaInboxAutoReply.ts \
  supabase/functions/_shared/metaInboxGraph.ts \
  supabase/functions/_shared/parkingBroadcast.ts \
  supabase/functions/analytics-ai-review-cron \
  supabase/functions/analytics-ai-review \
  supabase/functions/calendar-sync-cron \
  supabase/functions/calendar-sync-settings \
  supabase/functions/generate-marketing-media \
  supabase/functions/ical-export \
  supabase/functions/meta-inbox-backfill \
  supabase/functions/meta-inbox-disconnect \
  supabase/functions/meta-inbox-oauth-callback \
  supabase/functions/meta-inbox-oauth-complete \
  supabase/functions/meta-inbox-oauth-pages \
  supabase/functions/meta-inbox-oauth-start \
  supabase/functions/meta-inbox-resubscribe \
  supabase/functions/social-inbox-ai-suggest \
  supabase/functions/social-inbox-messages \
  supabase/functions/social-inbox-send \
  supabase/functions/social-inbox-threads \
  supabase/functions/upload-marketing-generation-reference \
  scripts/dev/audit-auth-matrix.mjs

commit_paths "feat(supabase): harden telegram sends with shared guard" \
  supabase/functions/_shared/propertyTelegramCredentials.ts \
  supabase/functions/_shared/telegramAdmin.ts \
  supabase/functions/_shared/telegramChat.ts \
  supabase/functions/_shared/telegramFinance.ts \
  supabase/functions/_shared/telegramMaintenance.ts \
  supabase/functions/_shared/telegramMarketing.ts \
  supabase/functions/_shared/telegramParking.ts \
  supabase/functions/_shared/telegramSettingsHttp.ts \
  supabase/functions/_shared/telegramStaff.ts \
  supabase/functions/_shared/telegramSendGuard_test.ts \
  supabase/functions/telegram-admin-cron \
  supabase/functions/telegram-admin-settings \
  supabase/functions/telegram-chat-settings \
  supabase/functions/telegram-finance-cron \
  supabase/functions/telegram-finance-settings \
  supabase/functions/telegram-global-settings \
  supabase/functions/telegram-maintenance-cron \
  supabase/functions/telegram-maintenance-settings \
  supabase/functions/telegram-marketing-cron \
  supabase/functions/telegram-marketing-settings \
  supabase/functions/telegram-parking-settings \
  supabase/functions/telegram-staff-cron \
  supabase/functions/telegram-staff-settings

commit_paths "feat(ui): add feature availability client and super admin controls" \
  ui/src/lib/featureAvailability \
  ui/src/components/feature-availability \
  ui/src/features/dashboard/super-admin/components/super-admin-feature-availability \
  ui/src/features/dashboard/super-admin/hooks/useFeatureAvailabilityAdmin.ts \
  ui/src/features/dashboard/super-admin/lib/featureAvailabilityAdmin.test.ts \
  ui/src/features/dashboard/super-admin/lib/featureAvailabilityAdmin.ts \
  ui/src/features/dashboard/super-admin/pages/SuperAdminFeatureAvailabilityPage.tsx \
  ui/src/features/dashboard/super-admin/lib/superAdminPaths.test.ts \
  ui/src/features/dashboard/super-admin/lib/superAdminPaths.ts \
  ui/src/features/dashboard/super-admin/lib/superAdminPlatformNav.test.ts \
  ui/src/features/dashboard/super-admin/lib/superAdminPlatformNav.ts \
  ui/src/features/dashboard/super-admin/routes/index.tsx

commit_paths "feat(ui): inbox chat templates and guest rich messages" \
  ui/src/features/dashboard/inbox \
  ui/src/components/chat/ChatMessageBubble.tsx \
  ui/src/components/chat/chatTemplateSnapshot.test.ts \
  ui/src/components/chat/chatTemplateSnapshot.ts \
  ui/src/features/dashboard/inbox/components/ChatTemplateMessage.tsx \
  ui/src/features/guest/chat

commit_paths "feat(ui): gate analytics marketing pricing on feature availability" \
  ui/src/features/dashboard/analytics \
  ui/src/features/dashboard/marketing \
  ui/src/features/dashboard/pricing \
  ui/src/features/dashboard/plans/lib/planGateCoverage.test.ts

commit_paths "feat(ui): refresh notifications hub and telegram settings" \
  ui/src/features/dashboard/notifications \
  ui/src/features/dashboard/parking/pages/ParkingNotificationsPage.tsx \
  ui/src/features/dashboard/bookings/components/AdminLayout.tsx \
  ui/src/features/dashboard/bookings/components/telegram-notifications \
  ui/src/features/dashboard/bookings/components/property-templates/RichTextDisplay.tsx \
  ui/src/features/dashboard/bookings/lib/telegramSettingsClient.ts \
  ui/src/features/dashboard/bookings/pages/NotificationsPage.tsx

commit_paths "feat(ui): expand super admin health and overview" \
  ui/src/features/dashboard/super-admin/components/super-admin-overview \
  ui/src/features/dashboard/super-admin/pages/SuperAdminHealthPage.tsx \
  ui/src/features/dashboard/super-admin/pages/SuperAdminOverviewPage.tsx

commit_paths "fix(ui): network-only feature availability in pwa sync" \
  ui/src/lib/pwa/syncEngine.test.ts \
  ui/src/lib/pwa/syncEngine.ts \
  ui/src/pwa/sw.ts

commit_paths "test(ui): e2e for feature availability inbox and assistant" \
  ui/e2e/features/feature-availability \
  ui/e2e/features/dashboard/inboxChatTemplates.spec.ts \
  ui/e2e/features/assistant/assistantTemplateContext.spec.ts \
  ui/e2e/shared/featureAvailabilityMocks.ts \
  ui/e2e/features/team/shared/propertyTeamRbacHarness.ts

commit_paths "docs: feature availability architecture route guides and workflow" \
  docs/architecture/feature-availability.md \
  docs/architecture/data-model.md \
  docs/architecture/edge-functions.md \
  docs/PROJECT.md \
  docs/README.md \
  docs/guides/routes/admin/feature-availability.md \
  docs/guides/routes/admin/overview.md \
  docs/guides/routes/account/profile.md \
  docs/guides/routes/auth.md \
  docs/guides/routes/org/parking/notifications.md \
  docs/guides/routes/org/property/analytics.md \
  docs/guides/routes/org/property/inbox.md \
  docs/guides/routes/org/property/marketing.md \
  docs/guides/routes/org/property/notifications.md \
  docs/guides/routes/org/property/pricing.md \
  docs/archive/operations/scheduled-jobs-and-testing.md \
  docs/workflow/done/feature-availability-controls.md \
  docs/workflow/for-testing/feature-availability-controls.md \
  docs/workflow/in-progress/feature-availability-controls.md \
  docs/workflow/done/README.md \
  docs/workflow/for-testing/README.md \
  docs/workflow/in-progress/README.md \
  docs/workflow/in-progress/production-readiness/checklist/22-security-and-rls.md \
  docs/workflow/in-progress/production-readiness/checklist/29-sdlc-testing.md \
  docs/workflow/in-progress/production-readiness/HANDOFF.md \
  docs/workflow/planned/README.md \
  docs/workflow/planned/kamespace-04-domain-move-kamespace-com.md \
  docs/workflow/planned/kamespace-05-google-services-verification.md \
  docs/workflow/planned/supabase-capacity-and-operational-readiness.md \
  docs/workflow/wont-do/module-status-management.md \
  .agent/skills/plans-and-permissions/SKILL.md

commit_paths "chore(*): add security audit skill brand scripts and batch runners" \
  .agents/skills/security-audit \
  .claude/skills/security-audit \
  .cursor/skills/security-audit \
  scripts/brand \
  scripts/dev/batch-commit-run-15-half-assistant-guest.sh \
  scripts/dev/batch-commit-run-15-quarter-marketing-health.sh \
  scripts/dev/batch-commit-run-6.sh \
  scripts/dev/batch-commit-all-deployable.sh

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard | grep -v 'ui/e2e/artifacts' | grep -v '^undefined/' || true)" ]; then
  echo "Remaining uncommitted files:"
  git status --porcelain
  git reset HEAD
  git add -A
  git reset -- ui/e2e/artifacts undefined 2>/dev/null || true
  if ! git diff --cached --quiet; then
    git commit -m "chore(*): commit remaining deployable files from batch"
  fi
fi

echo "Done. Commits:"
git log origin/develop..HEAD --oneline
