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

Announcements for this parking slot work the same as property announcements: notices from Kame Space and from the parking slot's linked development appear in one archive. Open a notice to read it and clear its unread dot.

**Common host questions**

- Q: Where do I find parking announcements?
  A: This page is a deep link for parking team members. Org members usually read the same notices from the organization **Announcements** page.
- Q: Why do I see notices for the whole building?
  A: Notices attached to the parking slot's development apply to every property and parking slot in that development, including this one.
- Q: What does the red dot mean?
  A: You have at least one unread notice. Opening the notice, or using **Read all** on a group, clears it.
- Q: Can I mark every notice read at once?
  A: Yes. Use **Read all** beside the Platform or development group title.
- Q: Can I delete a notice after reading it?
  A: No. You can mark it read, but the notice stays in the archive while it is active.
- Q: Do parking team members without org access see these notices?
  A: Yes. This deep link exists so parking-only members can read the notices that apply to their slot.

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
