#!/usr/bin/env bash
# SessionStart: remind agents that docs must update in the same change as code.
# Claude Code cannot auto-load alwaysApply .mdc rules — this injects the mandate every session.
set -uo pipefail

MSG='DOCS SYNC (mandatory): Material code/behavior changes must update matching docs in the SAME change — not later. Route/page UX → docs/guides/routes/* (route-guides skill). API/env/architecture → docs/PROJECT.md. Plans/tiers → docs/architecture/plans-feature-matrix.md + Plans guides. New host capabilities → decide Plans + Team RBAC (or N/A) via plans-and-permissions skill. Booking/auth invariants → .cursor/rules/booking-workflow.mdc or admin-auth.mdc. Invoke documentation-maintenance skill before claiming done. Canonical: CLAUDE.md § Docs are the source of truth · .cursor/rules/documentation-maintenance.mdc.'

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

escaped=$(escape_for_json "$MSG")
printf '{\n  "additional_context": "%s"\n}\n' "$escaped"
