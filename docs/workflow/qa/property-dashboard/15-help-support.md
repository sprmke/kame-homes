---
title: 'QA — Property Help & Support'
status: active
updated: 2026-08-29
---

# 15 — Help & Support

Route: `/org/:orgSlug/property/:propertySlug/help-support`

## Looks good

- Loads with correct title; remains available when subscription suspended.
- Nav item not in `PROPERTY_NAV_VIEW_PERMISSION` map → always shown when section access allows (intentional support escape hatch).

## Issues

| Sev | Issue                                                                           | Evidence                           |
| --- | ------------------------------------------------------------------------------- | ---------------------------------- |
| P3  | Section view permission maps to `bookings:view` — odd semantically              | `PROPERTY_SECTION_VIEW_PERMISSION` |
| P2  | Help content may not answer “why is AI locked” with deep links to Plans feature | Host critique                      |

## Improvements

- Map common upgrade prompts → Help articles + Plans `?feature=`.

## Doc gaps

- Confirm help-support guide matches tickets UX.

## Evidence

Live title; guards.tsx + propertyPermissions.ts.
