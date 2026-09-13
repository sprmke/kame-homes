---
stage: planned
title: 'AI Assistant — bulk/range pricing with diff preview'
status: planned
tags: [workflow, planned, ai, safety]
updated: 2026-09-02
kind: plan
---

# AI Assistant — bulk/range pricing with diff preview

**Deferred from** [`../done/ai-assistant-attachment-actions-and-coverage.md`](../done/ai-assistant-attachment-actions-and-coverage.md) Phase 6 + architecture §5.

## Problem

Single-date pricing tools exist today. Multi-date / range / bulk pricing from chat needs an explicit **diff preview** (affected nights, old vs new rate, block vs override) before Tier-2 confirm — same blast-radius bar as `property-pricing` PATCH.

## Scope (when started)

1. Design diff payload (date keys + before/after + operation type).
2. Read tool or propose preamble that renders a `data_table` preview block.
3. Tier-2 confirm executes only the frozen diff; no full-calendar replace footgun.

## Related

- [`../../architecture/ai-dashboard-assistant.md`](../../architecture/ai-dashboard-assistant.md) §5 exclusions
