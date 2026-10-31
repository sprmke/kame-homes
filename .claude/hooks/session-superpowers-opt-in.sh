#!/usr/bin/env bash
# Reinforce Superpowers opt-in + repo workflow doc paths.
# See .cursor/rules/superpowers-opt-in.mdc and .agent/skills/superpowers/SKILL.md

set -euo pipefail

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

context=$'SUPERPOWERS OPT-IN (this repo)\n\nSuperpowers auto-workflows are OFF unless the user runs /superpowers-* or explicitly asks.\n\nDo NOT auto-invoke superpowers:brainstorming, writing-plans, executing-plans, etc.\n\nWhen Superpowers IS allowed:\n- Plans → docs/workflow/planned/<slug>.md (no YYYY-MM-DD- prefix)\n- Specs → docs/workflow/intake/<slug>-design.md\n- Read .agent/skills/superpowers/SKILL.md for path overrides and § Lean mode.\n- /superpowers-plan|brainstorm|debug|execute → hooks block subagents (see guard-superpowers-subagents.sh).\n\nRetired folders (must not exist): docs/superpowers/, docs/planning/, docs/todos/ — GitHub backlog is in docs/README.md.'

escaped=$(escape_for_json "$context")
printf '{\n  "additional_context": "%s"\n}\n' "$escaped"
