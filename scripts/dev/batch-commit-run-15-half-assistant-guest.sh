#!/usr/bin/env bash
# ~1/2 WIP: dashboard AI assistant, reviews UX, notifications hub, templates workbench, guest marketing.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

commit() {
  local msg=$1
  shift
  git add "$@"
  git commit -m "$msg"
}

commit "feat(supabase): add reviews template and marketing follow-up migrations" \
  supabase/migrations/20261316128510_marketing_ai_post_version_photos.sql \
  supabase/migrations/20261316128520_org_reviews_to_write.sql \
  supabase/migrations/20261316128530_property_template_folders.sql

commit "feat(supabase): add dashboard assistant policy and visual modules" \
  supabase/functions/_shared/dashboardAssistantConfirmBlocks.ts \
  supabase/functions/_shared/dashboardAssistantConfirmBlocks_test.ts \
  supabase/functions/_shared/dashboardAssistantCoverageHelpers.ts \
  supabase/functions/_shared/dashboardAssistantCoverageHelpers_test.ts \
  supabase/functions/_shared/dashboardAssistantCoverageTools.ts \
  supabase/functions/_shared/dashboardAssistantGroundingCache.ts \
  supabase/functions/_shared/dashboardAssistantGroundingCache_test.ts \
  supabase/functions/_shared/dashboardAssistantGuardPolicy.ts \
  supabase/functions/_shared/dashboardAssistantGuardPolicy_test.ts \
  supabase/functions/_shared/dashboardAssistantMarkDone.ts \
  supabase/functions/_shared/dashboardAssistantMarkDone_test.ts \
  supabase/functions/_shared/dashboardAssistantResponsePolicy.ts \
  supabase/functions/_shared/dashboardAssistantResponsePolicy_test.ts \
  supabase/functions/_shared/dashboardAssistantResponseShape.ts \
  supabase/functions/_shared/dashboardAssistantResponseShape_test.ts \
  supabase/functions/_shared/dashboardAssistantTurnTiming.ts \
  supabase/functions/_shared/dashboardAssistantTurnTiming_test.ts \
  supabase/functions/_shared/dashboardAssistantVisuals.ts \
  supabase/functions/_shared/dashboardAssistantVisuals_test.ts \
  supabase/functions/_shared/dashboardAssistantBriefingExtras.ts \
  supabase/functions/_shared/dashboardAssistantBriefingExtras_test.ts \
  supabase/functions/_shared/dashboardAssistantBookingDocuments_test.ts \
  supabase/functions/_shared/assistantLatencySummary.ts \
  supabase/functions/_shared/assistantLatencySummary_test.ts \
  supabase/functions/_shared/backgroundTask_test.ts

commit "feat(supabase): extend dashboard assistant orchestration" \
  supabase/functions/_shared/dashboardAssistantActionDisplay.ts \
  supabase/functions/_shared/dashboardAssistantActionDisplay_test.ts \
  supabase/functions/_shared/dashboardAssistantAnalyticsTools.ts \
  supabase/functions/_shared/dashboardAssistantAttachedContext.ts \
  supabase/functions/_shared/dashboardAssistantBlocks.ts \
  supabase/functions/_shared/dashboardAssistantBlocks_test.ts \
  supabase/functions/_shared/dashboardAssistantBookingDocuments.ts \
  supabase/functions/_shared/dashboardAssistantBriefing.ts \
  supabase/functions/_shared/dashboardAssistantBriefing_test.ts \
  supabase/functions/_shared/dashboardAssistantConversationContext.ts \
  supabase/functions/_shared/dashboardAssistantFinanceMaintenanceTools.ts \
  supabase/functions/_shared/dashboardAssistantHostDisplay.ts \
  supabase/functions/_shared/dashboardAssistantHostDisplay_test.ts \
  supabase/functions/_shared/dashboardAssistantNavigationTools.ts \
  supabase/functions/_shared/dashboardAssistantNavigationTools_test.ts \
  supabase/functions/_shared/dashboardAssistantParity.ts \
  supabase/functions/_shared/dashboardAssistantParityTools.ts \
  supabase/functions/_shared/dashboardAssistantPhase4Tools.ts \
  supabase/functions/_shared/dashboardAssistantRiskClassifier.ts \
  supabase/functions/_shared/dashboardAssistantRoutes.ts \
  supabase/functions/_shared/dashboardAssistantSafetyGuard.ts \
  supabase/functions/_shared/dashboardAssistantSafetyGuard_test.ts \
  supabase/functions/_shared/dashboardAssistantStreamEvents.ts \
  supabase/functions/_shared/dashboardAssistantToolRouter.ts \
  supabase/functions/_shared/dashboardAssistantToolRouter_test.ts \
  supabase/functions/_shared/dashboardAssistantTools.ts \
  supabase/functions/_shared/ai/llmTools.ts \
  supabase/functions/_shared/ai/prompts/dashboardAssistant.ts \
  supabase/functions/_shared/aiModelRouter.ts \
  supabase/functions/_shared/assistantToolLabels.ts \
  supabase/functions/_shared/backgroundTask.ts \
  supabase/functions/_shared/dashboardService.ts \
  supabase/functions/_shared/activityLog.ts

commit "feat(supabase): wire assistant handlers reviews and notifications" \
  supabase/functions/dashboard-assistant-briefing/index.ts \
  supabase/functions/dashboard-assistant-chat/index.ts \
  supabase/functions/dashboard-assistant-confirm/index.ts \
  supabase/functions/list-org-reviews/index.ts \
  supabase/functions/list-property-reviews/index.ts \
  supabase/functions/notifications-list/index.ts \
  supabase/functions/property-templates-settings/index.ts \
  supabase/functions/_shared/orgReviewList.ts \
  supabase/functions/_shared/propertyReviewList.ts \
  supabase/functions/_shared/reviewListParams.ts \
  supabase/functions/_shared/notificationsUnreadSummary.ts \
  supabase/functions/_shared/notificationsUnreadSummary_test.ts \
  supabase/functions/_shared/propertyTemplates.ts \
  supabase/functions/_shared/financeCategoryLabels.ts \
  supabase/functions/_shared/financeCategoryLabels_test.ts \
  supabase/functions/_shared/financeService.ts \
  supabase/functions/_shared/financeService_test.ts \
  supabase/functions/tests/assistantToolCatalog.test.ts \
  supabase/functions/tests/orgReviews.test.ts \
  supabase/functions/tests/propertyReviews.test.ts

commit "test(supabase): add assistant eval datasets and offline scorers" \
  supabase/functions/tests/evals/answerQualityHydratorsOffline.test.ts \
  supabase/functions/tests/evals/answerQualityScore.test.ts \
  supabase/functions/tests/evals/answerQualityScore.ts \
  supabase/functions/tests/evals/assistantBlockShape.ts \
  supabase/functions/tests/evals/assistantBlockShapeOffline.test.ts \
  supabase/functions/tests/evals/evalRowTypes.ts \
  supabase/functions/tests/evals/aiEvalsOffline.test.ts \
  supabase/functions/tests/evals/runLiveEvals.ts \
  supabase/functions/tests/evals/datasets/assistant_answer_quality.jsonl \
  supabase/functions/tests/evals/datasets/assistant_block_shape.jsonl \
  supabase/functions/tests/evals/datasets/assistant_tool_selection.jsonl \
  supabase/functions/tests/evals/datasets/guest_tools.jsonl \
  supabase/functions/tests/evals/fixtures/assistant

commit "feat(ui): add assistant generative blocks and access libs" \
  ui/src/features/dashboard/ai-assistant/components/blocks/CalendarBlock.tsx \
  ui/src/features/dashboard/ai-assistant/components/blocks/CalloutBlock.tsx \
  ui/src/features/dashboard/ai-assistant/components/blocks/CarouselBlock.tsx \
  ui/src/features/dashboard/ai-assistant/components/blocks/ChartBlock.tsx \
  ui/src/features/dashboard/ai-assistant/components/blocks/ChecklistBlock.tsx \
  ui/src/features/dashboard/ai-assistant/components/blocks/ComparisonBlock.tsx \
  ui/src/features/dashboard/ai-assistant/components/blocks/EntityCardBlock.tsx \
  ui/src/features/dashboard/ai-assistant/components/blocks/KpiBlock.tsx \
  ui/src/features/dashboard/ai-assistant/components/blocks/TimelineBlock.tsx \
  ui/src/features/dashboard/ai-assistant/components/BriefingAttentionCards.tsx \
  ui/src/features/dashboard/ai-assistant/components/ChatComposerReviewPicker.tsx \
  ui/src/features/dashboard/ai-assistant/components/ChatComposerThemePicker.tsx \
  ui/src/features/dashboard/ai-assistant/lib/assistantAccess.ts \
  ui/src/features/dashboard/ai-assistant/lib/assistantAccess.test.ts \
  ui/src/features/dashboard/ai-assistant/lib/briefingDelta.ts \
  ui/src/features/dashboard/ai-assistant/lib/briefingDelta.test.ts

commit "feat(ui): extend dashboard assistant chat surface" \
  ui/src/features/dashboard/ai-assistant

commit "feat(ui): refresh org and property reviews experience" \
  ui/src/features/reviews

commit "feat(ui): add notifications hub shell and unread summary" \
  ui/src/features/dashboard/notifications \
  ui/src/components/skeletons/TemplateWorkbenchSkeleton.tsx

commit "feat(ui): add property template library workbench" \
  ui/src/features/dashboard/bookings/components/property-templates \
  ui/src/features/dashboard/bookings/lib/templateLibrary.ts \
  ui/src/features/dashboard/bookings/lib/templateLibrary.test.ts \
  ui/src/features/dashboard/bookings/lib/templateWorkbenchChrome.ts \
  supabase/functions/property-templates-settings/index.ts

commit "feat(ui): refresh guest marketing listing surfaces" \
  ui/src/features/guest/marketing \
  ui/src/features/guest/search \
  supabase/functions/_shared/publicPropertyService.ts \
  supabase/functions/_shared/publicHostService.ts

commit "feat(ui): extend guest account trip and operational flows" \
  ui/src/features/guest/account \
  ui/src/features/guest/trip \
  ui/src/features/guest/form \
  ui/src/features/guest/sd-form \
  ui/src/features/guest/property \
  ui/src/features/guest/pay-parking \
  supabase/functions/get-sd-form/index.ts \
  supabase/functions/guest-web-chat-messages/index.ts \
  supabase/functions/submit-form-completion/index.ts \
  supabase/functions/claim-sd-voucher/index.ts \
  supabase/functions/_shared/guestProfileService.ts \
  supabase/functions/_shared/guestIdentityKey.ts \
  supabase/functions/_shared/guestIdentityKey_test.ts \
  ui/src/features/reviews/components/ReviewResponseBlock.tsx \
  ui/src/features/reviews/components/ReviewWindowBadge.tsx

commit "feat(ui): polish dashboard chrome and org ai settings" \
  ui/src/features/dashboard/org/components/property-settings \
  ui/src/features/dashboard/org/components/org-settings \
  ui/src/features/dashboard/bookings/components/AdminLayout.tsx \
  ui/src/features/dashboard/bookings/components/AdminMoreSheet.tsx \
  ui/src/features/dashboard/bookings/components/AdminPageHeader.tsx \
  ui/src/features/dashboard/bookings/components/AdminSectionNavLayout.tsx \
  ui/src/features/dashboard/lib/dashboardChromeContext.tsx \
  ui/src/features/dashboard/lib/dashboardChromeContext.test.ts \
  ui/src/layouts/MainLayout.tsx \
  ui/src/index.css \
  ui/src/components/skeletons \
  ui/src/hooks/useGuardedViewSwitch.ts \
  ui/src/hooks/useSlidingActivePill.ts \
  ui/src/lib/date/rememberedDateRange.ts \
  ui/src/lib/date/rememberedDateRange.test.ts

commit "test(ui): add assistant notifications and template e2e" \
  ui/e2e/features/assistant/assistantVisualBlocks.spec.ts \
  ui/e2e/features/dashboard/notificationsHub.spec.ts \
  ui/e2e/features/dashboard/propertyTemplatesWorkbench.spec.ts \
  ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts \
  ui/e2e/features/admin/adminShellSmoke.spec.ts \
  ui/e2e/features/plans/gates/featureGates.spec.ts

commit "docs(docs): sync assistant reviews and guest marketing guides" \
  docs/architecture/ai-dashboard-assistant.md \
  docs/architecture/ai-platform.md \
  docs/architecture/data-model.md \
  docs/architecture/edge-functions.md \
  docs/architecture/overview.md \
  docs/architecture/routing.md \
  docs/architecture/skeleton-loaders.md \
  docs/guides/routes/org/assistant.md \
  docs/guides/routes/org/reviews.md \
  docs/guides/routes/org/property/reviews.md \
  docs/guides/routes/properties.md \
  docs/guides/routes/trip.md \
  docs/guides/routes/sd-form.md \
  docs/guides/routes/guest-booking-document.md \
  docs/guides/testing/ai-dashboard-assistant-manual.md \
  docs/guides/testing/guest-chat-ai-manual.md \
  docs/workflow/done/ai-chat-mode.md \
  docs/workflow/for-testing/public-native-density.md \
  docs/PROJECT.md \
  deno.lock

echo "batch-commit-run-15-half-assistant-guest done"
