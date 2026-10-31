---
title: 'QA — Property Pricing'
status: active
updated: 2026-08-29
---

# 05 — Pricing

Route: `/org/:orgSlug/property/:propertySlug/pricing`

## Looks good

- Unified rates + booked pills + block/unblock matches product intent.
- Permissions: `pricing:view` / `pricing.rates:edit` / blocks add/delete / `pricing.channels:*`.
- **Channel Sync** modal ships (`ChannelSyncDialog` + `calendarSync` Pro+) — verified after local migrations + Pro plan bump (Airbnb / iCal / export copy visible; no load error).

## Issues

| Sev | Issue                                                                                                       | Evidence             | Status                                                  |
| --- | ----------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------- |
| P0  | Local DB missing calendar-sync migrations → Pricing crashed: `property_blocked_dates.source does not exist` | Live error banner    | **Fixed** — `bun run db:migrate` applied `20261213120*` |
| P1  | Route guide omitted Channel Sync / `calendarSync`                                                           | `pricing.md` vs page | **Doc updated**                                         |
| P2  | Airbnb sync is Pro+ — top host pain gated behind upgrade                                                    | Matrix               | Product decision                                        |
| P3  | Intermittent console noise during rapid walks                                                               | Playwright           | Edge flakiness                                          |

## Improvements

- After connect, show last-sync age + failed feed badge on Pricing header.
- Cross-link from Settings → Integrations to Channel Sync.

## Doc gaps

- Channel Sync section + host Q&A added to `pricing.md`.

## Evidence

Live Pro session after migrate; `ChannelSyncDialog.tsx`; plans matrix § calendarSync.
