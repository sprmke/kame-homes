---
title: 'Parking Announcements'
status: active
tags: [guides, routes, org, parking, announcements]
updated: 2026-09-27
---

# Parking Announcements (deep-link fallback)

Route: `/org/:orgSlug/parking/:parkingSlug/announcements`

**No sidebar entry** — org hub members use [Org Announcements](../announcements.md). This route remains for parking team deep links and bookmarks.

> **Status:** Documented

## Overview

Same UI as [Property Announcements](../property/announcements.md), scoped to the parking slot's linked development. Org hub members use the org **Announcements** sidebar instead.

## Host-facing knowledge

Same as [Property Announcements](../property/announcements.md).
---

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Testing

| Layer | Path / spec                                                                  | Manual        |
| ----- | ---------------------------------------------------------------------------- | ------------- |
| Unit  | `parkingStatusMachine_test.ts`                                               | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs | PayMongo live |
| N/A   | Parking host dashboard shell load                                            | —             |

## Related

- [Property Announcements](../property/announcements.md)
- [Parking Help & Support](./help-support.md)
