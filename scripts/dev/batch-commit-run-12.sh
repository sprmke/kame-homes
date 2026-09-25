#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

commit() {
  git add -- "$@"
  git commit -m "$MSG"
}

# 1 — migrations
MSG="$(cat <<'EOF'
feat(supabase): add marketing generation schema migrations

Ship jobs, references, cron, plan features, usage index, and billing repair migrations.
EOF
)"
commit \
  supabase/migrations/20261316120000_marketing_generation_jobs.sql \
  supabase/migrations/20261316120100_marketing_generation_references.sql \
  supabase/migrations/20261316120200_ai_platform_usage_events_feature_index.sql \
  supabase/migrations/20261316120300_marketing_generation_cron.sql \
  supabase/migrations/20261316120400_marketing_generation_plan_features.sql \
  supabase/migrations/20261316120500_marketing_generation_video_plan_feature.sql \
  supabase/migrations/20261316120600_marketing_generation_billing_repair_index_fix.sql

# 2 — marketing shared
MSG="$(cat <<'EOF'
feat(supabase): add marketing generation shared services

Add pricing, jobs, storage, image and video AI helpers, sweeper, and host-facing errors.
EOF
)"
commit \
  supabase/functions/_shared/marketingGenerationBudget.ts \
  supabase/functions/_shared/marketingGenerationJobs.ts \
  supabase/functions/_shared/marketingGenerationPricing.ts \
  supabase/functions/_shared/marketingGenerationPricing_test.ts \
  supabase/functions/_shared/marketingGenerationStorage.ts \
  supabase/functions/_shared/marketingImageGenerationAi.ts \
  supabase/functions/_shared/marketingVideoGenerationAi.ts \
  supabase/functions/_shared/marketingGenerationFeatureConfig.ts \
  supabase/functions/_shared/marketingGenerationFeatureConfig_test.ts \
  supabase/functions/_shared/marketingGenerationSweeper.ts \
  supabase/functions/_shared/hostFacingError.ts \
  supabase/functions/_shared/hostFacingError_test.ts

# 3 — marketing edge + config
MSG="$(cat <<'EOF'
feat(supabase): add marketing generation edge handlers

Wire generate, poll, list, reference upload, sweeper, and platform override endpoints.
EOF
)"
commit \
  supabase/functions/generate-marketing-media/index.ts \
  supabase/functions/get-marketing-generation-job/index.ts \
  supabase/functions/marketing-generations/index.ts \
  supabase/functions/upload-marketing-generation-reference/index.ts \
  supabase/functions/marketing-generation-sweeper/index.ts \
  supabase/functions/ai-platform-generation-overrides/index.ts \
  supabase/functions/ai-platform-property-settings/index.ts \
  supabase/config.toml \
  supabase/.env.example

# 4 — shared platform + e2e
MSG="$(cat <<'EOF'
feat(supabase): extend activity log plans and ai platform services

Update plan features, team permissions, activity catalog, and AI usage routing.
EOF
)"
commit \
  supabase/functions/_shared/activityLog.ts \
  supabase/functions/_shared/activityLog_test.ts \
  supabase/functions/_shared/aiModelRouter.ts \
  supabase/functions/_shared/aiUsageService.ts \
  supabase/functions/_shared/planFeatures.ts \
  supabase/functions/_shared/planFeatures_test.ts \
  supabase/functions/_shared/propertySettingsCloneGroups.ts \
  supabase/functions/_shared/propertyTeamPermissions.ts \
  supabase/functions/_shared/superAdminVerification.ts \
  ui/e2e/features/marketing/marketingAiGenerate.spec.ts \
  ui/e2e/features/plans/shared/orgPlanHarnessShared.ts \
  ui/e2e/features/team/shared/propertyTeamRbacHarness.ts

# 5 — marketing ai studio ui 1
MSG="$(cat <<'EOF'
feat(ui): add marketing ai studio composer and job ui

Add composer, options bars, reference upload, results grid, and progress stages.
EOF
)"
commit \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioAspectPicker.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioComposer.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioEmptyState.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioGeneratingStage.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioJobCard.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioOptionsBar.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioReferenceLibraryDrawer.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioReferenceUploader.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioResultsGrid.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioSection.tsx

# 6 — marketing ai studio ui 2
MSG="$(cat <<'EOF'
feat(ui): add marketing generation hooks and client pricing

Wire generation API hooks, pricing helpers, and video studio controls.
EOF
)"
commit \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioVideoOptionsBar.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioVideoProgress.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingOverflowMenu.tsx \
  ui/src/features/dashboard/marketing/hooks/useGenerateMarketingMedia.ts \
  ui/src/features/dashboard/marketing/hooks/useMarketingGenerationApi.ts \
  ui/src/features/dashboard/marketing/hooks/useMarketingGenerationJob.ts \
  ui/src/features/dashboard/marketing/hooks/useMarketingGenerationReferences.ts \
  ui/src/features/dashboard/marketing/hooks/useMarketingGenerations.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationOptions.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationPricing.test.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationPricing.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationProgress.test.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationProgress.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationTypes.ts

# 7 — marketing studio shell + plans
MSG="$(cat <<'EOF'
feat(ui): refresh marketing studio shell and plan gates

Update studio page, shared cards, video editor panels, and plan presentation copy.
EOF
)"
commit \
  ui/src/features/dashboard/marketing/components/shared/MarketingCategoryChip.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingSidebarSection.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingStudioModeTabs.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingTemplateCard.tsx \
  ui/src/features/dashboard/marketing/components/video-editor/VideoEditorSettings.tsx \
  ui/src/features/dashboard/marketing/components/video-editor/VideoSceneElementsPanel.tsx \
  ui/src/features/dashboard/marketing/hooks/useMarketingPermissions.ts \
  ui/src/features/dashboard/marketing/pages/MarketingStudioPage.tsx \
  ui/src/features/dashboard/plans/lib/featureGateCopy.ts \
  ui/src/features/dashboard/plans/lib/planFeatures.ts \
  ui/src/features/dashboard/plans/lib/planPresentation.ts \
  ui/src/features/dashboard/org/lib/aiQuotaToast.ts

# 8 — analytics
MSG="$(cat <<'EOF'
feat(ui): add property analytics overview and next actions

Add overview section, state strip, next actions card, and recommendation helpers.
EOF
)"
commit \
  ui/src/features/dashboard/analytics/components/AnalyticsKpiStrip.tsx \
  ui/src/features/dashboard/analytics/components/ChannelMixCard.tsx \
  ui/src/features/dashboard/analytics/components/NextNinetyDaysCard.tsx \
  ui/src/features/dashboard/analytics/components/OccupancyRateTrendCard.tsx \
  ui/src/features/dashboard/analytics/components/PublicPagePerformanceCard.tsx \
  ui/src/features/dashboard/analytics/components/AnalyticsNextActionsCard.tsx \
  ui/src/features/dashboard/analytics/components/AnalyticsOverviewSection.tsx \
  ui/src/features/dashboard/analytics/components/AnalyticsStateStrip.tsx \
  ui/src/features/dashboard/analytics/lib/analyticsPeriod.ts \
  ui/src/features/dashboard/analytics/lib/analyticsNextActions.test.ts \
  ui/src/features/dashboard/analytics/lib/analyticsNextActions.ts \
  ui/src/features/dashboard/analytics/pages/PropertyAnalyticsPage.tsx

# 9 — mobile native admin shell
MSG="$(cat <<'EOF'
feat(ui): add mobile native admin shell and overflow menus

Add responsive overflow menu, fill-main layout helper, and inbox or help layout updates.
EOF
)"
commit \
  ui/src/components/mobile/ResponsiveOverflowMenu.tsx \
  ui/src/features/dashboard/bookings/components/AdminLayout.tsx \
  ui/src/features/dashboard/bookings/components/AdminSectionNavLayout.tsx \
  ui/src/features/dashboard/bookings/lib/adminLayoutFillMain.ts \
  ui/src/features/dashboard/help-support/components/HelpSupportLayout.tsx \
  ui/src/features/dashboard/inbox/components/InboxConversationView.tsx \
  ui/src/features/dashboard/inbox/pages/InboxPage.tsx \
  ui/src/components/navigation/AdminListViewMenu.tsx \
  ui/src/components/security/TurnstileWidget.tsx \
  ui/src/components/theme/ThemedToaster.tsx \
  ui/src/index.css \
  ui/src/lib/feedback/toastMessages.ts \
  ui/src/lib/feedback/toastMessages.test.ts

# 10 — setup guide, team, org
MSG="$(cat <<'EOF'
feat(ui): extend setup guide save context and team permissions

Add save context provider, team RBAC catalog updates, and org card polish.
EOF
)"
commit \
  ui/src/features/dashboard/setup-guide/components/SetupGuideMoments.tsx \
  ui/src/features/dashboard/setup-guide/components/SetupGuideOverlay.tsx \
  ui/src/features/dashboard/setup-guide/components/SetupGuidePricingEmbed.tsx \
  ui/src/features/dashboard/setup-guide/components/SetupGuideProvider.tsx \
  ui/src/features/dashboard/setup-guide/components/SetupGuideSettingsHost.tsx \
  ui/src/features/dashboard/setup-guide/components/SetupGuideSidebarEntry.tsx \
  ui/src/features/dashboard/setup-guide/components/SetupGuideStepBody.tsx \
  ui/src/features/dashboard/setup-guide/components/SetupGuideTeamEmbed.tsx \
  ui/src/features/dashboard/setup-guide/components/SetupGuideSaveContext.tsx \
  ui/src/features/dashboard/setup-guide/components/setupGuideContext.ts \
  ui/src/features/dashboard/team/components/CustomRolesSection.tsx \
  ui/src/features/dashboard/team/components/OrgTeamMembersTab.tsx \
  ui/src/features/dashboard/team/components/TeamMembersTab.tsx \
  ui/src/features/dashboard/team/lib/propertyPermissionCatalog.ts \
  ui/src/features/dashboard/team/lib/propertyTeamConstants.ts \
  ui/src/features/dashboard/org/components/onboarding/OnboardingProfileHeader.tsx \
  ui/src/features/dashboard/org/components/org-parkings/OrgParkingCard.tsx \
  ui/src/features/dashboard/org/components/org-properties/OrgPropertyCard.tsx \
  ui/src/features/dashboard/page-editor/components/property-showcase/PropertyShowcasePageEditor.tsx \
  ui/src/features/dashboard/page-editor/components/stay-guide/StayGuidePageEditor.tsx \
  ui/src/features/dashboard/page-editor/pages/PageEditorPage.tsx \
  ui/src/features/dashboard/super-admin/components/AiPlatformKillSwitchCard.tsx \
  ui/src/features/dashboard/super-admin/components/super-admin-developments/SuperAdminDevelopmentCard.tsx \
  ui/src/features/dashboard/super-admin/components/super-admin-overview/SuperAdminAiCostChart.tsx \
  ui/src/features/dashboard/super-admin/pages/SuperAdminAnnouncementsPage.tsx

# 11 — guest mobile native
MSG="$(cat <<'EOF'
feat(ui): sync guest marketing toolbars for mobile native layout

Update filters, toolbars, film scenes, and guest chrome for phone-first spacing.
EOF
)"
commit \
  ui/src/features/guest/account/components/GuestAccountMenu.tsx \
  ui/src/features/guest/auth/components/GuestAuthModal.tsx \
  ui/src/features/guest/chat/components/GuestChatHeaderBar.tsx \
  ui/src/features/guest/marketing/developments/components/DevelopmentsFilters.tsx \
  ui/src/features/guest/marketing/developments/components/DevelopmentsToolbar.tsx \
  ui/src/features/guest/marketing/developments/components/ParkingFilters.tsx \
  ui/src/features/guest/marketing/developments/components/ParkingToolbar.tsx \
  ui/src/features/guest/marketing/for-hosts/components/HostDashboardFilm.tsx \
  ui/src/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/FilmPrimitives.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/FilmShell.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneAct1.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneAct2.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneAct3.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneAct4.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneAct5.tsx \
  ui/src/features/guest/marketing/guest-landing/components/GuestHero.tsx \
  ui/src/features/guest/marketing/properties/components/PropertiesFilters.tsx \
  ui/src/features/guest/marketing/properties/components/PropertiesToolbar.tsx \
  ui/src/features/guest/marketing/shared/components/MarketingMoreSheet.tsx \
  ui/src/features/guest/search/components/SearchResultsToolbar.tsx \
  explore-hero-desktop.png

# 12 — docs + chore (all remaining deployable)
MSG="$(cat <<'EOF'
chore(*): sync docs workflow tooling and dependency locks

Update route guides, marketing AI workflow docs, mobile-native hooks, and env scripts.
EOF
)"
git add -- \
  .agent/skills/audit-logging/SKILL.md \
  .agent/skills/documentation-maintenance/SKILL.md \
  .agent/skills/mobile-responsive/SKILL.md \
  .agent/skills/self-review/SKILL.md \
  .agent/skills/supabase-auth/SKILL.md \
  .claude/README.md \
  .claude/hooks/remind-mobile-native-on-ui-edit.sh \
  .claude/hooks/session-mobile-native-ui-reminder.sh \
  .claude/settings.json \
  .cursor/hooks.json \
  .cursor/hooks/remind-mobile-native-on-ui-edit.sh \
  .cursor/hooks/session-mobile-native-ui-reminder.sh \
  .cursor/rules/README.md \
  .cursor/rules/documentation-maintenance.mdc \
  .cursor/rules/mobile-native-ui.mdc \
  .cursor/rules/mobile-responsive.mdc \
  .cursor/rules/project-context.mdc \
  .cursor/rules/security.mdc \
  .fallowrc.json \
  .gitignore \
  .opencode/plugins/gfm-ai-tooling.ts \
  CLAUDE.md \
  bun.lock \
  deno.lock \
  package-lock.json \
  package.json \
  opencode.json \
  scripts/README.md \
  scripts/dev/batch-commit-plan-25.mjs \
  scripts/dev/batch-commit-run.sh \
  scripts/dev/batch-commit-wip-filter.mjs \
  scripts/dev/env-sync-lib.mjs \
  scripts/dev/reorganize-env-files.mjs \
  scripts/dev/seed-analytics-demo-data.sql \
  scripts/dev/sync-all-env.mjs \
  scripts/dev/sync-dev-env.mjs \
  scripts/dev/sync-vercel-dev-env.mjs \
  docs/PROJECT.md \
  docs/architecture/ai-dashboard-assistant.md \
  docs/architecture/data-model.md \
  docs/architecture/edge-functions.md \
  docs/architecture/overview.md \
  docs/architecture/plans-feature-matrix.md \
  docs/architecture/storage.md \
  docs/architecture/validation-and-env.md \
  docs/archive/operations/migration-runbook.md \
  docs/archive/operations/scheduled-jobs-and-testing.md \
  docs/archive/reference/ai-payment-receipt-validation.md \
  docs/guides/routes/README.md \
  docs/guides/routes/account/profile.md \
  docs/guides/routes/admin/orgs.md \
  docs/guides/routes/admin/playbook.md \
  docs/guides/routes/auth.md \
  docs/guides/routes/calendar.md \
  docs/guides/routes/developments.md \
  docs/guides/routes/for-hosts.md \
  docs/guides/routes/form.md \
  docs/guides/routes/guest-booking-document.md \
  docs/guides/routes/index-landing.md \
  docs/guides/routes/legal.md \
  docs/guides/routes/onboarding.md \
  docs/guides/routes/org/activity.md \
  docs/guides/routes/org/analytics.md \
  docs/guides/routes/org/announcements.md \
  docs/guides/routes/org/dashboard.md \
  docs/guides/routes/org/help-support.md \
  docs/guides/routes/org/parking/activity.md \
  docs/guides/routes/org/parking/announcements.md \
  docs/guides/routes/org/parking/dashboard.md \
  docs/guides/routes/org/parking/notifications.md \
  docs/guides/routes/org/parking/settings.md \
  docs/guides/routes/org/plans.md \
  docs/guides/routes/org/property/activity.md \
  docs/guides/routes/org/property/analytics.md \
  docs/guides/routes/org/property/announcements.md \
  docs/guides/routes/org/property/dashboard.md \
  docs/guides/routes/org/property/finance.md \
  docs/guides/routes/org/property/maintenance.md \
  docs/guides/routes/org/property/marketing.md \
  docs/guides/routes/org/property/settings.md \
  docs/guides/routes/org/settings.md \
  docs/guides/routes/org/setup-guide.md \
  docs/guides/routes/org/team.md \
  docs/guides/routes/parkings.md \
  docs/guides/routes/properties.md \
  docs/guides/routes/properties/chat.md \
  docs/guides/routes/sd-form.md \
  docs/guides/routes/search.md \
  docs/guides/routes/services.md \
  docs/guides/routes/success.md \
  docs/workflow/done/marketing-guest-review-studio.md \
  docs/workflow/done/marketing-module-refinement.md \
  docs/workflow/for-testing/QA-BATCH.md \
  docs/workflow/for-testing/README.md \
  docs/workflow/for-testing/host-analytics-module.md \
  docs/workflow/for-testing/mobile-native-redesign.md \
  docs/workflow/for-testing/org-activity-audit-log.md \
  docs/workflow/for-testing/org-granular-team-permissions.md \
  docs/workflow/for-testing/parking-property-parity.md \
  docs/workflow/for-testing/super-admin-step-up-otp.md \
  docs/workflow/in-progress/MODULE-DISPOSITION.md \
  docs/workflow/in-progress/README.md \
  docs/workflow/in-progress/marketing-ai-asset-generation.md \
  docs/workflow/in-progress/marketing-module-refinement.md \
  docs/workflow/in-progress/mobile-native-redesign.md \
  docs/workflow/in-progress/org-activity-audit-log.md \
  docs/workflow/in-progress/org-granular-team-permissions.md \
  docs/workflow/in-progress/parking-property-parity.md \
  docs/workflow/in-progress/super-admin-step-up-otp.md \
  docs/workflow/planned/README.md \
  docs/workflow/planned/activity-log-followups.md \
  docs/workflow/planned/ai-assistant-bulk-pricing-chat.md \
  docs/workflow/planned/ai-assistant-parking-broadcast-chat.md \
  docs/workflow/planned/ai-assistant-settings-validators.md \
  docs/workflow/planned/ai-credits-topup-purchase.md \
  docs/workflow/planned/guest-trust-safety-reporting.md \
  docs/workflow/planned/host-analytics-module.md \
  docs/workflow/planned/marketing-meta-publishing-gaps.md \
  docs/workflow/planned/marketing-studio-mobile-and-dashboard-responsive.md \
  docs/workflow/planned/module-status-management.md \
  docs/workflow/planned/parking-e2e-production-readiness.md
git commit -m "$MSG"

echo "Done: 12 commits"
