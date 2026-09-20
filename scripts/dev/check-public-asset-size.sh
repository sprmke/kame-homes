#!/usr/bin/env bash
# Guards production-readiness doc 09 Phase 9.6: static files under ui/public/**
# cannot grow back to the dead-asset class we already removed (hero-banner.png
# was 2.27 MB with zero references). Images stay under 512 KiB; everything else
# under 2.5 MiB unless it is on the explicit allowlist with a reason.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

IMAGE_MAX=$((512 * 1024))
OTHER_MAX=$((2560 * 1024))

# Justified exceptions (path relative to ui/public/). Add a reason when you
# add a row — this list is the "without justification" half of Phase 9.6.
ALLOWLIST=(
  # Host marketing talking-avatar loop; video, not a forgotten raster dump.
  'avatars/receptionist-turtle-talk.mp4'
)

is_allowlisted() {
  local rel="$1"
  for allowed in "${ALLOWLIST[@]}"; do
    if [[ "$rel" == "$allowed" ]]; then
      return 0
    fi
  done
  return 1
}

fail=0
while IFS= read -r -d '' file; do
  rel="${file#ui/public/}"
  if is_allowlisted "$rel"; then
    continue
  fi
  size=$(wc -c < "$file" | tr -d ' ')
  ext="${file##*.}"
  case "$ext" in
    png|jpg|jpeg|webp|gif)
      max=$IMAGE_MAX
      label="image ${IMAGE_MAX} bytes (512 KiB)"
      ;;
    *)
      max=$OTHER_MAX
      label="non-image ${OTHER_MAX} bytes (2.5 MiB)"
      ;;
  esac
  if (( size > max )); then
    echo "FAIL: ui/public/${rel} is ${size} bytes (limit ${label})"
    echo "      Add it to ALLOWLIST in scripts/dev/check-public-asset-size.sh with a reason, or compress it."
    fail=1
  fi
done < <(find ui/public -type f ! -name '.DS_Store' -print0)

if (( fail )); then
  exit 1
fi
echo "OK — ui/public assets are within size budgets."
