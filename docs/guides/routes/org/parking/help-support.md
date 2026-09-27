---
title: 'Parking Help & Support'
status: active
tags: [guides, routes, org, parking, help-support]
updated: 2026-09-05
---

# Parking Help & Support

Route: `/org/:orgSlug/parking/:parkingSlug/help-support` (+ `/docs`, `/tickets`, `/tickets/new`, `/tickets/:ticketId`)

Announcements: [Announcements](./announcements.md) (`/announcements`). Legacy `/help-support/announcements` redirects there.

> **Status:** Documented

## Progress overview

| Section      | E2E | Validation | Docs | Notes                                              |
| ------------ | --- | ---------- | ---- | -------------------------------------------------- |
| FAQs         | Yes | N/A        | Yes  | Up to eight parking-scoped published FAQs          |
| All sections | Yes | Yes        | Yes  | Same feature as the property scope, parking-scoped |

## Overview

Identical feature to [Property Help & Support](../property/help-support.md), mounted for a parking slot instead of a property — tickets filed here carry `parking_id` (and `property_id` null). Visible to every parking team member, not gated behind a specific permission (`bookings:view` baseline, same as Dashboard).

## FAQs

Common FAQs here are scoped to the **parking** mount: this slot’s settings, rates, finance, and parking team — not organization account FAQs, property bookings, or AI Assistant.

## Host-facing knowledge

Same as the property-level page: documentation, AI Assistant, and support tickets, just scoped to this parking listing.

**Common host questions**

- Q: If I file a ticket about a parking issue, does your team know it's about parking?
  A: Yes. Tickets filed from a parking listing's Help & Support page are tagged with that listing, so our team has the context automatically.
- Q: Why don't I see property booking FAQs here?
  A: Help FAQs match the page you're on. Parking Help shows parking answers; open a property's Help & Support for stay and booking questions.

## API reference · Implementation map

Same as [Property Help & Support](../property/help-support.md) — parking-scoped calls use `parkingId` instead of `propertyId`.
---

**Unsaved changes.** Leaving after editing asks to **Discard** or **Keep editing** (nothing is saved until you submit). Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Testing

| Layer | Path / spec                                                                  | Manual        |
| ----- | ---------------------------------------------------------------------------- | ------------- |
| Unit  | `parkingStatusMachine_test.ts`                                               | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs | PayMongo live |
| N/A   | Parking host dashboard shell load                                            | —             |

## Related docs

- [Route index](../../README.md)
- [Org Help & Support](../help-support.md)
- [Property Help & Support](../property/help-support.md)
- [Super-admin ticket management](../../admin/support.md)
