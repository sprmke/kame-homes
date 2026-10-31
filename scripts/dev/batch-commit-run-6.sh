#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

commit() {
  local msg=$1
  shift
  git add "$@"
  git commit -m "$msg"
}

commit "feat(ui): polish ai mode chrome and conversation history" \
  ui/src/features/dashboard/ai-assistant/components/ConversationHistoryList.tsx \
  ui/src/features/dashboard/ai-assistant/components/DashboardModeToggle.tsx \
  ui/src/features/dashboard/ai-assistant/components/full-page/AiModeChrome.tsx \
  ui/src/features/dashboard/ai-assistant/lib/canvasWidth.ts \
  ui/src/features/dashboard/ai-assistant/lib/canvasWidth.test.ts \
  ui/e2e/features/assistant/assistantAiMode.spec.ts

commit "feat(ui): tune admin shell and plan tier sidebar icons" \
  ui/src/features/dashboard/bookings/components/AdminLayout.tsx \
  ui/src/features/dashboard/bookings/components/AdminMoreSheet.tsx \
  ui/src/features/dashboard/plans/components/OrgPlanSidebarEntry.tsx \
  ui/src/features/dashboard/plans/lib/planTierIcons.ts \
  ui/src/features/dashboard/plans/lib/planTierIcons.test.ts

commit "feat(ui): expand for-hosts v3 landing sections" \
  ui/src/features/guest/marketing/for-hosts/v3 \
  ui/src/features/guest/marketing/pages/ForHostsV3Page.tsx \
  ui/src/features/guest/marketing/routes/index.tsx

commit "feat(ui): refresh for-hosts preview showcase and seo meta" \
  ui/src/features/guest/marketing/for-hosts/preview/components/Reveal.tsx \
  ui/src/features/guest/marketing/for-hosts/preview/data/hostShowcase.ts \
  ui/src/features/guest/marketing/pages/ForHostsPreviewPage.tsx \
  ui/src/lib/seo/seoMeta.ts \
  ui/src/index.css

commit "docs(docs): sync ai assistant and host route guides" \
  docs/architecture/ai-dashboard-assistant.md \
  docs/guides/routes/README.md \
  docs/guides/routes/for-hosts.md \
  docs/guides/routes/org/assistant.md \
  docs/guides/routes/org/plans.md \
  docs/guides/testing/ai-dashboard-assistant-manual.md

commit "docs(docs): update ai chat workflow and marketing themes plan" \
  docs/workflow/for-testing/host-tour-film-redesign.md \
  docs/workflow/in-progress/ai-chat-mode.md \
  docs/workflow/planned/README.md \
  docs/workflow/planned/marketing-themes.md

echo "batch-commit-run-6 done"
