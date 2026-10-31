#!/usr/bin/env bash
# afterFileEdit hook: warns when wrong-stack terms are introduced (GFM = Vite SPA + Supabase, not Next/tRPC/Drizzle).
# Reads JSON from stdin with "file_path". Never blocks edits.

set -e
input=$(cat)

if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.file_path // empty')
else
  file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"$//')
fi

if [[ -n "$file_path" && -f "$file_path" ]]; then
  if rg -i -q "next/router|next/navigation|next/image|trpc|drizzle-orm|@neondatabase|apps/web|packages/emails" "$file_path"; then
    echo "Warning: wrong-stack term in $file_path. GFM uses Vite + React Router + Supabase edge functions (see .cursor/rules/project-context.mdc)." >&2
  fi
fi

echo '{}'
