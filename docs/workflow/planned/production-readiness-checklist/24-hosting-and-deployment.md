---
title: 'Hosting and deployment'
status: active
tags: [workflow, planned, production-readiness, deployment, vercel, supabase]
updated: 2026-09-21
stage: planned
kind: plan
---

# 24 — Hosting & deployment

## Goal

A deploy is boring: reproducible, verified before it reaches users, reversible within minutes, and impossible to run against production by accident.

## Remaining work to finalize

**Status: partial — deploy ordering + maintenance-mode verified; branch protection on since doc 26 (2026-09-19).** Cutover still blocked on 21/22/23. Rollback rehearsal is still the highest residual risk.

| #   | Work                                                                                                                                                                                                                                                                                                                                                                                                   | Blocker             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| 1   | Verify the environment matrix against live projects; deploy-time env var assertion (24.1).                                                                                                                                                                                                                                                                                                             | Hosted              |
| 2   | Rehearse rollback on hosted-dev with a measured RTO (24.2). **Partial:** operator runbook + `bun run rehearsal:rollback:dev:preflight` shipped (`docs/archive/operations/hosted-dev-rollback-rehearsal.md`, 2026-09-21). Measured drill still open.                                                                                                                                                    | Hosted-dev operator |
| 3   | Prod path: manual approval with the schema diff attached (24.4). `kamewave` stays the unlock.                                                                                                                                                                                                                                                                                                          | CI + policy         |
| 4   | Smoke tests: authenticated reads, a cleaned-up write, asset headers, PWA version, cron presence (24.5). **Partial (2026-09-21):** cd-dev [`35558455879`](https://github.com/sprmke/kame-homes/actions/runs/35558455879) — cron probe + partial listing smoke + transport compression; `verify:deployed-preview` incl. `/pwa-version.json`; adversarial **11/11**. Authenticated read/write still open. | CI + hosted         |
| 5   | ~~Branch protection on `main` and `develop`.~~ **Closed** — applied 2026-09-19 (doc 26); re-verified `develop` 2026-09-21 (`gh api` → required `quality` check, PR reviews, no force-push).                                                                                                                                                                                                            | —                   |
| 6   | Preview env scoping (no prod secrets).                                                                                                                                                                                                                                                                                                                                                                 | GitHub/Vercel       |
| 7   | Cutover checklist with named owners (24.6). Depends on 17, 21, 22, 23, 27, 30.                                                                                                                                                                                                                                                                                                                         | Those docs          |

## Measured before / after

| Metric                  | Before             | After                                                                | Difference                               |
| ----------------------- | ------------------ | -------------------------------------------------------------------- | ---------------------------------------- |
| Migrations vs functions | Assumed sequential | Confirmed in deploy scripts (db then fn)                             | Race closed                              |
| Maintenance mode scope  | Unverified         | 5 new-intake writers + banner; status uncached                       | Intentional, not a bug                   |
| Branch protection       | Off (2026-09-18)   | **On** `main` + `develop` (doc 26, 2026-09-19)                       | Closed                                   |
| Post-deploy smoke       | Public GETs only   | Partial listing + adversarial + header verify (cd-dev `35545944443`) | Hosted data gap for full property probes |

## Implementation status (2026-09-18 session)

Docs 21/22/23 are not fully closed yet (see their own status), so this doc's Phase 24.6 cutover checklist still cannot proceed regardless of what's verified here.

**Phase 24.3 — deploy ordering: verified, already correct.** Read `scripts/deploy/ci-deploy.sh` → `deploy-supabase-dev.sh`/`deploy-supabase.sh`: migrations (`supabase db push`) run before `supabase functions deploy` within the same shell function, sequentially, not as separate CI jobs that could race or be reordered. `cd-dev.yml`'s `deploy` job runs both as one step after `needs: quality`. This closes the doc's specific worry ("deploying functions before migrations means a function queries a missing column") — already enforced in the script, not by convention.

**Phase 24.7 — maintenance mode: verified, correct scope, no gap.** `maintenanceModeResponse()` (`_shared/platformSettingsCache.ts`) is checked in exactly 5 functions: `submit-form`, `submit-form-completion`, `submit-sd-form`, `submit-guest-review`, `create-organization` — the new-intake/new-signup write paths. This is intentionally narrower than "block everything," which is correct: a maintenance window should stop new bookings/signups without also locking hosts out of finishing in-progress admin work. `PlatformMaintenanceBanner` renders app-wide as an informational notice (not a hard block), confirming this is the intended design, not an oversight. Confirmed `get-public-platform-status` (the status-check endpoint itself) is excluded from the service worker's cache allowlist (`SW_CACHEABLE_FUNCTIONS` in `ui/src/pwa/shared.ts`) and returns `private` cache headers by explicit code comment — so a lifted maintenance flag is never masked by a stale cached response, closing the doc's own edge case.

Everything else in this doc is genuinely hosted-blocked this session — no `SUPABASE_ACCESS_TOKEN`/Vercel API access, and `mt-prod` does not exist yet per `docs/archive/operations/ci-cd-environment-matrix.md` (confirmed current, re-read this session). **Branch protection is no longer an open item** (doc 26). Remaining work is the table at the top of this doc.

## Implementation status (2026-09-21 follow-up)

**cd-dev green path re-confirmed** after Playwright `@ci` stabilization and post-deploy smoke hardening (`24a02935`). Latest run [`35547228391`](https://github.com/sprmke/kame-homes/actions/runs/35547228391): `quality` passed `@smoke` + `@ci`; `deploy` then:

- `ci-smoke.sh dev` — partial pass (empty listings) + transport compression on `get-health` / `list-public-pricing-plans`.
- `adversarialAuthLive.test.ts` — **12/12** on cd-dev run [`35561028251`](https://github.com/sprmke/kame-homes/actions/runs/35561028251) (2026-09-21).
- `verify:deployed-preview` — OK against `https://dev.kamehomes.space` and hosted `get-health`.

**`pg_stat_statements` capture** still skipped when `DEV_DB_URL` is unset on the `development` GitHub Environment (workflow emits `::warning` since `9299d7fb`). Operator: add secret per `docs/archive/operations/github-environments-setup.md`, re-run cd-dev, commit artifact under `baselines/` (doc 00 row 4).

## Prior art — do not redo

| Shipped                                 | Where                                                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Dual-track deployment model             | [`ci-cd-environments/`](../../in-progress/ci-cd-environments/README.md) — live `main` + legacy vs multi-tenant `kame-homes` |
| Dev CD                                  | `.github/workflows/cd-dev.yml`                                                                                              |
| Pre-prod + prod CD + rollback workflows | `cd-preprod.yml`, `cd-prod.yml`, `cd-rollback.yml`                                                                          |
| Prod CD gated                           | `CUTOVER_ENABLED` + typed confirm; deploys only after gate + quality + schema-diff artifact + backup + smoke (P1-6)         |
| Real smoke tests post-deploy            | `ci-smoke.sh` issues real GETs with the anon key (P1-7)                                                                     |
| Backup before deploy                    | `backup:supabase:dev/:prod`, automatic                                                                                      |
| Hardened rollback                       | Requires `--fresh-target`, empty public tables, typed project-ref confirm, atomic restore (P0-6)                            |
| Prod-deploy protection for agents       | `kamewave` unlock + shell hooks (`.cursor/rules/no-prod-deploy.mdc`)                                                        |
| Env status check                        | `bun run env:status`                                                                                                        |
| Asset cache headers                     | `ui/vercel.json`                                                                                                            |

This is the **most mature area** of the checklist. The remaining work is the cutover itself and a handful of verification gaps, both already tracked in the CI/CD plan.

## Current state — open items (from the prior plans)

1. **mt-prod does not exist yet.** Phase B (prod Supabase, `main`, `app.kamehomes.space`, legacy data migration) is pending.
2. **`cd-prod.yml` must stay off** until mt-prod exists and `CUTOVER_ENABLED` is set.
3. **Rollback has never been rehearsed** against hosted dev (Docker was down during the audit). This is the largest residual risk in the whole folder.
4. **Dual-track merge hazard** — the multi-tenant tree must not reach live `main`/legacy before cutover.

## Phases

### Phase 24.1 — Environment matrix verification

Confirm, for each of local / hosted dev / pre-prod / prod: Supabase project ref, Vercel project, domain, env var set, secret set, cron schedules, and which branch deploys there. The matrix exists (`docs/archive/operations/ci-cd-environment-matrix.md`) — verify it against reality rather than trusting the doc.

**Edge case:** an env var present in Vercel but missing in Supabase secrets (or vice versa) produces a runtime failure only on the path that uses it, often days later. Add a startup/deploy-time assertion that every required env var is present, failing the deploy rather than the request.

### Phase 24.2 — Rehearse rollback (highest priority)

Against hosted **dev**, not prod:

1. Take a backup.
2. Deploy a deliberate breaking change.
3. Run the rollback workflow.
4. Measure time to recovery; verify data integrity, that Storage objects still match DB rows (doc 20 Phase 20.6), and that the UI works after.

Document the measured RTO. **An unrehearsed rollback is not a rollback** — this converts a documented procedure into a verified capability.

### Phase 24.3 — Deploy ordering and compatibility

The SPA (Vercel) and edge functions (Supabase) deploy independently, so there is always a window where versions are mismatched.

- Define the order: migrations → edge functions → frontend, with every change backward compatible one step (doc 19 Phase 19.4, doc 18 Phase 18.6).
- Never ship a migration that breaks the currently deployed functions.
- Never ship a function response change that breaks the currently deployed (or PWA-cached) client.

### Phase 24.4 — Pre-deploy gates

Confirm the prod path enforces, in order: quality gate → migration checks (version + security) → schema diff artifact reviewed → backup → deploy → smoke → (on failure) automatic rollback trigger.

Add a **manual approval** step with the schema diff attached for prod.

### Phase 24.5 — Post-deploy verification

Extend `ci-smoke.sh` beyond public GETs:

- One authenticated read per tier (using a dedicated test account).
- One safe write path, end to end, that is cleaned up afterward.
- Asset header assertions (doc 16).
- PWA version endpoint returns the new build.
- Cron schedules present and next-run times sane.

**Edge case:** smoke tests that write must be idempotent and clean up, or they pollute the environment. Never run write smoke tests against prod with real-looking data (`?testing=true` pipelines are explicitly forbidden by repo rule — use a dedicated test org instead).

### Phase 24.6 — Cutover plan (Phase B)

Owned by the CI/CD plan; this doc only asserts the prerequisites. Before cutover:

- [ ] Docs 21, 22, 23 exit gates met (the launch blockers).
- [ ] Rollback rehearsed with a measured RTO.
- [ ] Load test run (doc 17).
- [ ] Backup + restore verified including Storage.
- [ ] Monitoring and alerting live (doc 27).
- [ ] Legacy data migration rehearsed on a copy.
- [ ] A documented go/no-go with named owners.

### Phase 24.7 — Zero-downtime and maintenance mode

- `platform_settings.maintenanceMode` exists — verify the whole app honors it, including edge functions, and that it is not served from a long cache (doc 11).
- For migrations that cannot be zero-downtime, define the maintenance window procedure and guest-facing messaging.

## Edge cases

- **Vercel preview deployments** point at hosted dev Supabase. A preview with production secrets would be a serious leak — verify preview env scoping.
- **Branch protection**: listed as an operator-blocked item in the prior audit. Confirm `main` and `develop` require passing CI and review.
- **Migration + function deploy race** — deploying functions before migrations means a function queries a missing column. Enforce order in the workflow, not by convention.
- **PWA stale clients** after deploy (docs 01, 16) — chunk-error boundary plus update prompt.
- **Cron schedules live in the hosted DB** (`pg_cron`), not `config.toml`. A fresh project has none until the scheduling migration runs, and they fail closed without Vault secrets (P2-6). Verify after every environment creation.
- **Secrets are not in the repo**, so a new environment starts non-functional until every secret is set. Maintain a checklist; `bun run env:status` plus the Phase 24.1 assertion covers this.
- **Rollback does not undo third-party side effects** — emails sent, payments captured, Meta posts published. Rollback restores the database, not the world. Document what is unrecoverable.

## Exit gate

- [ ] Environment matrix verified against live projects; deploy-time env var assertion in place. Not attempted — hosted access needed.
- [ ] Rollback rehearsed on hosted dev with a measured, documented RTO. Still the largest residual risk in the folder.
- [x] Deploy ordering enforced in the workflows — verified by reading the deploy scripts (migrations before functions, sequential within one script, not separate racing CI jobs).
- [ ] Prod path has a manual approval with the schema diff attached. Not verified this session.
- [ ] Smoke tests cover authenticated reads, a cleaned-up write, asset headers, PWA version, and cron presence. Not attempted — needs hosted.
- [ ] Branch protection confirmed on `main` and `develop`. **Checked: not enabled.** Operator work.
- [ ] Preview env scoping verified — no production secrets in previews. Not verified this session.
- [ ] Cutover prerequisite checklist complete with named owners. Blocked on docs 21/22/23 not being fully closed.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/deployment.md` (mandatory), `docs/archive/operations/ci-cd-environment-matrix.md`, `docs/archive/operations/dev-staging-environment.md`, the CI/CD plan folder.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A — platform operations, recorded in workflow run history.
