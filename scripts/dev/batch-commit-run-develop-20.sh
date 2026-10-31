#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

c() {
  git commit -m "$MSG"
}

MSG="$(cat <<'EOF'
database(supabase): add ai llm and marketing prompt migrations

Ship prompt enhancement, voice backfill, and ai hardening schema updates.
EOF
)"
git add -- \
  supabase/migrations/20261316122200_marketing_generation_prompt_enhancement.sql \
  supabase/migrations/20261316122360_voice_receptionist_reapply_legacy_backfill.sql \
  supabase/migrations/20261316123050_ai_llm_hardening.sql
c

MSG="$(cat <<'EOF'
feat(supabase): harden ai llm stack in shared services

Centralize llm transport, quotas, marketing, inbox, assistant, and sentry helpers.
EOF
)"
git add -A -- supabase/functions/_shared/
c

MSG="$(cat <<'EOF'
feat(supabase): wire ai platform edge handlers and deno lock

Update ai, analytics, marketing, inbox, and assistant function entrypoints.
EOF
)"
git add -A -- \
  supabase/functions/activity-log-retention-cron \
  supabase/functions/ai-platform-settings \
  supabase/functions/analytics-ai-review-cron \
  supabase/functions/analytics-ai-review \
  supabase/functions/analytics-org-summary \
  supabase/functions/analytics-summary \
  supabase/functions/booking-ai-review \
  supabase/functions/dashboard-assistant-chat \
  supabase/functions/dashboard-assistant-confirm \
  supabase/functions/finance-line-items \
  supabase/functions/generate-marketing-caption \
  supabase/functions/generate-marketing-media \
  supabase/functions/generate-marketing-template \
  supabase/functions/import-ai-map-columns \
  supabase/functions/maintenance-items \
  supabase/functions/meta-inbox-webhook \
  supabase/functions/property-page-views-prune-cron \
  supabase/functions/social-inbox-ai-suggest \
  supabase/functions/social-inbox-messages \
  supabase/functions/super-admin-ai-usage \
  supabase/functions/validate-booking-receipts \
  supabase/functions/deno.json \
  supabase/functions/deno.lock \
  supabase/.env.example
c

MSG="$(cat <<'EOF'
test(supabase): add ai eval harness and refresh ocr regression

Add offline eval datasets and extend handler tests for assistant tooling.
EOF
)"
git add -A -- supabase/functions/tests/
c

MSG="$(cat <<'EOF'
feat(ui): refresh org and property analytics views

Update kpi cards, comparison table, and remove legacy teaser strip.
EOF
)"
git add -A -- \
  ui/src/features/dashboard/analytics/ \
  ui/src/features/dashboard/org/routes/index.tsx
c

MSG="$(cat <<'EOF'
feat(ui): harden marketing ai studio composer flow

Update generation hooks, job cards, options, and colocated unit tests.
EOF
)"
git add -A -- ui/src/features/dashboard/marketing/
c

MSG="$(cat <<'EOF'
feat(ui): update bookings workflow and inbox guest chat

Adjust workflow panel, transitions, inbox thread, and guest chat limits.
EOF
)"
git add -A -- \
  ui/src/features/dashboard/bookings/ \
  ui/src/features/dashboard/inbox/ \
  ui/src/features/guest/chat/ \
  ui/src/features/guest/marketing/shared/components/MarketingMoreSheet.tsx \
  ui/src/lib/chat/
c

MSG="$(cat <<'EOF'
feat(ui): update plans gates super-admin usage and app shell

Refresh plan presentation, permissions catalog, sentry, and route fallbacks.
EOF
)"
git add -A -- \
  ui/src/features/dashboard/plans/ \
  ui/src/features/dashboard/super-admin/ \
  ui/src/features/dashboard/team/lib/propertyPermissionCatalog.ts \
  ui/src/components/error/AppErrorBoundary.tsx \
  ui/src/components/routing/RouteFallback.tsx \
  ui/src/components/skeletons/AdminSkeletons.tsx \
  ui/src/components/ui/bottom-sheet.tsx \
  ui/src/components/ui/sheet.tsx \
  ui/src/components/branding/AppLoader.tsx \
  ui/src/lib/sentry/ \
  ui/vercel.json
c

MSG="$(cat <<'EOF'
ci: extend quality gate and cd workflows for ai evals

Update package scripts, ci-quality-gate, and github workflow steps.
EOF
)"
git add -- \
  package.json \
  scripts/dev/ci-quality-gate.sh \
  scripts/dev/check-ai-gateway.mjs \
  .github/workflows/ci.yml \
  .github/workflows/cd-dev.yml
c

MSG="$(cat <<'EOF'
docs(docs): sync architecture guides and workflow plans

Update project index, ai platform docs, route guides, and qa notes.
EOF
)"
git add -A -- docs/
git reset HEAD -- docs/workflow/intake/_to-plan.md docs/workflow/intake/_to-prompt.md docs/personal/ 2>/dev/null || true
c

MSG="$(cat <<'EOF'
chore(*): sync agent skills cursor rules and claude entry

Refresh docs-first skills, documentation gates, and booking workflow rule.
EOF
)"
git add -- \
  .agent/skills/docs-first/SKILL.md \
  .agent/skills/documentation-maintenance/SKILL.md \
  .cursor/rules/booking-workflow.mdc \
  .cursor/rules/documentation-maintenance.mdc \
  .cursor/rules/project-context.mdc \
  CLAUDE.md \
  .codex/hooks.json
c

MSG="$(cat <<'EOF'
chore(*): add batch commit runner scripts for develop

Check in batch-commit-run helpers used for staged daily commits.
EOF
)"
git add -- \
  scripts/dev/batch-commit-run-8.sh \
  scripts/dev/batch-commit-run-12.sh \
  scripts/dev/batch-commit-run-15.sh \
  scripts/dev/batch-commit-run-20.sh \
  scripts/dev/batch-commit-run-20b.sh \
  scripts/dev/batch-commit-run-develop-20.sh
c

MSG="$(cat <<'EOF'
chore(deps): upgrade impeccable skill core and agent configs

Sync SKILL.md and subagent toml definitions with vendor impeccable release.
EOF
)"
git add -- \
  .agents/skills/impeccable/SKILL.md \
  .agents/skills/impeccable/agents/impeccable_asset_producer.toml \
  .agents/skills/impeccable/agents/impeccable_documenter.toml \
  .agents/skills/impeccable/agents/impeccable_finish_reviewer.toml \
  .agents/skills/impeccable/agents/impeccable_manual_edit_applier.toml
c

MSG="$(cat <<'EOF'
chore(deps): sync impeccable reference guides batch 1

Update android through craft-floor reference docs for native and web.
EOF
)"
git add -- \
  .agents/skills/impeccable/reference/android.md \
  .agents/skills/impeccable/reference/animate.md \
  .agents/skills/impeccable/reference/audit.native.md \
  .agents/skills/impeccable/reference/bolder.md \
  .agents/skills/impeccable/reference/craft-floor.md \
  .agents/skills/impeccable/reference/critique.md \
  .agents/skills/impeccable/reference/distill.md \
  .agents/skills/impeccable/reference/doctor.md \
  .agents/skills/impeccable/reference/document.md
c

MSG="$(cat <<'EOF'
chore(deps): sync impeccable reference guides batch 2

Update extract through live-setup reference guides.
EOF
)"
git add -- \
  .agents/skills/impeccable/reference/extract.md \
  .agents/skills/impeccable/reference/hooks.md \
  .agents/skills/impeccable/reference/init.md \
  .agents/skills/impeccable/reference/ios.md \
  .agents/skills/impeccable/reference/layout.md \
  .agents/skills/impeccable/reference/live-setup.md \
  .agents/skills/impeccable/reference/live.md \
  .agents/skills/impeccable/reference/new-work.md \
  .agents/skills/impeccable/reference/overdrive.md
c

MSG="$(cat <<'EOF'
chore(deps): sync impeccable reference guides batch 3

Update polish through visualize and degraded agent reference guides.
EOF
)"
git add -- \
  .agents/skills/impeccable/reference/polish.md \
  .agents/skills/impeccable/reference/quieter.md \
  .agents/skills/impeccable/reference/routing.md \
  .agents/skills/impeccable/reference/typeset.md \
  .agents/skills/impeccable/reference/visualize.md \
  .agents/skills/impeccable/reference/degraded/asset-producer.md \
  .agents/skills/impeccable/reference/degraded/documenter.md \
  .agents/skills/impeccable/reference/degraded/finish-reviewer.md \
  .agents/skills/impeccable/reference/degraded/manual-edit-applier.md
c

MSG="$(cat <<'EOF'
chore(deps): add impeccable cli binary and browser scripts

Ship vendor CLI entrypoints, font index data, and live browser helpers.
EOF
)"
git add -A -- .agents/skills/impeccable/scripts/
c

echo "Batch develop-20 complete"
