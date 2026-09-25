#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

MSG="$(cat <<'EOF'
refactor(supabase): extend shared http response helpers

Add typed helpers and tests used by edge handlers for consistent json errors.
EOF
)"
git add -- \
  supabase/functions/_shared/httpResponse.ts \
  supabase/functions/_shared/httpResponse_test.ts
git commit -m "$MSG"

commit() {
  git add -- "$@"
  git commit -m "$MSG"
}

MSG="$(cat <<'EOF'
chore(*): sync docs-first and documentation-maintenance skills

Point documentation skills at architecture phase 1 overview and routing docs.
EOF
)"
commit \
  .agent/skills/docs-first/SKILL.md \
  .agent/skills/documentation-maintenance/SKILL.md

MSG="$(cat <<'EOF'
docs(docs): refresh architecture overview and project index

Update PROJECT, docs README, and architecture overview for phase 1 doc split.
EOF
)"
commit \
  docs/PROJECT.md \
  docs/README.md \
  docs/architecture/overview.md \
  docs/architecture/edge-functions.md \
  docs/workflow/qa/property-dashboard/09-inbox.md \
  docs/workflow/qa/property-dashboard/11-templates.md \
  docs/workflow/qa/property-dashboard/12-public-pages.md

MSG="$(cat <<'EOF'
chore(*): sync claude and cursor project context rules

Update CLAUDE.md, documentation-maintenance gate, and project-context pointers.
EOF
)"
commit \
  CLAUDE.md \
  .cursor/rules/documentation-maintenance.mdc \
  .cursor/rules/project-context.mdc \
  .codex/hooks.json

MSG="$(cat <<'EOF'
chore(*): add batch commit session runner scripts

Check in dev batch-commit-run helpers used for staged daily commits.
EOF
)"
commit \
  scripts/dev/batch-commit-run-8.sh \
  scripts/dev/batch-commit-run-12.sh \
  scripts/dev/batch-commit-run-15.sh \
  scripts/dev/batch-commit-run-20.sh \
  scripts/dev/batch-commit-run-20b.sh

MSG="$(cat <<'EOF'
chore(deps): upgrade impeccable skill core and agent configs

Sync SKILL.md and subagent toml definitions with vendor impeccable release.
EOF
)"
commit \
  .agents/skills/impeccable/SKILL.md \
  .agents/skills/impeccable/agents/impeccable_asset_producer.toml \
  .agents/skills/impeccable/agents/impeccable_documenter.toml \
  .agents/skills/impeccable/agents/impeccable_finish_reviewer.toml \
  .agents/skills/impeccable/agents/impeccable_manual_edit_applier.toml

add_ref_batch() {
  git add -- "$@"
}

MSG="$(cat <<'EOF'
chore(deps): sync impeccable reference guides batch 1

Update adapt, audit, animate, and layout reference docs for native and web.
EOF
)"
add_ref_batch \
  .agents/skills/impeccable/reference/adapt.md \
  .agents/skills/impeccable/reference/adapt.native.md \
  .agents/skills/impeccable/reference/android.md \
  .agents/skills/impeccable/reference/animate.md \
  .agents/skills/impeccable/reference/audit.md \
  .agents/skills/impeccable/reference/audit.native.md \
  .agents/skills/impeccable/reference/bolder.md \
  .agents/skills/impeccable/reference/colorize.md
git commit -m "$MSG"

MSG="$(cat <<'EOF'
chore(deps): sync impeccable reference guides batch 2

Update craft, critique, distill, doctor, and document reference guides.
EOF
)"
add_ref_batch \
  .agents/skills/impeccable/reference/craft-floor.md \
  .agents/skills/impeccable/reference/critique.md \
  .agents/skills/impeccable/reference/distill.md \
  .agents/skills/impeccable/reference/doctor.md \
  .agents/skills/impeccable/reference/document.md \
  .agents/skills/impeccable/reference/extract.md \
  .agents/skills/impeccable/reference/harden.md \
  .agents/skills/impeccable/reference/hooks.md
git commit -m "$MSG"

MSG="$(cat <<'EOF'
chore(deps): sync impeccable reference guides batch 3

Update init, ios, layout, live, and onboard reference guides.
EOF
)"
add_ref_batch \
  .agents/skills/impeccable/reference/init.md \
  .agents/skills/impeccable/reference/ios.md \
  .agents/skills/impeccable/reference/layout.md \
  .agents/skills/impeccable/reference/live-setup.md \
  .agents/skills/impeccable/reference/live.md \
  .agents/skills/impeccable/reference/new-work.md \
  .agents/skills/impeccable/reference/onboard.md \
  .agents/skills/impeccable/reference/optimize.md
git commit -m "$MSG"

MSG="$(cat <<'EOF'
chore(deps): sync impeccable reference guides batch 4

Update overdrive, polish, quieter, routing, typeset, and visualize guides.
EOF
)"
add_ref_batch \
  .agents/skills/impeccable/reference/overdrive.md \
  .agents/skills/impeccable/reference/polish.md \
  .agents/skills/impeccable/reference/quieter.md \
  .agents/skills/impeccable/reference/routing.md \
  .agents/skills/impeccable/reference/typeset.md \
  .agents/skills/impeccable/reference/visualize.md \
  .agents/skills/impeccable/reference/degraded/asset-producer.md \
  .agents/skills/impeccable/reference/degraded/documenter.md \
  .agents/skills/impeccable/reference/degraded/finish-reviewer.md \
  .agents/skills/impeccable/reference/degraded/manual-edit-applier.md
git commit -m "$MSG"

MSG="$(cat <<'EOF'
chore(deps): add impeccable cli binary and font index data

Ship vendor CLI entrypoints, VERSION stamp, and bundled font index JSON.
EOF
)"
commit \
  .agents/skills/impeccable/scripts/VERSION \
  .agents/skills/impeccable/scripts/command-metadata.json \
  .agents/skills/impeccable/scripts/impeccable \
  .agents/skills/impeccable/scripts/impeccable.cmd \
  .agents/skills/impeccable/scripts/bin/darwin-arm64/impeccable \
  .agents/skills/impeccable/scripts/data/font-index.json \
  .agents/skills/impeccable/scripts/data/font-index-failures.json \
  .agents/skills/impeccable/scripts/live-browser-dom.js \
  .agents/skills/impeccable/scripts/live-browser-session.js \
  .agents/skills/impeccable/scripts/live-browser.js \
  .agents/skills/impeccable/scripts/live-browser-ignores.js \
  .agents/skills/impeccable/scripts/modern-screenshot.umd.js

MSG="$(cat <<'EOF'
chore(deps): sync impeccable detector scripts tree

Replace legacy detector CLI scripts with vendor impeccable detector bundle.
EOF
)"
git add -A -- .agents/skills/impeccable/scripts/detector
git add -A -- \
  .agents/skills/impeccable/scripts/detect.mjs \
  .agents/skills/impeccable/scripts/detect-csp.mjs \
  .agents/skills/impeccable/scripts/doctor.mjs \
  .agents/skills/impeccable/scripts/concept-seed.mjs \
  .agents/skills/impeccable/scripts/context.mjs \
  .agents/skills/impeccable/scripts/context-signals.mjs \
  .agents/skills/impeccable/scripts/critique-storage.mjs
git commit -m "$MSG"

MSG="$(cat <<'EOF'
chore(deps): sync impeccable live session scripts batch 1

Update live browser helpers and live framework adapter scripts.
EOF
)"
git add -A -- .agents/skills/impeccable/scripts/live/frameworks
git add -A -- \
  .agents/skills/impeccable/scripts/live/accept-css.mjs \
  .agents/skills/impeccable/scripts/live/accept-verify.mjs \
  .agents/skills/impeccable/scripts/live/browser-script-parts.mjs \
  .agents/skills/impeccable/scripts/live/completion.mjs \
  .agents/skills/impeccable/scripts/live/event-validation.mjs \
  .agents/skills/impeccable/scripts/live/generation-preflight.mjs \
  .agents/skills/impeccable/scripts/live/insert-ui.mjs \
  .agents/skills/impeccable/scripts/live/instructions.mjs \
  .agents/skills/impeccable/scripts/live/manual-apply.mjs \
  .agents/skills/impeccable/scripts/live/manual-edit-routes.mjs
git commit -m "$MSG"

MSG="$(cat <<'EOF'
chore(deps): sync impeccable live session scripts batch 2

Update live manual edit buffers, poll lanes, and svelte kit adapters.
EOF
)"
git add -A -- \
  .agents/skills/impeccable/scripts/live/manual-edits-buffer.mjs \
  .agents/skills/impeccable/scripts/live/poll-lanes.mjs \
  .agents/skills/impeccable/scripts/live/roots.mjs \
  .agents/skills/impeccable/scripts/live/session-store.mjs \
  .agents/skills/impeccable/scripts/live/source-lock.mjs \
  .agents/skills/impeccable/scripts/live/source-search.mjs \
  .agents/skills/impeccable/scripts/live/svelte-ast.mjs \
  .agents/skills/impeccable/scripts/live/svelte-component.mjs \
  .agents/skills/impeccable/scripts/live/sveltekit-adapter.mjs \
  .agents/skills/impeccable/scripts/live/tanstack-adapter.mjs \
  .agents/skills/impeccable/scripts/live/ui-core.mjs \
  .agents/skills/impeccable/scripts/live/vocabulary.mjs
git commit -m "$MSG"

MSG="$(cat <<'EOF'
chore(deps): sync impeccable live root scripts batch 3

Replace legacy live.mjs entry scripts with vendor live orchestration modules.
EOF
)"
git add -A -- \
  .agents/skills/impeccable/scripts/live.mjs \
  .agents/skills/impeccable/scripts/live-accept.mjs \
  .agents/skills/impeccable/scripts/live-commit-manual-edits.mjs \
  .agents/skills/impeccable/scripts/live-complete.mjs \
  .agents/skills/impeccable/scripts/live-copy-edit-agent.mjs \
  .agents/skills/impeccable/scripts/live-discard-manual-edits.mjs \
  .agents/skills/impeccable/scripts/live-inject.mjs \
  .agents/skills/impeccable/scripts/live-insert.mjs \
  .agents/skills/impeccable/scripts/live-manual-edit-evidence.mjs \
  .agents/skills/impeccable/scripts/live-poll.mjs \
  .agents/skills/impeccable/scripts/live-resume.mjs \
  .agents/skills/impeccable/scripts/live-server.mjs \
  .agents/skills/impeccable/scripts/live-status.mjs \
  .agents/skills/impeccable/scripts/live-target.mjs \
  .agents/skills/impeccable/scripts/live-wrap.mjs
git commit -m "$MSG"

MSG="$(cat <<'EOF'
chore(deps): sync impeccable shared lib scripts

Update impeccable lib helpers for config, staleness, and surface briefs.
EOF
)"
git add -A -- .agents/skills/impeccable/scripts/lib
git commit -m "$MSG"

MSG="$(cat <<'EOF'
chore(deps): remove legacy impeccable hook and palette scripts

Drop superseded hook.mjs and palette scripts replaced by impeccable CLI.
EOF
)"
git add -A -- \
  .agents/skills/impeccable/scripts/embed-prompt.mjs \
  .agents/skills/impeccable/scripts/generate-image.mjs \
  .agents/skills/impeccable/scripts/hook.mjs \
  .agents/skills/impeccable/scripts/hook-admin.mjs \
  .agents/skills/impeccable/scripts/hook-before-edit.mjs \
  .agents/skills/impeccable/scripts/hook-lib.mjs \
  .agents/skills/impeccable/scripts/palette.mjs \
  .agents/skills/impeccable/scripts/pin.mjs \
  .agents/skills/impeccable/scripts/serve-question.mjs \
  .agents/skills/impeccable/scripts/surface-brief.mjs
git commit -m "$MSG"

echo "Done"
