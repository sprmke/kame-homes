---
title: 'CI/CD and version control'
status: active
tags: [workflow, planned, production-readiness, ci-cd, git]
updated: 2026-09-16
stage: planned
kind: plan
---

# 26 — CI/CD & version control

## Goal

Every change is verified before merge, every merge is traceable, and no unreviewed or unverified code can reach an environment.

## Prior art — strong, and recently hardened

The CI pipeline (`.github/workflows/ci.yml`) already runs, in order:

1. `bun install --frozen-lockfile`
2. `type-check`
3. `lint`
4. `check:filenames`
5. Migration conventions (version + security checks)
6. `test` (Vitest)
7. `check:edge-types` (Deno, added by launch audit P0-2)
8. `test:edge` (Deno `_shared`)
9. `check-serve-public-rate-limit.sh`
10. `test:edge:handlers`
11. Playwright Chromium install + `test:e2e:smoke`
12. Playwright report upload
13. `build`
14. `assert-lazy-optimizer.mjs`

Plus `migration-replay.yml` (weekly `db:reset` + `db lint`), `cd-dev.yml`, `cd-preprod.yml`, `cd-prod.yml`, `cd-rollback.yml`, and `sync-help-center-content.yml`.

**This is a genuinely good pipeline.** The gaps are additive.

## Phases

### Phase 26.1 — Add the new gates from this folder

Each doc in this folder adds a CI guard. Consolidate them so the pipeline does not grow unbounded in wall-clock time:

| Doc | Guard                                                      |
| --- | ---------------------------------------------------------- |
| 00  | `check:budgets` (bundle, per-route, Lighthouse thresholds) |
| 01  | Chunk-graph leak detector                                  |
| 02  | No `.map` files in the deployed output                     |
| 03  | Image dimension lint                                       |
| 05  | `knip` unused deps/files                                   |
| 10  | Unbounded `.select(` detector                              |
| 11  | Cache-class declaration check                              |
| 13  | `select('*')` detector (can merge with 10)                 |
| 18  | Edge-function conformance report                           |
| 21  | Auth matrix conformance                                    |
| 23  | Rate-limit coverage on authenticated wrappers              |

**Edge case:** a pipeline that takes 25 minutes gets bypassed. Parallelize into jobs (lint/type, unit, edge, e2e, build+budgets) rather than one serial job, and keep the required-for-merge set fast.

### Phase 26.2 — Job structure and speed

- Split the single CI job into parallel jobs with a shared install/cache step.
- Cache Bun modules, Playwright browsers, and Deno dependencies.
- Run the full E2E suite on a schedule and on `main`/`develop`; keep `@smoke` on every PR.
- Target: PR feedback under 10 minutes.

### Phase 26.3 — Branch protection and review

Listed as operator-blocked previously — close it:

- `main` and `develop` require passing CI and at least one review.
- No force-push, no direct push to protected branches.
- Require branches up to date before merge.
- `CODEOWNERS` for sensitive paths: `supabase/migrations/**`, `_shared/auth*`, `_shared/orgAuth*`, `_shared/propertyScope*`, `.github/workflows/**`.

### Phase 26.4 — Commit and PR hygiene

- The repo has `.cursor/rules/git-commits.mdc` and an explicit rule against attributing commits to AI tooling — keep enforcing it.
- Conventional commit prefixes are already in use (`refactor(supabase): ...`).
- PR template covering: what changed, docs updated (the repo's mandatory same-change docs rule), plans/RBAC decision, activity-log decision, test evidence.

The repo's own doc obligations (`documentation-maintenance`, `route-guides`, `mobile-responsive`, `plans-and-permissions`, `audit-logging`) should appear as PR checkboxes so they are verifiable at review time rather than relying on agent discipline alone.

### Phase 26.5 — Dependency and security automation

- Dependabot or Renovate for dependency updates, grouped and scheduled to avoid noise.
- `bun audit` in CI (doc 05).
- Secret scanning enabled on the repository; a pre-commit hook blocking obvious key patterns.
- CodeQL or an equivalent SAST pass on the UI and edge code.

### Phase 26.6 — Release traceability

- Tag releases; generate a changelog from commits.
- The PostHog release is already the git SHA — extend that correlation to error tracking (doc 27) so any exception maps to a commit.
- Record which migration set and which function versions are live in each environment.

### Phase 26.7 — Worktree and branch hygiene

The repo has `.worktrees/` with at least two stale worktrees (`docs-obsidian-tooling-sync`, `feature/ai-voice-receptionist`). Stale worktrees and branches cause confusion about what is live and can be accidentally deployed. Prune them as part of this phase.

## Edge cases

- **Flaky E2E erodes trust in CI.** A flaky required test gets skipped, then the suite stops meaning anything. Quarantine flaky specs to a non-blocking job and fix them; do not disable them silently.
- **Secrets in CI** — workflow logs can leak env values through debug output. Use masked secrets and never `echo` them.
- **Fork PRs** cannot access secrets, so any secret-dependent job must be skipped or run only on trusted branches.
- **`--frozen-lockfile` failing** after a dependency change is correct behavior, not a CI bug — the lockfile must be committed.
- **Migration replay on a schedule** catches drift, but only weekly. A broken migration merged Monday is found Sunday. Consider running it on PRs that touch `supabase/migrations/**`.
- **The prod workflow being gated on `CUTOVER_ENABLED`** is correct, but a gate that is never tested does not work when needed. Exercise it end to end against pre-prod.
- **Dual-track**: the multi-tenant branch must not merge to live `main` before cutover (doc 24). A CI check asserting this would be cheap insurance.

## Exit gate

- [ ] CI split into parallel jobs with caching; PR feedback under 10 minutes.
- [ ] All new guards from this folder wired in without exceeding the time budget.
- [ ] Branch protection + `CODEOWNERS` active on `main` and `develop`.
- [ ] PR template including the repo's mandatory docs/plans/activity-log checkboxes.
- [ ] Dependency automation, secret scanning, and SAST active.
- [ ] Release tagging + changelog; environment version tracking.
- [ ] Migration replay runs on PRs touching migrations.
- [ ] Stale worktrees and merged branches pruned.
- [ ] Zero quarantined-and-forgotten flaky tests.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/deployment.md`, `.cursor/rules/git-commits.mdc`, the CI/CD plan folder, `.claude/README.md` if hooks change.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
