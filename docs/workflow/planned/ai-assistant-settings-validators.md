---
stage: planned
title: 'AI Assistant — settings validators (payment / automation / doc requirements)'
status: planned
tags: [workflow, planned, ai, safety]
updated: 2026-09-02
kind: plan
---

# AI Assistant — settings validators

**Deferred from** [`../done/ai-assistant-attachment-actions-and-coverage.md`](../done/ai-assistant-attachment-actions-and-coverage.md) Phase 5 (validators-first rule, Part B §9).

## Problem

Property/parking **payment methods PATCH**, **email automation toggles**, and **document requirements** overrides require the same validation + OTP parity as the dashboard (`settings-verification`, `app-settings` PATCH). The assistant must not expose weaker chat-only writes.

## Scope (when started)

1. Extract shared validators from `app-settings` / `parking-settings` PATCH paths.
2. Add Tier-2 propose tools that require `settingsVerificationToken` (or deep-link only if OTP UX cannot fit confirm flow).
3. Register in risk classifier + architecture §3.10; remove exclusion rows when shipped.

## Out of scope

- GCash QR **stage** (already shipped via `propose_stage_gcash_qr`).
- Raw PayMongo credential edits (never-build).

## Related

- [`../../architecture/ai-dashboard-assistant.md`](../../architecture/ai-dashboard-assistant.md) §3.10 exclusions
- [`../done/sensitive-settings-email-otp.md`](../done/sensitive-settings-email-otp.md)
