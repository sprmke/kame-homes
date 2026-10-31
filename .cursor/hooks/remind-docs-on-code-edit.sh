#!/usr/bin/env bash
# afterFileEdit: after a material code edit (UI / edge / migrations), remind the agent
# to update matching docs in the same change. Never blocks the edit.
# Mirrors .claude/hooks/remind-docs-on-code-edit.sh (Cursor afterFileEdit shape: file_path at top level).

set -e
input=$(cat)

if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.file_path // empty')
else
  file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"$//')
fi

[[ -z "$file_path" ]] && { echo '{}'; exit 0; }

norm="${file_path#/}"

is_code_path=0
case "$norm" in
  *'/ui/src/'*|ui/src/*|*'/supabase/functions/'*|supabase/functions/*|*'/supabase/migrations/'*|supabase/migrations/*)
    is_code_path=1
    ;;
esac

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

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

escaped=$(escape_for_json "$MSG")
printf '{\n  "additional_context": "%s"\n}\n' "$escaped"
