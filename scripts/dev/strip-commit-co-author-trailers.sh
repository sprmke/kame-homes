#!/usr/bin/env bash
# Remove Co-authored-by trailers and AI tool attribution lines from a git commit message file.
# Used by .husky/commit-msg (all contributors) and optional history rewrite scripts.
#
# Strips every Co-authored-by line (any co-author), not only AI tools — repo policy is
# human-only commit messages with no co-author trailers.

set -euo pipefail

msg_file="${1:?usage: strip-commit-co-author-trailers.sh <commit-msg-file>}"

[[ -f "$msg_file" ]] || exit 0

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

sed -E \
  -e '/^[[:space:]]*[Cc]o-[[:space:]]*[Aa]uthored-[[:space:]]*-?[[:space:]]*[Bb]y:/Id' \
  -e '/^[[:space:]]*[Gg]enerated with (Claude Code|Cursor)/Id' \
  "$msg_file" >"$tmp"

mv "$tmp" "$msg_file"
trap - EXIT
