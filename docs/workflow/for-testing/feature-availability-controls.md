---
stage: for-testing
title: 'Feature availability controls — manual QA'
status: active
tags: [qa, super-admin, feature-gating]
updated: 2026-10-29
plan: ../done/feature-availability-controls.md
---

# Feature availability controls — manual QA

Automated gates (Vitest, Deno, Playwright `@ci` under `ui/e2e/features/feature-availability/`, `bun run ci:quality`) are green. Run these on a local full stack (`./dev.sh`) before prod toggle exercises.

From [`../done/feature-availability-controls.md`](../done/feature-availability-controls.md) § Verification:

1. For each v1 module, turn the parent catalog key off → every listed host surface shows maintenance UI; one mutating edge call returns `503` + `FEATURE_UNAVAILABLE`. Turn each child off → narrower effect only. Turn on → normal within ~1 minute (cache TTL).
2. Auto restore: `expected_back_at` ~2 minutes ahead + `auto_restore` → surfaces return without a manual write.
3. Super-admin bypass: as super admin with bypass on, gated actions still work; as a normal host, they do not.
4. `/admin/audit` rows for each PUT/DELETE on `feature-availability`.
5. Mobile 375 / 768 / 1024 on touched host surfaces + `/admin/feature-availability`.
6. Hosted dev: `get_advisors` after migration `20261316128800_feature_availability_overrides.sql`.

Crons while off: see `docs/archive/operations/scheduled-jobs-and-testing.md` (Telegram `skipped: feature_unavailable`, `calendar-sync-cron`, `analytics-ai-review-cron`).
