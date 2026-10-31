---
stage: planned
title: 'AI Assistant — parking broadcast fan-out'
status: planned
tags: [workflow, planned, ai, parking, safety]
updated: 2026-09-02
kind: plan
---

# AI Assistant — parking broadcast fan-out

**Deferred from** [`../done/ai-assistant-attachment-actions-and-coverage.md`](../done/ai-assistant-attachment-actions-and-coverage.md) Phase 6 + Part E matrix.

## Problem

Claim/decline of a **single** parking stay is available in chat. **Broadcast fan-out** (notify many hosts, race TTL, guest email side-effects) is a distinct blast radius — not safe to mirror claim/decline Tier-2 copy alone.

## Scope (when started)

1. Dedicated design review: recipient scope, TTL visibility, idempotency, guest email timing.
2. Possibly read-only status + deep-link to parking booking detail for broadcast actions.
3. Never-build until multi-step confirm UX is approved.

## Related

- [`../../architecture/ai-dashboard-assistant.md`](../../architecture/ai-dashboard-assistant.md) §5 exclusions
- Parking broadcast edge functions: `claim-parking-booking`, `expire-parking-broadcasts`
