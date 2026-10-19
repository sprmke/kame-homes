---
title: 'Production readiness'
status: active
tags: [workflow, in-progress, production-readiness, security, qa, launch]
updated: 2026-10-19
stage: in-progress
kind: reference
---

# Production readiness

Every launch readiness checklist, audit, QA batch and operator list in one place. Plan: [`production-readiness-launch-audit.md`](./production-readiness-launch-audit.md).

**Folder = stage exception:** docs moved here from `planned/`, `for-testing/` and `done/` keep that history as `origin_stage` in frontmatter. They are re-verified against one baseline SHA before any is marked good. Do not move them back out with `workflow-move.sh`; that script only handles top-level stage folders.

## Status

| Item         | State                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline SHA | Not set. CD Dev `@ci` gate failed after #145 (Marketing Studio cold compile in CI, fix #177); baseline = first `develop` SHA that CD deploys cleanly                           |
| Hosted dev   | All 292 functions deployed 2026-10-19 from a local integration of #145 + #149 + #150 + #155 (health 200, cross-tenant probe clean)                                             |
| Phases 1–3   | Done ([#146](https://github.com/sprmke/kame-homes/pull/146)): folder, [`LEDGER.md`](./LEDGER.md), 57 module cards, checklists 31–38                                            |
| Phases 4–8   | Probes, OWASP matrices, 162-page walk, booking flow, perf/a11y fixes done; load test, restore drill, LLM probes blocked (see scorecard)                                        |
| Phase 9      | Operator list done; [prod env matrix](./environments/prod-env-matrix.md) done; cutover dry run partial                                                                         |
| Phase 10     | Scorecard below is a draft until the fix PRs merge and the baseline re-run passes                                                                                              |
| Fix PRs      | 19 merged into `develop` 2026-10-19 (admin merge, user-approved). Open: #153 (needs `workflow` token scope), #176 (CSP), #177 (CD gate warmup). See [`TO-FIX.md`](./TO-FIX.md) |
| Tag counts   | ✅ 9 · 🟡 43 · 🔴 3 · ⛔ 26 · 🆕 11 · 🧭 7 · ⏸️ 8 (105 items)                                                                                                                  |

## Go / no-go (draft, 2026-10-19)

Overall: **No-go**. Every gate still has an operator or merge dependency.

| Gate           | Verdict | Done                                                                                                                                                             | Still needed                                                                                                                                                |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Core booking | No-go   | Booking lifecycle verified on dev; guest-link tokens verified past grace; 162-page walk clean; entry chunk 496 → 151 KiB gzip (#152, #172), contrast fixed (PRs) | Merge #147–#152, #154, #156; re-run Lighthouse 3× median on baseline; listing map (Maps key, operator)                                                      |
| B Security     | No-go   | Adversarial auth 16/16, cross-tenant probes clean, RBAC matrix matches, upload sniffing everywhere, open redirect fixed, Actions pinned, audit triaged           | Merge #150, #151, #153, #155, #158, #159; Turnstile on prod (P0-1); Supabase Auth captcha (P0-2); CSP enforce decision; guest-chat bucket decision (PR-120) |
| C Money        | No-go   | No false-paid path (code); webhook signature + dedupe tested; down payment fixed on dev                                                                          | PayMongo sandbox keys and end-to-end run (PR-030); merge #149                                                                                               |
| D AI / voice   | No-go   | Provider fallback and outage handling tested                                                                                                                     | Paid Gemini key + billing cap (P0-3); LLM Top 10 live probes need the platform assistant on                                                                 |
| E Comms        | No-go   | Meta expiry handling tested; failed workflow emails surfaced (#157)                                                                                              | Merge #157; SPF/DKIM/DMARC check (operator); Meta live on dev or module flagged off                                                                         |
| F Operations   | No-go   | Prod env matrix complete, cron/Vault pairing clean, frozen lockfile everywhere                                                                                   | Restore drill with measured RTO (needs `DEV_DB_URL`); GitHub `development` secrets; alerts live; on-call channel named                                      |
| G Cutover      | No-go   | Operator list, env matrix, dry-run notes                                                                                                                         | mt-prod project; clean rehearsal; `kamewave` from the user                                                                                                  |

## Tags

Every doc carries `readiness`, `launch_gate`, `launch_blocker` and `last_verified` in frontmatter. Worst open item wins.

| Tag | `readiness`        | Meaning                                        |
| --- | ------------------ | ---------------------------------------------- |
| ✅  | `verified`         | Re-tested on the baseline SHA, evidence linked |
| 🟡  | `unverified`       | Claimed done, not re-tested on the baseline    |
| 🔴  | `failing`          | Re-tested and broken                           |
| ⛔  | `operator-blocked` | Needs a key, account or dashboard action       |
| 🧭  | `decision-needed`  | Needs a product call                           |
| ⏸️  | `deferred`         | Accepted for after launch, with reason         |
| 🆕  | `untracked`        | Gap found by this audit                        |

## Launch gates

| Gate | Area                                                 |
| ---- | ---------------------------------------------------- |
| A    | Core booking platform, public pages, performance     |
| B    | Security posture (auth, RLS, rate limits, anti-spam) |
| C    | Money (subscriptions, guest and parking payments)    |
| D    | AI and voice                                         |
| E    | Comms (inbox / Meta, email, push)                    |
| F    | Operations (observability, backups, crons, deploys)  |
| G    | Cutover (mt-prod, legacy migration, operator inputs) |

## Contents

| Folder / doc                                                                                                           | From        | Gate | Readiness |
| ---------------------------------------------------------------------------------------------------------------------- | ----------- | ---- | --------- |
| [`checklist/`](./checklist/README.md) (00 baseline + 01–30, `baselines/`)                                              | planned     | A–F  | 🟡        |
| [`audits/pre-production-launch-audit.md`](./audits/pre-production-launch-audit.md)                                     | for-testing | F    | 🟡        |
| [`audits/production-readiness-audit-and-remediation.md`](./audits/production-readiness-audit-and-remediation.md)       | for-testing | B    | 🟡        |
| [`audits/cost-abuse-security-production-readiness.md`](./audits/cost-abuse-security-production-readiness.md)           | for-testing | B    | 🟡        |
| [`audits/performance-optimization-production-readiness.md`](./audits/performance-optimization-production-readiness.md) | for-testing | A    | 🟡        |
| [`audits/posthog-analytics-production-readiness.md`](./audits/posthog-analytics-production-readiness.md)               | for-testing | F    | 🟡        |
| [`audits/captcha-anti-spam-hardening.md`](./audits/captcha-anti-spam-hardening.md)                                     | for-testing | B    | 🟡        |
| [`audits/ai-llm-best-practices-hardening.md`](./audits/ai-llm-best-practices-hardening.md)                             | for-testing | D    | 🟡        |
| [`audits/public-listing-pages-hardening.md`](./audits/public-listing-pages-hardening.md)                               | for-testing | A    | 🟡        |
| [`audits/production-readiness-hardening.md`](./audits/production-readiness-hardening.md)                               | done        | B    | 🟡        |
| [`audits/ai-receptionist-production-readiness.md`](./audits/ai-receptionist-production-readiness.md)                   | done        | D    | 🟡        |
| [`audits/parking-e2e-production-readiness.md`](./audits/parking-e2e-production-readiness.md)                           | planned     | C    | 🟡        |
| [`operator/cost-abuse-security-pending-from-user.md`](./operator/cost-abuse-security-pending-from-user.md)             | in-progress | G    | ⛔        |
| [`qa/QA-BATCH.md`](./qa/QA-BATCH.md)                                                                                   | for-testing | A    | 🟡        |
| [`qa/MODULE-DISPOSITION.md`](./qa/MODULE-DISPOSITION.md)                                                               | in-progress | A    | 🟡        |
| [`evidence/`](./evidence/phase0-snapshot.md)                                                                           | new         | —    | —         |

| [`LEDGER.md`](./LEDGER.md) | new | A–G | live |
| [`modules/`](./modules/README.md) (57 cards + route/edge maps) | new | A | 🟡 |
| [`security/`](./security/README.md) | new | B | 🟡 |
| [`environments/`](./environments/README.md) | new | F | 🟡 |

`TO-FIX.md` and `ALL-GOOD.md` land in Phase 10 from the ledger.
