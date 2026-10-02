#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

c() { git commit -m "$MSG"; }

MSG="$(cat <<'EOF'
database(supabase): add marketing generation options columns

Persist video and image generation option payloads on marketing jobs.
EOF
)"
git add -- supabase/migrations/20261316126600_marketing_generation_options.sql
c

MSG="$(cat <<'EOF'
feat(supabase): add marketing video prompt builder and mp4 probe

Build structured video prompts and validate generated mp4 output server-side.
EOF
)"
git add -- \
  supabase/functions/_shared/marketingVideoPromptBuilder.ts \
  supabase/functions/_shared/marketingVideoPromptBuilder_test.ts \
  supabase/functions/_shared/mp4Probe.ts \
  supabase/functions/_shared/mp4Probe_test.ts \
  supabase/functions/_shared/marketingVideoGenerationAi_test.ts \
  supabase/functions/_shared/marketingVideoGenerationAi.ts
c

MSG="$(cat <<'EOF'
feat(supabase): tune marketing generation pricing and media handler

Update job orchestration, pricing math, and generate-marketing-media entrypoint.
EOF
)"
git add -- \
  supabase/functions/_shared/marketingGenerationJobs.ts \
  supabase/functions/_shared/marketingGenerationPricing.ts \
  supabase/functions/_shared/marketingGenerationPricing_test.ts \
  supabase/functions/generate-marketing-media/index.ts \
  supabase/functions/_shared/aiModelRouter.ts
c

MSG="$(cat <<'EOF'
feat(supabase): add ai usage console summary for super admin

Aggregate generation outcomes for the platform AI usage dashboard.
EOF
)"
git add -- \
  supabase/functions/_shared/aiUsageConsoleSummary.ts \
  supabase/functions/_shared/aiUsageConsoleSummary_test.ts \
  supabase/functions/super-admin-ai-usage/index.ts \
  supabase/functions/deno.lock
c

MSG="$(cat <<'EOF'
feat(ui): extend marketing ai studio video and photo flow

Camera move picker, composer updates, and remove legacy video progress UI.
EOF
)"
git add -- \
  ui/src/features/dashboard/marketing/components/ai-studio/AiPostPanel.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioCameraMovePicker.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioComposer.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioGeneratingStage.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioJobCard.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioPhotoPicker.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioPhotoSheet.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioResultsGrid.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioSection.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioVideoProgress.tsx \
  ui/src/features/dashboard/marketing/hooks/useGenerateMarketingMedia.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationComposer.test.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationComposer.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationOptions.test.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationOptions.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationPricing.test.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationPricing.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationTypes.ts
c

MSG="$(cat <<'EOF'
feat(ui): add sheet drag dismiss helpers

Shared drag-to-close behavior for bottom sheets on mobile.
EOF
)"
git add -- \
  ui/src/components/ui/sheet.tsx \
  ui/src/components/ui/sheetDrag.ts \
  ui/src/components/ui/sheetDrag.test.ts
c

MSG="$(cat <<'EOF'
feat(ui): polish telegram notification settings fields

Tighten layout and credentials fields for property telegram modules.
EOF
)"
git add -- \
  ui/src/features/dashboard/bookings/components/PropertyTelegramCredentialsFields.tsx \
  ui/src/features/dashboard/bookings/components/telegram-notifications/TelegramChatIdField.tsx \
  ui/src/features/dashboard/bookings/components/telegram-notifications/TelegramGlobalBotTokenCard.tsx \
  ui/src/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationModuleLayout.tsx \
  ui/src/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationModuleSkeleton.tsx
c

MSG="$(cat <<'EOF'
feat(ui): expand super admin ai usage dashboard cards

Show plan usage and generation outcome breakdown on the AI console.
EOF
)"
git add -- \
  ui/src/features/dashboard/super-admin/components/super-admin-ai/AiUsageTab.tsx \
  ui/src/features/dashboard/super-admin/components/super-admin-ai/AiGenerationOutcomesCard.tsx \
  ui/src/features/dashboard/super-admin/components/super-admin-ai/AiPlanUsageCard.tsx \
  ui/src/features/dashboard/super-admin/hooks/useSuperAdminAiUsage.ts
c

MSG="$(cat <<'EOF'
feat(ui): adjust page preview and booking detail chrome

Showcase hero layout, page editor preview pane, and booking detail spacing.
EOF
)"
git add -- \
  ui/src/features/dashboard/page-editor/components/PageEditorPreviewPane.tsx \
  ui/src/features/guest/marketing/showcase/lib/showcaseHeroLayout.ts \
  ui/src/features/dashboard/bookings/pages/BookingDetailPage.tsx \
  ui/src/index.css
c

MSG="$(cat <<'EOF'
test(ui): update admin ai console and marketing generate e2e

Mock new super-admin usage cards and marketing video generation options.
EOF
)"
git add -- \
  ui/e2e/features/admin/adminAiConsole.spec.ts \
  ui/e2e/features/admin/shared/adminAiConsoleHarness.ts \
  ui/e2e/features/marketing/marketingAiGenerate.spec.ts
c

MSG="$(cat <<'EOF'
docs(docs): sync project index and edge function inventory

Update architecture edge-functions and admin AI route documentation.
EOF
)"
git add -- \
  docs/PROJECT.md \
  docs/architecture/edge-functions.md \
  docs/guides/routes/admin/ai.md \
  docs/guides/routes/org/assistant.md
c

MSG="$(cat <<'EOF'
docs(docs): update property routes and marketing video testing doc

Refresh bookings, marketing, notifications guides and for-testing README.
EOF
)"
git add -- \
  docs/guides/routes/org/property/bookings-detail.md \
  docs/guides/routes/org/property/marketing.md \
  docs/guides/routes/org/property/notifications.md \
  docs/guides/routes/property-showcase.md \
  docs/workflow/for-testing/README.md \
  docs/workflow/for-testing/marketing-ai-video-quality.md \
  scripts/dev/batch-commit-run-12.sh
c

echo "batch-commit-run-12 done"
