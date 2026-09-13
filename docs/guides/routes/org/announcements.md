---
title: 'Org Announcements'
status: active
tags: [guides, routes, org, announcements]
updated: 2026-09-10
---

# Org Announcements

Route: `/org/:orgSlug/announcements` (+ `/announcements/:announcementId` detail)

Legacy redirect: `/org/:orgSlug/help-support/announcements` → org announcements archive above.

> **Status:** Documented

## Progress overview

| Section       | E2E | Validation | Docs | Notes                                                     |
| ------------- | --- | ---------- | ---- | --------------------------------------------------------- |
| Summary cards | Yes | N/A        | Yes  | Active / Action required / Attention / Updates            |
| Archive feed  | Yes | N/A        | Yes  | Platform + development groups, 5-up pages                 |
| Detail view   | Yes | N/A        | Yes  | Back, sticky status card, full body, optional link button |
| Unread nav    | Yes | N/A        | Yes  | Red-dot on Announcements when unread (mobile + desktop)   |

## Overview

Org hub members open **Announcements** from the org sidebar (between Plans & Billing and Settings) to read platform maintenance, product updates, and development notices for the whole organization. The feed merges **platform** notices with **development** notices matched from every property and parking `residence_name` in the org (`list-host-announcements` with `orgId` only).

Notices appear only on this archive (and detail), not as a top banner on other pages. A **red dot** on **Announcements** (sidebar and **More** on phone) appears while any notice is unread. Opening a notice marks it read (device-local). Four summary stat cards sit above the feed.

**Page title:** `${Org Name} - Announcements`.

Property-only team members who cannot open org routes still reach announcements via the legacy property/parking `/announcements` deep-link routes (no sidebar entry).

## Host-facing knowledge

This is where you read official notices from Kame Homes — scheduled maintenance, new features, and updates for your buildings. Unread notices show a small red dot and stronger title; open a row to mark it read.

**Common host questions**

- Q: Where do I find announcements?
  A: Open **Announcements** from the org sidebar (or **More** on phone). A red dot means you still have unread notices.
- Q: What does the red dot on Announcements mean?
  A: You have at least one unread notice. Open each notice to clear the unread state.
- Q: What's the difference between Platform and a development name?
  A: **Platform** applies to all hosts. A development name applies only to properties or parkings linked to that development.

## Permissions

| Control       | Decision | Notes                                           |
| ------------- | -------- | ----------------------------------------------- |
| **Plans**     | N/A      | Not tier-gated                                  |
| **Team RBAC** | N/A      | `org.dashboard:view` baseline (org hub members) |

## Implementation map

| Layer  | Path                                                                                     |
| ------ | ---------------------------------------------------------------------------------------- |
| Pages  | `ui/src/features/dashboard/announcements/pages/HostAnnouncementsListPage.tsx`            |
| Routes | `ui/src/features/dashboard/announcements/routes/index.tsx` (`hostAnnouncementsOrgRoute`) |
| API    | `list-host-announcements` (`?orgId=` — aggregates all org residence names)               |

## Related

- [Property Announcements (deep-link fallback)](./property/announcements.md)
- [Parking Announcements (deep-link fallback)](./parking/announcements.md)
- [Super-admin Announcements](../admin/announcements.md)
