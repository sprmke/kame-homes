---
title: 'Guest Inbox (org) — removed'
status: removed
tags: [guides, routes, org, inbox]
updated: 2026-08-09
---

# Guest Inbox (`/org/:orgSlug/inbox`) — removed

> **Status:** Removed (2026-08-09)

Org-level Guest Inbox was removed to avoid confusion with property Inbox. Use:

**[`/org/:orgSlug/property/:propertySlug/inbox`](./property/inbox.md)**

- Full manage actions: Channels, Quick replies, Automation (desktop: separate header buttons; mobile: hero menu)
- Messages scoped to the property (web) + effective Meta Page

The old URL `/org/:orgSlug/inbox` **redirects** to `/org/:orgSlug/properties`.

Parking Inbox remains at `/org/:orgSlug/parking/:parkingSlug/inbox` (Channels only; quick replies / automation are managed on a property inbox).
---

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Testing

| Layer | Path / spec                                                                    | Manual |
| ----- | ------------------------------------------------------------------------------ | ------ |
| E2E   | `ui/e2e/features/auth/legacyRouteRedirectSmoke.spec.ts` redirect paths (`@ci`) | —      |
| N/A   | Redirect-only route                                                            | —      |
