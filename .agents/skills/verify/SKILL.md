---
name: verify
description: Build and verify a change in Guest Form Management — run ci:quality (lint, type-check, unit, edge, smoke E2E, build), exercise edge functions locally, and use Playwright CLI/MCP for flows not covered by committed specs.
---

# Verify (GFM)

"Verified" means static checks and the automated test pyramid pass, plus any behavior the suite does not cover was exercised manually (curl or browser).

## 1. Automated checks (run first)

```bash
bun run ci:quality
```

This mirrors CI: type-check, lint, filenames, Vitest, Deno `_shared`, Deno handlers, Playwright `@smoke`, build, lazy-optimizer assert.

Targeted runs:

```bash
bun run test                    # Vitest UI unit
bun run test:edge               # Deno _shared
bun run test:edge:handlers      # Deno handler tests
bun run test:e2e:smoke          # Playwright @smoke
bun run test:e2e:ci             # Playwright @ci (develop gate)
```

Index: `docs/guides/testing/README.md`. Skill **`testing`**.

Stop and fix before manual verification if any step fails.

## 2. Edge function changes

1. Start the local stack: `./dev.sh` (or `./dev.sh --ui-only` for UI-only).
2. Hit the function with curl (admin JWT vs anon key per endpoint).
3. Scheduled jobs: `docs/archive/operations/scheduled-jobs-and-testing.md`.
4. Booking status: confirm against `.cursor/rules/booking-workflow.mdc` side-effect matrix.

## 3. UI changes not covered by specs

1. `./dev.sh --ui-only` (Playwright webServer injects `VITE_POSTHOG_*` so dev does not crash E2E).
2. **Playwright CLI** (`playwright-cli` skill) for token-cheap snapshots.
3. **Playwright MCP** for exploratory flows only; commit regressions to `ui/e2e/features/<domain>/`.
4. Check golden path + one relevant edge case and mobile width.

## 4. Report format

State which automated checks passed, what was manually exercised, and what was not verified (live OAuth, PayMongo, Meta, Gemini `@live`, etc.).
