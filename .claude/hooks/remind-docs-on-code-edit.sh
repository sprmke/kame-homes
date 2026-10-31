#!/usr/bin/env bash
# PostToolUse (Edit|Write): after a material code edit (UI / edge / migrations), remind
# the agent to update matching docs in the same change. Never blocks the edit.
#
# Reads Claude Code's PostToolUse JSON from stdin: {"tool_input": {"file_path": "..."}, ...}

set -e
input=$(cat)

if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
else
  file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"$//')
fi

[[ -z "$file_path" ]] && { echo '{}'; exit 0; }

# Normalize to repo-relative-ish path for matching
norm="${file_path#/}"

is_code_path=0
case "$norm" in
  *'/ui/src/'*|ui/src/*|*'/supabase/functions/'*|supabase/functions/*|*'/supabase/migrations/'*|supabase/migrations/*)
    is_code_path=1
    ;;
esac

# Already editing docs — no reminder
case "$norm" in
  *'/docs/'*|docs/*|*'/CLAUDE.md'|CLAUDE.md|*'/.cursor/rules/'*|*'/.agent/skills/'*)
    echo '{}'
    exit 0
    ;;
esac

if [[ "$is_code_path" -eq 0 ]]; then
  echo '{}'
  exit 0
fi

MSG="Docs sync reminder: you edited ${file_path}. If this changes behavior/API/UX, update matching docs in this same change (documentation-maintenance + route-guides skills). Route guides → docs/guides/routes/; API/env → docs/PROJECT.md. Do not claim done with docs deferred."

if command -v jq >/dev/null 2>&1; then
  jq -n --arg msg "$MSG" \
    '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'
  exit 0
fi

echo "$MSG" >&2
echo '{}'
