#!/usr/bin/env bash
# CI parity — same checks as .github/workflows/ci.yml and cd-dev.yml quality job.
# Run before batch-commit sessions and before pushing to develop/main.
#
# Usage:
#   bun run ci:quality
#   ./scripts/dev/ci-quality-gate.sh
#   ./scripts/dev/ci-quality-gate.sh --skip-install   # when deps already installed

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SKIP_INSTALL=0
if [[ "${1:-}" == "--skip-install" ]]; then
  SKIP_INSTALL=1
fi

echo "=== CI quality gate (matches GitHub Actions ci.yml + cd-dev quality) ==="

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  echo "→ bun install --frozen-lockfile"
  bun install --frozen-lockfile
fi

run_step() {
  local label="$1"
  shift
  echo ""
  echo "→ $label"
  "$@"
}

run_step "type-check" bun run type-check
run_step "lint (ESLint errors block CD — warnings OK)" bun run lint
run_step "check:filenames" bun run check:filenames
run_step "migration versions" bash scripts/dev/check-migration-versions.sh
run_step "migration security" bash scripts/dev/check-migration-security.sh
run_step "unit tests (Vitest)" bun run test
run_step "edge type check (Deno)" bun run check:edge-types
run_step "edge unit tests (Deno _shared)" bun run test:edge
run_step "servePublic rate-limit coverage" bash scripts/dev/check-serve-public-rate-limit.sh
run_step "edge handler tests (Deno)" bun run test:edge:handlers
run_step "playwright smoke (@smoke)" bun run test:e2e:smoke
run_step "build UI" bun run build
run_step "assert image optimizer stays lazy (plan §10.6)" \
  node scripts/media/assert-lazy-optimizer.mjs
run_step "bundle budgets + chunk-graph leak check (production-readiness doc 00/01)" \
  bun run check:budgets
run_step "no public source maps (production-readiness doc 02)" \
  node scripts/performance/assert-no-sourcemaps.mjs
run_step "no render-blocking scripts in index.html (production-readiness doc 04)" \
  node scripts/performance/assert-no-blocking-scripts.mjs

echo ""
echo "OK — quality gate passed (safe to push for CI/CD quality job)."
