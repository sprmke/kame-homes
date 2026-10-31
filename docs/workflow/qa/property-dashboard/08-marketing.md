---
title: 'QA — Property Marketing'
status: active
updated: 2026-08-30
---

# 08 — Marketing

Route: `/org/:orgSlug/property/:propertySlug/marketing`

## Looks good

- Content Studio (Calendar / Design / Video) is a major differentiator when entitled.
- Watermark / upgrade for `marketingStudio` (Pro+); Meta publish Business+.
- Telegram marketing alerts correctly live under Notifications (guide callout).
- **Phase 3 (Pro):** Design editor → **Download PNG** succeeded; **Publish** → Upgrade to Business.
- **Phase 4 (Business):** Publish dialog empty-state + Inbox deep-link; confirm **Publish** disabled until Meta channel connected.

## Issues

| Sev | Issue                                                                                           | Evidence           |
| --- | ----------------------------------------------------------------------------------------------- | ------------------ |
| P1  | Rapid page walk hit **429** on `marketing-templates` / `publish-to-meta` — fragile under reload | Playwright console |
| P2  | `get-public-property` **400** while Marketing loads property media — preview may fail locally   | Console            |
| P2  | Free/Starter hosts open Marketing but mostly watermarked — feels like a locked showroom         | Host lens + matrix |
| P3  | Editor complexity vs day-to-day host time (CapCut-like video)                                   | Critique           |

## Improvements

- Soften empty/error when public property fetch fails (don’t spam console).
- One-click “Generate this week’s availability story” from Dashboard (AI promise).

## Doc gaps

- Guide very long but accurate; keep Meta publish Business+ note.

## Evidence

Live Marketing title; Phase 3 download + Publish gate; Phase 4 Business publish empty-state; console 429/400; `planFeatures` / matrix.
