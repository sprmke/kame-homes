---
title: 'QA — Property Dashboard'
status: active
updated: 2026-08-29
---

# 01 — Dashboard

Route: `/org/:orgSlug/property/:propertySlug`

## Looks good

- Page title `Monaco 2612 - Dashboard`; period filter seeds `?from`/`?to`.
- KPI strip + 2×3 board matches route guide (calendar, attention, cash flow, breakdown, maintenance, transactions).
- Permission-aware: finance/maintenance cards hide without `finance:view` / `maintenance:view`.
- View Property opens public listing; mobile hero + date overlap toolbar present.

## Issues

| Sev | Issue                                                                            | Evidence                         | Status                                                                                    |
| --- | -------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| P1  | Board/KPI/attention deep-links used bare `/bookings`, `/finance`, `/maintenance` | Live hrefs                       | **Fixed** — `propertySectionPath` + `resolvePropertyDashboardHref` (verified `NONE_BARE`) |
| P2  | AI assistant FAB visible on Free (upsell/read-only)                              | Live + `isAiAssistantFabVisible` | By design; quieter Free UX optional                                                       |
| P3  | Mobile density claims — re-check after link fix                                  | `dashboard.md`                   | Monitor                                                                                   |

## Improvements

- Surface one “next action” CTA from Needs attention into the hero.
- When attention is empty, offer “New booking” on Recent bookings empty state.

## Doc gaps

- Deep-link rule documented in `dashboard.md`.

## Evidence

Live walk 2026-08-29 owner session; post-fix href audit.
