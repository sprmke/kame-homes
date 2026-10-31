---
title: 'Super Admin Announcements — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-09-05
---

# Super Admin Announcements — operator guide

Route: `/admin/announcements`

> **Status:** Documented

## Progress overview

| Section                 | E2E save | Validation | Docs | Notes                                       |
| ----------------------- | -------- | ---------- | ---- | ------------------------------------------- |
| Platform-wide notices   | Done     | Server     | Done | All signed-in hosts                         |
| Stat cards + table/grid | Done     | N/A        | Done | Same list shell as Support tickets          |
| Big-modal CRUD          | Done     | N/A        | Done | Standard admin dialog shell, not a sub-page |
| Rich-text message       | Done     | N/A        | Done | WYSIWYG editor, rendered as HTML to host    |

---

## Overview

Platform-wide host notices — maintenance windows, product releases, billing outages — shown to **every** signed-in host on the property/parking **Announcements** page, regardless of development. Development-specific notices (pool closure, tower work) stay on **`/admin/developments/:slug` → Announcements**.

The list page (`/admin/announcements`) follows the same shell as **Support tickets**: four **stat cards** (Total, Active, Critical, Warning), a search + severity + status toolbar with a **table ⇄ grid** view toggle and per-page control, then the list itself (phone/tablet always forced to grid). Clicking a row or card opens the full CRUD form in a wide **big admin dialog** (larger than the ticket/approval dialogs — sized for a form with a rich-text editor, not a thread) with its own **Save changes** / **Delete**; there is no separate detail route.

**Add announcement** in the header is a dropdown with two destinations: **Platform announcement** opens the same big modal in create mode; **Development announcement** links to **`/admin/developments`** — open a development → Announcements section for residence-scoped notices (compact list + its own edit dialog, since that page batches all development fields under one **Save Changes** — see [Development detail — Announcements](./development-detail.md)).

Every destructive **Delete** (platform modal and the development-scoped dialog) is gated by an `AlertDialog` confirm step — no single-click delete.

Sidebar: **Announcements** (megaphone), separate from **AI Management**.

**Access:** `RequireSuperAdmin` (`SUPER_ADMIN_EMAILS`).

---

## Host-facing knowledge

Hosts see platform notices labeled **Platform** on the dedicated **Announcements** sidebar page. Development notices show the development name instead. A red dot on **Announcements** means there are unread notices.

**Common host questions**

- Q: Where do hosts see announcements?
  A: Only on **Announcements** in the host sidebar (or **More** on phone). Other dashboard pages do not show a top banner.
- Q: How do hosts know something is new?
  A: Unread notices show a red dot on **Announcements** and stronger titles in the list. Opening a notice marks it read.

---

## Fields

| Field    | Storage                                        | Validation                                                                |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| Title    | `platform_host_settings.announcements[].title` | Required, ≤160 chars                                                      |
| Message  | `…body`                                        | Rich-text HTML (WYSIWYG editor); required, ≤4000 plain-text chars         |
| Severity | `…severity`                                    | `info` \| `warning` \| `critical`                                         |
| Active   | `…active`                                      | Inactive rows filtered server-side                                        |
| Schedule | `…startsAt` / `…endsAt`                        | Optional calendar dates (DatePicker; Asia/Manila day boundaries, no time) |
| Link     | `…linkUrl` / `…linkLabel`                      | URL must be `http://` or `https://`; label ≤80                            |

Message is authored with the same TipTap rich-text editor used for property/stay-guide templates (bold/italic/underline, headings, lists, links, images), behind an **Edit / Preview** tab so admins can check the rendered result before saving — Preview reuses `StayGuideRichContent`, the same renderer hosts see. Stored as HTML and rendered as HTML on the host-facing detail page; list previews and the AI assistant tool responses strip tags down to plain text. Legacy plain-text rows are auto-wrapped in `<p>` on read so old announcements keep their line breaks.

---

## Save path

1. Open a row/card (or **Add announcement**) on **`/admin/announcements`** → big modal → **Save changes** / **Add announcement**
2. Dialog replaces (or appends) that one entry in the full array and calls `PATCH update-platform-host-settings` with `{ announcements: [...] }`, then closes on success — the first save in a session prompts for a step-up email OTP (~15-min sudo window; see [`overview.md`](overview.md#step-up-verification-all-admin-pages))
3. **Delete** in the dialog footer removes the entry the same way
4. Hosts read merged platform + development rows via **`list-host-announcements`**

Filters (search / severity / status), page, and page size live in the URL (`?search=&severity=&status=&page=&limit=`); the list itself is filtered/paginated client-side from the one `platform_host_settings.announcements[]` array (no server pagination — there's no per-tenant volume here like Support tickets).

---

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Implementation map

| Concern                                       | Path                                                                                                                                                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List page                                     | `ui/src/features/dashboard/super-admin/pages/SuperAdminAnnouncementsPage.tsx`                                                                                                                                                                |
| Stat cards                                    | `ui/src/features/dashboard/super-admin/components/super-admin-announcements/SuperAdminAnnouncementSummaryCards.tsx`                                                                                                                          |
| Toolbar                                       | `ui/src/features/dashboard/super-admin/components/super-admin-announcements/SuperAdminAnnouncementToolbar.tsx`                                                                                                                               |
| Table view                                    | `ui/src/features/dashboard/super-admin/components/super-admin-announcements/SuperAdminAnnouncementTable.tsx`                                                                                                                                 |
| Grid view                                     | `ui/src/features/dashboard/super-admin/components/super-admin-announcements/SuperAdminAnnouncementCardGrid.tsx`                                                                                                                              |
| Big modal (manage/CRUD)                       | `ui/src/features/dashboard/super-admin/components/super-admin-announcements/SuperAdminAnnouncementDialog.tsx` — extends `superAdminApprovalDialogContentClass` (ticket/approval dialog shell) with a wider/taller override for the CRUD form |
| Filters/summary lib                           | `ui/src/features/dashboard/super-admin/lib/superAdminAnnouncementFilters.ts`                                                                                                                                                                 |
| Form fields (shared, incl. Edit/Preview tabs) | `ui/src/features/dashboard/announcements/components/HostAnnouncementFormFields.tsx`                                                                                                                                                          |
| Dev-scoped list + dialog                      | `ui/src/features/dashboard/announcements/components/HostAnnouncementAdminList.tsx` + `HostAnnouncementEditor.tsx` (same big-dialog shell + confirm-delete as the platform modal)                                                             |
| Rich-text editor                              | `ui/src/features/dashboard/bookings/components/property-templates/RichTextEditor.tsx`                                                                                                                                                        |
| Rich-text render                              | `ui/src/features/guest/stay-guide/components/StayGuideRichContent.tsx`                                                                                                                                                                       |
| Hook                                          | `ui/src/features/dashboard/super-admin/hooks/usePlatformHostSettings.ts`                                                                                                                                                                     |
| Edge                                          | `get-platform-host-settings/`, `update-platform-host-settings/`, `list-host-announcements/`                                                                                                                                                  |
| Nav                                           | `superAdminPlatformNav.ts` → **Announcements**                                                                                                                                                                                               |

---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |

---

## Related docs

- [Property Announcements](../org/property/announcements.md)
- [Development detail — Announcements](./development-detail.md)
