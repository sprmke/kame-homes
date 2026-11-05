#!/usr/bin/env bash
# ~1/4 WIP: marketing studio (library + AI sessions) + super-admin system health.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

commit() {
  local msg=$1
  shift
  git add "$@"
  git commit -m "$msg"
}

merge_config_functions() {
  cp supabase/config.toml /tmp/kame-config-wt-backup.toml
  python3 << 'PY'
import re, subprocess, pathlib
names = [
  "marketing-ai-sessions",
  "super-admin-system-health",
]
head = subprocess.check_output(["git", "show", "HEAD:supabase/config.toml"], text=True)
wt = pathlib.Path("/tmp/kame-config-wt-backup.toml").read_text()

def blocks(text):
    out = {}
    for m in re.finditer(r"(?ms)^(\[functions\.([^\]]+)\][^\[]*)", text):
        out[m.group(2)] = m.group(1).rstrip() + "\n"
    return out

hb, wb = blocks(head), blocks(wt)
merged = head.rstrip() + "\n"
for n in names:
    if n in wb and n not in hb:
        merged += "\n" + wb[n]
pathlib.Path("supabase/config.toml").write_text(merged if merged.endswith("\n") else merged + "\n")
print("merged config blocks:", ", ".join(names))
PY
}

commit "feat(supabase): add system health monitoring migrations" \
  supabase/migrations/20261316127100_system_health_monitoring.sql \
  supabase/migrations/20261316127800_system_health_snapshot_v2.sql

commit "feat(supabase): add assistant latency breakdown migration" \
  supabase/migrations/20261316127700_assistant_latency_breakdown.sql

commit "feat(supabase): add marketing library and ai session migrations" \
  supabase/migrations/20261316127200_marketing_template_thumbnails.sql \
  supabase/migrations/20261316128400_marketing_templates_library.sql \
  supabase/migrations/20261316128500_marketing_ai_sessions.sql

commit "feat(supabase): add system health shared services" \
  supabase/functions/_shared/systemHealth \
  supabase/functions/super-admin-system-health/index.ts

commit "feat(supabase): extend marketing generation and theme services" \
  supabase/functions/_shared/marketingThemeDirector.ts \
  supabase/functions/_shared/marketingThemeDirector_test.ts \
  supabase/functions/_shared/marketingGenerationJobs.ts \
  supabase/functions/_shared/marketingImagePromptBuilder.ts \
  supabase/functions/_shared/marketingImagePromptBuilder_test.ts \
  supabase/functions/_shared/marketingPosterDirector.ts \
  supabase/functions/_shared/marketingPosterDirector_test.ts \
  supabase/functions/_shared/marketingTheme.ts \
  supabase/functions/_shared/marketingTheme_test.ts

commit "feat(supabase): wire marketing and super-admin edge handlers" \
  supabase/functions/marketing-ai-sessions/index.ts \
  supabase/functions/generate-marketing-media/index.ts \
  supabase/functions/generate-marketing-template/index.ts \
  supabase/functions/marketing-templates/index.ts \
  supabase/functions/marketing-themes/index.ts \
  supabase/functions/super-admin-ai-usage/index.ts \
  supabase/functions/super-admin-overview/index.ts

commit "feat(ui): add super-admin system health dashboard" \
  ui/src/features/dashboard/super-admin/pages/SuperAdminHealthPage.tsx \
  ui/src/features/dashboard/super-admin/components/super-admin-health \
  ui/src/features/dashboard/super-admin/hooks/useSystemHealth.ts \
  ui/src/features/dashboard/super-admin/lib/systemHealth \
  ui/src/features/dashboard/super-admin/components/super-admin-ai/AssistantLatencyCard.tsx

commit "feat(ui): polish super-admin shell ai usage and navigation" \
  ui/src/features/dashboard/super-admin

commit "feat(ui): add marketing studio session and library libs" \
  ui/src/features/dashboard/marketing/lib/aiStudioSessions.ts \
  ui/src/features/dashboard/marketing/lib/aiStudioSessions.test.ts \
  ui/src/features/dashboard/marketing/lib/aiStudioHandoff.ts \
  ui/src/features/dashboard/marketing/lib/marketingLibrary.ts \
  ui/src/features/dashboard/marketing/lib/marketingLibrary.test.ts \
  ui/src/features/dashboard/marketing/lib/marketingDeviceTier.ts \
  ui/src/features/dashboard/marketing/lib/marketingDeviceTier.test.ts \
  ui/src/features/dashboard/marketing/lib/marketingEditorPreload.ts \
  ui/src/features/dashboard/marketing/lib/marketingPhotoHandoff.ts \
  ui/src/features/dashboard/marketing/lib/marketingPresetThumbs.ts \
  ui/src/features/dashboard/marketing/lib/marketingRenderGate.ts \
  ui/src/features/dashboard/marketing/lib/marketingRenderGate.test.ts \
  ui/src/features/dashboard/marketing/lib/marketingStudioRoute.ts \
  ui/src/features/dashboard/marketing/lib/marketingStudioRoute.test.ts \
  ui/src/features/dashboard/marketing/lib/marketingThumbSizing.ts \
  ui/src/features/dashboard/marketing/lib/marketingThumbSizing.test.ts \
  ui/src/features/dashboard/marketing/lib/calendarMiniLayout.ts \
  ui/src/features/dashboard/marketing/lib/calendarMiniLayout.test.ts \
  ui/src/features/dashboard/marketing/lib/theme/marketingThemeCss.ts \
  ui/src/features/dashboard/marketing/lib/theme/marketingThemeLibrary.test.ts \
  ui/src/features/dashboard/marketing/lib/theme/themePaletteSuggestions.ts \
  ui/src/features/dashboard/marketing/lib/theme/themePaletteSuggestions.test.ts \
  ui/src/features/dashboard/marketing/hooks/useMarketingAiSessions.ts \
  ui/src/features/dashboard/marketing/hooks/useMarketingLibrary.ts \
  ui/src/features/dashboard/marketing/hooks/useMarketingDesignSession.ts \
  ui/src/features/dashboard/marketing/hooks/useAiPosterEngine.ts \
  ui/src/features/dashboard/marketing/hooks/usePresetThumbnail.ts \
  ui/src/features/dashboard/marketing/hooks/useResolvedMarketingTheme.ts

commit "feat(ui): add ai studio conversation and session ui" \
  ui/src/features/dashboard/marketing/components/ai-studio

commit "feat(ui): add marketing library workspace and editor chrome" \
  ui/src/features/dashboard/marketing/components/library \
  ui/src/features/dashboard/marketing/components/shared/MarketingEditorHost.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingEditorRail.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingEditorTopBar.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingInlineName.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingReplaceTemplateDialog.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingSizeDialog.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingTemplateThumb.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingTile.tsx \
  ui/src/features/dashboard/marketing/components/shared/CalendarMiniPreview.tsx \
  ui/src/features/dashboard/marketing/components/design-editor/polotno/KameStudioSections.tsx

commit "feat(ui): extend marketing themes and studio builders" \
  ui/src/features/dashboard/marketing/components/themes/NewThemeDialog.tsx \
  ui/src/features/dashboard/marketing/components/themes/ThemeAiDescribe.tsx \
  ui/src/features/dashboard/marketing/components/themes/ThemeContextBar.tsx \
  ui/src/features/dashboard/marketing/components/themes/ThemeShowcase.tsx \
  ui/src/features/dashboard/marketing/components/themes \
  ui/src/features/dashboard/marketing/pages/MarketingStudioPage.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingStudioShell.tsx \
  ui/src/features/dashboard/marketing/components/shared/MarketingStudioModeTabs.tsx \
  ui/src/features/dashboard/marketing/components/calendar-builder \
  ui/src/features/dashboard/marketing/components/design-editor \
  ui/src/features/dashboard/marketing/components/publishing \
  ui/src/features/dashboard/marketing/components/video-editor \
  ui/src/features/dashboard/marketing/hooks \
  ui/src/features/dashboard/marketing/lib

commit "test(ui): add marketing library e2e and refresh studio specs" \
  ui/e2e/features/marketing/marketingLibrary.spec.ts \
  ui/e2e/features/marketing/marketingStudioSmoke.spec.ts \
  ui/e2e/features/marketing/marketingThemes.spec.ts \
  ui/e2e/features/marketing/marketingAiGenerate.spec.ts \
  ui/e2e/features/marketing/marketingAiPost.spec.ts \
  ui/e2e/features/marketing/marketingCollage.spec.ts

merge_config_functions
commit "docs(docs): document marketing studio and super-admin health" \
  supabase/config.toml \
  deno.lock \
  docs/architecture/marketing-poster-studio.md \
  docs/architecture/marketing-themes.md \
  docs/guides/routes/org/property/marketing.md \
  docs/guides/routes/admin/health.md \
  docs/workflow/in-progress/marketing-themes.md \
  docs/workflow/in-progress/super-admin-system-health.md \
  docs/workflow/in-progress/marketing-studio-mobile-and-dashboard-responsive.md \
  docs/workflow/for-testing/marketing-studio-library-and-workspace-redesign.md \
  docs/workflow/for-testing/marketing-ai-studio-sessions-and-library-polish.md \
  docs/workflow/planned/super-admin-service-cost-monitoring.md \
  docs/workflow/for-testing/super-admin-step-up-otp.md \
  scripts/dev/check-select-star.sh \
  scripts/dev/check-migration-security.sh

mv /tmp/kame-config-wt-backup.toml supabase/config.toml

echo "batch-commit-run-15-quarter-marketing-health done"
