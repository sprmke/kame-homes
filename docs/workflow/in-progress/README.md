---
title: 'In progress'
status: active
tags: [workflow, in-progress]
updated: 2026-09-24
stage: in-progress
kind: reference
---

# In progress

Implementation **started** — plan not fully complete. Partial phases or v1 slices do **not** count as done; move to [`../done/`](../done/) only when the plan’s remaining scope is closed or explicitly deferred to backlog elsewhere.

Plans with **implementation complete** and only manual QA left live in [`../for-testing/`](../for-testing/) (**🧪**). **Start QA:** [`../for-testing/QA-BATCH.md`](../for-testing/QA-BATCH.md).

**Disposition snapshot:** [`MODULE-DISPOSITION.md`](./MODULE-DISPOSITION.md) — what closes vs what needs code.

**Moved out 2026-09-09:** `org-granular-team-permissions` + `super-admin-step-up-otp` → [`../for-testing/`](../for-testing/) (code shipped, QA-only — batches 6 & 7 in [`../for-testing/QA-BATCH.md`](../for-testing/QA-BATCH.md)). `marketing-module-refinement` → [`../done/`](../done/); remaining Meta-publishing feature gaps split to [`../planned/marketing-meta-publishing-gaps.md`](../planned/marketing-meta-publishing-gaps.md).

**Moved out 2026-09-10:** `org-activity-audit-log` → [`../for-testing/`](../for-testing/) — Phases 0–6 shipped + Phase 4 tail + realtime + retention + `activityLogExport` gate; open questions Q1–Q7 all resolved; follow-ups (RBAC leaves, `system.cron_run` rows, notice-tier emitters, support-ticket/guest-profile handlers, partitioning) split to [`../planned/activity-log-followups.md`](../planned/activity-log-followups.md). QA = batch #8 in [`../for-testing/QA-BATCH.md`](../for-testing/QA-BATCH.md). `mobile-native-redesign` → [`../for-testing/`](../for-testing/) — Phase 1 (guest booking flow shell) + Phase 2a–2f (marketing shell, PDP CTAs, guest account nav, auth pages, modal sweep, read-screen polish) + closing audit (Team permissions matrix verified sufficient as-is, doc updates, `/self-review` pass) all shipped; live-verified via Playwright at 375/768/1024px + dark mode against real dev data. Remaining: authenticated E2E walkthrough (guest sign-in, wizard steps, account nav) couldn't be driven past the auth gate in this session's environment.

**Moved out 2026-09-14:** `marketing-ai-asset-generation` → [`../done/`](../done/) — Phases 1–3 shipped (`ci:quality` green). Live Veo/Gemini calls left as accepted residual (funded key required).

**Moved out 2026-09-15:** `pre-production-launch-audit` → [`../for-testing/`](../for-testing/) — every P0/P1/P2 item closed in repo; remaining QA is restore rehearsal on hosted **dev** + the mt-prod cutover gate.

| Doc                                                                                    | Summary                                                                                               |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`ai-receptionist-production-readiness.md`](./ai-receptionist-production-readiness.md) | Core hardening implemented; local DB, hosted canary, real-device baselines, and pilot evidence remain |
| [`ci-cd-environments/`](./ci-cd-environments/README.md)                                | Phases A–C repo shipped; **operator checklist** + **Phase B prod cutover** at release                 |
| See [`../done/`](../done/) for completed work.                                         |

**Super admin console:** Phases 0–7 **done** — [`../done/super-admin-console-overhaul.md`](../done/super-admin-console-overhaul.md) (+ audit log, AI usage, platform settings, global search in `done/`). Remaining 6 modules: [`../planned/super-admin-console-followups.md`](../planned/super-admin-console-followups.md).

**Parking E2E:** Phases 0–5, 7–8 are in [`../done/`](../done/). Open: Phase 6 behavioral ranking ([`../planned/parking-e2e-phase6-ranking-trust-safety.md`](../planned/parking-e2e-phase6-ranking-trust-safety.md)) + production-readiness checklist ([`../planned/parking-e2e-production-readiness.md`](../planned/parking-e2e-production-readiness.md)).

Back to [workflow index](../README.md).
