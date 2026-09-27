---
title: 'Development Settings — operator guide'
status: active
tags: [guides, routes, admin, developments]
updated: 2026-09-27
---

# Development Settings — operator guide

Route: `/admin/developments/:developmentSlug`

> **Status:** Documented · a **← Developments** back link now sits above the pinned header
> (`AdminSectionNavLayout` header slot).

## Progress overview

| Section               | E2E save | Validation | Docs | Notes                                                             |
| --------------------- | -------- | ---------- | ---- | ----------------------------------------------------------------- |
| Basic Information     | Done     | Done       | Done | Name, slug, developer, type, status, description                  |
| Photos & Videos       | Done     | Done       | Done | Shared `PropertyMediaUpload`; saves immediately on reorder/upload |
| Email automations     | Done     | Done       | Done | PMO email (optional)                                              |
| Document Requirements | Done     | Done       | Done | Ordered checklist for PENDING_DOCUMENTS (all properties in dev)   |
| Unit types            | Done     | Done       | Done | Per-type max adults/children capacity presets                     |
| Pool                  | Done     | Done       | Done | Pool fee (PHP) + schedule                                         |
| Guest information     | Done     | Done       | Done | Requirements, guides, other info for guests + AI                  |
| Announcements         | Done     | Done       | Done | Host Announcements page for this development                      |
| Amenities             | Done     | —          | Done | Suggested chips + free-text add                                   |
| Location              | Done     | Done       | Done | Location line + `PropertyLocationPicker`                          |
| Towers & Parking      | Done     | —          | Done | Free-text tag lists                                               |
| Danger Zone           | Done     | Done       | Done | Delete blocked (409) while linked                                 |

---

## Overview

Single-development settings page for a super admin to edit a development's public profile and manage its lifecycle. All sections save together via one **Save Changes** action in the page header when dirty (no sticky footer), except the media gallery, which persists immediately on upload/reorder/delete.

**Access:** `RequireSuperAdmin` (`SUPER_ADMIN_EMAILS`).

---

## Host-facing knowledge

This page is where the platform team maintains the shared profile for a condo or subdivision project — its name, photos, amenities, location, and the property-management-office email that receives approval requests for every unit inside it. Hosts with a unit inside a registered development benefit from this shared information automatically; they don't edit it themselves.

**Common host questions**

- Q: Can I update my building's development photos or amenities myself?
  A: No — development-level details are managed by the platform team, since they're shared across every unit in the project. Contact the platform team if something needs updating.
- Q: What happens to my unit if the development profile is deleted?
  A: The platform team can't delete a development while properties or parking slots are still linked to it — they'd need to reassign or remove those first, so this shouldn't affect an active unit unexpectedly.

---

## Basic Information

### Fields

| Field       | Storage                       | Validation                                                                      |
| ----------- | ----------------------------- | ------------------------------------------------------------------------------- |
| Name        | `developments.name`           | 2–160 chars, unique across developments                                         |
| URL slug    | `developments.slug`           | Non-empty, unique; changing it redirects the page                               |
| Developer   | `developments.developer_name` | Optional                                                                        |
| Type        | `developments.type`           | One of `CONDOMINIUM` / `SUBDIVISION` / `MIXED_USE` / `TOWNHOUSE` / `COMMERCIAL` |
| Status      | `developments.status`         | `ACTIVE` / `INACTIVE`                                                           |
| Description | `developments.description`    | Optional free text                                                              |

### Save path

1. **Save Changes** → **`PATCH update-development`** with `developmentId` + changed fields.
2. On success, if the returned `slug` differs from the URL param (name/slug edit), the page navigates to the new slug in place.

---

## Photos & Videos

Reuses the property media-upload component (`PropertyMediaUpload`), scoped by `developmentId` instead of `propertyId`. Uploads/deletes/reorders call **`upload-development-media`** directly and persist immediately — they are not part of the batched Save Changes flow. First uploaded (or first reordered-to-front) image becomes `cover_image_url` automatically. Limits mirror property media (max image/video counts, per-type size caps) from `_shared/propertyMedia.ts`.

---

## Email automations

| Field     | Storage                          | Validation                                                                                                                                                                                    |
| --------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PMO email | `developments.settings.pmoEmail` | Optional; must be a valid email if set. Canonical **To:** for GAF/pet approval request emails for every property in this development (overrides legacy per-property `app_settings.email_to`). |

Receives GAF and pet approval requests for **all** properties inside this development (see `.cursor/rules/booking-workflow.mdc` for the request-email flow itself; this field only configures the recipient).

---

## Document Requirements

Ordered checklist of documents required before a booking reaches **Ready for check-in** — applies to every property whose `residence_name` matches this development.

| Field         | Storage                                                       | Notes                                                           |
| ------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| Document list | `developments.settings.workflowDefaults.documentRequirements` | JSON array; empty list → bookings skip `PENDING_DOCUMENTS` (D2) |

Each row: **label**, **trigger** (Always required / Guest has pets / Guest needs parking), **approval source** (Manual / Email listener), **PDF template** (None / GAF request form / Pet request form).

**PDF template** is what binds a row to the request pipeline: `requirementMatchesPdfTemplate` matches on `pdfTemplateId` **or** the literal row id (`gaf` / `pet`). A row left on **None** is tracked as a checklist step only — the orchestrator generates no request PDF and sends no request email for it. Re-adding a deleted GAF/pet row creates it with id `custom-N` and no template, so the template must be set explicitly or the request stops firing.

Save path: batched **Save Changes** → **`PATCH update-development`** with `documentRequirements`. The handler rejects the payload if any row is missing `id`, `label`, `order`, `triggerCondition`, or `approvalSource` rather than silently dropping it.

Edge resolution for bookings: `documentRequirements.ts#resolveDocumentRequirements` (property override column deprecated; development default → `DEFAULT_DOCUMENT_REQUIREMENTS` fallback).

---

## Unit types

Per-unit capacity presets for properties in this development. Stored in **`developments.settings.unitTypes`** (JSON array).

| Field per row | Notes                                                              |
| ------------- | ------------------------------------------------------------------ |
| `id`          | Stable slug (e.g. `studio`, `1br`, `2br`)                          |
| `label`       | Host-facing name (e.g. `Studio`, `1 bedroom`)                      |
| `maxAdults`   | Maximum adults allowed in the unit                                 |
| `maxChildren` | Maximum children allowed (occupancy rule: age ≤ 3 counts as child) |

**Azure North defaults** (when unset): Studio — 4 adults / 1 child; 1 bedroom — 6 / 2; 2 bedroom — 8 / 3.

Save path: batched **Save Changes** → **`PATCH update-development`** with `unitTypes`.

Public read: **`GET get-residence-unit-types?residenceName=`** (used by property settings + guest form capacity).

Properties pick one type under **Property Details → Unit type**; max adults/children are derived from the selection.

---

## Pool

| Field          | Storage                              | Notes                                      |
| -------------- | ------------------------------------ | ------------------------------------------ |
| Pool fee (PHP) | `developments.settings.poolFee`      | Optional; guest-safe amount for AI/inbox   |
| Pool schedule  | `developments.settings.poolSchedule` | Free text (hours, rules, seasonal closure) |

**Azure North defaults** (when unset): pool fee **₱200**; schedule **7 AM to 7 PM. Maintenance every Tuesday.**

Save path: batched **Save Changes** → **`PATCH update-development`**.

Guest-facing AI (inbox auto-reply, voice receptionist) reads these fields when the property's `residence_name` matches this development.

---

## Guest information

Building/residence facts shared across every unit in the development — surfaced to guests via AI tools, not a separate public page yet.

| Field             | Storage                                   | Notes                                      |
| ----------------- | ----------------------------------------- | ------------------------------------------ |
| Requirements      | `developments.settings.guestRequirements` | Free text (ID, noise, move-in rules, etc.) |
| Guides            | `developments.settings.guestGuides`       | JSON array `{ id, title, content }`        |
| Other information | `developments.settings.importantInfo`     | Catch-all free text for AI grounding       |

Document requirement **labels** from the Document Requirements section are also included in AI context (guest-safe checklist names only — no approval internals).

Save path: batched **Save Changes** → **`PATCH update-development`**.

---

## Announcements

Host-facing notices shown on the property/parking **Announcements** page for every org with properties or parking linked to this development (`residence_name` match).

Shown as a compact list (`HostAnnouncementAdminList`, same row style as the platform Announcements page). Clicking a row (or **Add announcement**) opens an edit dialog (`HostAnnouncementEditor`, shared `HostAnnouncementFormFields`) instead of a route — changes apply to this page's in-memory draft only and are not persisted until the page-level **Save Changes** below.

| Field per row    | Storage                                 | Notes                                                                                                                       |
| ---------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Title / message  | `developments.settings.announcements[]` | Message is rich-text HTML (WYSIWYG editor), required                                                                        |
| Severity         | same                                    | `info` / `warning` / `critical`                                                                                             |
| Active           | same                                    | Off = hidden even inside schedule window                                                                                    |
| Starts / ends    | same                                    | Optional calendar dates (Asia/Manila); no time picker — start is inclusive from that day, end is inclusive through that day |
| Link URL / label | same                                    | Optional CTA                                                                                                                |

Notices stay active until **Active** is turned off or optional **Ends** date passes (Asia/Manila day boundaries). Hosts read the full merged list under **Announcements** in the sidebar (unread red-dot on nav); the message renders as HTML there. Other dashboard pages do not show a top banner.

Platform-wide announcements (maintenance, product releases) are managed on **`/admin/announcements`**.

Save path: batched **Save Changes** → **`PATCH update-development`** with `announcements`.

---

## Amenities

Stored as `developments.settings.amenities` (string array). Suggested chips toggle on/off; a free-text input appends custom entries not in the suggestion list.

---

## Location

| Field                                                                       | Storage                                                                                            |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Location line                                                               | `developments.location`                                                                            |
| Address / city / province / country / zip / lat / lng / Maps URL / place ID | `developments.settings.{address,city,province,country,zipCode,latitude,longitude,mapsUrl,placeId}` |

Uses the shared `PropertyLocationPicker`. The location line auto-suggests from city + province when it was previously empty or itself auto-generated (`shouldAutoUpdateDevelopmentLocationLine`) — a manually-typed location line is never overwritten by the picker.

---

## Towers & Parking

Three free-text tag lists stored in `developments.settings`: `propertyTowers`, `parkingTowers`, `parkingLevels`. These populate tower/level choices offered to admins when they set up individual properties/parking slots that belong to this development.

---

## Danger Zone

**Delete** → **`POST delete-development`**. Server counts `properties` and `parkings` rows whose `residence_name` matches the development's `name` (case-sensitive exact match) and returns **409** ("Cannot delete a development that still has linked properties or parking slots") if either count is `> 0`. The UI disables the Delete button and shows the same reason whenever `stats.propertyCount` or `stats.parkingCount` is non-zero.

---

## API reference

| Action       | Endpoint                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------- |
| Get          | `GET get-development?slug=` — single development + stats                                  |
| Update       | `PATCH update-development` — `{ developmentId, ...changed fields }`                       |
| Delete       | `POST delete-development` — `{ developmentId }`; `409` if properties/parking still linked |
| Upload media | `POST upload-development-media?development_id=` — FormData `file`                         |
| Delete media | `DELETE upload-development-media?development_id=` — `{ storagePath                        | mediaId }` |

---

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Implementation map

| Concern               | Path                                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                  | `ui/src/features/dashboard/super-admin/pages/SuperAdminDevelopmentDetailPage.tsx`                                                                                                                         |
| Settings shell        | `ui/src/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentSettingsCard.tsx`                                                                                           |
| Section fields        | `ui/src/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentProfileSections.tsx`, `DevelopmentGuestInfoSection.tsx`                                                     |
| Form draft / diff     | `ui/src/features/dashboard/super-admin/lib/developmentSettingsForm.ts`                                                                                                                                    |
| Media adapter         | `ui/src/features/dashboard/super-admin/lib/developmentMedia.ts`                                                                                                                                           |
| Location auto-suggest | `ui/src/features/dashboard/super-admin/lib/developmentLocation.ts`                                                                                                                                        |
| Constants             | `ui/src/features/dashboard/super-admin/lib/developmentSettingsConstants.ts`                                                                                                                               |
| Query hooks           | `ui/src/features/dashboard/super-admin/hooks/useDevelopments.ts`, `ui/src/features/dashboard/super-admin/hooks/useUploadDevelopmentMedia.ts`                                                              |
| Edge functions        | `supabase/functions/get-development/index.ts`, `supabase/functions/update-development/index.ts`, `supabase/functions/delete-development/index.ts`, `supabase/functions/upload-development-media/index.ts` |

---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |

---

## Related docs

- [Route index](../README.md)
- [Developments list guide](./developments.md)
- [`docs/PROJECT.md`](../../PROJECT.md)

---

## Pending / follow-ups

- [ ] None known.
