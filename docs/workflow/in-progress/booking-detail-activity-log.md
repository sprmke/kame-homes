---
title: Booking detail activity log coverage
status: in-progress
tags: [workflow, activity-log, bookings]
updated: 2026-11-04
stage: in-progress
kind: feature
---

# Booking detail activity log coverage

## Goal

Every mutating host action on the booking detail page writes an `activity_log` row so the Activity rail matches operator actions (Automation Triggers sends, uploads, share links, AI review, etc.).

## Scope

In: workflow email sends, document uploads, share/stay-guide/trip/form links, AI review runs, receipt backfill.

Out: pure reads, property settings/templates from bookings chrome, orchestrator auto-emails on Proceed (status row only).

## Progress

- [x] Catalog actions in `ACTIVITY_ACTION_CATALOG`
- [x] Edge handler emits (`bookingActivityLog.ts` helper)
- [x] Route guide + org-activity inventory
- [x] Deno tests green (`activityLog_test.ts`)
- [x] Audit §B: assistant workflow email + upload-time receipt validation (`source: upload`); backfill metadata `source: backfill`

## Reference

Parent feature: [`../for-testing/org-activity-audit-log.md`](../for-testing/org-activity-audit-log.md). Route guide: [`../../guides/routes/org/property/bookings-detail.md`](../../guides/routes/org/property/bookings-detail.md) § Activity log.
