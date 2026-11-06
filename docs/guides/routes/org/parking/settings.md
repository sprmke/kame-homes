---
title: 'Parking settings — operator guide'
status: active
tags: [guides, routes, org, parking]
updated: 2026-09-27
---

# Parking settings — operator guide

Route: `/org/:orgSlug/parking/:parkingSlug/settings`

> **Status:** Documented

## Progress overview

| Section           | E2E save  | Validation | Docs | Notes                                                                                                                          |
| ----------------- | --------- | ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| Basic Information | Done      | Done       | Done | Parking type/residence/tower/level/slot are read-only                                                                          |
| Photos            | Done      | Done       | Done | Single cover photo required                                                                                                    |
| Parking Details   | Done      | Done       | Done | Check-in/out required; dimensions optional                                                                                     |
| Amenities         | Done      | Done       | Done | At least 1 amenity required                                                                                                    |
| Location          | Done      | Done       | Done | Address + map pin required                                                                                                     |
| Automations       | Done      | N/A        | Done | Email toggles (reservation / confirmed / no host) + auto-accept top match, grouped by recipient                                |
| Integrations      | Done      | N/A        | Done | Telegram + AI optional; status/shortcuts only                                                                                  |
| Activity          | Read-only | n/a        | Done | Summary row + **Manage** → modal with full parking activity feed (`ActivityLogPanel`). Section shown only with `activity:view` |
| Danger Zone       | Done      | N/A        | Done | Archive, restore, delete with confirmation                                                                                     |

## Overview

Configure one parking slot: cover photo, dimensions and check-in times, amenities, location, automation emails, integrations status, and delete. Guests pay through PayMongo, so there is no payment method section. Saves update the public listing guests see at `/parkings/:slug` and the admin sidebar for this slot. Aligned with [Property Settings](../property/settings.md): required fields, save-blocking validation, and section red-dot tracking follow the same pattern. Field helpers use a **?** beside the label (`FieldLabel` / `SettingsField` `help`) — not muted text under the control.

---

## Host-facing knowledge

Parking **Settings** is where you set up a single slot before guests can book it: photos, map location, size and clearance, amenities, brand color, and which emails send automatically. Guests pay through PayMongo at checkout, so you do not enter payment details here. Parking type, residence, tower, level, and slot number are set once when the slot is created and can't be changed here - delete and recreate the slot if any of those are wrong. Telegram and other integrations link out to **Notifications** for credentials. Most sections save independently, and deleting a slot is permanent, so that option lives in the danger zone at the bottom.

**Common host questions**

- Q: What do guests actually see from here?
  A: Basic info, photos, location, and amenities flow to your public parking page. Keep the cover photo and description accurate before sharing the link. Guests pay through PayMongo at checkout, so there are no payment details to fill in here.
- Q: Can I change the tower, level, or slot number after creating the slot?
  A: No. Those, along with parking type and residence, are locked once the slot is created since guests, bookings, and the public link are all tied to them. If one is wrong, delete the slot and create a new one.
- Q: Do I have to fill out every section before anything saves?
  A: No. **Save Changes** only saves the sections you've edited that pass validation, so you can finish photos today and automations later. Incomplete required areas still show a warning dot until you get to them.
- Q: Why is there no Payment section any more?
  A: Guests pay for parking through PayMongo when they book. Payment methods you entered before are kept for history but are no longer used or shown.
- Q: Where do I connect Telegram for this parking slot?
  A: On **Notifications** for this slot. Settings here only show integration status and shortcuts, not the bot token fields.
- Q: Where is listing verification for this slot?
  A: Open **Verification** from the parking sidebar, or upload listing docs in org **Get Verified → Listings**. Listing go-live needs your Parking Rights (and contract end when needed) plus proof of ownership or authorization on listing **Verified**. Additional proof and the Azure Property Management email confirmation are for listing **Recommended**.
- Q: My hosting contract is ending - what should I do?
  A: A renewal reminder may appear when you log in. Tap **Submit renewal contract** or use **Verification** in the sidebar to upload an updated contract before the grace period ends.

---

## Setup completeness

**Save Changes** is blocked while any required field is incomplete — the button stays visible but **disabled** (tooltip names the first issue), matching [Property Settings](../property/settings.md#setup-completeness). Incomplete sections show a **red dot** on the in-page section nav (desktop `lg+` sidebar) and on the sidebar **Settings** link, driven by the saved parking snapshot outside the editor and by the live draft while editing. On phone, Save is a hero icon when dirty; on desktop it appears in the page header actions (no separate sticky footer bar).

| Rule                                                     | Required? |
| -------------------------------------------------------- | --------- |
| Basic info (parking type, residence, tower, level, slot) | Yes       |
| Photos (cover image)                                     | Yes       |
| Parking details (check-in / check-out)                   | Yes       |
| Amenities (at least 1 selected)                          | Yes       |
| Location (address + map pin)                             | Yes       |
| Telegram integrations                                    | No        |

Field-level errors appear **as you edit** (on blur/change). After **Save Changes**, all remaining issues are shown at once and the page scrolls to the first incomplete section. Section banners (orange) appear for **Photos** and **Amenities** — not for sections with individual inputs.

Logic: `ui/src/features/dashboard/parking/lib/parkingSettingsCompletion.ts`, `ui/src/features/dashboard/parking/lib/parkingSettingsFieldError.ts`

---

## Sections

| Section         | Storage                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Basic info      | `parkings` columns + `parkings.settings` — `brandColor`, `description`; `residence_name`, `parking_type`, `tower`, `level`, `slot_label` (**read-only**, set at creation)                                                                                                                                                                                    |
| Photos          | `parkings.settings.coverImage` + `coverImageStoragePath` via **`upload-parking-media`** (single image max)                                                                                                                                                                                                                                                   |
| Parking details | `parkings.settings` — optional `spaceLengthM`, `spaceWidthM`, `heightClearanceM`; `checkInTime`, `checkOutTime` (defaults `14:00`, `12:00`) via **`ParkingDetailsSection`**                                                                                                                                                                                  |
| Amenities       | `parkings.settings.enabledParkingAmenities`, `customParkingAmenities`, resolved `features[]` (public listing) via **`PATCH update-parking`**                                                                                                                                                                                                                 |
| Location        | `parkings.settings` — `address`, `city`, `province`, `country`, `zipCode`, `latitude`, `longitude`, `mapsUrl`, `placeId` (same shape as property; **`PropertyLocationPicker`**)                                                                                                                                                                              |
| Automations     | `parking_settings.automation_toggles` — reservation request, guest confirmed, no-host-available (default **on**), and `autoAcceptTopMatch` (default **off**). Auto-accept claims the top-ranked candidate on the initial dispatch batch; the guest still pays before endorsement fires. Legacy `payment_methods` rows are kept but no longer read or edited. |
| Integrations    | `PropertyIntegrationsPanel` (`telegramLayout="parking"`) — Google status (flags), single **Parking** Telegram channel → notifications page, AI services (platform env)                                                                                                                                                                                       |
| Activity        | Read-only summary + **Manage** → modal with full parking-scoped feed (`ActivityLogPanel`) and an in-place sliding detail view (Back / Esc). Legacy `/activity` redirects to `…/settings?open=activity`. See [activity.md](./activity.md). No save path.                                                                                                      |
| Danger zone     | **`PATCH update-parking`** `{ status: ACTIVE \| INACTIVE }` archive/restore; **`DELETE delete-parking`** permanent delete                                                                                                                                                                                                                                    |

### Basic info fields

| Field                | Storage                                                                                                                                                                                                       | Public page                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Code                 | Derived display code from tower / level / slot (read-only)                                                                                                                                                    | —                                                 |
| URL Slug             | `parkings.slug` (read-only; fixed at creation, never regenerates). Beside Code on desktop (`sm` 50/50); copy button copies the absolute public parking URL (`/parkings/:slug`). Toast: **Public URL copied**. | `/parkings/:slug`                                 |
| Brand color          | `parkings.settings.brandColor` (empty = inherit org). Where it applies is a **?** tooltip on the label (`FieldLabel`). Admin and listing accents use that hex as `--primary`.                                 | Listing accents via **`ParkingPublicBrandShell`** |
| Parking type         | `parkings.parking_type` — **read-only** in settings (set at creation)                                                                                                                                         | Type badge on **`ParkingOverview`**               |
| Residence            | `parkings.residence_name` — **read-only** in settings (set at creation)                                                                                                                                       | Development link in **`ListingPlaceMeta`**        |
| Tower / Level / Slot | `parkings.tower`, `level`, `slot_label` — **read-only** in settings (set at creation)                                                                                                                         | **`ListingPlaceMeta`** placement labels           |
| Description          | `parkings.settings.description` (legacy `notes` migrated on save)                                                                                                                                             | **About this parking** section                    |

Parking type, residence, tower, level, and slot number can only be set when the slot is created (`useCreateParking`). They render read-only in Settings, same as property's type/residence/tower/unit — see [Property Settings § Basic Information](../property/settings.md#basic-information).

### Parking details fields

| Field                | Storage                                                         | Public page                                |
| -------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| Length (m)           | `parkings.settings.spaceLengthM` (default **5.0**)              | Stats grid on **`ParkingOverview`**        |
| Width (m)            | `parkings.settings.spaceWidthM` (default **2.5**)               | Same                                       |
| Height clearance     | `parkings.settings.heightClearanceM` (default **2.1**)          | Same                                       |
| Check-in / Check-out | `checkInTime`, `checkOutTime` (24h, defaults `14:00` / `12:00`) | **`ListingCheckInOutTimes`** (12h display) |

---

## Save paths

**Save Changes** saves only dirty sections that pass validation — the same section-scoped behavior as Property Settings. If required fields are still incomplete, **Save Changes** stays visible but is **disabled** (tooltip names the first issue); clicking while enabled with incomplete fields still scrolls to the first incomplete section and toasts the issue.

- Basic (brand color, description only — identity fields are read-only) → `PATCH update-parking`
- Photos → `POST` / `DELETE` **`upload-parking-media?parking_id=`** (auto-saved on upload/remove)
- Parking details → `PATCH update-parking` (`settings.spaceLengthM`, `settings.spaceWidthM`, `settings.heightClearanceM`, `settings.checkInTime`, `settings.checkOutTime`)
- Amenities → `PATCH update-parking` (`settings.enabledParkingAmenities`, `settings.customParkingAmenities`, `settings.features`)
- Location → `PATCH update-parking` (location fields in `parkings.settings`)
- Automations → `PATCH parking-settings?parking_id=` `{ automationToggles: { emailParkingReservationRequest, emailParkingGuestConfirmed, emailParkingNoHostAvailable, autoAcceptTopMatch } }`
- Integrations status → `GET parking-settings?parking_id=` (`parkingIntegrations`, `platformSecrets`); Telegram credentials saved from **Notifications** modules
- Archive / restore → `PATCH update-parking` `{ parkingId, status: 'INACTIVE' | 'ACTIVE' }` — hides/shows public listing (`list-public-parkings` / `get-public-parking` return **ACTIVE** only)
- Delete → `DELETE delete-parking`

Since parking type, residence, tower, level, and slot number can't change in Settings, the slug is fixed at creation and Settings never navigates to a new URL.

---

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, F5 / Cmd+Ctrl+R, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| Concern                    | Path                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Page                       | `ui/src/features/dashboard/parking/pages/ParkingSettingsPage.tsx`                                                       |
| Card                       | `ui/src/features/dashboard/parking/components/ParkingSettingsCard.tsx`                                                  |
| Dense settings CTAs        | `settings-action` / `settings-field-label` in `ui/src/index.css` (Danger Zone, Features Add, shared with org/property)  |
| Field label + help         | `ui/src/components/forms/FieldLabel.tsx`                                                                                |
| Details section            | `ui/src/features/dashboard/parking/components/ParkingDetailsSection.tsx`                                                |
| Features section           | `ui/src/features/dashboard/parking/components/ParkingFeaturesSection.tsx`                                               |
| Automations sections       | `ui/src/features/dashboard/parking/components/ParkingEmailAutomationSection.tsx`, `ParkingBookingAutomationSection.tsx` |
| Form draft                 | `ui/src/features/dashboard/parking/lib/parkingSettingsForm.ts`                                                          |
| Completion / validation    | `ui/src/features/dashboard/parking/lib/parkingSettingsCompletion.ts`                                                    |
| Field error resolver       | `ui/src/features/dashboard/parking/lib/parkingSettingsFieldError.ts`                                                    |
| Completion hooks           | `ui/src/features/dashboard/parking/hooks/useParkingSettingsCompletion.ts`                                               |
| Sidebar issues store       | `ui/src/features/dashboard/parking/lib/parkingSettingsIssuesStore.ts`                                                   |
| Sidebar issues sync        | `ui/src/features/dashboard/parking/components/ParkingSettingsIssuesSync.tsx`                                            |
| Shell (mounts issues sync) | `ui/src/features/dashboard/org/components/ParkingAdminShell.tsx`                                                        |
| Brand resolve (edge)       | `supabase/functions/_shared/parkingBranding.ts`                                                                         |
| Public API                 | `get-public-parking` → `loadPublicParkingBySlug`                                                                        |
| Public UI                  | `ParkingDetailPage`, `ParkingOverview`, `ParkingPublicBrandShell`                                                       |

## Setup Guide

The same sections can be completed inside the post-onboarding [Setup Guide](../setup-guide.md) overlay (identical storage and validation).
---

## Testing

| Layer | Path / spec                                                                                            | Manual        |
| ----- | ------------------------------------------------------------------------------------------------------ | ------------- |
| Unit  | `parkingStatusMachine_test.ts`, `parkingSettingsSavePlan.test.ts`, `parkingSettingsCompletion.test.ts` | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs                           | PayMongo live |
| N/A   | Parking host dashboard shell load                                                                      | —             |
