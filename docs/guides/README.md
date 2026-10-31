---
title: 'Guides'
status: active
tags: [guides]
updated: 2026-08-02
---

# Guides

Operator and agent documentation for **what each page/section does** — behavior, save paths, validation, and implementation pointers.

## Structure

```
docs/guides/
  README.md           ← this file
  _template.md        ← copy when adding a new route guide
  testing/            ← cross-route manual E2E flows
  routes/
    README.md         ← route index (links to every guide)
    sign-in.md
    org/
      property/
        settings.md   ← example of a complete guide
    ...
```

## Automated testing

Canonical pyramid, layout, scripts, and coverage inventory: [`testing/README.md`](./testing/README.md).

## Manual testing (feature flows)

| Doc                                                                                            | Purpose                                                                                      |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`testing/contract-expiry-lifecycle-manual.md`](./testing/contract-expiry-lifecycle-manual.md) | Contract expiry — notices, grace, consideration, SA grant/deny, lock, parking leg, 375px     |
| [`testing/ai-dashboard-assistant-manual.md`](./testing/ai-dashboard-assistant-manual.md)       | AI dashboard assistant — read/Tier-1/Tier-2 actions, guardrails, quota, kill switches, 375px |
| [`testing/parking-playwright.md`](./testing/parking-playwright.md)                             | Parking Playwright setup — feature-scoped mocks, auth seam, guest/host side-by-side flow     |

## When to update

Any material change to a page, section, or feature → update the matching route guide **in the same change**.

| Agent resource                                                                    | Purpose                          |
| --------------------------------------------------------------------------------- | -------------------------------- |
| [`.cursor/rules/route-guides.mdc`](../.cursor/rules/route-guides.mdc)             | Always-on reminder               |
| [`.cursor/skills/route-guides/SKILL.md`](../.cursor/skills/route-guides/SKILL.md) | Step-by-step workflow + template |
| [`docs/guides/routes/README.md`](./routes/README.md)                              | Route → file index               |

## vs other docs

| Document                                 | Scope                                     |
| ---------------------------------------- | ----------------------------------------- |
| **`docs/guides/routes/*.md`**            | Per-route behavior (this folder)          |
| **[[PROJECT]]**                          | System architecture, API tables, env vars |
| **`.cursor/rules/booking-workflow.mdc`** | Canonical booking state machine           |
| **[[NEW_FLOW_PLAN]]**                    | Redesign plan and phased decisions        |

Start with the [route index](./routes/README.md). For a full worked example, see [Property Settings](./routes/org/property/settings.md).
