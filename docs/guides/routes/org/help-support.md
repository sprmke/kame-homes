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

| Section      | E2E | Validation | Docs | Notes                                        |
| ------------ | --- | ---------- | ---- | -------------------------------------------- |
| FAQs         | Yes | N/A        | Yes  | Up to eight org-scoped published FAQs        |
| All sections | Yes | Yes        | Yes  | Same feature as the property scope, org-wide |

## Overview

Identical feature to [Property Help & Support](./property/help-support.md), mounted at the org level instead — tickets filed here have `property_id`/`parking_id` left null (org-level). Visible to every org team member, not gated behind a specific permission (`org:dashboard:view` baseline, same as Dashboard).

## FAQs

Common FAQs here are scoped to the **organization** mount: **Getting Started** first (ownership, Owner vs Admin, invites, delete org, add property), then portfolio **Parking** questions from the org Parkings list (add a slot, standalone vs stay parking). AI Assistant and property/parking-ops FAQs stay on those Help pages.

## Host-facing knowledge

Same as the property-level page: documentation, AI Assistant, and support tickets, just for questions that aren't about a specific property or parking listing.

**Common host questions**

- Q: Should I file a ticket from the org page or a property page?
  A: Either works, so pick whichever you're already on. We can still see which property or parking listing (if any) a ticket was filed from.
- Q: Why do the FAQs look different here than on a property?
  A: Each Help & Support page shows short answers for that level — organization, property, or parking — so you see the questions that match where you are.

## API reference · Implementation map

Same as [Property Help & Support](./property/help-support.md) — org-scoped calls use `orgId`/`orgSlug` instead of `propertyId`.
---

## Testing

| Layer | Path / spec            | Manual                      |
| ----- | ---------------------- | --------------------------- |
| N/A   | Help docs + tickets UI | Manual QA when copy changes |

## Related docs

- [Route index](../README.md)
- [Property Help & Support](./property/help-support.md)
- [Parking Help & Support](./parking/help-support.md)
- [Super-admin ticket management](../admin/support.md)
