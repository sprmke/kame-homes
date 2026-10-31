#!/usr/bin/env bash
# PostToolUse hook (matcher: Edit|Write): format the file that was just edited, if a
# formatter is available. Root package.json + .prettierrc configure Prettier for this
# repo (bun run format / format:check), so this actually runs, not a no-op.
#
# Reads Claude Code's PostToolUse JSON from stdin: {"tool_input": {"file_path": "..."}, ...}
# Must exit 0 and print JSON (or nothing) so the edit is never blocked — this hook is
# purely cosmetic.

set -e
input=$(cat)

if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
else
  file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"$//')
fi

format_with_prettier() {
  local target="$1"
  # Prefer bunx (fast) then npx for repo-local prettier.
  if command -v bunx >/dev/null 2>&1; then
    bunx --bun prettier --write "$target" >/dev/null 2>&1 && return 0
  fi
  if command -v npx >/dev/null 2>&1; then
    npx --no-install prettier --write "$target" >/dev/null 2>&1 && return 0
  fi
  return 1
}

if [[ -n "$file_path" && -f "$file_path" ]]; then
  case "$file_path" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.mdc|*.css|*.html)
      format_with_prettier "$file_path" || true
      ;;
  esac
fi

echo '{}'
