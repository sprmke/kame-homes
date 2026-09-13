#!/usr/bin/env bash
# afterFileEdit: after a UI edit under ui/src, remind the agent to follow mobile-native patterns.
# Never blocks the edit. Mirrors .claude/hooks/remind-mobile-native-on-ui-edit.sh.

set -e
input=$(cat)

if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.file_path // empty')
else
  file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"$//')
fi

[[ -z "$file_path" ]] && { echo '{}'; exit 0; }

norm="${file_path#/}"

case "$norm" in
  ui/src/*.tsx|ui/src/*.ts|*/ui/src/*.tsx|*/ui/src/*.ts) ;;
  *) echo '{}'; exit 0 ;;
esac

case "$norm" in
  *'/docs/'*|docs/*|*'/.cursor/rules/'*|*'/.agent/skills/'*)
    echo '{}'
    exit 0
    ;;
esac

MSG="Mobile-native UI reminder: you edited ${file_path}. On max-lg use bottom sheets and shared mobile primitives (ResponsiveModal, MobileChoiceSheet, ResponsiveOverflowMenu, BottomTabBar, ContextualActionBar) — not centered Dialog or floating DropdownMenu. Invoke mobile-responsive skill before claiming UI done."

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

escaped=$(escape_for_json "$MSG")
printf '{\n  "additional_context": "%s"\n}\n' "$escaped"
