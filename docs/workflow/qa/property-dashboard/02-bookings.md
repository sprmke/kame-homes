---
title: 'QA — Property Bookings list'
status: active
updated: 2026-08-29
---

# 02 — Bookings list

Route: `/org/:orgSlug/property/:propertySlug/bookings`

## Looks good

- Title correct; stage cards (Action Required / Pending Docs / Confirmed / History) with counts.
- Import + New booking present for owner; Free Import shows TierBadge path per guide.
- Table view loads bookings (Pending Review / Documents / SD Refund visible in demo data).
- Guide host Q&A matches shipped Kanban/import/calendar behaviors.

## Issues

| Sev | Issue                                                                             | Evidence          |
| --- | --------------------------------------------------------------------------------- | ----------------- |
| P2  | Dense filter chrome — powerful but a new host may not discover Kanban vs Calendar | Live + guide      |
| P3  | Rapid navigation sometimes races list refetch                                     | Walk session only |

## Improvements

- Default “Action Required” stage selected when count > 0 (host day-one).
- Persist last view mode per property in localStorage.

## Doc gaps

- Guide looks current (2026-08-27). No material drift found.

## Evidence

Live: `Monaco 2612 - Bookings` with stage cards + Import/New booking; guide `bookings.md`.
