#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

c() { git commit -m "$MSG"; }

MSG="$(cat <<'EOF'
database(supabase): add super admin ai usage rollups

Materialized daily rollups for platform AI cost and generation metrics.
EOF
)"
git add -- supabase/migrations/20261316126700_super_admin_ai_usage_rollups.sql
c

MSG="$(cat <<'EOF'
feat(supabase): extend super admin ai usage console summary

Roll up org usage for the AI console and tighten feedback/eval queries.
EOF
)"
git add -- \
  supabase/functions/_shared/aiUsageConsoleSummary.ts \
  supabase/functions/_shared/aiUsageConsoleSummary_test.ts \
  supabase/functions/super-admin-ai-usage/index.ts \
  scripts/dev/check-unbounded-select.sh
c

MSG="$(cat <<'EOF'
feat(admin): polish super admin ai usage dashboard

Feature labels, usage tab layout, cost chart, and route wiring.
EOF
)"
git add -- \
  ui/src/features/dashboard/super-admin/lib/aiFeatureLabels.ts \
  ui/src/features/dashboard/super-admin/lib/aiFeatureLabels.test.ts \
  ui/src/features/dashboard/super-admin/components/super-admin-ai/AiUsageTab.tsx \
  ui/src/features/dashboard/super-admin/components/super-admin-overview/SuperAdminAiCostChart.tsx \
  ui/src/features/dashboard/super-admin/routes/index.tsx
c

MSG="$(cat <<'EOF'
feat(ui): redesign host dashboard film scenes

Replace five-act scenes with chapter-based film and updated tour player.
EOF
)"
git add -- \
  ui/src/features/guest/marketing/for-hosts/components/HostDashboardFilm.tsx \
  ui/src/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/FilmPrimitives.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/FilmShell.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneAct1.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneAct2.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneAct3.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneAct4.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneAct5.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneBookends.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneBookings.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneGuestSite.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneGuests.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneMarketing.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneMoney.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneStart.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/SceneTeam.tsx \
  ui/src/features/guest/marketing/for-hosts/components/film/scenes/filmScenes.ts \
  ui/src/features/guest/marketing/for-hosts/data/hostTourChapters.ts \
  ui/src/features/guest/marketing/for-hosts/data/hostTourChapters.test.ts \
  ui/src/features/guest/marketing/for-hosts/data/hostTourNarration.ts \
  ui/src/features/guest/marketing/for-hosts/preview/components/VideoTourSection.tsx \
  ui/src/features/guest/marketing/for-hosts/preview/data/hostShowcase.ts
c

MSG="$(cat <<'EOF'
feat(ui): refresh host tour narration tracks

Regenerate chapter audio, captions, and manifest for the redesigned film.
EOF
)"
git add -- ui/public/marketing/for-hosts/narration/
c

MSG="$(cat <<'EOF'
chore(*): add marketing social creative render package

Remotion-based stills and short videos for host marketing social assets.
EOF
)"
git add -- marketing/social/
c

MSG="$(cat <<'EOF'
chore(*): add social creative skill and narration script

Wire agent skill docs and the host tour narration generation script.
EOF
)"
git add -- \
  .agent/skills/social-creative/ \
  .claude/skills/social-creative \
  .cursor/rules/social-creative.mdc \
  .cursor/skills/social-creative \
  .claude/README.md \
  .cursor/rules/README.md \
  scripts/README.md \
  scripts/marketing/generate-host-tour-narration.ts \
  scripts/dev/batch-commit-run-9.sh
c

MSG="$(cat <<'EOF'
docs(docs): sync architecture and host-facing route guides

Update data model, routing, edge functions, and for-hosts tour docs.
EOF
)"
git add -- \
  docs/README.md \
  docs/architecture/data-model.md \
  docs/architecture/edge-functions.md \
  docs/architecture/routing.md \
  docs/guides/routes/admin/ai.md \
  docs/guides/routes/for-hosts.md \
  docs/workflow/planned/multi-residence-config-decoupling.md
c

MSG="$(cat <<'EOF'
docs(docs): add host tour film redesign testing notes

Document for-testing coverage for the film redesign and video quality work.
EOF
)"
git add -- \
  docs/workflow/for-testing/README.md \
  docs/workflow/for-testing/marketing-ai-video-quality.md \
  docs/workflow/for-testing/host-tour-film-redesign.md
c

echo "batch-commit-run-9 done"
