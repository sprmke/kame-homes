#!/usr/bin/env bash
# SessionStart: remind agents that UI changes must follow mobile-native patterns.
# Mirrors .claude/hooks/session-mobile-native-ui-reminder.sh (Claude SessionStart shape).
set -uo pipefail

MSG='MOBILE-NATIVE UI (mandatory for ui/src/**): Preserve native app look on phone — bottom sheets (ResponsiveModal, MobileChoiceSheet, ResponsiveOverflowMenu), bottom nav (BottomTabBar / ContextualActionBar), no centered Dialog or floating DropdownMenu on max-lg. Invoke mobile-responsive skill before shipping UI. Gate: .cursor/rules/mobile-native-ui.mdc · Spec: mobile-responsive.mdc · Inventory: docs/workflow/for-testing/mobile-native-redesign.md.'

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

escaped=$(escape_for_json "$MSG")
printf '{\n  "additional_context": "%s"\n}\n' "$escaped"
