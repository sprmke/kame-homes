#!/usr/bin/env bash
# preToolUse hook: enforces "never edit a shipped migration, add a new one"
# (.cursor/rules/booking-workflow.mdc §7, .cursor/rules/supabase-edge-functions.mdc).
#
# Denies any write to an *existing* file under supabase/migrations/. Creating a new migration
# file is allowed, so the guard cannot depend on the tool matcher being honored — Cursor has
# been observed running preToolUse hooks for tools outside their declared matcher.
#
# Reads Cursor's preToolUse JSON from stdin: {"tool_name":"StrReplace","tool_input":{"path":"..."},...}
# Ported from .claude/hooks/guard-shipped-migrations.sh (Claude's PreToolUse/Edit matcher).
#
# Limitation: Cursor's preToolUse output schema documents "ask" as accepted-but-unenforced, so
# this hook must use a hard "deny" (no interactive confirm path like the Claude version implies).

set -e
input=$(cat)
if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.tool_input.path // .tool_input.file_path // empty')
else
  file_path=$(echo "$input" | grep -o '"path":"[^"]*"' | head -1 | sed 's/"path":"//;s/"$//')
fi

if [[ -f "$file_path" ]] &&
  [[ "$file_path" == *"/supabase/migrations/"* || "$file_path" == supabase/migrations/* ]]; then
  reason="Editing a shipped migration under supabase/migrations/ is not allowed — add a new migration file instead (see .cursor/rules/booking-workflow.mdc)."
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg reason "$reason" '{permission: "deny", user_message: $reason, agent_message: $reason}'
  else
    printf '{"permission":"deny","user_message":"%s","agent_message":"%s"}' "$reason" "$reason"
  fi
else
  echo '{"permission":"allow"}'
fi
