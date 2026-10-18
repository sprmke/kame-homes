---
title: 'Production readiness launch audit (consolidate, re-verify, close gaps)'
status: planned
tags: [workflow, planned, production-readiness, security, owasp, qa, testing, launch]
updated: 2026-10-19
stage: in-progress
kind: plan
---

# Production readiness launch audit

## Goal

Get to a state where we can say, with evidence, that the multi-tenant app is ready for production. Concretely:

1. **One home.** Every production-readiness, launch, security, QA, and operator checklist we have written lives in one folder with one master ledger.
2. **Re-verified, not re-claimed.** Every item that was marked done, partial, or "verified" is re-checked against the **current** `develop` tree and a **freshly deployed** hosted dev (`fwor…`). Nothing counts as done because an older session said so.
3. **No missing modules.** Every shipped module and route (including everything built after the 2026-09-16 checklist was written) has a readiness card with explicit pass/fail criteria.
4. **OWASP coverage.** A structured pass against OWASP Top 10:2025, OWASP API Security Top 10 (2023), OWASP Top 10 for LLM Apps (2025), and ASVS 5.0 Level 2, mapped to concrete tests.
5. **Two final lists.** An **All good** list (verified with evidence) and a **To fix** list (defects, gaps, operator actions, decisions), every row tagged and linked.

This plan is an **audit and verification** plan. It fixes only what blocks the audit itself (red CI, a broken dev deploy). Everything else it finds goes onto the To fix list for follow-up plans.

## Why now: what the discovery pass found (2026-10-19)

These findings are why "already done" claims can't be trusted as written:

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                             | Impact                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **CI is red on `develop`** for the last 127 commits (last green CI `68993f65`, 2026-09-27). Failing: `Edge handler tests (Deno)` and `Unbounded query guard`.                                                                                                                                                                                                                                       | Any "tests green" claim after 09-27 is unproven.                                                                                                                                                                                                                                       |
| F2  | **Hosted dev is stale.** Last green `CD Dev` was `86df2182` (2026-09-23, run `35898933371`). Since then: **161 commits, 17 new migrations, 70 edge-function folders changed** never reached `fwor…`. `CD Dev` fails at the same unbounded-query guard.                                                                                                                                              | Marketing themes, guest trip hub, public listing hardening, AI mode, system health, etc. were never tested on hosted dev.                                                                                                                                                              |
| F3  | `Sync Help Center content (dev)` workflow also failing on every recent push.                                                                                                                                                                                                                                                                                                                        | Help center content on dev is stale.                                                                                                                                                                                                                                                   |
| F4  | Unmerged branch `feature/architecture-phase-1` (same tip as `feature/marketing-ai-image-quality-hardening`): 20 commits ahead of `develop`, 179 files, +34,638 / −57,862. Includes `cf63ba98 feat(*): wire sentry alerts for ui and edge`.                                                                                                                                                          | **Corrected in Phase 0:** Sentry and `EdgeError` are already on `develop`; the branch adds nothing app-facing, and the −57k lines are `develop`'s own progress. Recommendation: do not merge. See [`production-readiness/evidence/phase0-snapshot.md`](./evidence/phase0-snapshot.md). |
| F5  | OWASP is mentioned in exactly one doc (2 lines). No structured OWASP pass exists.                                                                                                                                                                                                                                                                                                                   | Security coverage is spread across audits with no category-by-category proof.                                                                                                                                                                                                          |
| F6  | Readiness content is scattered across **5 stage folders** (planned, in-progress, for-testing, done, guides/testing) and ~45 files. Indexes have drifted: `planned/README.md` lists the checklist folder and `performance-optimization-production-readiness` as "not started" (the file is in `for-testing/`); `in-progress/README.md` lists `activity-modal-ui-polish` (file is in `for-testing/`). | Nobody can answer "what is left before launch" from one place.                                                                                                                                                                                                                         |
| F7  | Docs in `done/` still carry many unchecked boxes, e.g. `paymongo-subscription-billing` (41 open / 0 checked), `ai-receptionist-production-readiness` (16 open), `remove-google-calendar-sheets` (146 open), `free-tier-manual-booking-workflow` (25 open), `guest-form-configurable-sections` (49 open), `review-approval-workflow` (11 open), `production-readiness-hardening` (11 open).          | Some are stale boxes, some may be real untested work. Must be triaged, not assumed.                                                                                                                                                                                                    |
| F8  | Checklist folder (`production-readiness-checklist/`, written 2026-09-16) predates: marketing themes, AI poster studio, collage editor, AI chat mode, guest trip hub, public listing hardening, system health, for-hosts v3, org portfolio analytics redesign, activity modal polish, two-way reviews (planned).                                                                                     | New modules have no readiness criteria.                                                                                                                                                                                                                                                |
| F9  | Operator P0 list (`cost-abuse-security-pending-from-user.md`) has every box unchecked (Turnstile, Auth captcha, GCP billing cap, Maps key lock, spend alerts, Vault cron secrets, hosted-dev verification V-1..V-5). P0-7 (branch protection) was done 2026-09-19 but never ticked there.                                                                                                           | Launch blockers that need the operator are not tracked with current status.                                                                                                                                                                                                            |
| F10 | Launch blockers per the checklist: **21 Auth/permissions** and **22 Security/RLS** still partial; **23** closed but enforcement is **off by default** pending an operator watching traffic.                                                                                                                                                                                                         | Must be re-verified on the redeployed dev.                                                                                                                                                                                                                                             |

## Scope

### In

- Inventory, consolidation, and re-tagging of every readiness-related doc (list in **Phase 1**).
- Restoring a trustworthy baseline: green CI, hosted dev deployed from current `develop`, decision on the unmerged branch.
- Re-running every automated suite and guard, plus adversarial/security probes, against local and **hosted dev**.
- Module-by-module functional QA (manual + browser automation) on hosted dev at 375 / 768 / 1280 px.
- OWASP Top 10:2025, API Top 10, LLM Top 10, ASVS 5.0 L2 mapping and tests.
- Non-functional checks: performance, reliability/restore drill (dev only), observability, privacy/legal, email deliverability, accessibility, SEO.
- Final All good / To fix report, GitHub issues for every To fix row, and a go/no-go scorecard per launch gate.

### Out

- **Any production write.** No `deploy:supabase`, `db push`, `functions deploy`, remote migrations, prod secrets, or prod restore without the user saying **`kamewave`** in that message (`no-prod-deploy.mdc`). Prod items are listed as operator steps only.
- Creating mt-prod or migrating legacy data (owned by `ci-cd-environments/` Phase B and `legacy-to-mt-prod-migration.md`). This plan only rehearses and checks readiness.
- Fixing the defects the audit finds (beyond Phase 0 unblockers). Each fix gets its own plan or issue.
- Planned-but-unbuilt modules (two-way reviews, trust and safety reporting, dashboard mobile v2, etc.): listed as **not launch scope** and excluded from the gate unless product says otherwise.

## Approach

### Principles

1. **Evidence or it didn't happen.** A row is ✅ only with: environment, git SHA, date, and a pointer to the proof (CI run URL, command output saved under `evidence/`, screenshot, or Playwright report).
2. **Current tree, current deploy.** Evidence older than the Phase 0 baseline SHA is downgraded to "stale" and re-run.
3. **Don't redo good work.** Prior audits stay as inputs. We re-run their verification steps, we don't rewrite their analysis.
4. **Safe environments only.** Destructive and adversarial tests run on the **local** Docker stack first, then hosted **dev**. Never prod.
5. **Audit, then fix.** Findings go on the To fix list with severity. Only Phase 0 unblockers are fixed inside this plan.

### Status tags (used in every ledger row, card, and doc frontmatter)

| Tag | Frontmatter `readiness:` | Meaning                                                              |
| --- | ------------------------ | -------------------------------------------------------------------- |
| ✅  | `verified`               | Re-verified on the baseline SHA with linked evidence                 |
| 🟡  | `unverified`             | Code exists, claimed done, not yet re-verified on the baseline       |
| 🔴  | `failing`                | Re-test failed, or a defect was found                                |
| ⛔  | `operator-blocked`       | Needs keys, dashboards, money, or a human account (operator owns it) |
| 🧭  | `decision-needed`        | Product/owner decision required before it can close                  |
| ⏸️  | `deferred`               | Accepted as not needed for launch, with a written reason             |
| 🆕  | `untracked`              | Gap found by this audit, had no checklist before                     |

Every row also carries: `id`, `area`, `severity` (`blocker` / `high` / `medium` / `low`), `launch_gate` (A–G, see Phase 10), `owner` (`agent` / `operator` / `product`), `evidence`, `last_verified` (SHA + date).

Frontmatter added to every doc in the new folder:

```yaml
readiness: unverified # one of the tags above, worst open item wins
launch_blocker: true|false
launch_gate: A # A–G
last_verified: '<sha> <yyyy-mm-dd>'
```

### Target folder layout

One umbrella folder. Because work starts the moment Phase 0 begins, it lives under `in-progress/` (folder = stage). Each moved doc keeps its own original `stage:` in frontmatter as `origin_stage:` so history is not lost.

```
docs/workflow/in-progress/production-readiness/
├── README.md                    # master dashboard: gates, counts per tag, links
├── LEDGER.md                    # every open/closed item, one row each, IDs PR-###
├── ALL-GOOD.md                  # final verified list (Phase 10)
├── TO-FIX.md                    # final fix list, grouped by gate + severity (Phase 10)
├── this-plan.md                 # this plan, moved here at /workflow-start
├── checklist/                   # existing 00–30 docs (moved as-is) + baselines/
├── audits/                      # prior readiness passes (moved, tagged)
├── security/                    # OWASP + API + LLM + ASVS matrices, pentest log
├── modules/                     # one readiness card per module (new)
├── qa/                          # QA batch + per-module QA runs (moved + new)
├── operator/                    # every operator/third-party action in one list
├── environments/                # test accounts, seed matrix, env/secrets matrix
└── evidence/                    # dated run outputs, screenshots, reports (gitignored if large)
```

**Trade-off:** moving `done/` and `for-testing/` docs into one `in-progress/` folder bends the "folder = stage" rule. The alternative (leave files in place and only build an index) is what we have today, and it has already drifted. We keep `origin_stage` in frontmatter, and the README explains the exception. See Open question Q1.

---

## Implementation tasks

### Phase 0 — Restore a trustworthy baseline (blocks everything)

Without this, every later test runs against code that dev doesn't have.

**Decisions (2026-10-19):** Q1 umbrella folder · Q2 review first (done: do not merge) · Q3 PostHog for launch · Q4 in-progress modules ship behind a flag unless fully verified.

- [x] **0.1 Snapshot.** Record `develop` SHA, uncommitted files (`git status`; today: `for-hosts.md` guide, planned README, `two-way-reviews.md`, `batch-commit-run-6.sh`, `HostDashboardTourPlayer.tsx`), branch list, latest CI and CD run IDs → `evidence/phase0-snapshot.md`.
- [~] **0.2 Fix CI red (F1).** Local `ci:quality` green 2026-10-19 (fixes uncommitted; GitHub CI pending push). See evidence. Reproduce locally: `bun run test:edge:handlers` and `bash scripts/dev/check-unbounded-select.sh`. Fix root causes (or add a reviewed allowlist entry with reason, never a blanket skip). Then `bun run ci:quality` fully green locally.
- [~] **0.3 Fix Help Center sync workflow (F3).** Root cause: empty `DEV_SUPABASE_SERVICE_ROLE_KEY`; secret set 2026-10-19, confirm on next run. Read failing job log (`gh run view --log-failed`), fix, confirm green.
- [x] **0.4 Unmerged branch decision (F4).** Diff `feature/architecture-phase-1` against `develop`, classify the 20 commits (Sentry wiring, impeccable skill syncs, docs, shared HTTP helpers), and check the −57,862 lines for anything that would delete live code. Output: keep / cherry-pick / abandon recommendation → **Q2** for the user. Also decide **PostHog vs Sentry** for error tracking (Q3); the checklist (doc 27/28) assumes PostHog.
- [ ] **0.5 Push and redeploy hosted dev (F2).** After CI is green on GitHub, let `CD Dev` deploy to `fwor…` (or `bun run deploy:supabase:dev` with its built-in DEV ref check + typed confirm). Confirm all 17 pending migrations applied (`bun run migrations:status:dev`), all functions deployed, Vercel `kame-homes` preview on `dev.kamehomes.space` built from the same SHA.
- [ ] **0.6 Post-deploy smoke.** `ci-smoke.sh`, `verify:deployed-preview`, `get-health`, adversarial auth live suite, cron probe. Record as the **baseline SHA**. All evidence older than this SHA is now "stale".
- [ ] **0.7 GitHub environment gaps.** Check `development` environment for `DEV_DB_URL` and `SMOKE_PROPERTY_SLUG` (both blocked checklist rows 00/12/14/24). If missing → operator list.

Exit: CI green on `develop`, `CD Dev` green on the same SHA, dev UI + DB + functions all on that SHA.

### Phase 1 — Consolidate every readiness doc into one folder

Pure moves plus link rewrites. No body edits except the frontmatter tags and a one-line "moved from" note.

**Done 2026-10-19.** 50 tracked files moved (`git mv`), plan + evidence moved in, 46 docs tagged (`origin_stage`, `readiness: unverified`, `launch_gate`, `launch_blocker: tbd`, `last_verified: none`; `stage: in-progress`). "Moved from" lives in `origin_stage` instead of a body line. Refs rewritten in ~85 files (docs, scripts, edge/UI comments); shipped migrations and old `batch-commit-run-*` scripts left as history. 52 pre-existing stale links in touched docs fixed too. Remaining broken links: 11 repo-file links in `migration-runbook.md` (pre-existing, wrong depth).

- [x] **1.1 Create** `docs/workflow/in-progress/production-readiness/` with the layout above; move this plan in via `/workflow-start` (`scripts/dev/workflow-move.sh start production-readiness-launch-audit`), then into the folder.
- [x] **1.2 Move with `git mv`** (history kept):

| From                                                               | To                                    | origin_stage |
| ------------------------------------------------------------------ | ------------------------------------- | ------------ |
| `planned/production-readiness-checklist/` (31 docs + `baselines/`) | `checklist/`                          | planned      |
| `for-testing/pre-production-launch-audit.md`                       | `audits/`                             | for-testing  |
| `for-testing/production-readiness-audit-and-remediation.md`        | `audits/`                             | for-testing  |
| `for-testing/cost-abuse-security-production-readiness.md`          | `audits/`                             | for-testing  |
| `for-testing/performance-optimization-production-readiness.md`     | `audits/`                             | for-testing  |
| `for-testing/posthog-analytics-production-readiness.md`            | `audits/`                             | for-testing  |
| `for-testing/captcha-anti-spam-hardening.md`                       | `audits/`                             | for-testing  |
| `for-testing/ai-llm-best-practices-hardening.md`                   | `audits/`                             | for-testing  |
| `for-testing/public-listing-pages-hardening.md`                    | `audits/`                             | for-testing  |
| `done/production-readiness-hardening.md`                           | `audits/`                             | done         |
| `done/ai-receptionist-production-readiness.md`                     | `audits/`                             | done         |
| `planned/parking-e2e-production-readiness.md`                      | `audits/`                             | planned      |
| `in-progress/cost-abuse-security-pending-from-user.md`             | `operator/`                           | in-progress  |
| `in-progress/MODULE-DISPOSITION.md`                                | `qa/` (becomes input to module cards) | in-progress  |
| `for-testing/QA-BATCH.md`                                          | `qa/`                                 | for-testing  |

- [x] **1.3 Link, don't move** (these are feature plans with their own life; the module card links to them): every other `for-testing/*` feature plan, `in-progress/ci-cd-environments/`, `in-progress/super-admin-system-health.md`, `planned/super-admin-service-cost-monitoring.md`, `planned/ai-paid-provider-and-production-quotas.md`, `planned/activity-log-followups.md`, `qa/property-dashboard/*`, `guides/testing/*`, `archive/operations/*` runbooks (`production-deployment.md`, `migration-runbook.md`, `incident-response.md`, `secret-rotation.md`, `hosted-dev-rollback-rehearsal.md`, `legacy-to-mt-prod-migration.md`, `alerting-setup.md`, `github-environments-setup.md`).
- [x] **1.4 Rewrite references** to moved paths. Known code/script references that must change in the same commit:
  - `scripts/performance/capture-baseline.mjs` (writes baselines to the old path)
  - `scripts/dev/check-select-star.sh`, `scripts/dev/check-unbounded-select.sh` (comments + any allowlist path)
  - `ui/index.html` (comment referencing doc 04)
  - other `scripts/performance/*`, `scripts/deploy/hosted-dev-rollback-rehearsal-preflight.sh`, `scripts/README.md`
  - `docs/PROJECT.md`, `docs/architecture/{edge-functions,pwa}.md`, `docs/archive/operations/*`, `docs/guides/routes/admin/platform-tools.md`, `docs/guides/testing/cost-abuse-verification.md`, `.cursor/rules/*`, `CLAUDE.md` if referenced
  - Find with `rg -l '<old-path>'` for every moved file; verify with a link check (below).
- [x] **1.5 Link check.** Run `bash scripts/dev/check-retired-docs-paths.sh` plus a one-off markdown relative-link checker over `docs/` (fail on any broken link into the moved files).
- [x] **1.6 Fix index drift (F6).** Update `planned/README.md`, `in-progress/README.md`, `for-testing/README.md`, `done/README.md`, `docs/README.md`, `intake/_to-plan.md` (run `bun run sync:workflow-scratchpads`). Fix the two known wrong rows (performance-optimization, activity-modal-ui-polish).
- [x] **1.7 Tooling check.** Confirm `workflow-move.sh`, `check-workflow-scratchpads.sh`, Obsidian `Workflow.base` / `Route Guides.base` still work with a nested folder; adjust if they assume flat files.

Exit: one folder, zero broken links, `ci:quality` still green (scripts with moved paths still pass).

### Phase 2 — Build the master ledger (extract and dedupe)

**Done 2026-10-19.** `LEDGER.md` seeded (PR-001..PR-107). Raw extract 1,268 items → ~120 unique rows. F7 stale `done/` boxes tabled. P0-7 / parking ungate / superhost files reconciled ✅. Dashboard counts on folder README.

- [x] **2.1 Extract** every open item into `LEDGER.md` with ID `PR-###`, from:
  - checklist 00–30 "Remaining work to finalize" tables + exit gates
  - every audit's open boxes, residuals, "accepted" and "deferred" lists
  - operator P0-1..P0-7, D-1..D-4, V-1..V-5
  - QA batch #1–#9 and every for-testing feature plan's manual QA section
  - **done/ docs with unchecked boxes (F7)**: triage each box as (a) stale box, actually shipped → verify and tick; (b) real untested work → ledger row; (c) explicitly out of scope → note. Start with `paymongo-subscription-billing`, `ai-receptionist-production-readiness`, `free-tier-manual-booking-workflow`, `guest-form-configurable-sections`, `review-approval-workflow`, `production-readiness-hardening`, `verification-scope-split`, `listing-contract-renewal-modal`, `parking-e2e-phase*`, `super-admin-console-overhaul`, `unit-handoff-phase-a`, `property-calendar-page`, `ai-settings-super-admin-ownership`. (`remove-google-calendar-sheets`, `docs-obsidian-tooling-sync`, `docs-workflow-vault` are likely stale boxes; confirm quickly.)
  - `guides/testing/*-manual.md` unchecked steps (ai-dashboard-assistant 22, cost-abuse 6, super-admin 5, contract-expiry 5)
- [x] **2.2 Dedupe.** The same item often appears in 2–4 docs (e.g. restore drill in pre-prod audit, docs 24/30, QA #9; branch protection in hardening, P0-7, docs 24/26). One ledger row, all sources listed.
- [x] **2.3 Initial tag** every row with the tag set above. Default for anything claimed done before the baseline SHA: 🟡.
- [x] **2.4 Reconcile known stale claims**: P0-7 branch protection (done 2026-09-19 per doc 26, verify with `gh api` and tick); `PARKING_INTERIM_UNGATED_FEATURES` (removed 2026-09-09, confirm with `rg`); orgSuperhost missing files note in the hardening doc (confirm present).
- [x] **2.5 Dashboard.** `README.md` shows counts per tag, per gate, per owner, and the top 10 blockers.

### Phase 3 — Gap analysis: modules and routes with no readiness coverage

- [x] **3.1 Module inventory** from code, not docs: `ui/src/features/{guest,dashboard}/*`, `supabase/functions/*` (314), routes in `ui/src/routes/**`, crons, webhooks, storage buckets. Script: `scripts/dev/readiness-inventory.mjs` (new, read-only) prints module → routes → edge functions → e2e specs → route guide → plan doc.
- [x] **3.2 Module readiness cards** in `modules/<module>.md`, one per row below. Each card uses the **standard criteria** (3.3) and links its feature plan, route guide(s), QA doc, and tests.

| Area           | Modules (one card each)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest / public | Landing + explore; for-hosts (incl. v3 + tour film + pricing page); search + listing pages (properties, parkings, developments, services); property detail + showcase + calendar; guest booking form + success; SD form; guest review; vouchers (claim, wallet, reveal, redeem); stay guide; **guest trip hub** 🆕; booking documents; guest auth; guest account (profile, stays, trips, messages, tickets, favorites, wishlist); guest web chat; pay-parking + parking marketplace request/pay/status; legal pages; SEO (sitemap, robots, crawler middleware) 🆕; PWA install/offline/push |
| Host core      | Sign-in + accept-invite; onboarding + verification (tiers, Recommended) + setup guide; org selector/hub; org + property dashboards; bookings (property, org unified, parking) + workflow transitions + booking detail + AI booking summary/receipt validation; calendar + Airbnb channel sync; pricing + smart pricing + portfolio bundling; finance; maintenance; operations / staff / unit handoff; templates + email automations; settings (property/org/parking) + copy to properties + sensitive-settings OTP; contract renewal / listing lifecycle; import (smart AI importer)        |
| Team & trust   | Team RBAC (property, org granular, parking) + invites; activity log (feeds, entity panels, export, realtime, retention) + activity modal polish 🆕; superhost; announcements; help & support center (+ tickets)                                                                                                                                                                                                                                                                                                                                                                             |
| Comms          | Inbox (Meta Messenger/IG, web chat, AI replies, share links/files); notifications (in-app, Telegram, web push); Resend outbound email + inbound approval email (GAF/pet)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Growth / AI    | Marketing Studio: **themes** 🆕, design editor, **collage** 🆕, video (Remotion + Veo), **AI poster studio** 🆕, AI assets, calendar templates, guest review studio, Meta publishing; custom pages + page editor + public pages; AI dashboard assistant + **AI chat mode** 🆕; voice receptionist; analytics (property + **org portfolio redesign** 🆕) + Ask Analytics; AI usage metering + credits                                                                                                                                                                                        |
| Money          | Plans + PayMongo subscription billing (org-level) + feature gates; guest payment settings; parking payments + payouts + commission (Phases 3/4/8); AI credit top-up (planned, not launch scope unless decided)                                                                                                                                                                                                                                                                                                                                                                              |
| Super admin    | Overview, orgs/hosts/host detail, approvals, org subscriptions + pricing plans, payment settings, parking payouts, AI settings/usage, platform settings, rate limits, audit log, global search, announcements, support, playbook, developments, step-up OTP, **system health** 🆕 (in progress)                                                                                                                                                                                                                                                                                             |
| Platform       | Crons (full inventory from `incident-response.md` + `pg_cron` on dev); webhooks (PayMongo, Meta, Resend inbound); storage buckets; realtime channels; maintenance mode + kill switches; multi-residence config (Azure-hardcoded today, see `multi-residence-config-decoupling.md`)                                                                                                                                                                                                                                                                                                          |

- [x] **3.3 Standard criteria per card** (each a checkbox with evidence):
  1. **Functional**: happy path + main unhappy paths (validation errors, empty data, network failure, concurrent edit).
  2. **Access control**: each role (anon, guest authed, owner, org admin scoped, property Full Access / Operations / Read Only, parking member, super admin, outsider from another org) can only see/do what the permission catalog says. UI gate and server gate both checked.
  3. **Plan gate**: behavior per tier (Free / Starter / Pro / Business) matches `plans-feature-matrix.md`; downgrade path.
  4. **Tenant isolation**: object IDs from another org/property return 403/404 (no IDOR) on every read and write.
  5. **Server-side validation** on every write (not only Zod in the browser).
  6. **Audit log**: mutations emit `activity_log` (or documented N/A).
  7. **Mobile native** at 375 and 768: bottom sheets not dropdowns, one bottom nav layer, 44 px targets, no horizontal scroll; desktop 1280.
  8. **States**: layout-matched skeleton, empty, error, offline where relevant.
  9. **Unsaved-changes guard** on manual-save surfaces.
  10. **Page title + favicon** per `page-titles.mdc`.
  11. **Accessibility smoke**: keyboard path, labels, contrast, axe 0 serious/critical.
  12. **Performance**: payload bounded/paginated, no N+1, acceptable LCP/INP on the route.
  13. **Observability**: errors captured with correlation id, no PII in logs.
  14. **Automated tests**: unit for logic, E2E `@smoke`/`@ci` for the primary journey; gaps listed.
  15. **Docs**: route guide current (behavior, permissions, Testing column, host-facing knowledge).
  16. **Prod config**: required secrets, crons, Vault entries, third-party setup listed for prod.
- [x] **3.4 Route coverage map.** For every route guide (≈100 under `docs/guides/routes/`): has E2E? has unit? Testing column filled? Output table in `modules/ROUTE-COVERAGE.md`; missing = 🆕 row.
- [x] **3.5 Edge function coverage map.** Use `scripts/dev/audit-edge-functions.mjs` + `audit-auth-matrix.mjs` output: for all 314 functions, record auth tier, rate limit, cache class, validation, handler test yes/no, activity log yes/N/A. Missing = 🆕 row.
- [x] **3.6 Cross-cutting gaps not in any checklist yet** (add as 🆕 checklist docs `checklist/31-…` onward):
  - 31 **Privacy and legal**: Philippine Data Privacy Act (RA 10173) obligations, privacy policy + terms current with features (AI, voice recording, analytics, push), data subject requests (export/delete for guest and host), retention for guest IDs/receipts, cookie/analytics consent.
  - 32 **Email deliverability**: SPF/DKIM/DMARC on sending domains, bounce/complaint handling (`email_suppressions`), template rendering across clients, `static_files` for email templates in `config.toml`.
  - 33 **Accessibility** (WCAG 2.2 AA): axe sweep on all primary routes, keyboard, screen reader spot checks.
  - 34 **SEO + public discoverability**: sitemap, robots, canonical, meta/OG, crawler middleware, no indexing of dev.
  - 35 **Business-logic integrity**: double booking race, voucher double claim, credit wallet race, payment amount tampering, workflow transitions out of order, timezone (Asia/Manila) and date-format edges (`MM-DD-YYYY` vs `YYYY-MM-DD`), DST-free but midnight boundaries.
  - 36 **Browser and device matrix**: Chrome, Safari iOS, Android Chrome, Firefox; PWA on iOS + Android.
  - 37 **Third-party failure modes**: Gemini/Groq down, Resend down, PayMongo down, Meta token expired, Maps quota hit → graceful degradation.
  - 38 **Supply chain**: lockfile integrity, `bun audit`/OSV, pinned Deno remote imports, GitHub Actions pinned by SHA, Dependabot triage.

### Phase 4 — Test environments, accounts, and fixtures

- [ ] **4.1 Environment matrix** (`environments/ENVIRONMENTS.md`): local Docker stack, hosted dev (`fwor…` + `dev.kamehomes.space`), legacy prod (read-only, never touched), mt-prod (does not exist yet). For each: what tests are allowed.
- [ ] **4.2 Seed matrix** (local + dev): orgs on Free / Starter / Pro / Business; each with ≥2 properties + 1 parking; members for every role/template; one scoped org admin; a guest account with past + upcoming stays; an unrelated "outsider" org for IDOR tests; a large-tenant org (≥200 bookings, ≥200 activity rows) for pagination/virtualization. Reuse `authParitySeed` and existing QA seeds; add `scripts/dev/seed-readiness-matrix.*` only if gaps remain.
- [ ] **4.3 Test accounts doc** (no passwords committed): which email maps to which role/tier, where credentials live (local password manager / `supabase/.env.dev.local`).
- [ ] **4.4 Sandbox credentials needed** → operator list: PayMongo **test** keys + webhook secret on dev, Turnstile test + real keys on dev, Meta test app/page, Resend dev domain, paid or test Gemini key, VAPID keys + `PUSH_FANOUT_SECRET`, Google Maps restricted key, `*_CRON_SECRET` Vault entries.

### Phase 5 — Automated verification sweep (local, then hosted dev)

Run everything that already exists on the baseline SHA and record results in `evidence/phase5-<date>.md`.

- [ ] **5.1 Quality gate**: `bun run ci:quality` (lint, type-check, filenames, Vitest, Deno, handlers, build, all static guards).
- [ ] **5.2 Unit**: `bun run test`, `test:coverage:lib`, `node scripts/dev/lib-unit-test-inventory.mjs` (0 missing), `lib-behavioral-coverage-audit.mjs`.
- [ ] **5.3 Edge**: `test:edge`, `test:edge:handlers`, `check:edge-types`.
- [ ] **5.4 E2E**: `test:e2e:smoke`, `test:e2e:ci`, `test:e2e:plans`, mobile/tablet viewport projects, plus the full suite once; record flaky tests.
- [ ] **5.5 Plans/RBAC**: `check:plan-catalog` on fresh local DB, `planGateCoverage.test.ts`, plan↔permission coverage test.
- [ ] **5.6 DB**: `bun run db:reset` clean replay of all 390 migrations; `check-migration-versions.sh`, `check-migration-security.sh`; RLS probe (`probe-rls-anon-local.sh`) for `anon` + `authenticated`; Supabase advisors (security + performance) on dev (read-only).
- [ ] **5.7 Static guards** individually (so one failure doesn't mask another): cache-class, select-star, unbounded-select, serve-public-rate-limit, authenticated-rate-limit, vercel-headers, storage-cache-control, CSP theme hash, public asset size, bundle budget, tracked secrets, `audit-edge-functions.mjs --check`, `audit-auth-matrix.mjs --check`.
- [ ] **5.8 Hosted dev probes**: `ci-smoke.sh` (with `SMOKE_PROPERTY_SLUG`), `verify:deployed-preview`, adversarial auth live suite, cron probe, edge latency baseline, `abuse-public-endpoints.sh`, `check-cors-origins.sh`, `abuse-storage-anon-read.sh` (V-2).
- [ ] **5.9 AI evals**: `bun run eval:ai` offline + live (live needs key).
- [ ] **5.10 Lighthouse** 3× median on the 9 budget routes on dev (doc 00).

Every failure → 🔴 ledger row with the command and output.

### Phase 6 — OWASP and security pass

Output: `security/OWASP-TOP10-2025.md`, `security/API-TOP10-2023.md`, `security/LLM-TOP10-2025.md`, `security/ASVS-5-L2.md`, `security/PENTEST-LOG.md`. Each category row: what we have (link), how we test it, result, tag.

- [ ] **6.1 OWASP Top 10:2025 mapping and tests**

| Category                                  | What to test here                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A01 Broken Access Control                 | IDOR on every ID-taking function (all 314) with outsider + wrong-role tokens; guest booking token enforce + grace (`GUEST_BOOKING_ACCESS_ENFORCE=true` on dev, V-5); browser direct-table writes vs RLS; super-admin routes as non-admin; parking vs property scope crossover              |
| A02 Security Misconfiguration             | CORS allowlist, CSP (Report-Only → enforce readiness, collect reports), security headers on Vercel, `verify_jwt` policy per function, storage bucket policies (5 guest-doc buckets `TO public` read noted in hardening doc), source maps not public, debug endpoints, error detail leakage |
| A03 Software Supply Chain Failures        | `bun audit` / OSV-Scanner, Dependabot backlog, pinned `esm.sh`/`deno.land` imports, GitHub Actions pinned to SHA, lockfile committed, third-party script inventory (`third-party-origins.md`)                                                                                              |
| A04 Cryptographic Failures                | HMAC tokens (guest access, step-up sudo, invites) algorithm + TTL + constant-time compare; webhook signature verification (PayMongo, Meta, Resend); secrets never in client bundle (`rg` the build output); TLS only                                                                       |
| A05 Injection                             | SQL via RPC args and `.or()`/filter string building; XSS in rich text, custom pages, page editor, chat, marketing text (DOMPurify coverage); email template injection; CSV/formula injection in exports; prompt injection (see LLM)                                                        |
| A06 Insecure Design                       | Business-logic abuse list (checklist 35): double booking, voucher reuse, credit wallet race, price/amount tampering on checkout, workflow skip; rate limits on costly flows                                                                                                                |
| A07 Authentication Failures               | OTP brute force + resend limits, captcha on auth (P0-2), session expiry, sign-out on all tabs + PWA, invite token reuse/expiry, OAuth redirect allowlist, super-admin step-up                                                                                                              |
| A08 Software or Data Integrity Failures   | Webhook replay/dedupe (`processed_paymongo_events`), service worker cache poisoning / stale data, CI deploy integrity (only from protected branch), migration ordering                                                                                                                     |
| A09 Security Logging and Alerting         | `activity_log` + super-admin audit coverage of mutations, auth failures logged, alerting actually wired (PostHog/Sentry, Q3), no PII in logs, log retention                                                                                                                                |
| A10 Mishandling of Exceptional Conditions | Fail-open vs fail-closed review (rate limiter, captcha, cron secrets on `ENVIRONMENT=production`), error envelopes don't leak stack/SQL, third-party outage behavior (checklist 37)                                                                                                        |

- [ ] **6.2 API Security Top 10 (2023)**: BOLA (= A01 sweep), broken auth, BOPLA (mass assignment: send extra fields like `organization_id`, `status`, `role`, `price` on every write), unrestricted resource consumption (payload size, pagination caps, upload size, AI cost), BFLA (admin functions with host token), sensitive business flows (booking, voucher, OTP), SSRF (`safeOutboundUrl.ts` coverage on every remote fetch: marketing, import, Meta, link previews), misconfiguration, inventory (every function in `config.toml` and deployed list matches; no orphan/old functions on dev), unsafe consumption of third-party APIs (validate Gemini/Meta/PayMongo responses).
- [ ] **6.3 LLM Top 10 (2025)** for dashboard assistant, AI mode, inbox AI replies, voice receptionist, marketing AI, smart pricing rationale, booking AI review, import: prompt injection via guest messages/uploaded docs/listing text; sensitive info disclosure across tenants; excessive agency (assistant tools respect permission leaves + confirmation on writes); system prompt leakage; improper output handling (render as text, zod output); unbounded consumption (quotas, platform ceiling); misinformation (AI verdict override exists).
- [ ] **6.4 ASVS 5.0 Level 2** checklist (condensed to rows that apply to a Supabase SPA): auth, session, access control, validation, stored crypto, error handling, data protection, communications, files/uploads, API, config. Each row → link to the test above or a 🆕 gap.
- [ ] **6.5 Tooling runs (dev only)**: OWASP ZAP baseline scan of `dev.kamehomes.space`; ZAP API scan against public edge endpoints; Semgrep (or CodeQL) SAST on `ui/src` + `supabase/functions` (doc 26 SAST row); gitleaks on full git history; `npm`-ecosystem OSV scan. Triage false positives in the log.
- [ ] **6.6 Manual pentest checklist** §6.2 of `guides/testing/cost-abuse-verification.md` (V-4), executed and logged step by step.
- [ ] **6.7 Upload attacks**: polyglot files, SVG with script, oversized, wrong MIME, path traversal names, on every upload endpoint (doc 20 says only some sniff magic bytes).

### Phase 7 — Module-by-module functional QA on hosted dev

- [ ] **7.1 Run QA batch #1–#9** (`qa/QA-BATCH.md`) on dev, recording pass/fail per step. Those needing keys get ⛔ until the operator provides them.
- [ ] **7.2 Run every for-testing feature plan's manual QA** (smart pricing, host onboarding setup guide, copy settings, host analytics, parking parity, mobile native redesign, org portfolio analytics, host tour film, marketing collage, marketing AI video, public listing hardening, activity modal polish, AI LLM hardening, superhost, verification tiers, PWA, step-up OTP, activity log, org granular permissions).
- [ ] **7.3 Walk each module card** (Phase 3) with browser automation at 375 / 768 / 1280, per role and tier, saving screenshots under `evidence/modules/<module>/`. Use the property-dashboard QA skill + `qa-walk-property-pages.mjs`, `qa-probe-plan-gates.mjs`, `qa-probe-rbac-nav.mjs`; extend the same pattern to org, parking, guest, and super-admin surfaces.
- [ ] **7.4 In-progress modules** (marketing themes, poster studio, guest trip hub, AI image quality, system health, AI chat mode): QA what is shipped, and tag as "not launch-ready" or "launch behind a flag/module-status" (ties to `module-status-management.md`).
- [ ] **7.5 Parking money path** (`audits/parking-e2e-production-readiness.md` pre-launch checklist): sandbox PayMongo end to end, refund/override path existence, 375 px passes for Phase 5/8 UIs, Playwright coverage for payment → endorsement → chat and cancel/expire/decline.
- [ ] **7.6 Cross-browser/device** spot pass (checklist 36) on the 10 most important journeys.
- [ ] **7.7 UX quality bar**: per module, note weird UI/UX (layout breaks, copy with AI tells or em dashes, missing loading states, double bottom bars, desktop-in-phone layouts) as 🔴 low/medium rows.

### Phase 8 — Non-functional checks

- [ ] **8.1 Performance**: bundle budget, Lighthouse medians (5.10), k6 public GET run on dev + large-tenant seed (doc 17), slowest edge functions from latency baseline, `pg_stat_statements` once `DEV_DB_URL` exists (docs 00/12/14).
- [ ] **8.2 Reliability**: **measured restore drill on hosted dev** (`hosted-dev-rollback-rehearsal.md`; top priority in docs 24/30), backup integrity check, maintenance mode toggle, kill switches (assistant, voice, push), cron heartbeat for every scheduled job, cron overlap guards (doc 15: 4/6 open).
- [ ] **8.3 Observability**: error tracking live on dev (PostHog or Sentry per Q3), alert routes defined, correlation id end to end incl. guest side, uptime monitor on `get-health`.
- [ ] **8.4 Privacy/legal** (checklist 31), **email** (32), **a11y** (33), **SEO** (34) executed.
- [ ] **8.5 Cost controls**: AI quotas + platform ceiling, Maps key restriction, spend alerts per provider (operator), storage growth/retention.

### Phase 9 — Operator and cutover readiness (list and rehearse, no prod writes)

- [ ] **9.1 One operator list** (`operator/OPERATOR-ACTIONS.md`) merging: P0-1..P0-7, D-1..D-4, V-1..V-5, GitHub env vars, sandbox keys (4.4), PostHog/Sentry projects, Vercel env per environment, Supabase Auth settings (captcha, redirect URLs, SMTP), DNS/email auth records, Meta app review, Google services approval, PayMongo Platforms. Each with "how to verify it's done".
- [ ] **9.2 Cutover rehearsal on dev only**: walk `production-deployment.md`, `migration-runbook.md` § production, `legacy-to-mt-prod-migration.md`, and `ci-cd-environments/` Phase B as a dry run; record every step that is unclear, missing, or would fail. Confirm `cd-prod.yml` stays gated (`CUTOVER_ENABLED` unset).
- [ ] **9.3 Prod env matrix**: every secret, Vault entry, cron, and env var prod will need, cross-checked against `.env.prod.example`, `config.toml`, and system-health registry.

### Phase 10 — Final report, tagging, and go/no-go

- [ ] **10.1 ALL-GOOD.md**: every ✅ row grouped by area, with evidence links.
- [ ] **10.2 TO-FIX.md**: every 🔴 / 🆕 / ⛔ / 🧭 row grouped by launch gate then severity, each with owner and a proposed fix plan or issue.
- [ ] **10.3 GitHub issues** for every agent-owned To fix row (label `production-readiness`, severity label, link back to `PR-###`).
- [ ] **10.4 Re-tag every doc** in the folder (`readiness:`, `launch_blocker:`, `last_verified:`), and flip prior audits to `done/`-equivalent status inside the folder where every row is ✅ or ⏸️.
- [ ] **10.5 Go/no-go scorecard** in `README.md`:

| Gate | Scope                                                                  | Go when                                                                                 |
| ---- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A    | Core booking platform (guest booking, host bookings, workflow, emails) | No blocker/high 🔴; OWASP A01/A05/A07 ✅; module cards ✅ for core modules              |
| B    | Security posture                                                       | Checklist 21 + 22 ✅; ZAP/SAST triaged; pentest log complete; CSP enforce decision made |
| C    | Money (subscriptions, guest payments, parking payments)                | Sandbox end-to-end ✅; refund/override path exists; webhook dedupe proven               |
| D    | AI / voice                                                             | Paid key + quotas + ceiling ✅; LLM Top 10 ✅; kill switches tested                     |
| E    | Comms (inbox/Meta, email, push)                                        | Deliverability ✅; Meta live on dev ✅ or module flagged off                            |
| F    | Operations (observability, backups, restore, crons, incident)          | Restore drill measured; alerts live; cron secrets set; on-call/comms channel named      |
| G    | Cutover (mt-prod + legacy migration)                                   | Rehearsal clean; operator list complete; `kamewave` unlock given by the user            |

- [ ] **10.6 Close-out**: summary to the user, keep folder in `in-progress/` until gates close, then `/workflow-done`.

## Execution notes

- **Order:** Phase 0 → 1 → 2 → 3 are sequential. Phases 4–8 can overlap once Phase 3 cards exist (5 before 7; 6 can run beside 7). Phase 9 runs beside 8. Phase 10 last.
- **Rough size:** Phase 0: 0.5–1 day. Phases 1–3: 1–1.5 days. Phases 4–5: 1 day. Phase 6: 2–3 days. Phase 7: 3–4 days (biggest). Phase 8: 1–2 days. Phases 9–10: 1 day. Operator wait time is extra.
- **Sessions:** one session per phase (or per area within Phase 7), per `ai-usage.mdc`. The ledger is the hand-off between sessions.
- **Permissions given:** the user granted full access to the **dev** environment for this work. Dev deploys use the dev scripts' own ref check. **Production stays untouched**; any prod step needs `kamewave` in the user's message.
- **Plans / RBAC:** N/A, no new host capability. **activity-log:** N/A, audit and docs only; any fix found later decides its own.

## Docs to update

| Doc                                                                                                                | When       | Why                                     |
| ------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------- |
| `docs/workflow/planned/README.md`, `in-progress/README.md`, `for-testing/README.md`, `done/README.md`              | Phase 1    | Moves + drift fixes                     |
| `docs/workflow/intake/_to-plan.md`                                                                                 | Phase 1    | Scratchpad links to the new folder      |
| `docs/README.md`, `docs/PROJECT.md`, `docs/architecture/{edge-functions,pwa,deployment}.md`                        | Phase 1    | Paths to moved docs                     |
| `docs/archive/operations/*` (alerting, scheduled jobs, github-environments, rollback rehearsal, migration runbook) | Phase 1    | Paths                                   |
| `scripts/README.md` + scripts listed in 1.4, `ui/index.html` comment                                               | Phase 1    | Paths                                   |
| `docs/guides/routes/*.md` Testing column                                                                           | Phase 3, 7 | Coverage truth                          |
| `docs/guides/testing/README.md`                                                                                    | Phase 5    | Link to readiness folder + new commands |
| `.cursor/rules/README.md`, `CLAUDE.md` (only if they link moved paths)                                             | Phase 1    | Paths                                   |

## Open questions

- **Q1 Folder placement.** Recommended: one umbrella folder at `docs/workflow/in-progress/production-readiness/`, moving prior audits (including two `done/` docs) into it with `origin_stage` kept in frontmatter. Alternative: keep files in their stage folders and only add the master ledger + index. The first matches "merge into one folder"; the second keeps the stage rule pure.
- **Q2 Unmerged `feature/architecture-phase-1` branch** (20 commits, Sentry wiring, large deletions): merge, cherry-pick selected commits (e.g. Sentry), or abandon? Phase 0.4 produces a recommendation first.
- **Q3 Error tracking provider:** PostHog error tracking (what checklist 27/28 and the PostHog plan assume) or Sentry (what the unmerged branch wires)? Pick one for launch.
- **Q4 Launch scope:** which in-progress modules (marketing themes, poster studio, trip hub, AI chat mode, system health) must be launch-ready versus shipped behind a flag or hidden?
- **Q5 Parking money at launch:** pilot with manual PayMongo links + manual disbursement, or keep parking payments off until sandbox end-to-end and the refund path exist?
