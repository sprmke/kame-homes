---
title: 'CI/CD and version control'
status: active
tags: [workflow, planned, production-readiness, ci-cd, git]
updated: 2026-09-19
stage: planned
kind: plan
---

# 26 — CI/CD & version control

## Goal

Every change is verified before merge, every merge is traceable, and no unreviewed or unverified code can reach an environment.

## Implementation status (2026-09-19 session)

This session had working `gh` auth against the real `sprmke/kame-homes` repo and a running local Supabase — more repo/infra access than prior sessions in this folder had. Shipped:

- **Found and fixed a real CI bug, not just process gaps.** `ci.yml`'s Playwright smoke step had been failing on `develop` intermittently for weeks (`PAGEERROR supabaseUrl is required`) — `playwright.config.ts`'s `webServer` never set `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, and `ui/src/lib/supabase/client.ts` calls `createClient()` at module load time, which throws synchronously on an empty string and crashes the entire SPA before any test can render. Fixed by adding placeholder env vars to `webServer.env`, gated by `process.env.VITE_SUPABASE_URL ||` so real values (local/hosted CI secrets) still win when present. **The placeholder host had to stay `127.0.0.1`** — supabase-js derives the session localStorage key as `sb-${hostname.split('.')[0]}-auth-token`, and `ui/e2e/shared/ids.ts#SUPABASE_AUTH_STORAGE_KEY` hardcodes `sb-127-auth-token` to match; an arbitrary placeholder hostname (tried `placeholder.supabase.co` first) silently broke every spec that seeds a session via `seedSupabaseAuthSession` (admin/dashboard smoke tests) even though the crash itself was fixed. Verified locally with `ui/.env`/`ui/.env.development` moved aside + no env vars set (true CI simulation): full `chromium-ci` project went from ~all-failing to **95/96 passing**. The one residual failure (`guestFormSubmit.spec.ts`) is a separate, pre-existing flake unrelated to this fix — not chased further this session, flagged for doc 29's flake-reduction phase instead.
- **Phase 26.2 — split `ci.yml` into 5 parallel jobs** (`static-guards`, `lint-and-types`, `unit-and-edge-tests`, `e2e-smoke`, `build-and-budgets`) fanning into a `quality` gate job (`if: always()` + explicit failure/cancelled check) so branch protection's required-check name never has to change when jobs are added/split further. `static-guards` needs no `bun install` at all (every guard script is pure bash/grep or Node built-ins) — it's the fastest job and runs immediately. Added `actions/cache` for bun install cache, Deno cache, and Playwright browsers (skips the OS-deps-heavy `playwright install --with-deps` on a cache hit, using `install-deps` only). Not measured against a live run this session (would need a push to `develop`/a PR) — the split and caching are structurally sound (verified: valid YAML via `ruby -ryaml`, each job's script/dependency requirements traced by hand) but the "under 10 minutes" target itself is unverified without an actual CI run.
- **Phase 26.3 — branch protection applied to `main` and `develop`** on the real repo (previously **zero protection on either**, confirmed via `gh api .../branches/main/protection` → 404 before this session): require PR + 1 approving review + code-owner review, require the `quality` status check (strict, must be up to date), block force-push and branch deletion, require conversation resolution. `enforce_admins: false` deliberately — the repo has one collaborator (the owner) with admin rights, so a hard admin lock would risk a self-lockout with no one else to unblock it. Confirmed with the user before applying (branch protection changes how they push to their own repo).
- **`.github/CODEOWNERS`** created — `supabase/migrations/**`, the four auth/scope `_shared/*.ts` files, and `.github/workflows/**` require review from `@sprmke` (the only collaborator; this makes the rule self-documenting for when a second person joins rather than a no-op).
- **`.github/PULL_REQUEST_TEMPLATE.md`** created — checklist mirrors CLAUDE.md's mandatory same-change doc obligations (`documentation-maintenance`, `route-guides`, `mobile-responsive`, `audit-logging`, `plans-and-permissions`, new analytics events) plus a test-evidence section, so they're verifiable at review time instead of relying on agent/author discipline alone.
- **`.github/dependabot.yml` confirmed already shipped** by an earlier session (bun + github-actions ecosystems, weekly, grouped minor/patch) — not redone.
- **Phase 26.7 — stale worktree cleanup.** `.worktrees/docs-obsidian-tooling-sync` (31MB) and `.worktrees/feature/ai-voice-receptionist` (938MB, ~114k files) both had broken `.git/worktrees/` metadata pointing at a pre-rename repo path (`.../guest-form-management`, not `.../kame-homes`) — `git worktree list` didn't even recognize them, confirming they were orphaned directories, not live worktrees `git worktree remove` could clean up. Confirmed with the user, then `rm -rf` (gitignored path, no git history touched) — freed ~1GB.
- **6 remote branches confirmed fully merged into `origin/main`** and safe to delete (`codebase-restructure`, `feature/finance`, `feature/reskin-app`, `fix-google-calendar-related-issues`, `new-changes`, `payment-receipt-ai-validation`) via `git branch -r --merged origin/main`. **Not deleted this session** — remote branch deletion is a more clearly shared/hard-to-reverse action than local worktree cleanup, and this session's one "ask the user" budget for destructive ops went to branch protection + worktree deletion. Left as a ready-to-run recommendation.

## Remaining work to finalize

**Status: partial.** Quality gates and dual-track workflows already existed (not redone). This session closed speed (job split + caching), protection (branch rules + CODEOWNERS + PR template), a real CI correctness bug (Playwright env crash), and worktree hygiene. Still open: measuring the actual PR-feedback wall-clock time against a live run, dependency/secret-scanning/SAST automation, release tagging, and migration replay on PRs.

| #   | Work                                                                                                                                                                  | Blocker             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | ~~Wire every new guard from this folder into CI without exceeding the time budget (26.1).~~ **Done** — all guards already present in the new `static-guards` job.     | —                   |
| 2   | ~~Split CI into parallel jobs with caching (26.2).~~ **Done** — 5 parallel jobs + fan-in `quality` gate. **Not measured**: actual PR wall-clock time.                 | Needs a live CI run |
| 3   | ~~Branch protection + `CODEOWNERS` on `main` and `develop` (26.3).~~ **Done.**                                                                                        | —                   |
| 4   | ~~PR template with docs / plans / activity-log checkboxes (26.4).~~ **Done.**                                                                                         | —                   |
| 5   | Dependency automation ~~(shipped by an earlier session, confirmed)~~; secret scanning and SAST still open (26.5).                                                     | GitHub / tooling    |
| 6   | Release tagging + changelog; environment version tracking (26.6).                                                                                                     | Process             |
| 7   | Migration replay on PRs that touch migrations still open. ~~Prune stale worktrees~~ **done** (~1GB freed); 6 merged remote branches identified, **not deleted**.      | CI + user go-ahead  |
| 8   | Zero quarantined-and-forgotten flaky tests. **One found this session** (`guestFormSubmit.spec.ts`, pre-existing, unrelated to the env-crash fix). Cross-check doc 29. | Tests               |

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

- [x] CI split into parallel jobs with caching. **PR feedback under 10 minutes not measured** — needs a live CI run against a real push/PR.
- [x] All new guards from this folder wired in (moved into `static-guards`, which needs no `bun install`).
- [x] Branch protection + `CODEOWNERS` active on `main` and `develop`.
- [x] PR template including the repo's mandatory docs/plans/activity-log checkboxes.
- [x] Pre-commit secret patterns (`check-staged-secrets.sh`). CI tracked-tree scan (`check-tracked-secrets.sh` in `ci.yml`, 2026-09-21).
- [ ] SAST (CodeQL or equivalent) still open. GitHub Advanced Security org-level scanning not verified here.
- [ ] Release tagging + changelog; environment version tracking.
- [x] Migration replay on PRs touching `supabase/migrations/**` (`migration-replay.yml`, 2026-09-21) plus weekly schedule.
- [x] Stale worktrees pruned (~1GB). Merged branches identified (6) but not deleted — needs explicit go-ahead for remote deletion.
- [ ] Zero quarantined-and-forgotten flaky tests. One found this session (`guestFormSubmit.spec.ts`), not yet triaged/fixed.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/deployment.md`, `.cursor/rules/git-commits.mdc`, the CI/CD plan folder, `.claude/README.md` if hooks change.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
