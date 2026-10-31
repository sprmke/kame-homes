#!/usr/bin/env bash
# ~1/4 WIP: legacy migrate, kame space rebrand, chat-template edge, assistant template context. No e2e, no feature-availability.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

commit() {
  local msg=$1
  shift
  git add "$@"
  git commit -m "$msg"
}

commit "chore(*): extend legacy-to-mt-prod migrate lib and inventory" \
  scripts/migrate/legacy-to-mt-prod/README.md \
  scripts/migrate/legacy-to-mt-prod/inventory.ts \
  scripts/migrate/legacy-to-mt-prod/lib.sh \
  scripts/migrate/legacy-to-mt-prod/migrate.sh

commit "chore(*): add legacy-to-mt-prod sql and storage phases" \
  scripts/migrate/legacy-to-mt-prod/sql/00-inventory.sql \
  scripts/migrate/legacy-to-mt-prod/sql/10-post-restore-fixups.sql \
  scripts/migrate/legacy-to-mt-prod/sql/20-shape-tenant-org.sql \
  scripts/migrate/legacy-to-mt-prod/sql/30-rewrite-storage-urls.sql \
  scripts/migrate/legacy-to-mt-prod/sql/40-derived-rebuild.sql \
  scripts/migrate/legacy-to-mt-prod/sql/50-cleanup-guest-auth.sql \
  scripts/migrate/legacy-to-mt-prod/sql/90-verify.sql \
  scripts/migrate/legacy-to-mt-prod/storage/copyBuckets.ts

commit "docs: add kamespace cutover and rebrand workflow plans" \
  docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md \
  docs/workflow/planned/kamespace-03-rebrand-kame-homes-to-kame-space.md \
  docs/workflow/planned/kamespace-01-legacy-prod-config-secrets-backup.md \
  docs/workflow/wont-do/module-status-management.md \
  docs/workflow/planned/README.md \
  docs/workflow/in-progress/chat-templates.md

commit "docs: update legacy migration runbook and intake" \
  docs/archive/operations/legacy-to-mt-prod-migration.md \
  docs/workflow/intake/_to-dos.md \
  docs/workflow/intake/_to-plan.md \
  docs/workflow/in-progress/README.md \
  scripts/README.md

commit "feat(supabase): extend http response and cors helpers" \
  supabase/functions/_shared/httpResponse.ts \
  supabase/functions/_shared/cors.ts \
  supabase/functions/_shared/cronSecretGate.ts

commit "feat(supabase): add chat template renderer tests and handler tweaks" \
  supabase/functions/_shared/chatTemplateMessage.ts \
  supabase/functions/_shared/chatTemplateMessage_test.ts \
  supabase/functions/chat-templates/index.ts

commit "feat(supabase): wire assistant property template attached context" \
  supabase/functions/_shared/dashboardAssistantAttachedContext.ts \
  supabase/functions/dashboard-assistant-chat/index.ts \
  supabase/functions/_shared/ai/prompts/dashboardAssistant.ts

commit "feat(supabase): extend assistant coverage tools and response shape" \
  supabase/functions/_shared/dashboardAssistantCoverageTools.ts \
  supabase/functions/_shared/dashboardAssistantCoverageHelpers.ts \
  supabase/functions/_shared/dashboardAssistantCoverageHelpers_test.ts \
  supabase/functions/_shared/dashboardAssistantResponseShape.ts \
  supabase/functions/_shared/dashboardAssistantResponseShape_test.ts

commit "feat(supabase): extend assistant router labels and host display" \
  supabase/functions/_shared/dashboardAssistantToolRouter.ts \
  supabase/functions/_shared/dashboardAssistantToolRouter_test.ts \
  supabase/functions/_shared/assistantToolLabels.ts \
  supabase/functions/_shared/dashboardAssistantHostDisplay.ts \
  supabase/functions/_shared/dashboardAssistantVisuals.ts \
  supabase/functions/_shared/dashboardAssistantParity.ts \
  supabase/functions/_shared/dashboardAssistantRiskClassifier.ts \
  supabase/functions/tests/assistantToolCatalog.test.ts \
  supabase/functions/tests/evals/aiEvalsOffline.test.ts

commit "feat(supabase): tighten guest asset and booking edge handlers" \
  supabase/functions/_shared/guestBookingAccessToken.ts \
  supabase/functions/_shared/approvalEmailMatcher.ts \
  supabase/functions/_shared/orgReviewList.ts \
  supabase/functions/_shared/propertyReviewList.ts \
  supabase/functions/_shared/superAdminVerification.ts \
  supabase/functions/resolve-booking-property/index.ts \
  supabase/functions/get-booked-dates/index.ts \
  supabase/functions/get-booking-asset-url/index.ts \
  supabase/functions/ical-export/index.ts \
  supabase/functions/submit-pay-parking/index.ts \
  supabase/functions/marketing-ai-sessions/index.ts \
  supabase/functions/approval-email-webhook/index.ts

commit "feat(ui): assistant property template context in composer" \
  ui/src/features/dashboard/ai-assistant/components/ChatComposer.tsx \
  ui/src/features/dashboard/ai-assistant/components/ChatComposerModulePicker.tsx \
  ui/src/features/dashboard/ai-assistant/components/ChatContextCatalogRowVisual.tsx \
  ui/src/features/dashboard/ai-assistant/components/ChatContextPillSuggestions.tsx \
  ui/src/features/dashboard/ai-assistant/hooks/useAssistantContextCatalog.ts \
  ui/src/features/dashboard/ai-assistant/lib/assistantToolLabels.ts \
  ui/src/features/dashboard/ai-assistant/lib/attachedContext.ts \
  ui/src/features/dashboard/ai-assistant/lib/contextPickerIcons.ts \
  ui/src/features/dashboard/ai-assistant/lib/contextPickerRegistry.ts \
  ui/src/features/dashboard/ai-assistant/lib/moduleSuggestions.ts

commit "feat(ui): improve org selector landing and routing" \
  ui/src/features/dashboard/org/lib/orgLanding.ts \
  ui/src/features/dashboard/org/lib/orgLanding.test.ts \
  ui/src/features/dashboard/org/pages/OrgSelectorPage.tsx \
  docs/guides/routes/org/selector.md

commit "refactor(ui): default platform branding to kame space" \
  ui/src/lib/platformAppName.ts \
  ui/src/lib/platformAppName.test.ts \
  ui/src/lib/platformBranding.ts \
  ui/src/lib/seo/seoMeta.ts \
  supabase/functions/_shared/platformBrand.ts \
  supabase/functions/_shared/platformBrand_test.ts \
  ui/index.html \
  ui/middleware.ts \
  ui/public/favicon/site.webmanifest \
  ui/public/offline.html \
  ui/src/components/branding/KameHomesBrandIcon.tsx \
  ui/src/components/branding/KameSpaceBrandIcon.tsx

commit "refactor(ui): refresh host marketing and guest surface copy" \
  ui/src/features/guest/marketing/for-hosts/data/hostTourChapters.ts \
  ui/src/features/guest/marketing/for-hosts/data/hostTourNarration.ts \
  ui/public/marketing/for-hosts/narration/intro.vtt \
  ui/public/marketing/for-hosts/narration/manifest.json \
  ui/public/marketing/for-hosts/narration/outro.vtt \
  ui/src/features/guest/marketing/for-hosts/preview/data/hostShowcase.ts \
  ui/src/features/guest/marketing/for-hosts/preview/components/showcase/showcaseDemoRegistry.ts \
  ui/src/features/guest/marketing/for-hosts/v3/data/hostLandingV3.ts \
  ui/src/features/guest/marketing/for-hosts/v3/components/V3FeatureBento.tsx \
  ui/src/features/guest/trip/lib/guestTripCalendar.ts

commit "refactor(marketing): update social remotion brand strings" \
  marketing/social/scripts/captions.ts \
  marketing/social/scripts/filipinoCaptions.ts \
  marketing/social/scripts/gallery.ts \
  marketing/social/src/angles/checklist.tsx \
  marketing/social/src/angles/kinetic.tsx \
  marketing/social/src/angles/question.tsx \
  marketing/social/src/angles/versus.tsx \
  marketing/social/src/concepts.tsx \
  marketing/social/src/features/bookingScreens.tsx \
  marketing/social/src/features/opsScreens.tsx \
  marketing/social/src/filipino/bahala.tsx \
  marketing/social/src/filipino/noonNgayon.tsx \
  marketing/social/src/primitives.tsx \
  marketing/social/src/screens.tsx

commit "docs: update assistant inbox templates and architecture notes" \
  docs/PROJECT.md \
  docs/architecture/ai-dashboard-assistant.md \
  docs/architecture/overview.md \
  docs/architecture/pwa.md \
  docs/guides/routes/README.md \
  docs/guides/routes/org/assistant.md \
  docs/guides/routes/org/property/templates.md \
  docs/workflow/for-testing/ai-companion-response-quality-and-generative-ui.md

commit "chore(deps): sync lockfiles package scripts and dev hooks" \
  package.json \
  bun.lock \
  deno.lock \
  skills-lock.json \
  .gitignore \
  .husky/pre-commit \
  scripts/dev/audit-auth-matrix.mjs \
  scripts/dev/check-select-star.sh \
  scripts/dev/migrate-feature-imports.sh \
  scripts/dev/setup-agents-skills.sh \
  .agent/skills/self-review/SKILL.md \
  .claude/README.md \
  .cursor/rules/README.md \
  .cursor/rules/plans-and-permissions.mdc

echo "Done: 18 commits on $(git branch --show-current)."
