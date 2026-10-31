---
title: 'QA — Property Booking detail'
status: active
updated: 2026-08-30
---

# 03 — Bookings detail

Route: `/org/:orgSlug/property/:propertySlug/bookings/:bookingId`

## Looks good

- Workflow rail + edit tabs are the core “manage a stay” product — well documented in `bookings-detail.md` + `booking-workflow.mdc`.
- Permission leaves for stay/guests/parking/pets/pricing/workflow are wired (`BookingDetailPage`).
- AI summary panel: results visible after run; run gated by `aiValidations` (Pro+) — correct downgrade-safety pattern.
- Free / `automatedBookingFlow`: Automation Triggers exposes Send for GAF / pet / ack / ready / parking / SD; toast expands Triggers after plan skip; advance guide copy is plan-aware; Email Automations locks plan-gated toggles with TierBadge; next-step + manual-email banners; confirm modal Free hint; sd-cron post-run plan-skip toast; RFCI/RFCO bell notifications fire on Free even when email is plan-gated.
- **Phase 2/3:** PENDING_REVIEW→PENDING_DOCUMENTS; RFCI→READY_FOR_CHECKOUT after receipt; GAF PDF upload → Mark complete (Jane …017; status stays PENDING_DOCUMENTS while other docs open).

## Issues

| Sev | Issue                                                                                                  | Evidence  |
| --- | ------------------------------------------------------------------------------------------------------ | --------- |
| P2  | Cognitive load: Progress + Documents + Pricing + Automation Triggers is a lot for a first-time co-host | Host lens |

## Improvements

- “Last sent at” for manual GAF/ack/ready/pet sends (P3.4 — optional DB columns).

## Doc gaps

- Guide is detailed and largely accurate. Keep in sync when calendar-sync reservation ingest lands.

## Evidence

Code + route guide + plans matrix; Free manual-send suite shipped in `free-tier-manual-booking-workflow` (2026-08-29). Phase 2/3 live workflow + GAF complete on monaco-2612 samples — see `17-` / `18-` phase files.
