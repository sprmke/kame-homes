#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

c() { git commit -m "$MSG"; }

MSG="$(cat <<'EOF'
database(supabase): enforce authenticated rate limits

Add migration, config entries, shared limit helpers, and ci guard script.
EOF
)"
git add -- \
  supabase/migrations/20261316123500_authenticated_rate_limit_enforcement.sql \
  supabase/config.toml \
  supabase/functions/_shared/rateLimit.ts \
  supabase/functions/_shared/rateLimit_test.ts \
  supabase/functions/_shared/serveEdge.ts \
  supabase/functions/_shared/hostPreviewAccess.ts \
  supabase/functions/super-admin-rate-limits/ \
  supabase/functions/platform-settings/index.ts \
  scripts/dev/check-authenticated-rate-limit.sh \
  scripts/dev/check-unbounded-select.sh \
  scripts/dev/batch-commit-run-7.sh
c

MSG="$(cat <<'EOF'
feat(supabase): host preview jwt on public property reads

Wire preview access checks into public property and showcase handlers.
EOF
)"
git add -- \
  supabase/functions/_shared/guestStayGuide.ts \
  supabase/functions/_shared/platformSettingsCache.ts \
  supabase/functions/_shared/publicPropertyService.ts \
  supabase/functions/_shared/superAdminVerification.ts \
  supabase/functions/get-public-property/index.ts \
  supabase/functions/get-public-showcase/index.ts
c

MSG="$(cat <<'EOF'
feat(ui): add super admin rate limits console

Add rate limit page, hooks, and platform settings navigation updates.
EOF
)"
git add -A -- \
  ui/src/features/dashboard/super-admin/hooks/useSuperAdminRateLimits.ts \
  ui/src/features/dashboard/super-admin/pages/SuperAdminRateLimitsPage.tsx \
  ui/src/features/dashboard/super-admin/hooks/usePlatformSettings.ts \
  ui/src/features/dashboard/super-admin/lib/superAdminPaths.ts \
  ui/src/features/dashboard/super-admin/lib/superAdminPlatformNav.ts \
  ui/src/features/dashboard/super-admin/pages/SuperAdminPlatformSettingsPage.tsx \
  ui/src/features/dashboard/super-admin/routes/index.tsx \
  ui/src/features/dashboard/super-admin/components/AiCreditWalletCard.tsx \
  ui/src/features/dashboard/super-admin/components/HostVerificationRewardCard.tsx \
  ui/src/features/dashboard/super-admin/components/SuperAdminGenerationOverridesCard.tsx \
  ui/src/features/dashboard/super-admin/components/super-admin-approvals/
c

MSG="$(cat <<'EOF'
feat(ui): setup guide skeleton and editor preview jwt

Add step skeleton, preview token hook, and setup guide overlay polish.
EOF
)"
git add -A -- \
  ui/src/features/dashboard/setup-guide/ \
  ui/src/features/dashboard/page-editor/ \
  ui/src/features/dashboard/pricing/components/ChannelSyncDialog.tsx \
  ui/src/features/dashboard/pricing/components/SmartPricingDialog.tsx
c

MSG="$(cat <<'EOF'
feat(ui): update guest stay guide showcase and voice chat

Refresh public pages, voice receptionist api, and guest account settings.
EOF
)"
git add -A -- \
  ui/src/features/guest/ \
  ui/src/components/skeletons/GuestPageSkeletons.tsx
c

MSG="$(cat <<'EOF'
feat(ui): polish dashboard announcements bookings and org ai settings

Update host announcements, workflow modals, and org ai platform sections.
EOF
)"
git add -A -- \
  ui/src/features/dashboard/announcements/ \
  ui/src/features/dashboard/bookings/ \
  ui/src/features/dashboard/inbox/components/InboxQuickRepliesTab.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioComposer.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioSection.tsx \
  ui/src/features/dashboard/org/components/ \
  ui/src/features/dashboard/analytics/components/AiPerformanceReviewCard.tsx \
  ui/src/features/dashboard/ai-assistant/components/ChatBlockRenderer.tsx \
  ui/src/features/dashboard/ai-assistant/components/blocks/TextBlock.tsx \
  ui/src/features/dashboard/team/lib/permissionExpansionDrift.test.ts \
  ui/src/components/skeletons/AdminSkeletons.tsx
c

MSG="$(cat <<'EOF'
docs(docs): sync rate limiting guides and route docs

Update architecture, route guides, checklist 23, and components rule.
EOF
)"
git add -A -- docs/ .cursor/rules/components.mdc
git reset HEAD -- docs/workflow/intake/_to-plan.md docs/workflow/intake/_to-prompt.md docs/personal/ 2>/dev/null || true
c

echo "batch-commit-run-7 done"
