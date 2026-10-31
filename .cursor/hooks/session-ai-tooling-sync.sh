#!/usr/bin/env bash
# Warn-only session-start check: Cursor/Claude/OpenCode AI tooling drift.
# See scripts/dev/check-ai-tooling-sync.sh (also blocking in .husky/pre-commit).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

if bash "$ROOT/scripts/dev/check-ai-tooling-sync.sh" >/dev/null 2>&1; then
  status="AI tooling sync: OK (Cursor/Claude/OpenCode skills, commands, agents, hooks, mcp in sync)."
else
  status="AI tooling sync: DRIFT DETECTED — run 'bun run check:ai-tooling-sync' for details."
fi

escaped=$(escape_for_json "$status")
printf '{\n  "additional_context": "%s"\n}\n' "$escaped"
