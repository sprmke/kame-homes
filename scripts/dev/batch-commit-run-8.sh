#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

c() { git commit -m "$MSG"; }

MSG="$(cat <<'EOF'
feat(ui): refactor marketing ai studio photo references

Replace aspect/options bars with listing photo pickers and shared composer options.
EOF
)"
git add -- \
  ui/src/features/dashboard/marketing/components/ai-studio/AiPostPanel.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioAspectPicker.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioChoiceGroup.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioComposer.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioEmptyState.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioJobCard.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioLookPicker.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioOptionsBar.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioPhotoPicker.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioPhotoSheet.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioReferenceLibraryDrawer.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioReferenceUploader.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioResultsGrid.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioSection.tsx \
  ui/src/features/dashboard/marketing/components/ai-studio/AiStudioVideoOptionsBar.tsx \
  ui/src/features/dashboard/marketing/lib/marketingGenerationComposer.test.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationComposer.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationOptions.test.ts \
  ui/src/features/dashboard/marketing/lib/marketingGenerationOptions.ts \
  ui/src/features/dashboard/marketing/lib/marketingListingPhotoReference.test.ts \
  ui/src/features/dashboard/marketing/lib/marketingListingPhotoReference.ts
c

MSG="$(cat <<'EOF'
feat(ui): polish ai mode chrome and conversation history

Tune dashboard mode providers, full-page chrome, and canvas width.
EOF
)"
git add -- \
  ui/src/features/dashboard/ai-assistant/components/ConversationHistoryList.tsx \
  ui/src/features/dashboard/ai-assistant/components/DashboardModeProvider.tsx \
  ui/src/features/dashboard/ai-assistant/components/DashboardModeToggle.tsx \
  ui/src/features/dashboard/ai-assistant/components/full-page/AiModeChrome.tsx \
  ui/src/features/dashboard/ai-assistant/lib/canvasWidth.ts
c

MSG="$(cat <<'EOF'
feat(bookings): integrate ai mode into admin shell

Update admin layout, more sheet, and booking detail chrome for mode switch.
EOF
)"
git add -- \
  ui/src/features/dashboard/bookings/components/AdminLayout.tsx \
  ui/src/features/dashboard/bookings/components/AdminMoreSheet.tsx \
  ui/src/features/dashboard/bookings/components/booking-detail/BookingDetailHeader.tsx \
  ui/src/features/dashboard/bookings/pages/BookingDetailPage.tsx \
  ui/src/index.css
c

MSG="$(cat <<'EOF'
test(ui): update assistant and marketing ai e2e specs

Align mocked journeys with ai mode and marketing studio photo flow.
EOF
)"
git add -- \
  ui/e2e/features/assistant/assistantAiMode.spec.ts \
  ui/e2e/features/marketing/marketingAiGenerate.spec.ts \
  ui/e2e/features/marketing/marketingAiPost.spec.ts
c

MSG="$(cat <<'EOF'
docs(docs): update marketing poster studio architecture

Refresh poster studio doc and plans matrix for marketing ai changes.
EOF
)"
git add -- \
  docs/architecture/marketing-poster-studio.md \
  docs/architecture/plans-feature-matrix.md
c

MSG="$(cat <<'EOF'
docs(docs): sync assistant and property marketing route guides

Update org assistant and property marketing host-facing behavior notes.
EOF
)"
git add -- \
  docs/guides/routes/org/assistant.md \
  docs/guides/routes/org/property/marketing.md
c

MSG="$(cat <<'EOF'
docs(docs): refresh ai assistant manual and chat mode ledger

Document manual testing steps and in-progress ai chat mode status.
EOF
)"
git add -- \
  docs/guides/testing/ai-dashboard-assistant-manual.md \
  docs/workflow/in-progress/ai-chat-mode.md
c

MSG="$(cat <<'EOF'
chore(*): add ai chat batch commit helper script

Keep the prior batch-commit run script for reproducible local commits.
EOF
)"
git add -- scripts/dev/batch-commit-run-7-ai-chat.sh scripts/dev/batch-commit-run-8.sh
c

echo "batch-commit-run-8 done"
