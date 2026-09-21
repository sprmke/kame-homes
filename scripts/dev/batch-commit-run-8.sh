#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

commit() {
  git add -- "$@"
  git commit -m "$MSG"
}

# 1 — migration timestamp renames (delete + add pairs)
MSG="$(cat <<'EOF'
chore(supabase): renumber pending migrations for deploy order

Replace superseded migration filenames with 202613161207–211 timestamps unchanged SQL.
EOF
)"
commit \
  supabase/migrations/20261231140100_platform_host_settings_rls_fix.sql \
  supabase/migrations/20261231150000_azure_north_pool_defaults.sql \
  supabase/migrations/20261231152000_restore_platform_host_settings.sql \
  supabase/migrations/20261310120000_guest_doc_storage_service_role_writes.sql \
  supabase/migrations/20261311120000_dashboard_assistant_expire_cron.sql \
  supabase/migrations/20261316120700_azure_north_pool_defaults.sql \
  supabase/migrations/20261316120800_restore_platform_host_settings.sql \
  supabase/migrations/20261316120900_platform_host_settings_rls_fix.sql \
  supabase/migrations/20261316121000_guest_doc_storage_service_role_writes.sql \
  supabase/migrations/20261316121100_dashboard_assistant_expire_cron.sql

# 2 — supabase shared
MSG="$(cat <<'EOF'
feat(supabase): harden cors platform brand and cron handlers

Add cors and platformBrand unit tests; extend finance and marketing feature config.
EOF
)"
commit \
  supabase/functions/_shared/cors.ts \
  supabase/functions/_shared/cors_test.ts \
  supabase/functions/_shared/platformBrand.ts \
  supabase/functions/_shared/platformBrand_test.ts \
  supabase/functions/_shared/financeService.ts \
  supabase/functions/_shared/marketingGenerationFeatureConfig.ts \
  supabase/functions/_shared/metaInboxHealthcheckCron.ts \
  supabase/functions/_shared/parkingReminderCron.ts \
  supabase/functions/_shared/workflowOrchestrator.ts \
  supabase/.env.example

# 3 — marketing edge
MSG="$(cat <<'EOF'
feat(supabase): extend marketing generation edge handlers

Update generate-marketing-media, marketing-generations, and ai platform property settings.
EOF
)"
commit \
  supabase/functions/generate-marketing-media/index.ts \
  supabase/functions/marketing-generations/index.ts \
  supabase/functions/ai-platform-property-settings/index.ts

# 4 — PWA + platform app name
MSG="$(cat <<'EOF'
feat(ui): add configurable platform app name and pwa polish

Introduce platformAppName helper, route fallback shell, and updated PWA precache config.
EOF
)"
commit \
  ui/.env.example \
  ui/index.html \
  ui/public/favicon/site.webmanifest \
  ui/public/offline.html \
  ui/src/App.tsx \
  ui/src/components/routing/RouteFallback.tsx \
  ui/src/components/pwa/InstallPrompt.tsx \
  ui/src/components/pwa/PwaProvider.tsx \
  ui/src/lib/platformBranding.ts \
  ui/src/lib/platformAppName.ts \
  ui/src/lib/platformAppName.test.ts \
  ui/src/pwa/shared.ts \
  ui/src/pwa/sw.ts \
  ui/vite.config.ts \
  ui/vercel.json

# 5 — bookings hooks + lazy dashboard routes batch 1
MSG="$(cat <<'EOF'
perf(ui): lazy-load dashboard routes batch 1

Code-split activity, analytics, announcements, bookings, finance, and inbox routes.
EOF
)"
commit \
  ui/src/features/dashboard/bookings/components/AdminLayout.tsx \
  ui/src/features/dashboard/bookings/hooks/useAppSettings.ts \
  ui/src/features/dashboard/bookings/hooks/useBookings.ts \
  ui/src/features/dashboard/bookings/hooks/useRescheduleBooking.ts \
  ui/src/features/dashboard/bookings/hooks/useTransitionBooking.ts \
  ui/src/features/dashboard/bookings/hooks/useUpdateBooking.ts \
  ui/src/features/dashboard/bookings/hooks/useUploadAppSettingsAsset.ts \
  ui/src/features/dashboard/bookings/routes/propertyRoutes.tsx \
  ui/src/features/dashboard/activity/routes/index.tsx \
  ui/src/features/dashboard/ai-assistant/components/AiAssistantLauncherButton.tsx \
  ui/src/features/dashboard/analytics/routes/index.tsx \
  ui/src/features/dashboard/announcements/components/HostAnnouncementCard.tsx \
  ui/src/features/dashboard/announcements/routes/index.tsx \
  ui/src/features/dashboard/custom-pages/routes/index.tsx \
  ui/src/features/dashboard/finance/hooks/useFinanceLineItems.ts \
  ui/src/features/dashboard/finance/routes/index.tsx \
  ui/src/features/dashboard/help-support/routes/index.tsx \
  ui/src/features/dashboard/inbox/components/InboxThreadList.tsx \
  ui/src/features/dashboard/inbox/routes/index.tsx \
  ui/src/features/dashboard/maintenance/routes/index.tsx \
  ui/src/components/navigation/AdminListViewMenu.tsx

# 6 — marketing ai studio + super-admin overrides
MSG="$(cat <<'EOF'
feat(ui): extend marketing ai studio and super-admin overrides

Add generation composer helpers, studio UI tweaks, and platform override admin card.
EOF
)"
commit \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioComposer.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioJobCard.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioOptionsBar.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioReferenceUploader.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioResultsGrid.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioSection.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioVideoOptionsBar.tsx \
  ui/src/features/dashboard/marketing/hooks/useMarketingGenerationReferences.ts \
  ui/src/features/dashboard/marketing/hooks/useMarketingGenerations.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationComposer.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationComposer.test.ts \
  ui/src/features/dashboard/marketing/routes/index.tsx \
  ui/src/features/dashboard/super-admin/components/SuperAdminGenerationOverridesCard.tsx \
  ui/src/features/dashboard/super-admin/hooks/useAiPlatformGenerationOverrides.ts \
  ui/src/features/dashboard/super-admin/pages/SuperAdminOrgAiSection.tsx \
  ui/src/features/dashboard/super-admin/routes/index.tsx \
  ui/e2e/features/marketing/marketingAiGenerate.spec.ts

# 7 — org ai platform + lazy routes batch 2 + team
MSG="$(cat <<'EOF'
feat(org): sync ai platform settings and lazy property routes

Update org hooks, listing verification UI, and code-split property-scoped dashboard modules.
EOF
)"
commit \
  ui/src/features/dashboard/org/components/listing-authorization/ListingContractRenewalProvider.tsx \
  ui/src/features/dashboard/org/components/listing-authorization/ListingVerificationSidebarCta.tsx \
  ui/src/features/dashboard/org/components/property-settings/PropertyAiPlatformSection.tsx \
  ui/src/features/dashboard/org/components/verification/GetVerifiedModal.tsx \
  ui/src/features/dashboard/org/hooks/useAiPlatformSettings.ts \
  ui/src/features/dashboard/org/hooks/useOrgSettings.ts \
  ui/src/features/dashboard/org/hooks/useOrganizations.ts \
  ui/src/features/dashboard/org/routes/index.tsx \
  ui/src/features/dashboard/parking/routes/index.tsx \
  ui/src/features/dashboard/pricing/routes/index.tsx \
  ui/src/features/dashboard/property/routes/index.tsx \
  ui/src/features/dashboard/setup-guide/components/SetupGuideOverlay.tsx \
  ui/src/features/dashboard/team/hooks/useOrgTeam.ts \
  ui/src/features/dashboard/team/hooks/usePropertyTeam.ts \
  ui/src/features/dashboard/team/routes/index.tsx \
  ui/e2e/features/public/publicPagesSmoke.spec.ts \
  ui/e2e/features/team/shared/propertyTeamRbacHarness.ts

# 8 — guest lazy routes + docs + tooling
MSG="$(cat <<'EOF'
chore(*): sync guest lazy routes docs and agent tooling

Code-split guest modules; document marketing AI ship, PWA, and performance workflow.
EOF
)"
git add -- \
  ui/src/features/guest/account/components/GuestAccountLayout.tsx \
  ui/src/features/guest/account/routes/index.tsx \
  ui/src/features/guest/auth/components/AuthLayout.tsx \
  ui/src/features/guest/auth/routes/index.tsx \
  ui/src/features/guest/marketing/guest-landing/components/FeaturedProperties.tsx \
  ui/src/features/guest/marketing/routes/index.tsx \
  ui/src/features/guest/marketing/shared/components/HostWorkspaceSidePanel.tsx \
  ui/src/features/guest/marketing/shared/components/ListingGallery.tsx \
  ui/src/features/guest/marketing/shared/components/MarketingImage.tsx \
  ui/src/features/guest/marketing/shared/components/MarketingLayoutShell.tsx \
  ui/src/features/guest/marketing/shared/components/MarketingNav.tsx \
  ui/src/features/guest/pay-parking/routes/index.tsx \
  ui/src/features/guest/property/routes/index.tsx \
  ui/src/features/guest/sd-form/routes/index.tsx \
  .agent/skills/performance/SKILL.md \
  .cursor/rules/admin-auth.mdc \
  .cursor/rules/page-titles.mdc \
  scripts/README.md \
  scripts/dev/seed-analytics-demo-data.sql \
  docs/PROJECT.md \
  docs/architecture/edge-functions.md \
  docs/architecture/plans-feature-matrix.md \
  docs/architecture/pwa.md \
  docs/architecture/validation-and-env.md \
  docs/archive/operations/migration-runbook.md \
  docs/archive/reference/page-title-inventory.md \
  docs/guides/routes/admin/orgs.md \
  docs/guides/routes/auth.md \
  docs/guides/routes/for-hosts.md \
  docs/guides/routes/index-landing.md \
  docs/guides/routes/onboarding.md \
  docs/guides/routes/org/property/announcements.md \
  docs/guides/routes/org/property/marketing.md \
  docs/guides/routes/org/property/settings.md \
  docs/workflow/done/README.md \
  docs/workflow/done/marketing-ai-asset-generation.md \
  docs/workflow/in-progress/marketing-ai-asset-generation.md \
  docs/workflow/for-testing/cost-abuse-security-production-readiness.md \
  docs/workflow/for-testing/super-admin-step-up-otp.md \
  docs/workflow/for-testing/performance-optimization-production-readiness.md \
  docs/workflow/in-progress/MODULE-DISPOSITION.md \
  docs/workflow/in-progress/README.md \
  docs/workflow/planned/README.md \
  docs/workflow/planned/marketing-collage-editor.md \
  docs/workflow/planned/property-management-feature-roadmap.md
git commit -m "$MSG"

echo "Done: 8 commits"
