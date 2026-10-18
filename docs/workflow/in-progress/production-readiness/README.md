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

| Item                | State                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Baseline SHA        | Not set. Waits on CI fix [PR #145](https://github.com/sprmke/kame-homes/pull/145) + CD Dev redeploy |
| Phase 0 (baseline)  | Local CI green, fixes in PR. See [`evidence/phase0-snapshot.md`](./evidence/phase0-snapshot.md)     |
| Phase 1 (this move) | Done 2026-10-19                                                                                     |
| Ledger              | Phase 2 (`LEDGER.md`, then `TO-FIX.md` / `ALL-GOOD.md` at Phase 10)                                 |

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

Coming in later phases: `LEDGER.md`, `TO-FIX.md`, `ALL-GOOD.md`, `security/` (OWASP, API, LLM, ASVS matrices), `modules/` (one card per module), `environments/` (accounts, seeds, secrets matrix).
