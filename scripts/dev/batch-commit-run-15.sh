#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

commit() {
  git add -- "$@"
  git commit -m "$MSG"
}

MSG="$(cat <<'EOF'
feat(supabase): add analytics channel and booking pace helpers

Add shared channel bucketing and booking pace calculators with Deno unit tests.
EOF
)"
commit \
  supabase/functions/_shared/analyticsChannel.ts \
  supabase/functions/_shared/analyticsChannel_test.ts \
  supabase/functions/_shared/bookingPace.ts \
  supabase/functions/_shared/bookingPace_test.ts

MSG="$(cat <<'EOF'
feat(supabase): extend analytics service and guest origin bucketing

Refresh analytics aggregation and guest origin bucketing with regression tests.
EOF
)"
commit \
  supabase/functions/_shared/analyticsService.ts \
  supabase/functions/_shared/guestOriginBucketing.ts \
  supabase/functions/_shared/guestOriginBucketing_test.ts \
  supabase/functions/_shared/marketingUploadStorage_test.ts

MSG="$(cat <<'EOF'
feat(supabase): add upload-marketing-asset edge handler

Wire dedicated marketing asset upload handler and generation storage updates.
EOF
)"
commit \
  supabase/functions/upload-marketing-asset/index.ts \
  supabase/functions/_shared/marketingGenerationStorage.ts \
  supabase/config.toml \
  supabase/.env.example \
  ui/.env.example

MSG="$(cat <<'EOF'
feat(ui): add analytics guest distribution cards

Add donut chart, guest origins, party size, and age distribution surfaces.
EOF
)"
commit \
  ui/src/features/dashboard/analytics/components/AnalyticsDistributionCard.tsx \
  ui/src/features/dashboard/analytics/components/AnalyticsDonutChart.tsx \
  ui/src/features/dashboard/analytics/components/AnalyticsGuestSignalsCard.tsx \
  ui/src/features/dashboard/analytics/components/GuestAgeCard.tsx \
  ui/src/features/dashboard/analytics/components/GuestOriginsCard.tsx \
  ui/src/features/dashboard/analytics/components/GuestPartySizeCard.tsx

MSG="$(cat <<'EOF'
refactor(ui): simplify property analytics overview cards

Remove legacy next-actions and occupancy cards; refresh KPI and channel mix layout.
EOF
)"
commit \
  ui/src/features/dashboard/analytics/components/AnalyticsKpiStrip.tsx \
  ui/src/features/dashboard/analytics/components/AnalyticsNextActionsCard.tsx \
  ui/src/features/dashboard/analytics/components/AnalyticsOverviewSection.tsx \
  ui/src/features/dashboard/analytics/components/AnalyticsStateStrip.tsx \
  ui/src/features/dashboard/analytics/components/BookingPaceCard.tsx \
  ui/src/features/dashboard/analytics/components/ChannelMixCard.tsx \
  ui/src/features/dashboard/analytics/components/GuestInsightsCard.tsx \
  ui/src/features/dashboard/analytics/components/LeadTimeLosCard.tsx \
  ui/src/features/dashboard/analytics/components/NextNinetyDaysCard.tsx \
  ui/src/features/dashboard/analytics/components/OccupancyRateTrendCard.tsx \
  ui/src/features/dashboard/analytics/components/PublicPagePerformanceCard.tsx

MSG="$(cat <<'EOF'
test(ui): add analytics distribution and channel label tests

Add guest origins display helpers and distribution range validators with Vitest.
EOF
)"
commit \
  ui/src/features/dashboard/analytics/lib/analyticsNextActions.test.ts \
  ui/src/features/dashboard/analytics/lib/analyticsNextActions.ts \
  ui/src/features/dashboard/analytics/lib/analyticsDistributionRange.test.ts \
  ui/src/features/dashboard/analytics/lib/analyticsDistributionRange.ts \
  ui/src/features/dashboard/analytics/lib/channelLabels.test.ts \
  ui/src/features/dashboard/analytics/lib/channelLabels.ts \
  ui/src/features/dashboard/analytics/lib/guestOriginsDisplay.test.ts \
  ui/src/features/dashboard/analytics/lib/guestOriginsDisplay.ts \
  ui/src/features/dashboard/analytics/lib/exportPdf.ts \
  ui/src/features/dashboard/analytics/lib/occupancyStateCopy.ts \
  ui/src/features/dashboard/analytics/lib/types.ts

MSG="$(cat <<'EOF'
feat(ui): add marketing collage document lib

Add collage layouts, cover crop, store ops, and document serialization helpers.
EOF
)"
commit \
  ui/src/features/dashboard/marketing/lib/collage/collageDocument.test.ts \
  ui/src/features/dashboard/marketing/lib/collage/collageDocument.ts \
  ui/src/features/dashboard/marketing/lib/collage/collageLayouts.ts \
  ui/src/features/dashboard/marketing/lib/collage/collageStoreOps.ts \
  ui/src/features/dashboard/marketing/lib/collage/collageTypes.ts \
  ui/src/features/dashboard/marketing/lib/collage/coverCrop.test.ts \
  ui/src/features/dashboard/marketing/lib/collage/coverCrop.ts

MSG="$(cat <<'EOF'
feat(ui): add marketing collage editor panel ui

Add collage panel, layout grid, cell list, and style controls for design studio.
EOF
)"
commit \
  ui/src/features/dashboard/marketing/components/design-editor/collage/CollageCellList.tsx \
  ui/src/features/dashboard/marketing/components/design-editor/collage/CollageLayoutGrid.tsx \
  ui/src/features/dashboard/marketing/components/design-editor/collage/CollagePanel.tsx \
  ui/src/features/dashboard/marketing/components/design-editor/collage/CollageStartFromControl.tsx \
  ui/src/features/dashboard/marketing/components/design-editor/collage/CollageStyleControls.tsx

MSG="$(cat <<'EOF'
feat(ui): wire polotno uploads and marketing asset hook

Replace session media hook with marketing uploads and upload-marketing-asset client.
EOF
)"
commit \
  ui/src/features/dashboard/marketing/components/design-editor/polotno/usePolotnoSessionMedia.ts \
  ui/src/features/dashboard/marketing/components/design-editor/polotno/useMarketingUploads.ts \
  ui/src/features/dashboard/marketing/hooks/useUploadMarketingAsset.ts \
  ui/src/features/dashboard/marketing/components/design-editor/PolotnoDesignStudio.tsx \
  ui/src/features/dashboard/marketing/components/design-editor/polotno/KamePolotnoEditor.tsx \
  ui/src/features/dashboard/marketing/components/design-editor/polotno/PropertyMediaPanels.tsx \
  ui/src/features/dashboard/marketing/lib/polotno/initPolotno.ts \
  ui/src/features/dashboard/marketing/lib/polotno/orgLogoCircle.ts \
  ui/src/features/dashboard/marketing/lib/polotno/polotnoStore.ts

MSG="$(cat <<'EOF'
feat(ui): refresh marketing templates panel and saved templates

Update templates panel wiring for collage and polotno saved template metadata.
EOF
)"
commit \
  ui/src/features/dashboard/marketing/components/shared/MarketingTemplatesPanel.tsx \
  ui/src/features/dashboard/marketing/lib/marketingSavedTemplates.ts

MSG="$(cat <<'EOF'
feat(ui): simplify org plans page billing layout

Remove redundant current plan summary card and tighten billing panel hierarchy.
EOF
)"
commit \
  ui/src/features/dashboard/plans/components/CurrentPlanSummary.tsx \
  ui/src/features/dashboard/plans/components/PlanBillingPanel.tsx \
  ui/src/features/dashboard/plans/pages/OrgPlansPage.tsx

MSG="$(cat <<'EOF'
test(ui): add marketing collage e2e and team harness tweak

Cover collage design studio smoke path and org plan RBAC harness alignment.
EOF
)"
commit \
  ui/e2e/features/marketing/marketingCollage.spec.ts \
  ui/e2e/features/team/shared/propertyTeamRbacHarness.ts

MSG="$(cat <<'EOF'
docs(docs): sync analytics marketing plans and workflow guides

Document collage editor for-testing move and refreshed property analytics routes.
EOF
)"
commit \
  docs/PROJECT.md \
  docs/architecture/edge-functions.md \
  docs/architecture/storage.md \
  docs/guides/routes/org/plans.md \
  docs/guides/routes/org/property/analytics.md \
  docs/guides/routes/org/property/marketing.md \
  docs/workflow/for-testing/README.md \
  docs/workflow/for-testing/host-analytics-module.md \
  docs/workflow/for-testing/marketing-collage-editor.md \
  docs/workflow/planned/README.md \
  docs/workflow/planned/marketing-collage-editor.md

MSG="$(cat <<'EOF'
chore(*): add git-commits skill and strip co-author trailers

Add git-commits skill mirrors, husky commit-msg guard, and batch-commit doc updates.
EOF
)"
commit \
  .agent/skills/git-commits/SKILL.md \
  .claude/skills/git-commits \
  .cursor/skills/git-commits \
  .agent/skills/batch-commit/SKILL.md \
  .agent/skills/github-issues/SKILL.md \
  .cursor/rules/git-commits.mdc \
  .husky/commit-msg \
  scripts/dev/strip-co-authors-from-history.sh \
  scripts/dev/strip-commit-co-author-trailers.sh

MSG="$(cat <<'EOF'
chore(*): sync agent commands env scripts and deno lock

Update kh-submit-for-review copy, env sync scripts, and seed analytics demo SQL.
EOF
)"
commit \
  .claude/README.md \
  .claude/commands/kh-submit-for-review.md \
  .claude/settings.json \
  .cursor/commands/kh-submit-for-review.md \
  .cursor/rules/README.md \
  CLAUDE.md \
  deno.lock \
  scripts/README.md \
  scripts/dev/reorganize-env-files.mjs \
  scripts/dev/seed-analytics-demo-data.sql \
  scripts/dev/sync-dev-env.mjs

echo "Done: 15 commits"
