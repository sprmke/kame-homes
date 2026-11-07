---
title: 'In progress'
status: active
tags: [workflow, in-progress]
updated: 2026-11-07
stage: in-progress
kind: reference
---

# In progress

Implementation **started** — plan not fully complete. Partial phases or v1 slices do **not** count as done; move to [`../done/`](../done/) only when the plan’s remaining scope is closed or explicitly deferred to backlog elsewhere.

Plans with **implementation complete** and only manual QA left live in [`../for-testing/`](../for-testing/) (**🧪**). **Start QA:** [`production-readiness/qa/QA-BATCH.md`](./production-readiness/qa/QA-BATCH.md).

**Disposition snapshot:** [`MODULE-DISPOSITION.md`](./production-readiness/qa/MODULE-DISPOSITION.md) — what closes vs what needs code.

**Moved out 2026-11-07:** [`booking-detail-activity-log.md`](../for-testing/booking-detail-activity-log.md) and [`support-content-and-faq-sync.md`](../for-testing/support-content-and-faq-sync.md) → **for testing** (all phase items checked; manual QA and the live sync run remain). [`ci-cd-environments/`](../done/ci-cd-environments/README.md) → **done** (dual-track superseded by the one-project cutover). The duplicate `public-native-density.md` copy was removed; the live plan stays in [`../for-testing/`](../for-testing/public-native-density.md).

**Moved in 2026-11-07 (third pass):** [`host-onboarding-setup-guide.md`](./host-onboarding-setup-guide.md) (for testing → in progress: reward reminder/unlock emails are still unimplemented).

**Moved in 2026-11-07 (second pass):** [`activity-log-followups.md`](./activity-log-followups.md) (planned → in progress: `org.activity:view` + listing `activity:view` shipped, four crons emit `system.cron_run`; export leaves, helper, notice emitters, ticket handlers and partitioning remain) and [`marketing-video-editor-multitrack.md`](./marketing-video-editor-multitrack.md) (for testing → in progress: T1.10, T1.11, T1.13 and T2.7 are still unimplemented).

**Moved in 2026-11-07:** [`mobile-app-chrome-header-and-tab-bar.md`](./mobile-app-chrome-header-and-tab-bar.md) (planned → in-progress; Phase 1 + 1b shipped), [`notifications-page-restructure.md`](./notifications-page-restructure.md) and [`google-services-production-hardening.md`](./google-services-production-hardening.md) (planned → in-progress).

**Moved in 2026-11-06:** [`telegram-delivery-and-history.md`](./telegram-delivery-and-history.md) — implemented, migration pending deploy. Read-only copy of what each Telegram group received (15-day window, 20 per page), a master delivery switch per property/parking, and all Telegram management moved into the header Manage sheet with Activity / Telegram tabs.

**Moved in 2026-11-06:** [`settings-cleanup-and-clarity.md`](./settings-cleanup-and-clarity.md) — started. Retires the legacy Parking owners BCC field, the hidden `emailParkingBroadcast` toggle, the dead Parking Request template and orphan pay-parking code; fixes complimentary own parking being honored with Allow Parking off; rewrites Email automations copy and moves the toggles inline; merges parking Automations and removes the parking Payment section (guests pay through PayMongo). Expand now, contract (schema drop) after one release soak.

**Moved in 2026-11-06:** [`property-archive-and-delete-lifecycle.md`](./property-archive-and-delete-lifecycle.md) — P0 hotfix shipped: Restore no longer bypasses listing verification or a contract lock (server + hidden button with the reason), a property that is not `ACTIVE` refuses new bookings through the direct link, and booked guests keep their stay guide when the host archives. P1–P7 (reason column, one lifecycle service, automations matrix, host UI, guest closed screen, billing, parking parity) remain. All five open decisions are settled in §6.

**Moved in 2026-11-05:** [`cancellation-policy-and-process.md`](./cancellation-policy-and-process.md) — started. Tiered policy engine + custom builder, immutable booking-time snapshot, Manila refund calculator, guest cancel/request from the trip page, host cancel sheet with reasons and overrides, refund tracking, cancellation emails, activity log, edge-case matrix. Phases 1–7 in the doc.

**Moved in 2026-11-05:** [`support-content-and-faq-sync.md`](../for-testing/support-content-and-faq-sync.md) — started. Makes `docs/guides/` the enforced source behind the Help Center Guides tab, `help_center_faqs`, public `/support`, and guest help. Phases: coverage gate, content sweep, provenance-safe sync, FAQ search/browse, public endpoint, support-content rule.

**Moved in 2026-11-04:** [`supabase-capacity-and-operational-readiness.md`](./supabase-capacity-and-operational-readiness.md) — first slice shipped (bookings-list RPC, RLS init-plan rewrite, duplicate index drop, retention, Realtime binding merge, capture scripts, drift gate). Remaining: compute upgrade, continuous alerts, large-tenant seed, load tests, public cache, dashboard/finance aggregates. Evidence: [`production-readiness/evidence/supabase-capacity-2026-11-04.md`](./production-readiness/evidence/supabase-capacity-2026-11-04.md).

**Moved in 2026-11-05:** [`weekly-ops-report.md`](./weekly-ops-report.md) — weekly operations report across Supabase, Sentry, database metrics, and delivery health. Super-admin list/detail, manual generate, idempotent email, Monday cron, and the agent handoff prompt. Architecture: [`../architecture/ops-reports.md`](../../architecture/ops-reports.md).

**Moved in 2026-11-05:** [`dashboard-contextual-help.md`](./dashboard-contextual-help.md) — P0 foundations and P1 stat cards shipped. P0: touch-safe `InfoHint`, `FieldHelpTooltip` / `MetricInfoDot` migration, How it works dialog and button, intro cards, notice callouts, copy registry and guard, Playwright coverage. P1: `StatCard` stretched-link refactor, shared metric definitions with source guards, hints on property / org / parking, finance, pricing, org listings, booking stages, maintenance, team, announcements, and the marketing storage meter. Remaining P2-P10: Smart Pricing / Channel sync, notifications and Telegram, templates, support, marketing, inbox, the settings sweep, and docs. Architecture: [`../architecture/contextual-help.md`](../../architecture/contextual-help.md).

**Moved out 2026-11-03:** [`kamespace-02-legacy-prod-to-mt-prod-cutover.md`](../done/kamespace-02-legacy-prod-to-mt-prod-cutover.md) and [`kamespace-01-legacy-prod-config-secrets-backup.md`](../done/kamespace-01-legacy-prod-config-secrets-backup.md) → **done**. Legacy data, storage, auth, domains, email and repo are on the new stack; the secrets backup is closed with its optional tails deferred. Deferred in 02: Maps Embed API, property photos, PayMongo approval, 30-day decommission.

**Moved out 2026-11-03:** [`kamespace-05-google-services-verification.md`](../done/kamespace-05-google-services-verification.md) → **done**. Google sign-in brand verification approved and published. Remaining Maps/Gemini/Fonts/legacy items split to [`../planned/google-services-production-hardening.md`](./google-services-production-hardening.md), not pre-production blockers.

**Updated 2026-11-04:** **04 domain move is complete** → [`../done/`](../done/kamespace-04-domain-move-kamespace-com.md). Production is on `kamespace.com`; Search Console sitemap submitted; Resend, DMARC, Supabase Auth, Cloudflare Turnstile, Meta, PostHog, Sentry, PayMongo and Google Business verified. The legacy domain is intentionally abandoned (not renewed).

**Moved out 2026-11-04:** [`kamespace-03-rebrand-kame-homes-to-kame-space.md`](../done/kamespace-03-rebrand-kame-homes-to-kame-space.md) → **done**. Production, emails, PDFs, AI replies, legal pages, PWA manifest, narration audio and all social stills/videos now use Kame Space; guard green in CI.

**Moved in 2026-11-02:** the Kame Space launch series (`kamespace-01`…`04`) was in this folder; the `planned/` copies are superseded. All five plans (01–05) are now closed.

**Moved out 2026-11-03:** [`chat-templates.md`](../for-testing/chat-templates.md) → for-testing — code + tests complete; manual live-thread QA (web card, Meta flattening, assistant rewrite) left.

**Moved out 2026-09-09:** `org-granular-team-permissions` + `super-admin-step-up-otp` → [`../for-testing/`](../for-testing/) (code shipped, QA-only — batches 6 & 7 in [`production-readiness/qa/QA-BATCH.md`](./production-readiness/qa/QA-BATCH.md)). `marketing-module-refinement` → [`../done/`](../done/); remaining Meta-publishing feature gaps split to [`../planned/marketing-meta-publishing-gaps.md`](../planned/marketing-meta-publishing-gaps.md).

**Moved out 2026-09-10:** `org-activity-audit-log` → [`../for-testing/`](../for-testing/) — Phases 0–6 shipped + Phase 4 tail + realtime + retention + `activityLogExport` gate; open questions Q1–Q7 all resolved; follow-ups (RBAC leaves, `system.cron_run` rows, notice-tier emitters, support-ticket/guest-profile handlers, partitioning) split to [`./activity-log-followups.md`](./activity-log-followups.md). QA = batch #8 in [`production-readiness/qa/QA-BATCH.md`](./production-readiness/qa/QA-BATCH.md). `mobile-native-redesign` → [`../for-testing/`](../for-testing/) — Phase 1 (guest booking flow shell) + Phase 2a–2f (marketing shell, PDP CTAs, guest account nav, auth pages, modal sweep, read-screen polish) + closing audit (Team permissions matrix verified sufficient as-is, doc updates, `/self-review` pass) all shipped; live-verified via Playwright at 375/768/1024px + dark mode against real dev data. Remaining: authenticated E2E walkthrough (guest sign-in, wizard steps, account nav) couldn't be driven past the auth gate in this session's environment.

**Moved out 2026-09-14:** `marketing-ai-asset-generation` → [`../done/`](../done/) — Phases 1–3 shipped (`ci:quality` green). Live Veo/Gemini calls left as accepted residual (funded key required).

**Moved out 2026-09-15:** `pre-production-launch-audit` → [`../for-testing/`](../for-testing/) — every P0/P1/P2 item closed in repo; remaining QA is restore rehearsal on hosted **dev** + the mt-prod cutover gate.

**Moved out 2026-11-03:** [`marketing-ai-image-quality-hardening.md`](../for-testing/marketing-ai-image-quality-hardening.md) → for-testing — Phases 1–6 implemented. Still open: the 20-prompt blind image score (user is the judge) before this can move to done.

**Moved out 2026-09-27:** [`org-portfolio-analytics-redesign.md`](../for-testing/org-portfolio-analytics-redesign.md) → for-testing (`ci:quality` green; manual QA remaining).

**Moved out 2026-10-29:** [`feature-availability-controls.md`](../done/feature-availability-controls.md) → done (Phases 1–9; manual QA → [`../for-testing/feature-availability-controls.md`](../for-testing/feature-availability-controls.md)).

**Moved in 2026-09-27:** [`activity-modal-ui-polish.md`](../for-testing/activity-modal-ui-polish.md) ← [`../planned/`](../planned/) — Activity Manage modal toolbar, refine, modal-scroll virtualization, friendly summaries.

| Doc                                                                                                            | Summary                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`production-readiness/`](./production-readiness/README.md)                                                    | **Launch readiness umbrella**: checklist (00–30), audits, OWASP, module cards, QA batch, operator inputs, evidence. Ledger + to-fix / all-good lists. Phase 0 baseline done 2026-10-19                                                                                         |
| [`cancellation-policy-and-process.md`](./cancellation-policy-and-process.md)                                   | Tiered policy engine + custom builder, immutable booking-time snapshot, Manila refund calculator, guest cancel/request, host cancel sheet, refund tracking, cancellation emails, edge-case matrix. Phases 1–7.                                                                 |
| [`dashboard-contextual-help.md`](./dashboard-contextual-help.md)                                               | Host dashboard help: touch-safe `InfoHint`, stat card formula hints, How it works panels, first-visit intro cards, Support "Broken" note, full form sweep. P0 and P1 shipped; P2-P10 remain. Public pages follow-up: [#296](https://github.com/sprmke/kame-space/issues/296)   |
| [`guest-trip-hub.md`](./guest-trip-hub.md)                                                                     | Guest trip page per booking (`/properties/:slug/trip`) + `/account/trips`, success page / email / SD form entry points; manual QA + host copy-link follow-up remain                                                                                                            |
| [`activity-modal-ui-polish.md`](../for-testing/activity-modal-ui-polish.md)                                    | Activity Manage modal UI/UX polish (org/property/parking)                                                                                                                                                                                                                      |
| [`marketing-themes.md`](./marketing-themes.md)                                                                 | Theme-first Marketing Studio: themes library + switcher + editor, per-property `marketing_themes`, calendar/posts/videos/AI follow the theme (re-theme engine, hand edits kept), live calendar cards; manual QA + follow-ups (AI theme creation, thumbnails in Storage) remain |
| [`marketing-ai-poster-studio.md`](./marketing-ai-poster-studio.md)                                             | AI Post: poster design system (6 archetypes, 8 type systems, icons, audit), AI art director, Generate tab mode shipped locally; blind eval + later phases (brand kit, photo enhance, server render) remain                                                                     |
| [`agentic-ai-assistants.md`](./agentic-ai-assistants.md)                                                       | Agentic behavior for the dashboard assistant and guest receptionist — plan, chain tools, recover from tool errors, verify before replying; existing RBAC and safety guardrails stay                                                                                            |
| [`ai-studio-sample-assets.md`](./ai-studio-sample-assets.md)                                                   | Generate the real photo and clip sample assets for the AI Studio example gallery; blocked on a paid Gemini/Veo key (all configured keys hit the free-tier hard cap)                                                                                                            |
| [`super-admin-system-health.md`](./super-admin-system-health.md)                                               | `/admin/health` monitoring — env vars, third-party credentials, scheduled jobs, DB prerequisites, tenant integrations; OK / Warning / Error / Off / Unknown with fix hints                                                                                                     |
| [`marketing-studio-mobile-and-dashboard-responsive.md`](./marketing-studio-mobile-and-dashboard-responsive.md) | Full mobile-editing parity for the three Marketing Studio editors + touch pricing-calendar range select + dashboard responsive polish. Studio shell verified; pricing range select and phases 4-6 remain                                                                       |
| [`mobile-app-chrome-header-and-tab-bar.md`](./mobile-app-chrome-header-and-tab-bar.md)                         | Phone shell chrome: docked tab bar (Phase 1, `9910a95fc`) + public detail back control (Phase 1b, `0e15fc997`) shipped; admin tab set, dashboard large-title header and cleanup remain                                                                                         |
| [`notifications-page-restructure.md`](./notifications-page-restructure.md)                                     | Property + parking Notifications pages: Activity / Push alerts / Telegram tabs, bounded 20-row feed with Newer/Older paging, All/Unread filter. In build on the working tree                                                                                                   |
| [`telegram-delivery-and-history.md`](./telegram-delivery-and-history.md)                                       | Sent-Telegram history (15-day window, 20 per page), per-asset master delivery switch, and Telegram management moved into the header Manage sheet. Code complete; migration pending deploy                                                                                      |
| [`google-services-production-hardening.md`](./google-services-production-hardening.md)                         | Post-launch Google follow-ups H-01…H-12: billing and Maps spend controls done 2026-11-05; Gemini paid tier, Fonts, System Health probe, legacy project retirement, docs remain                                                                                                 |
| See [`../done/`](../done/) for completed work.                                                                 |                                                                                                                                                                                                                                                                                |

**Audited 2026-11-04:** stale duplicate copies were moved to [`../../archive/workflow-superseded/`](../../archive/workflow-superseded/README.md); the live copy in each case is the newer one in its stage folder.

**Super admin console:** Phases 0–7 **done** — [`../done/super-admin-console-overhaul.md`](../done/super-admin-console-overhaul.md) (+ audit log, AI usage, platform settings, global search in `done/`). Remaining 6 modules: [`../planned/super-admin-console-followups.md`](../planned/super-admin-console-followups.md).

**Parking E2E:** Phases 0–5, 7–8 are in [`../done/`](../done/). Open: Phase 6 behavioral ranking ([`../planned/parking-e2e-phase6-ranking-trust-safety.md`](../planned/parking-e2e-phase6-ranking-trust-safety.md)) + production-readiness checklist ([`production-readiness/audits/parking-e2e-production-readiness.md`](./production-readiness/audits/parking-e2e-production-readiness.md)).

Back to [workflow index](../README.md).
