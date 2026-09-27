---
title: 'Property Announcements'
status: active
tags: [guides, routes, org, property, announcements]
updated: 2026-09-27
---

# Property Announcements (deep-link fallback)

Route: `/org/:orgSlug/property/:propertySlug/announcements` (+ `/announcements/:announcementId` detail)

**No sidebar entry** — org hub members use [Org Announcements](../announcements.md). This route remains for property-only team members and bookmarks. `/help-support/announcements` from any scope redirects to org `/announcements`.

> **Status:** Documented

## Progress overview

| Section       | E2E | Validation | Docs | Notes                                                     |
| ------------- | --- | ---------- | ---- | --------------------------------------------------------- |
| Summary cards | Yes | N/A        | Yes  | Active / Action required / Attention / Updates            |
| Archive feed  | Yes | N/A        | Yes  | Platform + development groups, 5-up pages                 |
| Detail view   | Yes | N/A        | Yes  | Back, sticky status card, full body, optional link button |
| Unread nav    | Yes | N/A        | Yes  | Red-dot on Announcements when unread (mobile + desktop)   |

## Overview

Property-only team members can open this deep-link route to read platform maintenance, product updates, and development notices scoped to their property's linked development. Org hub members use the org **Announcements** sidebar instead. Notices appear **only** on this archive (and detail) — other dashboard pages do not show a top banner. A **red dot** on **Announcements** (sidebar and **More** menu) appears while any notice is unread — same indicator pattern as Settings issues. Opening a notice marks it read (device-local). Four summary stat cards sit above the feed. Each feed group is one **parent card** (title, **Read all**, and pager in the header). While the list or detail loads, those cards and feed rows render as skeletons. Visible to **every** non–plan-limited property team member (same baseline as Help & Support). Suspended orgs may still open Announcements.

## Host-facing knowledge

This is where you read official notices from Kame Homes — scheduled maintenance, new features, and updates for your building or development. Unread notices show a small red dot and stronger title; open a row to mark it read. Use **Read all** next to a group title to clear every unread notice in that group. The list always shows active notices until we turn them off or the schedule ends.

**Common host questions**

- Q: Where do I find announcements?
  A: Open **Announcements** from the org sidebar (or **More** on phone). A red dot means you still have unread notices.
- Q: What does the red dot on Announcements mean?
  A: You have at least one unread notice. Open each notice, or use **Read all** on a group, to clear the unread state. Editing a notice can mark it unread again.
- Q: Can I mark everything read at once?
  A: Yes. Next to each group title (Platform or a development name), tap **Read all** when that group has unread notices.
- Q: What's the difference between Platform and a development name?
  A: **Platform** applies to all hosts. A development name (e.g. your building) applies only to properties linked to that development.

## Summary cards

Four **StatCard**s in a 2×2 / four-column grid: **Active** (total count), **Action required** (critical), **Attention** (warning), **Updates** (info). Same card pattern as property Dashboard KPIs.

## Archive feed

Active notices from **`list-host-announcements`**, merged for this property's org and linked development. Grouped under **Platform** and each development name. Each group is one **parent card**: group title, **Read all**, and **Previous** / **Next** chevrons sit in the card header; rows use `divide-y` below (no double borders). Rows are **clickable** — unread rows use a light primary tint (`bg-primary/5`), semibold title, and a small red unread dot **inline beside the title**; read rows use a transparent fill and medium weight. Opening detail marks the notice read (localStorage per org). **Read all** beside the group title marks every unread notice in that group. Up to **five** rows per page.

**Detail** (`/announcements/:announcementId`): same page title and subtitle as the list, **stat cards** then **Back** then a **`surface-card`** detail panel (status header · severity marker · title · body · optional link button). Opening the page marks that notice as read.

Body is authored by super-admins as rich text (WYSIWYG editor — bold/italic, headings, lists, links, images) and renders as formatted HTML here (`StayGuideRichContent`), not plain text. The archive-row preview and summary text always show a plain-text excerpt regardless of formatting.

## Permissions

| Control       | Decision | Notes                                                                   |
| ------------- | -------- | ----------------------------------------------------------------------- |
| **Plans**     | N/A      | Free for all property members; not tier-gated                           |
| **Team RBAC** | N/A      | Baseline access — same as Help & Support (`bookings:view` not required) |

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| Layer       | Path                                                                                |
| ----------- | ----------------------------------------------------------------------------------- |
| Page        | `ui/src/features/dashboard/announcements/pages/HostAnnouncementsListPage.tsx`       |
| Detail      | `ui/src/features/dashboard/announcements/pages/HostAnnouncementDetailPage.tsx`      |
| Detail card | `ui/src/features/dashboard/announcements/components/HostAnnouncementDetailCard.tsx` |
| Stats       | `ui/src/features/dashboard/announcements/components/HostAnnouncementStatCards.tsx`  |
| Feed        | `ui/src/features/dashboard/announcements/components/HostAnnouncementCard.tsx`       |
| Unread nav  | `ui/src/features/dashboard/announcements/hooks/useHostAnnouncementHasUnread.ts`     |
| Read state  | `ui/src/features/dashboard/announcements/lib/hostAnnouncementReadState.ts`          |
| API         | `list-host-announcements`                                                           |
| Routes      | `ui/src/features/dashboard/announcements/routes/index.tsx`                          |

---

## Testing

| Layer | Path / spec        | Manual                   |
| ----- | ------------------ | ------------------------ |
| N/A   | Announcements CRUD | Manual when copy changes |

## Related

- [Property Help & Support](./help-support.md)
- [Super-admin Announcements](../../admin/announcements.md)
