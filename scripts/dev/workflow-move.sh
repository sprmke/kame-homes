#!/usr/bin/env bash
# Move workflow docs between lifecycle stages.
# Usage:
#   workflow-move.sh start <slug-or-path>        # planned -> in-progress
#   workflow-move.sh for-testing <slug-or-path>  # in-progress -> for-testing
#   workflow-move.sh done <slug-or-path>         # in-progress|for-testing -> done
#   workflow-move.sh wont-do <slug-or-path>      # planned|in-progress|for-testing -> wont-do
#
# Accepts slug (mobile-native-redesign.md) or path under docs/workflow/.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DOCS="$ROOT/docs/workflow"

cmd="${1:-}"
slug="${2:-}"

usage() {
  echo "Usage: workflow-move.sh start|for-testing|done|wont-do <slug-or-path>" >&2
  exit 1
}

[[ -n "$cmd" && -n "$slug" ]] || usage

resolve_source() {
  local s="$1"
  if [[ -f "$s" ]]; then
    echo "$s"
    return
  fi
  if [[ -f "$DOCS/planned/$s" ]]; then
    echo "$DOCS/planned/$s"
    return
  fi
  if [[ -f "$DOCS/in-progress/$s" ]]; then
    echo "$DOCS/in-progress/$s"
    return
  fi
  if [[ -f "$DOCS/for-testing/$s" ]]; then
    echo "$DOCS/for-testing/$s"
    return
  fi
  if [[ -f "$DOCS/wont-do/$s" ]]; then
    echo "$DOCS/wont-do/$s"
    return
  fi
  if [[ "$s" != *.md ]]; then
    resolve_source "${s}.md"
    return
  fi
  echo ""
}

patch_stage() {
  local file="$1"
  local stage="$2"
  local today
  today="$(date +%Y-%m-%d)"
  if grep -q '^stage:' "$file"; then
    perl -pi -e "s/^stage: .*/stage: ${stage}/" "$file"
  else
    perl -pi -e "s/^(status: .*)/\$1\nstage: ${stage}/" "$file"
  fi
  if grep -q '^updated:' "$file"; then
    perl -pi -e "s/^updated: .*/updated: ${today}/" "$file"
  fi
  if [[ "$stage" == "wont-do" ]] && grep -q '^status:' "$file"; then
    perl -pi -e "s/^status: .*/status: cancelled/" "$file"
  fi
}

move_design_spec() {
  local src_dir="$1"
  local dest_dir="$2"
  local base="$3"
  local slug="${base%.md}"
  local design="${slug}-design.md"
  local design_src="$src_dir/$design"

  if [[ ! -f "$design_src" ]]; then
    return 0
  fi

  git mv "$design_src" "$dest_dir/$design" 2>/dev/null || mv "$design_src" "$dest_dir/$design"
  patch_stage "$dest_dir/$design" "$4"
  echo "Moved design spec: docs/workflow/${dest_dir#"$DOCS/"}/$design"
}

sync_scratchpad() {
  local base="$1"
  node "$ROOT/scripts/dev/sync-workflow-scratchpads.mjs" --slug="${base%.md}" || true
}

case "$cmd" in
  start)
    src="$(resolve_source "$slug")"
    [[ -n "$src" ]] || { echo "Not found: $slug" >&2; exit 1; }
    base="$(basename "$src")"
    dest="$DOCS/in-progress/$base"
    if [[ "$src" == "$dest" ]]; then
      echo "Already in progress: $base"
      exit 0
    fi
    src_dir="$(dirname "$src")"
    git mv "$src" "$dest" 2>/dev/null || mv "$src" "$dest"
    patch_stage "$dest" "in-progress"
    move_design_spec "$src_dir" "$DOCS/in-progress" "$base" "in-progress"
    echo "Started: docs/workflow/in-progress/$base"
    sync_scratchpad "$base"
    ;;
  for-testing)
    src="$(resolve_source "$slug")"
    [[ -n "$src" ]] || { echo "Not found: $slug" >&2; exit 1; }
    base="$(basename "$src")"
    dest="$DOCS/for-testing/$base"
    if [[ "$src" == "$dest" ]]; then
      echo "Already for testing: $base"
      exit 0
    fi
    src_dir="$(dirname "$src")"
    git mv "$src" "$dest" 2>/dev/null || mv "$src" "$dest"
    patch_stage "$dest" "for-testing"
    move_design_spec "$src_dir" "$DOCS/for-testing" "$base" "for-testing"
    echo "For testing: docs/workflow/for-testing/$base"
    sync_scratchpad "$base"
    ;;
  done)
    src="$(resolve_source "$slug")"
    [[ -n "$src" ]] || { echo "Not found: $slug" >&2; exit 1; }
    base="$(basename "$src")"
    dest="$DOCS/done/$base"
    if [[ "$src" == "$dest" ]]; then
      echo "Already done: $base"
      exit 0
    fi
    src_dir="$(dirname "$src")"
    git mv "$src" "$dest" 2>/dev/null || mv "$src" "$dest"
    patch_stage "$dest" "done"
    move_design_spec "$src_dir" "$DOCS/done" "$base" "done"
    echo "Done: docs/workflow/done/$base"
    sync_scratchpad "$base"
    ;;
  wont-do)
    src="$(resolve_source "$slug")"
    [[ -n "$src" ]] || { echo "Not found: $slug" >&2; exit 1; }
    base="$(basename "$src")"
    dest="$DOCS/wont-do/$base"
    if [[ "$src" == "$dest" ]]; then
      echo "Already won't do: $base"
      exit 0
    fi
    src_dir="$(dirname "$src")"
    git mv "$src" "$dest" 2>/dev/null || mv "$src" "$dest"
    patch_stage "$dest" "wont-do"
    move_design_spec "$src_dir" "$DOCS/wont-do" "$base" "wont-do"
    echo "Won't do: docs/workflow/wont-do/$base"
    sync_scratchpad "$base"
    ;;
  *)
    usage
    ;;
esac
