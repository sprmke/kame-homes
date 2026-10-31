---
title: 'Production readiness'
status: active
tags: [workflow, in-progress, production-readiness, security, qa, launch]
updated: 2026-11-01
stage: in-progress
kind: reference
---

# Production readiness

Every launch readiness checklist, audit, QA batch and operator list in one place. Plan: [`production-readiness-launch-audit.md`](./production-readiness-launch-audit.md).

**Folder = stage exception:** docs moved here from `planned/`, `for-testing/` and `done/` keep that history as `origin_stage` in frontmatter. They are re-verified against one baseline SHA before any is marked good. Do not move them back out with `workflow-move.sh`; that script only handles top-level stage folders.

## Status

| Item         | State                                                                                                                                                                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline SHA | **`96eb9334`** (2026-11-01), after #185–#190. Hosted dev was deployed by `CD Dev` from `d4c63b07` (same edge tree, migrations in sync). Evidence: [`evidence/phase5-reverify-2026-11-01.md`](./evidence/phase5-reverify-2026-11-01.md)                                                               |
| Hosted dev   | Functions + DB are on `develop`; `20261316128950` (media-library tiers) applied by `CD Dev`; `get-health` ok. QA fixtures re-seeded after a data reset                                                                                                                                               |
| CI / CD      | `CI` green on `96eb9334`; **`CD Dev` green end to end** (quality → backup → migrations → functions → smoke → adversarial auth) for the first time since 2026-09-23                                                                                                                                   |
| Phases 1–3   | Done ([#146](https://github.com/sprmke/kame-homes/pull/146)): folder, [`LEDGER.md`](./LEDGER.md), 57 module cards, checklists 31–38                                                                                                                                                                  |
| Phases 4–8   | Automated sweep + hosted-dev probes re-run 2026-11-01 (IDOR, RBAC, invites, uploads, workflow, guest tokens, CORS, rate limits, storage, smoke, preview, AI evals, plan catalog, RLS, clean `db:reset`). Load test, restore drill, Lighthouse medians and LLM live probes still open (see scorecard) |
| Phase 9      | Operator list done; [prod env matrix](./environments/prod-env-matrix.md) done; cutover dry run partial                                                                                                                                                                                               |
| Phase 10     | Scorecard below is a draft until the remaining 🔴 / ⛔ / 🧭 rows close                                                                                                                                                                                                                               |
| Fix PRs      | #185–#190 merged 2026-11-01. No open readiness PRs                                                                                                                                                                                                                                                   |
| E2E `@ci`    | 297 passed · 9 skipped (marketing studio, PR-133) · 0 failed                                                                                                                                                                                                                                         |
| Tag counts   | ✅ 17 · 🟡 36 · 🔴 4 · ⛔ 26 · 🆕 15 · 🧭 7 · ⏸️ 8 (~113 items; PR-133…PR-139 added)                                                                                                                                                                                                                 |

## Go / no-go (draft, 2026-10-19)

Overall: **No-go**. Every gate still has an operator or merge dependency.

| Gate           | Verdict | Done                                                                                                                                                                                           | Still needed                                                                                                                                   |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A Core booking | No-go   | Booking lifecycle + guards re-verified on dev; guest-link tokens verified past grace; 162-page walk clean; host analytics view tracking; entry chunk 151 KiB gzip                              | Lighthouse 3× median on the baseline (PR-040); listing map needs the Maps key on dev (PR-116); bundle budget over by ~0.7 MiB (PR-134)         |
| B Security     | No-go   | IDOR 13/13 denied; RBAC matrix matches; invites + upload sniffing pass; guest-token enforcement; CORS allowlist; rate limits return 429; RLS probe on a fresh DB; Actions pinned (#153 merged) | Turnstile enforce on prod (PR-001), Supabase Auth captcha (PR-002); CSP still Report-Only (PR-012 decision); guest-chat bucket call (PR-120)   |
| C Money        | No-go   | No false-paid path in code; webhook signature + dedupe tested; down payment fixed on dev                                                                                                       | PayMongo sandbox keys + end-to-end run (PR-030); parking refund/override path decision (PR-031); double-booking constraint decision (PR-032)   |
| D AI / voice   | No-go   | Provider fallback + outage handling tested; live AI evals pass every gate (documents 4/4, blocks 98%, quality 98%, guest 97%)                                                                  | Paid provider key + billing cap (PR-003); platform USD ceiling (PR-006); voice receptionist terms/rollout (PR-004)                             |
| E Comms        | No-go   | Meta expiry handling tested; failed workflow emails surfaced (#157); inbound approvals documented                                                                                              | SPF/DKIM/DMARC verification (PR-073); Meta live on dev or module flagged off (PR-072); real-device push QA (PR-074)                            |
| F Operations   | No-go   | Prod env matrix + cron/Vault pairing clean; frozen lockfiles; CI and CD Dev green; fresh `db:reset` replays cleanly                                                                            | Restore drill with measured RTO (PR-024) — needs `DEV_DB_URL` (PR-025); alerts live + on-call channel (PR-027); migration-replay lint (PR-139) |
| G Cutover      | No-go   | Operator list, env matrix, dry-run notes; `cd-prod.yml` still gated                                                                                                                            | mt-prod project; clean rehearsal; operator inputs (DNS/SMTP/Meta/Google); `kamewave` from you                                                  |

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
