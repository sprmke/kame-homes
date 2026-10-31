---
title: 'QA — Property Maintenance'
status: active
updated: 2026-08-29
---

# 06 — Maintenance

Route: `/org/:orgSlug/property/:propertySlug/maintenance`

## Looks good

- Finance-like layout (cards, filters, table/card/calendar).
- Export gated `maintenanceReporting` + `maintenance.export:view`.
- Telegram wiring deferred to Notifications module — clear separation.

## Issues

| Sev | Issue                                                                        | Evidence      |
| --- | ---------------------------------------------------------------------------- | ------------- |
| P2  | No AI “suggest recurring plan from booking turnover” — missed AI opportunity | Host critique |
| P3  | Category filter client-side only on loaded period                            | Guide         |

## Improvements

- Auto-create turnover cleaning reminder when booking hits READY_FOR_CHECKOUT (opt-in).

## Doc gaps

- Guide current.

## Evidence

Live title; guide `maintenance.md`.
