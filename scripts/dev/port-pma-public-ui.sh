#!/usr/bin/env bash
# Sync PMA marketing UI source into GFM (manual / periodic re-port).
# Usage: ./scripts/dev/port-pma-public-ui.sh [pma_root]
#
# Default PMA path: ../property-management-app/apps/web/src/features/marketing
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PMA_ROOT="${1:-$(cd "$ROOT/../property-management-app" 2>/dev/null && pwd || true)}"
SRC="${PMA_ROOT}/apps/web/src/features/marketing"
DEST="$ROOT/ui/src/features/guest/marketing"

if [[ ! -d "$SRC" ]]; then
  echo "PMA marketing source not found: $SRC" >&2
  echo "Pass PMA repo root: $0 /path/to/property-management-app" >&2
  exit 1
fi

echo "Copying PMA marketing → GFM"
echo "  from: $SRC"
echo "  to:   $DEST"

rsync -a --delete \
  --exclude 'pages/' \
  "$SRC/" "$DEST/"

echo ""
echo "Done. GFM-specific files preserved under:"
echo "  - ui/src/features/guest/marketing/pages/     (React Router pages — do not overwrite from PMA)"
echo "  - ui/src/features/guest/marketing/routes/    (route tree)"
echo "  - ui/src/features/guest/marketing/shared/components/MarketingImage.tsx"
echo ""
echo "After sync, re-apply Vite adapters (see .cursor/skills/public-ui/SKILL.md):"
echo "  - next/image → MarketingImage"
echo "  - Link href → Link to"
echo "  - useSearchParams destructuring"
echo "  - Remove styled-jsx"
echo ""
echo "Then: cd ui && bun run build"
