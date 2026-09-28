---
stage: planned
title: 'AI Assistant — settings validators (payment / automation / doc requirements)'
status: planned
tags: [workflow, planned, ai, safety]
updated: 2026-09-28
kind: plan
---

# AI Assistant — settings validators

**Deferred from** [`../done/ai-assistant-attachment-actions-and-coverage.md`](../done/ai-assistant-attachment-actions-and-coverage.md) Phase 5 (validators-first rule, Part B §9).

## Status (2026-09-28, ai-chat-mode.md Phase 7)

- **Email automation toggles:** shipped as `get_automation_settings` + `propose_update_automation_toggles` (Tier 2, on/off flags only).
- **Payment methods:** stay an OTP-verified Settings screen; the assistant hands off with `open_page`. Revisit only if OTP fits a confirm card.
- **Document requirements:** written only by super-admin `update-development`, so there is no host write to cover (N/A).

What remains of this plan is the payment methods tool, if the OTP flow can be designed into chat.

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
