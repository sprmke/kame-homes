#!/usr/bin/env bash
# Deny subagents while Superpowers lean mode is active.
# Cursor: subagentStart · Claude Code: PreToolUse (Task)

set -euo pipefail

ROOT="${CURSOR_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}}"
# shellcheck source=../../scripts/dev/superpowers-lean-lib.sh
source "$ROOT/scripts/dev/superpowers-lean-lib.sh"

input=$(cat)
event=""
tool_name=""

if command -v jq >/dev/null 2>&1; then
  event=$(echo "$input" | jq -r '.hook_event_name // empty')
  tool_name=$(echo "$input" | jq -r '.tool_name // .tool // empty')
else
  event=$(echo "$input" | grep -o '"hook_event_name":"[^"]*"' | head -1 | sed 's/"hook_event_name":"//;s/"$//' || true)
  tool_name=$(echo "$input" | grep -oE '"(tool_name|tool)":"[^"]*"' | head -1 | sed 's/^"[^"]*":"//;s/"$//' || true)
fi

should_block=false
if [[ "$event" == "subagentStart" ]]; then
  should_block=true
elif [[ "$event" == "PreToolUse" && "$tool_name" == "Task" ]]; then
  should_block=true
fi

if [[ "$should_block" == true ]] && superpowers_lean_is_active "$ROOT"; then
  reason=$(superpowers_lean_deny_message)
  if command -v jq >/dev/null 2>&1; then
    if [[ "$event" == "PreToolUse" ]]; then
      jq -n --arg reason "$reason" \
        '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
    else
      jq -n --arg reason "$reason" '{permission: "deny", user_message: $reason}'
    fi
  else
    if [[ "$event" == "PreToolUse" ]]; then
      printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$reason"
    else
      printf '{"permission":"deny","user_message":"%s"}\n' "$reason"
    fi
  fi
  exit 0
fi

if [[ "$event" == "PreToolUse" ]]; then
  echo '{}'
else
  echo '{"permission":"allow"}'
fi
