---
title: 'Super Admin Playbook Articles — operator guide'
status: active
tags: [guides, routes, admin, analytics]
updated: 2026-09-09
---

# Super Admin Playbook Articles — operator guide

Route: `/admin/playbook`

> **Status:** Documented
> Feature: Host Analytics Improvement Playbook — [`../org/property/analytics.md`](../org/property/analytics.md)

## Progress overview

| Section        | E2E save | Validation | Docs | Notes                                                              |
| -------------- | -------- | ---------- | ---- | ------------------------------------------------------------------ |
| Article list   | Done     | N/A        | Done | Category-grouped, active/inactive toggle, URL-persisted pagination |
| Article editor | Done     | Done       | Done | Add/edit; JSON `applies_when` condition editor; numeric sort order |
| Delete         | Done     | N/A        | Done | Confirmation dialog                                                |

---

## Overview

Platform super-admins manage the curated tip/tutorial catalog (`host_playbook_articles`) that
the Host Analytics module's deterministic matcher (`_shared/hostPlaybook.ts`) and the AI
Performance Review's `improvements[].articleSlugs` citations both draw from. This is the only
way to add or edit Playbook content — the 17 launch articles came from a seed migration
(`20261308120000_host_analytics_foundation.sql`), not this page.

**Access:** `RequireSuperAdmin` (`SUPER_ADMIN_EMAILS`), same tier as FAQs/Announcements.

---

## Host-facing knowledge

_(Platform operator, not a host — this page isn't visible to hosts.)_

**Common host questions**

- Q: How do I add or edit a Playbook article?
  A: Open **Playbook articles** from the Super Admin sidebar (under Content). Add, edit, toggle
  active/inactive, or delete from there.
- Q: What does "Applies when" control?
  A: A JSON condition (`{"metric": "...", "op": "...", "value": ...}`) evaluated against a
  property's analytics bundle — it decides which properties see this article on their Analytics
  page and whether the AI review can cite it. Leave it as `{}` to always match.
- Q: What happens to hosts' pages if I delete an article the AI review already cited?
  A: The citation chip simply won't resolve to anything on that already-generated review; new
  reviews stop citing it immediately. Deleting doesn't retroactively edit stored reviews.

---

## Article list

### Sections

Grouped by `category` (free-text, autocompleted from existing categories in the editor). Each
row shows title, slug, a truncated body preview, an active/inactive `Switch`, and edit/delete
icon buttons.

### Behavior / edge cases

**Pagination:** same pattern as FAQs/Support — `page`/`limit` persisted in the URL, default page
size `ADMIN_DEFAULT_PAGE_SIZE`. `GET list-host-playbook-articles-admin` orders by category then
`sort_order`, paginates via `.range()` + `{ count: 'exact' }`, returns
`{ articles, total, page, limit }`.

No drag-and-drop reorder (unlike the FAQ editor) — reordering is a numeric **Sort order** field
in the editor dialog, a deliberate scope trim since Playbook ordering matters far less than FAQ
ordering (articles are matched/filtered by condition, not browsed top-to-bottom by a host).

## Article editor

### Fields

| Field        | Storage                               | Validation                                                                 |
| ------------ | ------------------------------------- | -------------------------------------------------------------------------- |
| Slug         | `host_playbook_articles.slug`         | Required on create only, immutable after, unique, lowercase/digits/hyphens |
| Category     | `host_playbook_articles.category`     | Required, free text (combobox with existing values)                        |
| Title        | `host_playbook_articles.title`        | Required, ≤200 chars                                                       |
| Body         | `host_playbook_articles.body_md`      | Required markdown, ≤4000 chars                                             |
| Applies when | `host_playbook_articles.applies_when` | Optional JSON object, validated client-side before save                    |
| Sort order   | `host_playbook_articles.sort_order`   | Integer, lower = matched/shown first                                       |
| Active       | `host_playbook_articles.is_active`    | Toggle on the list row, not the dialog                                     |

### Save path

- Create → **`create-host-playbook-article`** (POST) — 409-equivalent friendly error on a
  duplicate slug (Postgres `23505`).
- Edit / active toggle / sort order → **`update-host-playbook-article`** (POST, partial).
- Delete → **`delete-host-playbook-article`** (POST) after an `AlertDialog` confirmation.

## API reference

| Action                                        | Endpoint                                             |
| --------------------------------------------- | ---------------------------------------------------- |
| List all articles (incl. inactive), paginated | `GET list-host-playbook-articles-admin?page=&limit=` |
| Create article                                | `POST create-host-playbook-article`                  |
| Update article (also reorder / toggle)        | `POST update-host-playbook-article`                  |
| Delete article                                | `POST delete-host-playbook-article`                  |

## Implementation map

| Concern            | Path                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Page               | `ui/src/features/dashboard/super-admin/pages/SuperAdminPlaybookArticlesPage.tsx`                                  |
| Editor dialog      | `ui/src/features/dashboard/super-admin/components/super-admin-support/SuperAdminPlaybookArticleEditorDialog.tsx`  |
| Hooks              | `ui/src/features/dashboard/super-admin/hooks/useHostPlaybookArticlesAdmin.ts`                                     |
| Shared nav         | `ui/src/features/dashboard/super-admin/lib/superAdminPlatformNav.ts`                                              |
| Edge functions     | `supabase/functions/{list,create,update,delete}-host-playbook-article*`                                           |
| Route registration | `ui/src/features/dashboard/super-admin/routes/index.tsx`, `superAdminPaths.ts`                                    |
| Matcher (consumer) | `supabase/functions/_shared/hostPlaybook.ts`, `_shared/analyticsAiReview.ts` (`articleSlugs` citation allow-list) |
