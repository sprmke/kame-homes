#!/usr/bin/env bash
# UserPromptSubmit (Claude Code): activate Superpowers lean mode and inject constraints.
# Cursor uses the same script via .cursor/hooks/superpowers-lean-mode.sh on beforeSubmitPrompt.

set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
# shellcheck source=../../scripts/dev/superpowers-lean-lib.sh
source "$ROOT/scripts/dev/superpowers-lean-lib.sh"

input=$(cat)
prompt=""
event=""

if command -v jq >/dev/null 2>&1; then
  prompt=$(echo "$input" | jq -r '.prompt // .user_prompt // empty')
  event=$(echo "$input" | jq -r '.hook_event_name // empty')
else
  prompt=$(echo "$input" | grep -oE '"(prompt|user_prompt)":"[^"]*"' | head -1 | sed 's/^"[^"]*":"//;s/"$//' | sed 's/\\"/"/g' || true)
  event=$(echo "$input" | grep -o '"hook_event_name":"[^"]*"' | head -1 | sed 's/"hook_event_name":"//;s/"$//' || true)
fi

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

mode=""
if mode=$(superpowers_lean_detect_mode "$prompt"); then
  superpowers_lean_activate "$ROOT" "$mode"
  ctx=$(superpowers_lean_constraints_text "$mode")
  escaped=$(escape_for_json "$ctx")
  printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' "$escaped"
  exit 0
fi

if superpowers_lean_is_active "$ROOT"; then
  ctx=$(superpowers_lean_constraints_text)
  escaped=$(escape_for_json "$ctx")
  printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' "$escaped"
  exit 0
fi

echo '{}'
