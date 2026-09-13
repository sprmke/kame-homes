---
title: 'In-progress module disposition'
status: active
tags: [workflow, in-progress]
updated: 2026-09-14
stage: in-progress
kind: reference
---

# In-progress module disposition

Snapshot of every open module — what is **testing-only**, what is **real code**, and what **closes** vs **stays open**. Updated when workflow stage changes.

---

## For testing now (implementation complete)

Numbered batch: [`../for-testing/QA-BATCH.md`](../for-testing/QA-BATCH.md) (batches #1–#8). Other `for-testing/` docs carry their own § FOR TESTING / § Verify sections.

| Module                           | Stage       | Close after                       |
| -------------------------------- | ----------- | --------------------------------- |
| Superhost program                | for-testing | QA batch #1                       |
| Onboarding verification simplify | for-testing | QA batch #2                       |
| Host verification tiers          | for-testing | QA batch #3                       |
| CAPTCHA & anti-spam              | for-testing | QA batch #4 (+ Turnstile keys)    |
| PWA install / offline / push     | for-testing | QA batch #5 (+ dev deploy config) |
| Org granular team permissions    | for-testing | QA batch #6                       |
| Super Admin step-up OTP          | for-testing | QA batch #7                       |
| Org Activity & Audit Log         | for-testing | QA batch #8 (+ prod deploy)       |
| Cost / abuse / security          | for-testing | Operator P0 + V-1–V-5             |
| Production readiness remediation | for-testing | Operator P0 + V-1–V-5             |

Also in `for-testing/` (own checklists, not numbered): `smart-pricing-ai`, `host-onboarding-setup-guide`, `property-settings-copy-to-properties`, `host-analytics-module`, `parking-property-parity`, `mobile-native-redesign`, `posthog-analytics-production-readiness`.

---

## In progress — disposition

| Module                            | Verdict                                                                         | Remaining work                                                                                                                                                                             | Recommended action                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **marketing-module-refinement**   | Bug-fix slice **done**                                                          | Meta gaps split out → [`../planned/marketing-meta-publishing-gaps.md`](../planned/marketing-meta-publishing-gaps.md)                                                                       | **Done 2026-09-09** — [`../done/marketing-module-refinement.md`](../done/marketing-module-refinement.md) |
| **org-granular-team-permissions** | Phases 1–4 **shipped** (incl. AI assistant org-tool leaf audit)                 | Phase 5 QA matrix                                                                                                                                                                          | **Moved to for-testing 2026-09-09** — QA batch #6                                                        |
| **super-admin-step-up-otp**       | v1 **shipped** — 11 gated `serveSuperAdmin` mutations                           | Manual QA (4 checks)                                                                                                                                                                       | **Moved to for-testing 2026-09-09** — QA batch #7                                                        |
| **marketing-ai-asset-generation** | Phase 1 images **shipped**; Phase 2 video **code-complete** (not live-verified) | Phase 3 hardening (admin sub-cap UI, reference-library drawer, retry-with-same-settings, premium-tier hatch UI, allowance revisit). Live Veo E2E + local `db:migrate` collision still open | **Stay in-progress** — do not move to done or for-testing while Phase 3 remains in this plan             |
| **ci-cd-environments/**           | Repo Phases A–C **shipped**                                                     | Phase A operator checklist; Phase B mt-prod cutover at release                                                                                                                             | **Stay in-progress** — operator/release work, not agent QA                                               |

**Super admin console** — Phases 0–7 **done** ([`../done/super-admin-console-overhaul.md`](../done/super-admin-console-overhaul.md)). Remaining 6 modules in [`../planned/super-admin-console-followups.md`](../planned/super-admin-console-followups.md).

---

## Planned (related, not in-progress)

| Doc                                                                                                                                | Notes                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [`../planned/parking-e2e-phase6-ranking-trust-safety.md`](../planned/parking-e2e-phase6-ranking-trust-safety.md)                   | Parking E2E Phase 6                                |
| [`../planned/parking-e2e-production-readiness.md`](../planned/parking-e2e-production-readiness.md)                                 | Parking prod checklist                             |
| [`../planned/marketing-studio-mobile-and-dashboard-responsive.md`](../planned/marketing-studio-mobile-and-dashboard-responsive.md) | Marketing mobile (separate from Meta publish gaps) |

---

## Suggested session order (if clearing the board)

1. **Run QA batch** — `for-testing/QA-BATCH.md` #1–#8 → `/workflow-done` each pass (fastest wins). #8 (org-activity-audit-log) also needs a prod deploy.
2. **mobile-native-redesign** — moved to `for-testing/` 2026-09-10; remaining work is a signed-in staging QA pass, not code.
3. **ci-cd-environments** — Phase A operator checklist now; Phase B prod cutover at release

Back to [in-progress index](./README.md)
