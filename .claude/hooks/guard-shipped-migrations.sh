#!/usr/bin/env bash
# PreToolUse hook: enforces "never edit a shipped migration, add a new one"
# (.cursor/rules/booking-workflow.mdc §7, .cursor/rules/supabase-edge-functions.mdc).
#
# Denies any write to an *existing* file under supabase/migrations/. Creating a new migration
# file is allowed, so the guard cannot depend on the tool matcher being honored — the OpenCode
# plugin routes Write through this same script.
#
# Reads Claude Code's PreToolUse JSON from stdin: {"tool_input": {"file_path": "..."}, ...}

set -e
input=$(cat)
if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
else
  file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"$//')
fi

if [[ -f "$file_path" ]] &&
  [[ "$file_path" == *"/supabase/migrations/"* || "$file_path" == supabase/migrations/* ]]; then
  reason="Editing a shipped migration under supabase/migrations/ is not allowed — add a new migration file instead (see .cursor/rules/booking-workflow.mdc)."
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg reason "$reason" \
      '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  else
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}' "$reason"
  fi
else
  echo '{}'
fi
