---
title: 'Super Admin Support Tickets — operator guide'
status: active
tags: [guides, routes, admin, help-support]
updated: 2026-09-05
---

# Super Admin Support Tickets — operator guide

Route: `/admin/support` (+ `/admin/support/faqs`)

> **Status:** Documented

## Progress overview

| Section              | E2E save | Validation | Docs | Notes                                                                                      |
| -------------------- | -------- | ---------- | ---- | ------------------------------------------------------------------------------------------ |
| Ticket list          | Done     | N/A        | Done | Search + filters; table/card toggle (grid on mobile)                                       |
| Ticket detail dialog | Done     | Done       | Done | Reply thread + status/priority; inbox-style composer                                       |
| FAQ editor           | Done     | Done       | Done | First-class nav + overview item; add/edit/reorder/publish/delete; URL-persisted pagination |

---

## Overview

Platform super-admins triage every support ticket across all organizations **and** explore guest tickets (`channel=guest`, shown as **Explore guest**), reply, and manage status/priority. FAQs are a separate first-class page (sidebar + overview card), not a button on the tickets list.

**Access:** `RequireSuperAdmin` (`SUPER_ADMIN_EMAILS`), same tier as Approvals/Hosts/Developments.

---

## Host-facing knowledge

_(Platform operator, not a host — this page isn't visible to hosts.)_

The platform team reviews every ticket hosts file through their Help & Support page here, replies, and closes them out. Replying to a host sends them an email with a link back to the ticket.

**Common host questions**

- Q: How do I reply to a host's ticket?
  A: Open the ticket from the list, type your reply at the bottom of the detail panel, and send. The host gets an email notification.
- Q: Does replying change the ticket status?
  A: An "Open" ticket automatically moves to "In progress" once you reply. You can also set status and priority manually from the same panel.
- Q: How do I add or edit an FAQ?
  A: Open FAQs from the Super Admin sidebar or overview. Add, edit, reorder (drag the handle to reorder within a category), publish/unpublish, or delete from there.

---

## Ticket list

### Sections

Search (subject / org name / submitter name / email) + category filter + status filter, applied server-side against the full ticket set (not just the loaded page). Desktop defaults to a table (subject, org, category, priority, status, date) with a table/grid toggle matching Hosts and Developments. Phone/tablet layouts force the card grid — phone rows are dense (subject + status; org · submitter · category · priority · date on one meta line).

### Behavior / edge cases

Clicking a ticket opens `SuperAdminTicketDetailDialog` (bottom sheet on mobile, centered dialog on desktop via `ResponsiveModal`). Empty copy distinguishes “no tickets yet” from “no tickets match your filters”.

**Pagination:** standard admin-list pagination (same pattern as the bookings list) — `page`/`limit` persisted in the URL (`?page=`, `?limit=`), default page size 31 (`ADMIN_DEFAULT_PAGE_SIZE`). `GET list-support-tickets-admin` accepts `page`/`limit`/`search`/`category`/`status`/`org_id`, all applied at the DB level: `category`/`status`/`org_id` are `.eq()` filters, `search` matches `subject`/`submitted_by_name`/`submitted_by_email` via `.ilike()` (escaped through `postgrestOrIlikeValue`) OR'd with an `organization_id.in.(...)` lookup against organizations whose name matches (the org name lives on a joined table, so it can't be folded into the same `.ilike()` OR directly). Results are ordered by `created_at` desc and paginated with `.range()` + `count: 'exact'`, returning `{ tickets, total, page, limit }`. `AdminListPagination` renders once at the page level below whichever view (table or grid) is active, and the per-page select (`AdminListPerPageSelect`) lives in `SuperAdminSupportToolbar` next to the view toggle — both are shared across table/grid so switching views never resets the page. Search/category/status filter state lives in the URL (`?search=`, `?category=`, `?status=`) and changing any of them resets to page 1. Because filtering now happens in the database, a ticket that matches your filters will show up on the correct page across the entire ticket set, not just the currently loaded page.

## Ticket detail dialog

### Fields

| Field    | Storage                        | Validation                             |
| -------- | ------------------------------ | -------------------------------------- |
| Status   | `support_tickets.status`       | open / in_progress / resolved / closed |
| Priority | `support_tickets.priority`     | low / medium / high / none             |
| Reply    | `support_ticket_messages.body` | Required, ≤5000 chars                  |

Header shows organization (or **Explore guest**), category, and the submitter. Status and priority are the dropdowns (no duplicate status badge). A status banner appears for **Resolved** and **Closed** tickets. Enter sends the reply; Shift+Enter inserts a new line. Send is disabled while a reply is in flight.

**Status flow (admin):**

| Status      | Composer | Auto on admin reply |
| ----------- | -------- | ------------------- |
| Open        | Shown    | → In progress       |
| In progress | Shown    | —                   |
| Resolved    | Shown    | → In progress       |
| Closed      | Shown    | → In progress       |

Admin reply email links to the host Help & Support ticket URL or `/account/tickets/:id` for explore guests.

### Save path

1. Reply → **`reply-support-ticket-admin`** (POST) → inserts a `sender_type='admin'` message, auto-moves **Open → In progress** and **Resolved/Closed → In progress**, sends `sendSupportTicketReplyNotify` to the submitter (best-effort; guest channel links to `/account/tickets/:id`).
2. Status/priority change → **`update-support-ticket-status`** (POST) → independent fields, either can be set alone.

## FAQ editor (`/admin/support/faqs`)

First-class Platform nav item and overview card (label **FAQs**). Category-grouped rows, each with a drag handle (`@dnd-kit`) instead of up/down arrows. Every category renders its own `DndContext` + `SortableContext`, so a row can only be reordered within its own category — dropping outside that category's list is a no-op. On drop, the new order is applied to local state immediately (no wait for the network), then the row's `sort_order` values are reassigned to match the target position and persisted via `update-help-center-faq` calls for only the rows whose position actually changed; the local override is cleared once the refetched list confirms the same order, so a slow request never causes a visible snap-back. As before, this only reorders within the currently loaded page. Publish toggle is a `Switch` bound directly to `is_published`. Delete asks for confirmation via `AlertDialog`. Add/edit opens a shared dialog form (category — free text with a datalist of existing categories, question, answer).

**Pagination:** standard admin-list pagination (same pattern as the bookings list) — `page`/`limit` persisted in the URL (`?page=`, `?limit=`), default page size 31 (`ADMIN_DEFAULT_PAGE_SIZE`). `GET list-help-center-faqs-admin` accepts `page`/`limit`, orders by category then `sort_order`, and paginates via `.range()` + `{ count: 'exact' }` (no full-table fetch), returning `{ faqs, total, page, limit }`. Pagination controls are hidden until there is more than one page; the per-page select (`AdminListPerPageSelect`) resets to page 1 on change. Because pagination is applied after the category/sort_order ordering, a category can in principle split across pages once FAQ counts exceed one page. This page has no search/status/category filter UI today — everything above the per-page select is display-only grouping of the current page's rows.

## API reference

| Action                                        | Endpoint                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| List tickets (all orgs), filtered + paginated | `GET list-support-tickets-admin?page=&limit=&search=&category=&status=&org_id=` |
| Get ticket + thread                           | `GET get-support-ticket-admin`                                                  |
| Reply as admin                                | `POST reply-support-ticket-admin`                                               |
| Reopen (submitter, closed only)               | `POST reopen-support-ticket`                                                    |
| Update status/priority                        | `POST update-support-ticket-status`                                             |
| List all FAQs (incl. unpublished), paginated  | `GET list-help-center-faqs-admin?page=&limit=`                                  |
| Create FAQ                                    | `POST create-help-center-faq`                                                   |
| Update FAQ (also reorder)                     | `POST update-help-center-faq`                                                   |
| Delete FAQ                                    | `POST delete-help-center-faq`                                                   |

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Implementation map

| Concern            | Path                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pages              | `ui/src/features/dashboard/super-admin/pages/SuperAdminSupportPage.tsx`, `SuperAdminHelpFaqsPage.tsx`                                                  |
| List UI            | `ui/src/features/dashboard/super-admin/components/super-admin-support/{SuperAdminSupportTable,SuperAdminSupportCardGrid,SuperAdminSupportToolbar}.tsx` |
| Detail             | `ui/src/features/dashboard/super-admin/components/super-admin-support/SuperAdminTicketDetailDialog.tsx`                                                |
| Shared nav         | `ui/src/features/dashboard/super-admin/lib/superAdminPlatformNav.ts`                                                                                   |
| Hooks              | `ui/src/features/dashboard/super-admin/hooks/{useSupportTicketsAdmin,useHelpCenterFaqsAdmin}.ts`                                                       |
| Edge functions     | `supabase/functions/{list,get,reply}-support-ticket-admin`, `update-support-ticket-status`, `{list,create,update,delete}-help-center-faq*`             |
| Route registration | `ui/src/features/dashboard/super-admin/routes/index.tsx`, `superAdminPaths.ts`                                                                         |

---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |

## Related docs

- [Route index](../README.md)
- [Property Help & Support](../org/property/help-support.md) (host-facing counterpart)
- [`docs/PROJECT.md`](../../PROJECT.md)
- [`docs/workflow/in-progress/help-support-center.md`](../../workflow/in-progress/help-support-center.md)

## Pending / follow-ups

- [ ] None — Phase 5 of the Help & Support plan shipped this in full.
