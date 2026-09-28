#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

c() { git commit -m "$MSG"; }

MSG="$(cat <<'EOF'
feat(ui): polish assistant chat ui components
EOF
)"
git add -- 'ui/src/features/dashboard/ai-assistant/components/AiAssistantLauncherButton.tsx' 'ui/src/features/dashboard/ai-assistant/components/AiAssistantPanel.tsx' 'ui/src/features/dashboard/ai-assistant/components/AssistantMessageCard.tsx' 'ui/src/features/dashboard/ai-assistant/components/AssistantTurnProgress.tsx' 'ui/src/features/dashboard/ai-assistant/components/ChatBlockRenderer.tsx' 'ui/src/features/dashboard/ai-assistant/components/ChatComposer.tsx' 'ui/src/features/dashboard/ai-assistant/components/ChatThread.tsx' 'ui/src/features/dashboard/ai-assistant/components/ConversationHistoryList.tsx' 'ui/src/features/dashboard/ai-assistant/components/blocks/ActionConfirmationBlock.tsx' 'ui/src/features/dashboard/ai-assistant/components/blocks/ActivityTimelineBlock.tsx' 'ui/src/features/dashboard/ai-assistant/components/blocks/BookingCardBlock.tsx' 'ui/src/features/dashboard/ai-assistant/components/blocks/DataTableBlock.tsx' 'ui/src/features/dashboard/ai-assistant/components/blocks/FlowBlock.tsx' 'ui/src/features/dashboard/ai-assistant/components/blocks/LinkListBlock.tsx' 'ui/src/features/dashboard/ai-assistant/components/blocks/StatListBlock.tsx' 'ui/src/features/dashboard/ai-assistant/components/blocks/TaskPlanBlock.tsx' 'ui/src/features/dashboard/ai-assistant/hooks/useAiAssistantAccess.ts' 'ui/src/features/dashboard/ai-assistant/hooks/useAiAssistantChat.ts' 'ui/src/features/dashboard/ai-assistant/lib/aiAssistantApi.ts' 'ui/src/features/dashboard/ai-assistant/lib/assistantStream.test.ts'
c

MSG="$(cat <<'EOF'
feat(ui): extend assistant client libs and tests
EOF
)"
git add -- 'ui/src/features/dashboard/ai-assistant/lib/assistantStream.ts' 'ui/src/features/dashboard/ai-assistant/lib/assistantToolLabels.ts' 'ui/src/features/dashboard/ai-assistant/lib/chatBlockDisplay.ts' 'ui/src/features/dashboard/ai-assistant/components/AssistantAiOffCard.tsx' 'ui/src/features/dashboard/ai-assistant/components/AssistantMemoryButton.tsx' 'ui/src/features/dashboard/ai-assistant/components/AssistantMemoryDialog.tsx' 'ui/src/features/dashboard/ai-assistant/components/AssistantStatusNotices.tsx' 'ui/src/features/dashboard/ai-assistant/components/ChatMessageActions.tsx' 'ui/src/features/dashboard/ai-assistant/components/StepFailureHint.tsx' 'ui/src/features/dashboard/ai-assistant/components/UserMessageBubble.tsx' 'ui/src/features/dashboard/ai-assistant/components/blocks/OpenPageBlock.tsx' 'ui/src/features/dashboard/ai-assistant/hooks/useAssistantMemory.ts' 'ui/src/features/dashboard/ai-assistant/hooks/useCanvasResize.ts' 'ui/src/features/dashboard/ai-assistant/lib/assistantAiOff.test.ts' 'ui/src/features/dashboard/ai-assistant/lib/assistantAiOff.ts' 'ui/src/features/dashboard/ai-assistant/lib/assistantEntityLinks.test.ts' 'ui/src/features/dashboard/ai-assistant/lib/assistantEntityLinks.ts' 'ui/src/features/dashboard/ai-assistant/lib/assistantRoutes.test.ts' 'ui/src/features/dashboard/ai-assistant/lib/assistantRoutes.ts' 'ui/src/features/dashboard/ai-assistant/lib/assistantSurfaceParity.test.ts'
c

MSG="$(cat <<'EOF'
feat(ui): extend assistant client libs and tests
EOF
)"
git add -- 'ui/src/features/dashboard/ai-assistant/lib/canvasWidth.test.ts' 'ui/src/features/dashboard/ai-assistant/lib/canvasWidth.ts' 'ui/src/features/dashboard/ai-assistant/lib/composerTriggers.test.ts' 'ui/src/features/dashboard/ai-assistant/lib/composerTriggers.ts' 'ui/src/features/dashboard/ai-assistant/lib/conversationGroups.test.ts' 'ui/src/features/dashboard/ai-assistant/lib/conversationGroups.ts' 'ui/src/features/dashboard/analytics/components/AnalyticsEmptyState.tsx' 'ui/src/features/dashboard/analytics/pages/OrgAnalyticsPage.tsx' 'ui/src/features/dashboard/analytics/pages/PropertyAnalyticsPage.tsx' 'ui/src/features/dashboard/announcements/components/HostAnnouncementCard.tsx' 'ui/src/features/dashboard/announcements/pages/HostAnnouncementDetailPage.tsx' 'ui/src/features/dashboard/announcements/pages/HostAnnouncementsListPage.tsx' 'ui/src/features/dashboard/announcements/routes/index.tsx' 'ui/src/features/dashboard/bookings/components/AdminLayout.tsx' 'ui/src/features/dashboard/bookings/components/AdminMoreSheet.tsx' 'ui/src/features/dashboard/bookings/components/AdminPageHeader.tsx' 'ui/src/features/dashboard/bookings/components/AdminSectionNavLayout.tsx' 'ui/src/features/dashboard/bookings/components/BookingDateRangeFilter.tsx' 'ui/src/features/dashboard/bookings/components/BookingsSummaryCards.tsx' 'ui/src/features/dashboard/bookings/components/PropertySettingsCard.tsx'
c

MSG="$(cat <<'EOF'
feat(bookings): land deployable slice 4
EOF
)"
git add -- 'ui/src/features/dashboard/bookings/hooks/useVoiceReceptionistSettings.ts' 'ui/src/features/dashboard/help-support/components/HelpSupportLayout.tsx' 'ui/src/features/dashboard/inbox/components/InboxConversationView.tsx' 'ui/src/features/dashboard/inbox/pages/InboxPage.tsx' 'ui/src/features/dashboard/lib/dashboardChromeContext.test.ts' 'ui/src/features/dashboard/lib/dashboardChromeContext.tsx' 'ui/src/features/dashboard/lib/useDateRangeDisplayLabel.ts' 'ui/src/features/dashboard/marketing/components/ai-studio/AiStudioSection.tsx' 'ui/src/features/dashboard/marketing/components/design-editor/DesignEditor.tsx' 'ui/src/features/dashboard/marketing/components/design-editor/PolotnoDesignStudio.tsx' 'ui/src/features/dashboard/marketing/lib/templateRegistry.ts' 'ui/src/features/dashboard/marketing/pages/MarketingStudioPage.tsx' 'ui/src/features/dashboard/marketing/components/ai-studio/AiPostPanel.tsx' 'ui/src/features/dashboard/marketing/hooks/useGeneratePosters.test.ts' 'ui/src/features/dashboard/marketing/hooks/useGeneratePosters.ts' 'ui/src/features/dashboard/marketing/lib/polotno/fitPosterTextSlots.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterArchetypes.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterAudit.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterColor.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterCompiler.test.ts'
c

MSG="$(cat <<'EOF'
feat(ui): extend marketing poster studio and ai quality
EOF
)"
git add -- 'ui/src/features/dashboard/marketing/lib/poster/posterCompiler.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterDefaults.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterEdgeCases.test.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterEdgeParity.test.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterFacts.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterFontLoader.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterFonts.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterIconNodes.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterIcons.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterModules.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterPhotoSizes.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterRender.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterSpec.ts' 'ui/src/features/dashboard/marketing/lib/poster/posterText.ts' 'ui/src/features/dashboard/org/components/org-settings/OrgAiSettingsSection.tsx' 'ui/src/features/dashboard/org/components/property-settings/PropertyAiSettingsSection.tsx' 'ui/src/features/dashboard/org/components/property-settings/PropertyVoiceReceptionistFields.tsx' 'ui/src/features/dashboard/org/components/property-settings/PropertyVoiceReceptionistSection.tsx' 'ui/src/features/dashboard/org/hooks/useAiPlatformSettings.ts' 'ui/src/features/dashboard/org/hooks/useCopyPropertySettings.ts'
c

MSG="$(cat <<'EOF'
feat(org): land deployable slice 6
EOF
)"
git add -- 'ui/src/features/dashboard/org/lib/aiSettingsLabels.ts' 'ui/src/features/dashboard/org/lib/copyPropertySettingsGroups.test.ts' 'ui/src/features/dashboard/org/lib/copyPropertySettingsGroups.ts' 'ui/src/features/dashboard/org/lib/propertySettingsCompletion.ts' 'ui/src/features/dashboard/org/lib/propertySettingsForm.test.ts' 'ui/src/features/dashboard/org/lib/propertySettingsForm.ts' 'ui/src/features/dashboard/org/pages/OrgDashboardPage.tsx' 'ui/src/features/dashboard/org/pages/OrgParkingsPage.tsx' 'ui/src/features/dashboard/org/pages/OrgPropertiesPage.tsx' 'ui/src/features/dashboard/org/pages/OrgSettingsPage.tsx' 'ui/src/features/dashboard/org/routes/guards.tsx' 'ui/src/features/dashboard/org/components/org-settings/OrgVoiceReceptionistGroup.tsx' 'ui/src/features/dashboard/org/hooks/useOrgListingSkeletonView.ts' 'ui/src/features/dashboard/org/hooks/useVoiceReceptionistOrgSettings.ts' 'ui/src/features/dashboard/parking/components/ParkingDashboardCalendarSection.tsx' 'ui/src/features/dashboard/parking/components/ParkingPricingRatesFormCard.tsx' 'ui/src/features/dashboard/parking/components/ParkingSettingsCard.tsx' 'ui/src/features/dashboard/parking/pages/ParkingPricingPage.tsx' 'ui/src/features/dashboard/plans/components/OrgPlanSidebarEntry.tsx' 'ui/src/features/dashboard/plans/lib/planFeaturePermissions.ts'
c

MSG="$(cat <<'EOF'
feat(ui): land deployable slice 7
EOF
)"
git add -- 'ui/src/features/dashboard/plans/lib/planGateCoverage.test.ts' 'ui/src/features/dashboard/plans/lib/planPresentation.ts' 'ui/src/features/dashboard/plans/pages/OrgPlansPage.tsx' 'ui/src/features/dashboard/plans/lib/planIncludedFeatures.test.ts' 'ui/src/features/dashboard/pricing/components/PricingCalendarGrid.tsx' 'ui/src/features/dashboard/pricing/components/PricingRatesFormCard.tsx' 'ui/src/features/dashboard/pricing/pages/PropertyPricingPage.tsx' 'ui/src/features/dashboard/pricing/lib/pricingCalendarLayout.test.ts' 'ui/src/features/dashboard/pricing/lib/pricingCalendarLayout.ts' 'ui/src/features/dashboard/property/components/DashboardFinanceCalendarSection.tsx' 'ui/src/features/dashboard/setup-guide/components/SetupGuideStepBody.tsx' 'ui/src/features/dashboard/super-admin/components/AiDashboardAssistantKillSwitchCard.tsx' 'ui/src/features/dashboard/super-admin/components/super-admin-ai/AiUsageTab.tsx' 'ui/src/features/dashboard/super-admin/hooks/useSuperAdminAiUsage.ts' 'ui/src/features/dashboard/super-admin/pages/SuperAdminAnnouncementsPage.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminApprovalsPage.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminAuditPage.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminDevelopmentsPage.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminHelpFaqsPage.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminHostsPage.tsx'
c

MSG="$(cat <<'EOF'
feat(ui): land deployable slice 8
EOF
)"
git add -- 'ui/src/features/dashboard/super-admin/pages/SuperAdminOrgActivitySection.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminOrgApprovalsSection.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminOrgSubscriptionsPage.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminOrgSupportSection.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminOverviewPage.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminParkingPayoutsPage.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminPlatformPropertiesPage.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminPlaybookArticlesPage.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminPricingPlansPage.tsx' 'ui/src/features/dashboard/super-admin/pages/SuperAdminSupportPage.tsx' 'ui/src/features/dashboard/super-admin/routes/index.tsx' 'ui/src/features/dashboard/super-admin/components/super-admin-ai/AssistantEvalRunsCard.tsx' 'ui/src/features/dashboard/team/lib/propertyPermissionCatalog.ts' 'ui/src/features/dashboard/team/lib/propertyPermissions.ts' 'ui/src/features/dashboard/team/lib/propertyTeamConstants.ts' 'ui/src/features/dashboard/team/lib/settingsPermissionExpansion.ts' 'docs/architecture/ai-dashboard-assistant.md' 'docs/architecture/edge-functions.md' 'docs/architecture/overview.md' 'docs/architecture/plans-feature-matrix.md'
c

MSG="$(cat <<'EOF'
docs(docs): sync assistant architecture and project index
EOF
)"
git add -- 'docs/architecture/skeleton-loaders.md' 'docs/architecture/unsaved-changes.md' 'docs/architecture/marketing-poster-studio.md' 'docs/archive/operations/migration-runbook.md' 'docs/guides/routes/README.md' 'docs/guides/routes/admin/ai.md' 'docs/guides/routes/org/analytics.md' 'docs/guides/routes/org/help-support.md' 'docs/guides/routes/org/parking/inbox.md' 'docs/guides/routes/org/plans.md' 'docs/guides/routes/org/properties.md' 'docs/guides/routes/org/property/analytics.md' 'docs/guides/routes/org/property/dashboard.md' 'docs/guides/routes/org/property/inbox.md' 'docs/guides/routes/org/property/marketing.md' 'docs/guides/routes/org/property/settings.md' 'docs/guides/routes/org/property/team.md' 'docs/guides/routes/org/settings.md' 'docs/guides/testing/ai-dashboard-assistant-manual.md' 'docs/guides/routes/org/assistant.md'
c

MSG="$(cat <<'EOF'
docs(docs): sync assistant architecture and project index
EOF
)"
git add -- 'docs/PROJECT.md' 'docs/workflow/for-testing/mobile-native-redesign.md' 'docs/workflow/for-testing/property-settings-copy-to-properties.md' 'docs/workflow/in-progress/README.md' 'docs/workflow/in-progress/marketing-ai-image-quality-hardening.md' 'docs/workflow/planned/README.md' 'docs/workflow/planned/ai-assistant-settings-validators.md' 'docs/workflow/planned/unified-ai-settings-card.md' 'docs/workflow/in-progress/marketing-ai-poster-studio.md' '.cursor/rules/ai-assistant-parity.mdc' 'deno.lock' 'ui/e2e/features/admin/adminAiConsole.spec.ts' 'ui/e2e/features/admin/shared/adminAiConsoleHarness.ts' 'ui/e2e/features/analytics/aiReviewPlaybook.spec.ts' 'ui/e2e/features/analytics/shared/aiReviewHarness.ts' 'ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts' 'ui/e2e/features/marketing/marketingAiGenerate.spec.ts' 'ui/e2e/features/org/orgAiSettingsToggleOnly.spec.ts' 'ui/e2e/features/team/shared/propertyTeamRbacHarness.ts' 'ui/e2e/features/assistant/assistantAiMode.spec.ts'
c

MSG="$(cat <<'EOF'
feat(ui): extend marketing poster studio and ai quality
EOF
)"
git add -- 'ui/e2e/features/marketing/marketingAiPost.spec.ts' 'scripts/dev/batch-commit-run-15.sh' 'scripts/dev/check-unbounded-select.sh' 'supabase/functions/ai-platform-property-settings/index.ts' 'supabase/functions/analytics-org-summary/index.ts' 'supabase/functions/dashboard-assistant-chat/index.ts' 'supabase/functions/dashboard-assistant-confirm/index.ts' 'supabase/functions/dashboard-assistant-global-settings/index.ts' 'supabase/functions/dashboard-assistant-memory/index.ts' 'supabase/functions/dashboard-assistant-settings/index.ts' 'supabase/functions/dashboard-stats/index.ts' 'supabase/functions/generate-marketing-template/index.ts' 'supabase/functions/list-activity-log/index.ts' 'supabase/functions/notifications-mark-read/index.ts' 'supabase/functions/reopen-support-ticket/index.ts' 'supabase/functions/reply-support-ticket/index.ts' 'supabase/functions/social-inbox-templates/index.ts' 'supabase/functions/super-admin-ai-usage/index.ts' 'supabase/functions/tests/assistantToolCatalog.test.ts' 'supabase/functions/tests/evals/aiEvalsOffline.test.ts'
c

MSG="$(cat <<'EOF'
feat(supabase): land deployable slice 12
EOF
)"
git add -- 'supabase/functions/tests/evals/datasets/assistant_tool_selection.jsonl' 'supabase/functions/tests/evals/runLiveEvals.ts' 'supabase/functions/tests/teamPermissionGates.test.ts' 'supabase/functions/tests/assistantParityManifest.test.ts' 'supabase/functions/tests/assistantParityToolsLocal.integration_test.ts' 'supabase/functions/voice-receptionist-settings/index.ts' 'supabase/functions/voice-receptionist-usage/index.ts' 'supabase/functions/voice-receptionist-voice-preview/index.ts' 'supabase/migrations/20261316126200_ai_voice_receptionist_org_settings.sql' 'supabase/migrations/20261316126300_ai_assistant_memory.sql' 'supabase/migrations/20261316126400_ai_assistant_eval_runs.sql' 'supabase/migrations/20261316126500_voice_receptionist_rollout.sql' 'supabase/config.toml' 'supabase/functions/_shared/ai/prompts/dashboardAssistant.ts' 'supabase/functions/_shared/aiLimitAdmin.ts' 'supabase/functions/_shared/aiUsageService.ts' 'supabase/functions/_shared/assistantToolLabels.ts' 'supabase/functions/_shared/dashboardAssistantActionDisplay.ts' 'supabase/functions/_shared/dashboardAssistantActivity.ts' 'supabase/functions/_shared/dashboardAssistantBlocks.ts'
c

MSG="$(cat <<'EOF'
feat(supabase): add assistant parity tools and memory services
EOF
)"
git add -- 'supabase/functions/_shared/dashboardAssistantBlocks_test.ts' 'supabase/functions/_shared/dashboardAssistantRiskClassifier.ts' 'supabase/functions/_shared/dashboardAssistantSafetyGuard.ts' 'supabase/functions/_shared/dashboardAssistantStreamEvents.ts' 'supabase/functions/_shared/dashboardAssistantTools.ts' 'supabase/functions/_shared/dashboardStatsScope.ts' 'supabase/functions/_shared/propertySettingsCloneGroups.ts' 'supabase/functions/_shared/propertySettingsCloneTypes.ts' 'supabase/functions/_shared/propertyTeamPermissions.ts' 'supabase/functions/_shared/settingsPermissionExpansion.ts' 'supabase/functions/_shared/voiceReceptionistService.ts' 'supabase/functions/_shared/activityLogVisibility.ts' 'supabase/functions/_shared/assistantEvalSummary.ts' 'supabase/functions/_shared/assistantEvalSummary_test.ts' 'supabase/functions/_shared/assistantFeedbackSummary.ts' 'supabase/functions/_shared/assistantFeedbackSummary_test.ts' 'supabase/functions/_shared/assistantToolFailureReason.ts' 'supabase/functions/_shared/assistantToolFailureReason_test.ts' 'supabase/functions/_shared/dashboardAssistantActivity_test.ts' 'supabase/functions/_shared/dashboardAssistantMemory.ts'
c

MSG="$(cat <<'EOF'
feat(supabase): add assistant parity tools and memory services
EOF
)"
git add -- 'supabase/functions/_shared/dashboardAssistantMemory_test.ts' 'supabase/functions/_shared/dashboardAssistantParity.ts' 'supabase/functions/_shared/dashboardAssistantParityToolNames.ts' 'supabase/functions/_shared/dashboardAssistantParityTools.ts' 'supabase/functions/_shared/dashboardAssistantToolRouter.ts' 'supabase/functions/_shared/dashboardAssistantToolRouter_test.ts' 'supabase/functions/_shared/inboxQuickReplyTemplates.ts' 'supabase/functions/_shared/marketingPosterDirector.ts' 'supabase/functions/_shared/marketingPosterDirector_test.ts' 'supabase/functions/_shared/notificationsMarkRead.ts' 'supabase/functions/_shared/orgPortfolioSummary.ts' 'supabase/functions/_shared/supportTicketSubmitterActions.ts' 'ui/src/components/chat/ChatRichBody.tsx' 'ui/src/components/routing/RouteFallback.tsx' 'ui/src/components/shared/AdminSurfaceCardHeader.tsx' 'ui/src/components/shared/StatCard.tsx' 'ui/src/components/skeletons/AdminSkeletons.tsx' 'ui/src/components/skeletons/AnalyticsSkeleton.tsx' 'ui/src/components/skeletons/BookingsExtrasSkeleton.tsx' 'ui/src/components/skeletons/HelpSupportSkeleton.tsx'
c

MSG="$(cat <<'EOF'
feat(ui): land deployable slice 15
EOF
)"
git add -- 'ui/src/components/skeletons/PricingSkeleton.tsx' 'ui/src/components/skeletons/RouteSkeletons.tsx' 'ui/src/components/skeletons/AnnouncementsSkeleton.tsx' 'ui/src/components/skeletons/OrgListingSkeleton.tsx' 'ui/src/hooks/useSettingsUserEdited.ts' 'ui/src/index.css' 'ui/src/lib/chat/parseChatRichBlocks.test.ts' 'ui/src/lib/chat/parseChatRichBlocks.ts' 'ui/src/lib/date/navigation.test.ts' 'ui/src/lib/date/navigation.ts' 'ui/src/lib/chat/inlineMarkdown.test.ts' 'ui/src/lib/chat/inlineMarkdown.ts'
c

echo "batch-commit-run-15 done"
