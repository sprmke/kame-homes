---
title: 'Property dashboard QA findings'
status: active
tags: [qa, property, dashboard]
updated: 2026-08-30
---

# Property dashboard QA findings

Deep review of **property-level** dashboard modules (`/org/:orgSlug/property/:propertySlug/*`).

**Skill for future runs:** `.agent/skills/property-dashboard-qa/SKILL.md` (symlinked into `.cursor/skills/` + `.claude/skills/`).

**Walk helper:** `bun scripts/dev/qa-walk-property-pages.mjs <orgSlug> <propertySlug>`

**Probes:** `qa-probe-plan-gates.mjs`, `qa-probe-rbac-nav.mjs`

## Session context (2026-08-29 → 2026-08-30)

| Item                | Value                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Property under test | `kame-home` / `monaco-2612` (org owner `sprmke.dev@gmail.com`)                                                                             |
| Local plan seed     | Phase 1 started Free; paid probes + Phase 2/3 ran with **`kame-home` on Pro (`growth`)** — restore/document if you change it               |
| Live UI             | Vite `localhost:5173` + local Supabase                                                                                                     |
| Auth                | Magic-link session inject into Playwright (`sb-127-auth-token`)                                                                            |
| Edge note           | `./dev.sh` logged missing `issue-guest-form-completion-token` at start; some public/marketing calls returned **400/429** during rapid walk |

## Severity legend

| Sev    | Meaning                                         |
| ------ | ----------------------------------------------- |
| **P0** | Blocks day-to-day hosting                       |
| **P1** | Wrong link / wrong gate / broken primary action |
| **P2** | Friction vs “AI-assisted easy management”       |
| **P3** | Polish / docs drift                             |

## Index

| #   | Module               | File                                                                       | Top findings                                                         |
| --- | -------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 01  | Dashboard            | [01-dashboard.md](./01-dashboard.md)                                       | **P1 fixed:** bare `/bookings` `/finance` `/maintenance` deep-links  |
| 02  | Bookings             | [02-bookings.md](./02-bookings.md)                                         | Strong workflow surface; Free import gate OK                         |
| 03  | Bookings detail      | [03-bookings-detail.md](./03-bookings-detail.md)                           | Dense but powerful; AI review Pro+                                   |
| 04  | Finance              | [04-finance.md](./04-finance.md)                                           | Solid ledger; export Starter+                                        |
| 05  | Pricing              | [05-pricing.md](./05-pricing.md)                                           | Channel Sync live but **guide outdated** (updated)                   |
| 06  | Maintenance          | [06-maintenance.md](./06-maintenance.md)                                   | Parity with Finance patterns                                         |
| 07  | Team                 | [07-team.md](./07-team.md)                                                 | RBAC templates clear; Free seat=1                                    |
| 08  | Marketing            | [08-marketing.md](./08-marketing.md)                                       | Studio heavy; Free watermark + 429 under load                        |
| 09  | Inbox                | [09-inbox.md](./09-inbox.md)                                               | Core loop free; Meta Business+                                       |
| 10  | Notifications        | [10-notifications.md](./10-notifications.md)                               | Telegram enable Starter+                                             |
| 11  | Templates            | [11-templates.md](./11-templates.md)                                       | Custom templates unused for sends                                    |
| 12  | Public pages         | [12-public-pages.md](./12-public-pages.md)                                 | Explore-open Free; save Pro+                                         |
| 13  | Plans                | [13-plans.md](./13-plans.md)                                               | Property mirror of org billing                                       |
| 14  | Settings             | [14-settings.md](./14-settings.md)                                         | Completeness dots good; dual edit surfaces                           |
| 15  | Help                 | [15-help-support.md](./15-help-support.md)                                 | Baseline access OK                                                   |
| 16  | Plans & RBAC matrix  | [16-plans-and-rbac.md](./16-plans-and-rbac.md)                             | Tier × template expectations                                         |
| 17  | Phase 2 actions      | [17-phase2-module-actions.md](./17-phase2-module-actions.md)               | Dialogs + CTA inventory; guest-balance toast fix                     |
| 18  | Phase 3 deep         | [18-phase3-deep-interactions.md](./18-phase3-deep-interactions.md)         | Settings save, Marketing download, GAF, Telegram validate, Meta gate |
| 19  | Phase 4 Business+    | [19-phase4-business-integrations.md](./19-phase4-business-integrations.md) | Live Telegram send + Save; Meta OAuth start; Publish empty-state     |
| 20  | Superhost            | [20-superhost.md](./20-superhost.md)                                       | Superhost progress surface                                           |
| 21  | Org + property roles | [21-org-property-team-roles.md](./21-org-property-team-roles.md)           | **Closed:** UUID auth + listing lifecycle; QA script 18/18 pass      |

## Host critique (overall)

**What works:** Property shell + page titles are consistent. Bookings (list + workflow) is the strongest “run my property” surface. Finance / Maintenance / Pricing share familiar patterns. Plan TierBadges and upgrade modals are generally present where the matrix says they should be.

**Where we fall short of “AI makes management easy” on Free:** Almost all AI value is Pro/Business. On Free, the AI assistant FAB still appears (upsell / read-only) — fine for conversion, but a host with many Free units gets a constant “almost AI” tease without day-to-day automation (`automatedBookingFlow` emails gated, Meta gated, marketing studio watermarked). Multi-property switching exists, but Free + 325 demo properties on `kame-homes` is not a realistic portfolio UX stress test for paid hosts.

**Local QA gap (closed through Phase 4):** Free + Starter/Pro/Business probes; Phase 2/3 deep interactions; Phase 4 live Telegram preview/Save and Meta OAuth **start** on Business. Full Meta page grant + live Publish post still need a human Facebook session. Org restored to **Pro** after Phase 4.

## Fixes shipped in this QA pass

1. Dashboard deep-links now use `propertySectionPath` (Stat cards, Attention, Finance charts, Maintenance, Transactions).
2. Route guide `pricing.md` — document Channel Sync / `calendarSync`.
3. Applied pending local calendar-sync migrations (`20261213120*`) that were breaking Pricing (`property_blocked_dates.source`).
4. New skill + rule + findings set under `docs/workflow/qa/property-dashboard/`.
5. Local `kame-home` org set to **Pro (`growth`)** for paid-gate + Phase 2/3 smoke (Phase 4 temporarily used **Business**, then restored to Pro).
6. Guest-balance proceed validation toast (`GuestBalanceSettlementForm`) — commit `0cc59fcc`.
7. `qa-probe-rbac-nav.mjs` stripped invalid TypeScript annotations so Bun can run it.
