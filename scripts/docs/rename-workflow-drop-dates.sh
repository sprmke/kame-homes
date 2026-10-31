#!/usr/bin/env bash
# Strip YYYY-MM-DD- prefix from workflow doc filenames.
# Usage: bash scripts/docs/rename-workflow-drop-dates.sh [--dry-run]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DRY="${1:-}"

renamed=0
while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  dir="$(dirname "$f")"
  [[ "$base" =~ ^20[0-9]{2}-[0-9]{2}-[0-9]{2}-(.+\.md)$ ]] || continue
  new="${BASH_REMATCH[1]}"
  dest="$dir/$new"
  if [[ -e "$dest" ]]; then
    echo "SKIP (exists): $f -> $dest" >&2
    continue
  fi
  if [[ "$DRY" == "--dry-run" ]]; then
    echo "would mv: $f -> $dest"
  else
    git mv "$f" "$dest" 2>/dev/null || mv "$f" "$dest"
    echo "mv: $f -> $dest"
  fi
  renamed=$((renamed + 1))
done < <(find "$ROOT/docs/workflow" -name '20*.md' -print0)

echo "Renamed $renamed file(s)"
