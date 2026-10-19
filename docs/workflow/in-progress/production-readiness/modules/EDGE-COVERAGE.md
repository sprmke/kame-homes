---
title: 'Edge function coverage map'
status: active
updated: 2026-10-19
stage: in-progress
kind: reference
readiness: unverified
launch_gate: B
---

# Edge function coverage map

Inventory: **311** functions (`scripts/dev/readiness-inventory.mjs`, 2026-10-19). Heuristic gaps: [`../evidence/phase3-edge-gaps.md`](../evidence/phase3-edge-gaps.md) from `audit-edge-functions.mjs --gaps-only`.

Auth-matrix zero-signal guard: green on `fix/ci-green-guards` (310 functions, 0 with no authz signal) after PR #145 allowlists.

## How to refresh

```bash
node scripts/dev/audit-edge-functions.mjs --gaps-only
node scripts/dev/audit-auth-matrix.mjs --check
```

Treat heuristic "no-validation-detected" as triage, not a defect. Confirm in Phase 6/7.

## Cron / webhook inventory (named)

See `evidence/phase3-inventory.md`. Cross-check `docs/archive/operations/scheduled-jobs-and-testing.md` and live `cron.job` after Phase 0.6.
