---
title: 'In progress'
status: active
tags: [workflow, in-progress]
updated: 2026-10-30
stage: in-progress
kind: reference
---

# In progress

Implementation **started** — plan not fully complete. Partial phases or v1 slices do **not** count as done; move to [`../done/`](../done/) only when the plan’s remaining scope is closed or explicitly deferred to backlog elsewhere.

Plans with **implementation complete** and only manual QA left live in [`../for-testing/`](../for-testing/) (**🧪**). **Start QA:** [`production-readiness/qa/QA-BATCH.md`](./production-readiness/qa/QA-BATCH.md).

**Disposition snapshot:** [`MODULE-DISPOSITION.md`](./production-readiness/qa/MODULE-DISPOSITION.md) — what closes vs what needs code.

**Moved in 2026-10-25:** [`chat-templates.md`](./chat-templates.md) ← [`../planned/`](../planned/) — property stay-guide/custom templates in Guest Inbox Insert → Templates and AI Assistant Pin context. Code + tests complete; manual live-thread QA (web card, Meta flattening, assistant rewrite) left.

**Moved out 2026-09-09:** `org-granular-team-permissions` + `super-admin-step-up-otp` → [`../for-testing/`](../for-testing/) (code shipped, QA-only — batches 6 & 7 in [`production-readiness/qa/QA-BATCH.md`](./production-readiness/qa/QA-BATCH.md)). `marketing-module-refinement` → [`../done/`](../done/); remaining Meta-publishing feature gaps split to [`../planned/marketing-meta-publishing-gaps.md`](../planned/marketing-meta-publishing-gaps.md).

**Moved out 2026-09-10:** `org-activity-audit-log` → [`../for-testing/`](../for-testing/) — Phases 0–6 shipped + Phase 4 tail + realtime + retention + `activityLogExport` gate; open questions Q1–Q7 all resolved; follow-ups (RBAC leaves, `system.cron_run` rows, notice-tier emitters, support-ticket/guest-profile handlers, partitioning) split to [`../planned/activity-log-followups.md`](../planned/activity-log-followups.md). QA = batch #8 in [`production-readiness/qa/QA-BATCH.md`](./production-readiness/qa/QA-BATCH.md). `mobile-native-redesign` → [`../for-testing/`](../for-testing/) — Phase 1 (guest booking flow shell) + Phase 2a–2f (marketing shell, PDP CTAs, guest account nav, auth pages, modal sweep, read-screen polish) + closing audit (Team permissions matrix verified sufficient as-is, doc updates, `/self-review` pass) all shipped; live-verified via Playwright at 375/768/1024px + dark mode against real dev data. Remaining: authenticated E2E walkthrough (guest sign-in, wizard steps, account nav) couldn't be driven past the auth gate in this session's environment.

**Moved out 2026-09-14:** `marketing-ai-asset-generation` → [`../done/`](../done/) — Phases 1–3 shipped (`ci:quality` green). Live Veo/Gemini calls left as accepted residual (funded key required).

**Moved out 2026-09-15:** `pre-production-launch-audit` → [`../for-testing/`](../for-testing/) — every P0/P1/P2 item closed in repo; remaining QA is restore rehearsal on hosted **dev** + the mt-prod cutover gate.

**Moved in 2026-09-23:** [`marketing-ai-image-quality-hardening.md`](./marketing-ai-image-quality-hardening.md) ← [`../planned/`](../planned/) — Phases 1–6 implemented. 2026-09-24: property context now reads real amenity settings and includes the listing name and brand color. Still open: the 20-prompt blind image score (user is the judge) before this can move to done.

**Moved out 2026-09-27:** [`org-portfolio-analytics-redesign.md`](../for-testing/org-portfolio-analytics-redesign.md) → for-testing (`ci:quality` green; manual QA remaining).

**Moved out 2026-10-29:** [`feature-availability-controls.md`](../done/feature-availability-controls.md) → done (Phases 1–9; manual QA → [`../for-testing/feature-availability-controls.md`](../for-testing/feature-availability-controls.md)). Redirect stub: [`./feature-availability-controls.md`](./feature-availability-controls.md).

**Moved in 2026-09-27:** [`activity-modal-ui-polish.md`](../for-testing/activity-modal-ui-polish.md) ← [`../planned/`](../planned/) — Activity Manage modal toolbar, refine, modal-scroll virtualization, friendly summaries.

| Doc                                                                         | Summary                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`production-readiness/`](./production-readiness/README.md)                 | **Launch readiness umbrella**: checklist (00–30), audits, OWASP, module cards, QA batch, operator inputs, evidence. Ledger + to-fix / all-good lists. Phase 0 baseline done 2026-10-19                                                                                         |
| [`guest-trip-hub.md`](./guest-trip-hub.md)                                  | Guest trip page per booking (`/properties/:slug/trip`) + `/account/trips`, success page / email / SD form entry points; manual QA + host copy-link follow-up remain                                                                                                            |
| [`activity-modal-ui-polish.md`](../for-testing/activity-modal-ui-polish.md) | Activity Manage modal UI/UX polish (org/property/parking)                                                                                                                                                                                                                      |
| [`marketing-themes.md`](./marketing-themes.md)                              | Theme-first Marketing Studio: themes library + switcher + editor, per-property `marketing_themes`, calendar/posts/videos/AI follow the theme (re-theme engine, hand edits kept), live calendar cards; manual QA + follow-ups (AI theme creation, thumbnails in Storage) remain |
| [`marketing-ai-poster-studio.md`](./marketing-ai-poster-studio.md)          | AI Post: poster design system (6 archetypes, 8 type systems, icons, audit), AI art director, Generate tab mode shipped locally; blind eval + later phases (brand kit, photo enhance, server render) remain                                                                     |
| [`ci-cd-environments/`](./ci-cd-environments/README.md)                     | Phases A–C repo shipped; **operator checklist** + **Phase B prod cutover** at release                                                                                                                                                                                          |
| See [`../done/`](../done/) for completed work.                              |

**Super admin console:** Phases 0–7 **done** — [`../done/super-admin-console-overhaul.md`](../done/super-admin-console-overhaul.md) (+ audit log, AI usage, platform settings, global search in `done/`). Remaining 6 modules: [`../planned/super-admin-console-followups.md`](../planned/super-admin-console-followups.md).

**Parking E2E:** Phases 0–5, 7–8 are in [`../done/`](../done/). Open: Phase 6 behavioral ranking ([`../planned/parking-e2e-phase6-ranking-trust-safety.md`](../planned/parking-e2e-phase6-ranking-trust-safety.md)) + production-readiness checklist ([`production-readiness/audits/parking-e2e-production-readiness.md`](./production-readiness/audits/parking-e2e-production-readiness.md)).

Back to [workflow index](../README.md).
