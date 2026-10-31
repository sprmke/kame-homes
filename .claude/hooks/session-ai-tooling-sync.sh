#!/usr/bin/env bash
# Warn-only SessionStart check: Cursor/Claude/OpenCode AI tooling drift.
# See scripts/dev/check-ai-tooling-sync.sh (also blocking in .husky/pre-commit).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if bash "$ROOT/scripts/dev/check-ai-tooling-sync.sh" >/dev/null 2>&1; then
  status="AI tooling sync: OK (Cursor/Claude/OpenCode skills, commands, agents, hooks, mcp in sync)."
else
  status="AI tooling sync: DRIFT DETECTED — run 'bun run check:ai-tooling-sync' for details."
fi

if command -v jq >/dev/null 2>&1; then
  jq -n --arg msg "$status" \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $msg}}'
else
  escaped="${status//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  printf '{"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "%s"}}\n' "$escaped"
fi
