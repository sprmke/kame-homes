#!/usr/bin/env bash
# Reject migration filenames that Supabase cannot track deterministically.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

versions_file="$(mktemp)"
trap 'rm -f "$versions_file"' EXIT
failed=0

for path in supabase/migrations/*.sql; do
  filename="${path##*/}"
  version="${filename%%_*}"

  if [[ ! "$filename" =~ ^([0-9]{8}|[0-9]{14})_[a-z0-9_]+\.sql$ ]]; then
    echo "INVALID migration filename: $filename" >&2
    failed=1
    continue
  fi

  printf '%s\n' "$version" >>"$versions_file"
done

duplicates="$(sort "$versions_file" | uniq -d)"
if [[ -n "$duplicates" ]]; then
  while IFS= read -r version; do
    echo "DUPLICATE migration version $version:" >&2
    printf '  %s\n' supabase/migrations/"${version}"_*.sql >&2
  done <<<"$duplicates"
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "OK — migration versions are unique and filenames are valid."
