#!/usr/bin/env bash
# PostToolUse hook (matcher: Edit|Write): warns when wrong-stack terms are introduced
# (GFM = Vite SPA + Supabase, not Next.js/tRPC/Drizzle). Never blocks the edit — surfaces
# via hookSpecificOutput.additionalContext so Claude sees it in the next turn.
#
# Reads Claude Code's PostToolUse JSON from stdin: {"tool_input": {"file_path": "..."}, ...}

set -e
input=$(cat)

if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
else
  file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"$//')
fi

PATTERN="next/router|next/navigation|next/image|trpc|drizzle-orm|@neondatabase|apps/web|packages/emails"

match_pattern() {
  local target="$1"
  # rg is only guaranteed inside Claude Code's own interactive shell integration, not to
  # subprocesses it spawns to run hooks — fall back to grep -E so this still works.
  if command -v rg >/dev/null 2>&1; then
    rg -i -q "$PATTERN" "$target"
  else
    grep -qiE "$PATTERN" "$target"
  fi
}

if [[ -n "$file_path" && -f "$file_path" ]]; then
  if match_pattern "$file_path"; then
    if command -v jq >/dev/null 2>&1; then
      jq -n --arg msg "Warning: wrong-stack term in $file_path. GFM uses Vite + React Router + Supabase edge functions (see CLAUDE.md and .cursor/rules/project-context.mdc), not Next.js/tRPC/Drizzle." \
        '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'
      exit 0
    else
      echo "Warning: wrong-stack term in $file_path (Vite + Supabase repo, not Next.js/tRPC/Drizzle)." >&2
    fi
  fi
fi

echo '{}'
