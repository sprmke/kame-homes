---
title: 'Org Help & Support'
status: active
tags: [guides, routes, org, help-support]
updated: 2026-09-05
---

# Org Help & Support

Route: `/org/:orgSlug/help-support` (+ `/docs`, `/tickets`, `/tickets/new`, `/tickets/:ticketId`)

Announcements live on the org hub — see [Org Announcements](./announcements.md). Org `/help-support/announcements` redirects to `/org/:orgSlug/announcements`.

> **Status:** Documented

## Progress overview

| Section      | E2E | Validation | Docs | Notes                                            |
| ------------ | --- | ---------- | ---- | ------------------------------------------------ |
| FAQs         | Yes | N/A        | Yes  | Up to ten org-scoped common FAQs + search/browse |
| All sections | Yes | Yes        | Yes  | Same feature as the property scope, org-wide     |

## Overview

Identical feature to [Property Help & Support](./property/help-support.md), mounted at the org level instead — tickets filed here have `property_id`/`parking_id` left null (org-level). Visible to every org team member, not gated behind a specific permission (`org:dashboard:view` baseline, same as Dashboard).

**Loading:** the route skeleton shows the hero, module tiles, section intro, and the active section's content. Switching FAQs / Guides / Tickets keeps the layout mounted; only the section body shows a skeleton while its chunk loads.

## FAQs

Common FAQs here are scoped to the **organization** mount: **Getting Started**, **Plans & Billing**, **Parking** (portfolio), and **Account & Security** first. Search covers every host FAQ on this mount, and the category list opens the full set. AI Assistant and property/parking-operations FAQs stay on those Help pages.

**Provenance:** synced rows (`origin = 'synced'`) come from `docs/guides/support/faqs.md` and are read-only in the super-admin editor. Manual rows (`origin = 'manual'`) stay fully editable. Both appear here when published.

## Host-facing knowledge

Same as the property-level page: documentation, AI Assistant, and support tickets, just for questions that aren't about a specific property or parking listing.

**Common host questions**

- Q: Should I file a ticket from the org page or a property page?
  A: Either works, so pick whichever you're already on. We can still see which property or parking listing (if any) a ticket was filed from.
- Q: Why do the FAQs look different here than on a property?
  A: Each Help & Support page shows short answers for that level - organization, property, or parking - so you see the questions that match where you are.
- Q: Does a ticket filed here belong to a property?
  A: No. Tickets filed from the organization Help page are org-level and are not tied to a property or parking listing.
- Q: Where did the announcements link go?
  A: Announcements now live on their own page in the org sidebar. The old Help & Support announcements link sends you there.
- Q: Can every team member open this page?
  A: Yes. Help & Support is available to every org team member, the same as the dashboard. No extra permission is needed.

## API reference · Implementation map

Same as [Property Help & Support](./property/help-support.md) — org-scoped calls use `orgId`/`orgSlug` instead of `propertyId`.
---

**Unsaved changes.** Leaving after editing asks to **Discard** or **Keep editing** (nothing is saved until you submit). Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Testing

| Layer | Path / spec            | Manual                      |
| ----- | ---------------------- | --------------------------- |
| N/A   | Help docs + tickets UI | Manual QA when copy changes |

## Related docs

- [Route index](../README.md)
- [Property Help & Support](./property/help-support.md)
- [Parking Help & Support](./parking/help-support.md)
- [Super-admin ticket management](../admin/support.md)
