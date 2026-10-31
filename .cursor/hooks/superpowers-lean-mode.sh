#!/usr/bin/env bash
# beforeSubmitPrompt (Cursor): activate Superpowers lean mode when any /superpowers-* command runs.
# Claude Code wires the same script to UserPromptSubmit (see .claude/settings.json).

set -euo pipefail

ROOT="${CURSOR_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
# shellcheck source=../../scripts/dev/superpowers-lean-lib.sh
source "$ROOT/scripts/dev/superpowers-lean-lib.sh"

input=$(cat)
prompt=""
event=""

if command -v jq >/dev/null 2>&1; then
  prompt=$(echo "$input" | jq -r '.prompt // empty')
  event=$(echo "$input" | jq -r '.hook_event_name // empty')
else
  prompt=$(echo "$input" | grep -o '"prompt":"[^"]*"' | head -1 | sed 's/"prompt":"//;s/"$//' | sed 's/\\"/"/g' || true)
  event=$(echo "$input" | grep -o '"hook_event_name":"[^"]*"' | head -1 | sed 's/"hook_event_name":"//;s/"$//' || true)
fi

mode=""
if mode=$(superpowers_lean_detect_mode "$prompt"); then
  superpowers_lean_activate "$ROOT" "$mode"
  case "$mode" in
    execute) msg="Superpowers lean mode on (execute): subagents blocked; implement inline." ;;
    brainstorm) msg="Superpowers lean mode on (brainstorm): subagents blocked; spec only." ;;
    debug) msg="Superpowers lean mode on (debug): subagents blocked; single-threaded." ;;
    *) msg="Superpowers lean mode on ($mode): subagents blocked; plan only." ;;
  esac
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg msg "$msg" '{continue: true, user_message: $msg}'
  else
    printf '{"continue":true,"user_message":"%s"}\n' "$msg"
  fi
  exit 0
fi

echo '{"continue":true}'
