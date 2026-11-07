---
title: 'Property Settings — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-09-27
---

# Property Settings — operator guide

Route: `/org/:orgSlug/property/:propertySlug/settings`

> **Status:** Documented

## Progress overview

| Section            | E2E save  | Validation | Docs | Notes                                                                                                                                                       |
| ------------------ | --------- | ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic Information  | Done      | Done       | Done | Required fields marked with *; save blocked until complete                                                                                                  |
| Property Details   | Done      | Done       | Done | Azure North residence defaults + limits                                                                                                                     |
| Photos & Videos    | Done      | Done       | Done | Gallery via `upload-property-media` / listing editor                                                                                                        |
| Amenities          | Done      | Done       | Done | Name preview + `+N` + Manage modal (`PropertyAmenitiesManageDialog`, `PropertySettingsSummaryRow`)                                                          |
| House Rules        | Done      | Done       | Done | Name preview + `+N` + Manage modal (`PropertyHouseRulesManageDialog`, `PropertySettingsSummaryRow`)                                                         |
| Cancellation       | Done      | Done       | Done | Guest preview on card + Manage modal (full policy form)                                                                                                     |
| Guest Form         | Done      | Done       | Done | Pets + decor cards, then a nested Parking card (Allow Parking, free own-slot parking, preferred parking; own-slot controls disabled without an active slot) |
| Location           | Done      | Done       | Done | Compact address + Manage modal (picker + Save / discard)                                                                                                    |
| Socials            | Done      | Done       | Done | Facebook / Airbnb / Instagram / TikTok (org inherit)                                                                                                        |
| Reviews & vouchers | Done      | Done       | Done | External reviews + next-stay voucher config                                                                                                                 |
| Payment            | Done      | Done       | Done | Compact method rows + Manage modal (account/QR editor)                                                                                                      |
| Building Forms     | Done      | Done       | Done | Compact summary + Manage modal (form + live PDF preview)                                                                                                    |
| Email automations  | Done      | Done       | Done | Team email + read-only building admin email; check-out timing; Automated sends as a summary row + Manage modal                                              |
| Integrations       | Done      | Done       | Done | Telegram + AI optional; GAF/pet via Resend inbound                                                                                                          |
| AI features        | Moved     | n/a        | Done | Removed from property settings; configured in org Settings → AI features                                                                                    |
| Activity           | Read-only | n/a        | Done | Summary row + **Manage** → modal with full property activity feed (`ActivityLogPanel`). Section shown only with `activity:view`                             |
| Danger Zone        | Done      | Done       | Done | Archive + delete with confirmations                                                                                                                         |

> **Also editable in Page Editor:** Photos & Videos, Brand color, Description, Amenities, House Rules, and Cancellation — same fields, same storage. **External reviews and vouchers** are Settings-only (**Reviews & vouchers**). **Socials** are Settings-only.

---

## Overview

Living operator spec for property settings: what each section does, how data is saved, and setup completeness. **Save Changes** persists only dirty sections that pass validation — incomplete required areas still show a red dot for setup tracking. Field helpers use a **?** beside the label (`FieldLabel` `help` / `SettingsField` `help`) — not muted text under the control.

Many section values can also be **seeded from another property** via org **Properties → Copy settings** (4-step wizard). Payment methods are not included.

### Permissions (Phase 5)

Route/nav: `settings:view`. Each section has its own edit leaf (`settings.basicInfo:edit`, `settings.media:edit`, …). Shared listing fields (media, amenities, house rules, cancellation) use the same `settings.*` ids from Public Pages (Q2). Socials are Settings-only. Integrations is `settings.integrations:view` only. Archive/restore: `settings.dangerZone:edit`. Permanent delete stays owner-only (D10). Payment OTP still required **in addition to** `settings.payment:edit`. Profile/content saves go through `update-property` with the matching section leaf (no longer owner-only).

---

## Host-facing knowledge

Property Settings is where you complete operational setup: basic info, capacity, location, payment details, building forms, email automations, and integrations. Listing content (photos, description, amenities, house rules, cancellation, brand color) can be edited here **or** under **Public Pages → Edit** on the Property card - both screens save to the same place. Social URLs are edited here only (**Socials**). You can save section by section, and incomplete required areas show a red dot until they're done.

**Common host questions**

- Q: Do I have to fill out every section before anything saves?
  A: No. **Save Changes** only saves the sections you've edited that pass validation, so you can finish contact details today and payment later. Incomplete required areas still show a warning dot until you get to them.
- Q: What's the difference between Archive and Delete?
  A: Archive hides the property from active use but keeps all bookings and history. Delete permanently removes an empty property, and it's blocked if any bookings exist, so use Archive instead for units with past stays.
- Q: Why can't I restore my archived property?
  A: Restore only appears when the listing is verified and the listing contract is current. A new listing has to be approved first, and an ended contract has to be renewed. The card under **Danger Zone** tells you which one applies.
- Q: Can guests still book a property I archived?
  A: No. The public page and its direct booking link stop taking new bookings. Guests who already have a booking keep their form, trip page, and stay guide.
- Q: Where do guests see my cancellation policy and house rules?
  A: House rules and cancellation policy appear on your public property listing. The booking form also shows the policy with the exact deadline dates for the stay and asks the guest to agree to it. After booking, the trip page shows the policy that applied when they booked, plus their refund if they cancel. Automated email wording is edited separately on the Templates page.
- Q: If I change my cancellation policy, do existing bookings change too?
  A: No. The policy is copied onto each booking when the guest books, so a change only applies to new bookings. Existing guests keep the terms they agreed to. There is no save prompt about upcoming bookings.
- Q: Where do I configure which documents guests must submit (GAF, pet approval, etc.)?
  A: Document requirements are set at the **development** level by the platform team (Super Admin → Developments → Document Requirements). All properties in that development inherit the same list.
- Q: Where is the PMO / documents-approver email set?
  A: On the development in Super Admin (**Developments → Email automations → PMO email**). Property Settings shows it read-only as **Building admin email** so you can see where GAF and pet requests go. The team ops email there handles alerts and Reply-To.
- Q: Where do I turn automated emails on or off?
  A: **Property Settings → Email automations → Automated sends → Manage**. The modal lists every automatic email, who receives it, and when it sends. Switch the ones you want. Your changes save with the page **Save Changes** at the top of Settings.
- Q: Where do I edit amenities, house rules, or cancellation?
  A: In **Property Settings** - Amenities, House Rules, and Cancellation use **Manage** for the full editor - or in **Public Pages → Property → Edit** if you want a live preview. Both save the same data. The Amenities and House Rules cards show your first few picks with a **+N** badge for the rest, so you can see what is on without opening the editor.
- Q: Where do I fill Building Forms (GAF owner and signature)?
  A: **Property Settings → Building Forms → Manage**. Enter owner and contact details, add the signature, and check the live PDF preview. Save in the modal, then use page **Save Changes** for the text fields.
- Q: Where do I upload listing photos?
  A: **Property Settings → Photos & Videos**, or the listing Page Editor gallery. Photos are shared across the listing, property cards, and Marketing.
- Q: Where is listing verification?
  A: Open **Verification** from the property sidebar, or upload listing docs in org **Get Verified → Listings**. Listing go-live needs your Property Rights (and contract end when you are an Authorized Representative or Sublessee) plus proof of ownership or authorization on listing **Verified**. Additional proof and the Azure Property Management email confirmation are for listing **Recommended**. Submitting listing **Recommended** waits until listing Verified is approved and needs a paid plan that includes the Recommended badge.
- Q: My contract is ending - what should I do?
  A: A renewal reminder may appear when you log in. Tap **Submit renewal contract** or use **Verification** in the sidebar to upload an updated contract before the grace period ends.
- Q: What does the Cleaning Time setting do?
  A: It's the shortest gap your cleaner needs between one guest checking out and the next guest checking in **on the same day**. Set it under **Property Details → Cleaning Time** - it's required and always at least 1 hour. Guests can't pick a check-in or check-out time on the booking form that leaves less than that gap.
- Q: Why is **Free parking on your own slots** grayed out?
  A: It needs **Allow Parking** on and at least one active slot in **Parking**. The line under the switch tells you which one is missing, and the **Parking** link takes you to your slot list.
- Q: How do next-stay vouchers work?
  A: Under **Reviews & vouchers**, open **Manage** on Next-stay vouchers. They are off by default, so turn them on first. Pick a **reveal style** (Reel, Wheel, or Flip), choose which discounts to include (5% through free stay), and set a **Weight** for each - higher weight = more often. **Odds** update automatically; you do not need the weights to add to 100. Use the nightly rate select (weekday / weekend / custom) to see about how much each prize saves. Guests can claim one discount after checkout. Apply the code manually on their next booking - automatic redemption is not built yet.
- Q: Why is **Enable next-stay vouchers** off on a new property?
  A: Vouchers are opt-in. New properties start with the switch off so guests are never promised a discount you did not configure. Turn it on and pick your prizes when you are ready.
- Q: Do external reviews appear right after I add them?
  A: Not yet. Every Airbnb or Facebook review you submit needs a proof screenshot and admin approval. Our team checks submissions manually, so it can take some time. Only approved reviews show on your public listing, and editing a review sends it back for review.
- Q: Can I copy settings from another property onto this one?
  A: Yes. On the org **Properties** page, use **Copy settings**. Pick the source property and which groups to copy. Payment methods are not copied.
- Q: What happens if I rename the property?
  A: The URL slug updates from the new name. The app moves you to the new settings URL and, for this browser session, Back from older pages opens the same screen under the new slug instead of an access error.
- Q: What do Image / Video monthly credits do?
  A: They cap how many AI Generate credits this property can spend on images or video this month. Leave blank to use 60% of the org allowance. Premium quality is not set here.

---

## Setup completeness

**Save Changes** saves **only dirty sections that pass validation** — you do not need every section complete first. Within a section, only **changed fields** are validated for that save (e.g. contact information can save even when other basic fields are still incomplete). Valid filled sections persist; invalid dirty sections are skipped and highlighted. **Exception — Payment:** if payment methods are edited, Save is disabled until the whole Payment section’s required fields are valid (it does not partially save other sections alongside an incomplete payment draft). If **no** dirty section is savable, the button stays visible but **disabled**. If some sections save and others do not, you get a toast: _New changes has been saved._

Incomplete sections still show a **red dot** on the in-page section nav (**desktop `lg+` sidebar only** — the mobile horizontal chip strip is hidden) and on the sidebar **Settings** link (for setup tracking). On phone/tablet, Settings uses the same **brand hero** shell as other admin pages (`AdminMobilePage`); Save appears as a hero icon when there are unsaved changes. On desktop, **Save Changes** appears in the page header actions when the form is dirty (no separate sticky footer bar).

| Rule                                                           | Required? |
| -------------------------------------------------------------- | --------- |
| Basic info (name, type, tower/unit for condos, contact fields) | Yes       |
| Property details (capacity, check-in/out)                      | Yes       |
| Location (address + map pin)                                   | Yes       |
| Payment (provider, account name, account number)               | Yes       |
| Payment QR (per method)                                        | No        |
| Building forms (GAF fields + signature)                        | Yes       |
| Email automations (Team email, timing, toggles)                | Yes       |
| Telegram integrations                                          | No        |

Field-level errors appear **as you edit** a field (on change). After **Save Changes**, all remaining issues are shown at once. Section banners (orange) appear for **Integrations** when needed — not for sections with individual inputs.

Logic: `ui/src/features/dashboard/org/lib/propertySettingsCompletion.ts`, `ui/src/features/dashboard/org/lib/propertySettingsFieldError.ts`, `ui/src/features/dashboard/org/lib/propertySettingsSave.ts`

---

## Active vs Archive

Both use the same column: `properties.status` (`ACTIVE` | `INACTIVE`).

| Control                   | What it does                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Archive** (Danger Zone) | Sets `status = INACTIVE` immediately via `update-property`.                                                               |
| **Restore** (Danger Zone) | Sets `status = ACTIVE` when the property is archived, but only if the listing is verified and the contract is not locked. |

**Inactive** properties keep all bookings, settings, integrations, and media. Nothing is deleted.
New bookings through the public `?property=` link are refused while the property is not `ACTIVE`.

---

## Basic Information

### Fields

| Field         | Storage                            | Validation                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Property name | `properties.name`                  | 2–120 chars; **globally unique** (case-insensitive); **reserved names blocked** (see [onboarding.md](../../onboarding.md) § Reserved organization / property names); availability checked after typing pauses                                                                                                                                                                                                                                        |
| URL slug      | `properties.slug`                  | Auto-derived from name on save; globally unique. Read-only beside the name on desktop (`sm` 50/50 row); copy button copies the absolute public property URL (`/properties/:slug`). Toast: **Public URL copied**. On rename, the settings URL is updated with `replace: true`, and a **session** old→new remap (`tenantSlugRemap.ts`) rewrites any Back/Forward hit on the old `/property/:slug/…` path to the new slug (avoids "No property access") |
| Property type | `properties.type`                  | **Read-only** in settings (set at property creation). Condo enables residence / tower / unit display                                                                                                                                                                                                                                                                                                                                                 |
| Residence     | `properties.residence_name`        | **Read-only** in settings. Known residences apply defaults at creation (see below)                                                                                                                                                                                                                                                                                                                                                                   |
| Tower         | `properties.tower`                 | **Read-only** in settings. Options from residence config (Azure North: Monaco, Bali, Barbados)                                                                                                                                                                                                                                                                                                                                                       |
| Unit          | `properties.unit_number`           | **Read-only** in settings. 4-digit. Unique per tower among **`ACTIVE`** properties only ([#120](https://github.com/sprmke/kame-space/issues/120)); many `INACTIVE` peers allowed (succession). Republish / stay ACTIVE with an ACTIVE peer → **409**.                                                                                                                                                                                                |
| Contact name  | `properties.settings.contactName`  | Required; full name when non-empty; inline error on blur                                                                                                                                                                                                                                                                                                                                                                                             |
| Contact role  | `properties.settings.contactRole`  | Required                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Phone         | `properties.settings.contactPhone` | Required; PH mobile `09XXXXXXXXX`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Email         | `properties.settings.contactEmail` | Required; valid email                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Brand color   | `app_settings.brand_color`         | Optional override; empty = inherit org. Preset swatches, **From photos** (enabled after gallery images are uploaded — extracts accent from property photos), custom picker, Reset. Changing it marks Settings dirty and shows **Save Changes** (saved with operational basic section via `PATCH app-settings`)                                                                                                                                       |

### Save path

1. UI draft → **Save Changes** → `update-property` (PATCH) for profile fields; brand color → `PATCH app-settings?property_id=`
2. DB columns + merged `properties.settings` JSONB; brand color on `app_settings`

### Residence defaults (Azure North Residences)

When residence is **Azure North Residences**, the app applies:

| Field         | Default                | Allowed range              |
| ------------- | ---------------------- | -------------------------- |
| Tower options | Monaco, Bali, Barbados | From residence catalog     |
| Bedrooms      | 1                      | 1–2                        |
| Bathrooms     | 1                      | 1                          |
| Floor         | 1                      | 1–29                       |
| Max adults    | 4 (Studio unit type)   | From development unit type |
| Max children  | 1 (Studio unit type)   | From development unit type |
| Unit type     | `studio`               | Dropdown from development  |
| Check-in      | 2:00 PM (`14:00`)      | —                          |
| Check-out     | 12:00 PM (`12:00`)     | —                          |

Defaults apply when creating a new property with that residence (not when editing an existing property — location fields are read-only after creation). New Azure North properties default to **Studio** unit type.

---

## Property Details

Stored in `properties.settings` (+ `properties.max_guests` derived from adults + children).

| Field         | Key            | Default                | Guest-facing use                                      |
| ------------- | -------------- | ---------------------- | ----------------------------------------------------- |
| Unit type     | `unitTypeId`   | `studio` (Azure North) | Sets bedrooms, bathrooms, max adults/children         |
| Bedrooms      | `bedrooms`     | from unit type         | Read-only; from development unit type config          |
| Bathrooms     | `bathrooms`    | from unit type         | Read-only; from development unit type config          |
| Floor         | `floors`       | residence limits       | Listing detail                                        |
| Check-in      | `checkInTime`  | `14:00`                | Guest form default + early-arrival warning threshold  |
| Check-out     | `checkOutTime` | `12:00`                | Guest form default + late-departure warning threshold |
| Max adults    | `maxAdults`    | from unit type         | Read-only; guest form occupancy limit                 |
| Max children  | `maxChildren`  | from unit type         | Read-only; guest form occupancy limit                 |
| Self check-in | `selfCheckIn`  | `false`                | Public listing + stay guide                           |

**Layout:** row 1 — Unit type, Bedrooms, Bathrooms; row 2 — Floor, Max adults, Max children; then check-in / check-out times, **Cleaning Time**, and self check-in.

**Unit type** options come from the property's development/residence via **`GET get-residence-unit-types`**. Changing unit type updates `bedrooms`, `bathrooms`, `maxAdults`, `maxChildren`, and `max_guests` (computed sum) on save. Super admin configures per-type bedrooms/bathrooms/max guests under **Development → Unit types**.

Check-in/out times are picked via the shared **`TimePicker`** (`ui/src/components/ui/time-picker.tsx`, 30-min increments — same component used on the guest form), saved as 24-hour **`HH:mm`** strings. They appear on the public property page, house-rule presets, and — after save — pre-fill the guest booking form Stay step via **`get-guest-payment-info`** → `useGuestPaymentInfo()`.

Validated on save against residence limits (see Azure North table above). **Cleaning Time** lives here, beside check-in and check-out time.

**Cleaning Time** — `cleaningBufferMinutes`, a **required** `Select` (1h–6h in 30-minute steps; no "off" option), stored as whole minutes (`60`–`360`, step `30`). Default (and floor) is **1 hour** — a missing/invalid saved value resolves to 60, never `null`. Only applies to a **same-day turnover**: one guest's `checkOutDate` equal to another guest's `checkInDate` on the same property. The guest booking form disables check-in times earlier than `(previous checkout time + buffer)` and check-out times later than `(next check-in time − buffer)` in the `TimePicker`, and `submit-form` re-validates the same rule server-side (`_shared/cleaningBuffer.ts`, `_shared/guestFormSettings.ts`) before saving. Does not affect non-adjacent bookings or dates with no turnover. Validated in `_shared/propertySettingsValidation.ts` (must be a valid 30-minute step between 60 and 360 — `null`/off is rejected).

Save path: dirty `details` section → `update-property` settings merge (`propertyProfileSettingsPatch`).

---

## Photos & Videos

Listing gallery photos/videos. Storage: `properties.settings.media` via `upload-property-media` / `update-property`. Same fields are editable in **Public Pages → Property → Edit** (live preview). Brand color is under **Basic Information** (`app_settings.brand_color`) and also in the listing editor.

Each picked photo is **downscaled + re-encoded to WebP in the browser** (long edge 3840px, quality-first — no visible loss even full-screen on 4K) before upload via `prepareUpload` / `PHOTO_MASTER` preset; the stored file is typically 50–80% smaller. Ceilings: **image 10 MB, video 50 MB** (client rejects over-ceiling with `File must be N MB or smaller`; videos are not transcoded — trim/compress a longer clip first). **SVG is rejected** (public bucket XSS). Architecture: [`storage.md`](../../../architecture/storage.md) §7.1.

## Description

Stored in `properties.settings.description` (max 1000 chars). Also editable in the listing Page Editor.

---

## Amenities

Compact card on Property Settings: names the first amenities plus **Manage** in the summary row (replaces the old header/chevron). Opens a large `ResponsiveModal` (`PropertyAmenitiesManageDialog`) with collapsible amenity categories (3-column grid on large screens): Essentials, Kitchen & Dining, Entertainment, Workspace, Facilities, Outdoor, Safety & Security, Family & Accessibility — catalog in `propertySettingsConstants.ts` includes PH-condo-relevant presets (rice cooker, water dispenser, function room/clubhouse, visitor parking, keycard access, etc.). Preset + custom amenities still store in `properties.settings.enabledAmenities` / `customAmenities`. Changes update the page draft live; persist with the page **Save**. Also editable in the listing Page Editor.

**Summary row** (`PropertySettingsSummaryRow`): real amenity names from `resolveAmenityLabels`, then a `+N` pill, then **Manage**. `summarizeSettingsLabels` (`propertySettingsSummaryLabels.ts`) collapses on whichever limit is reached first — **3 items** or a **48-character** budget — so a long name like "Carbon Monoxide Alarm" shows one item plus `+N` instead of overflowing. Empty selection reads "No amenities selected". Custom names are included in the same order the host saved them.

---

## House Rules

Compact card on Property Settings: names the first rules plus **Manage** in the summary row. Opens a large `ResponsiveModal` (`PropertyHouseRulesManageDialog`) with collapsible rule categories (3-column grid on large screens): Check-in & timing, Restrictions, Guests & pets, Property — catalog in `propertyHouseRulesConstants.ts` includes condo-building presets (comply with condo/building rules, valid ID at lobby, no unregistered guests, etc.). Preset + custom house rules (`enabledHouseRules` / `customHouseRules`). Mutually exclusive presets still apply on toggle. Changes update the page draft live; persist with the page **Save**. Also editable in the listing Page Editor. Preset catalog still mirrors `propertyHouseRulesConstants.ts`; check-in/out presets use property detail times on the public listing. Templates → **House Rules** remains email copy only.

**Summary row:** uses `resolveHouseRulesForDisplay` so check-in/out rules read with the property's own times ("Check-in: After 14:00 · Checkout: Before 12:00"), then the same `+N` pill and **Manage**. Same 3-item / 48-character collapse as Amenities. Empty selection reads "No house rules selected".

---

## Guest Form

Per-property toggles for which sections appear on the public booking form (`/form?property=<slug>`). Stored in **`properties.settings`** (profile save — not `app_settings`).

| Toggle                    | Key                         | Default                                                                  | Effect when off                                                                                                                                                                                                                                                   |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Allow Pets                | `allowPets`                 | `true`                                                                   | Pets step hidden; `has_pets` forced `false` on submit (server + client clamp)                                                                                                                                                                                     |
| Allow Parking             | `allowParking`              | `true`                                                                   | Parking step hidden; `need_parking` forced `false` on submit                                                                                                                                                                                                      |
| Allow Surprise Decor      | `allowSurpriseDecor`        | `true`                                                                   | Decor checkbox hidden on Stay step; `guest_requests_surprise_decor` forced false                                                                                                                                                                                  |
| Complimentary own parking | `complimentaryOwnerParking` | `false`                                                                  | Same-org own-slot linked pins still require PayMongo. Also inert while Allow Parking is off (server checks both keys). Stays visible but disabled until Allow Parking is on and an ACTIVE org parking exists; helper text under the switch says which is missing. |
| Preferred parking         | `preferredOwnerParkingId`   | set on `create-parking` to earliest ACTIVE (`created_at`); else _(none)_ | Ranking falls back to residence match + earliest `created_at`                                                                                                                                                                                                     |

**Preferred parking** — org listing UUID. When still available for the stay window, `resolve-owner-default-parking` / `get-pay-parking` rank it first. Select of ACTIVE org parkings in Guest Form (`useParkings`). **Default on add:** after `create-parking`, org properties with empty or invalid preferred are set to the earliest ACTIVE listing (`created_at` ASC; `_shared/preferredOwnerParkingDefaults.ts`). Hosts may still choose **None** or another listing; a preferred that points at a removed/inactive listing is healed to the first ACTIVE listing in the settings draft.

**Complimentary own parking** — when on, a same-org pinned submit with `linkedPropertyBookingId` auto-claims (skips awaiting-payment email) then `fulfillComplimentaryOwnerParking` (₱0 ledger, `provider: complimentary`) → `PENDING_REVIEW` + endorsement + property parking gate, without PayMongo. The server requires **both** `allowParking` and `complimentaryOwnerParking`, so a stale saved `true` does nothing while parking is off. The toggle stays visible but disabled until Allow Parking is on and the org has at least one ACTIVE parking slot: helper text under it says to turn on Allow Parking, or links to **Parking** to add a slot. Preferred parking stays hidden until both conditions are met.

The Guest Form sheet groups **Allow Pets** and **Allow Surprise Decor** as standalone rows, then a nested **Parking** card with **Allow Parking**, **Free parking on your own slots**, and **Preferred parking** so the related controls read as one block.

Section nav: **Guest Form** (after House Rules). UI: `PropertyGuestFormSettingsSection.tsx`.

Save path: **Save Changes** → dirty `guest-form` section → `update-property` settings merge (`propertyProfileSettingsPatch`).

Public exposure: resolved via **`get-guest-payment-info`** (same request as payment/GAF defaults) → `useGuestPaymentInfo()` on the guest form. Missing/invalid keys default to **`true`** (preserves legacy always-on behavior).

**Check-in / check-out times** (configured under **Property Details**, not this section): also resolved via **`get-guest-payment-info`** as **`checkInTime`** / **`checkOutTime`** (24h `HH:mm`; defaults **`14:00`** / **`12:00`**). New guest submissions pre-fill those fields; early/late warnings on the Stay step compare against the property values. Existing **`?bookingId=`** edits keep stored submission times from **`get-form`**.

**Guest capacity** (`maxAdults`, `maxChildren`) is also exposed on **`get-guest-payment-info`**. The Stay step guest list uses these for the maximum-guests reminder and server-side validation on **`submit-form`** (occupancy rule: ages 4+ = adult, ages 0–3 = child for capacity checks).

**Booking source** (separate from these toggles): guest form uses **`?source=facebook`** / **`?source=airbnb`** for platform-specific name labels; omitting `source` stores **`Direct`** (`booking_source` column default **`Direct`** after migration `20261003140000_booking_source_default_direct.sql`).

---

## Cancellation policy

Compact card on Property Settings with the guest preview and **Manage**. The Manage sheet has preset cards (Flexible, Moderate, Standard, Limited, Firm, Non-refundable, Custom) and an example with a sample check-in, a sample payment breakdown (down payment, pet fee, parking fee, additional fee) and the refund at each deadline ("Cancel by Nov 6 → ₱2,000 back"). **Custom** adds a tier builder (up to 5 rows, days 0–365, refund 0–100, sorted, validated); after the last row there is no refund.

**Percentages apply to what the guest has actually paid** (down payment + settled balance), not the full stay value. This matches the app's payment model: guests pay a down payment at booking and the balance at check-in, so a 50% policy returns 50% of the down payment instead of wiping it out. Every paid amount follows the same policy. The security deposit is collected at check-in, so it is not part of the pre-check-in example. A host cancellation after check-in still returns it. Once the balance is paid, guest cancellations always go through host approval.

Stored in `properties.settings.cancellationPolicy` (v2 shape) with the current version id at `properties.settings.cancellationPolicyVersionId`. Every change appends a row to `property_cancellation_policy_versions` and logs `property.cancellation_policy_updated`. Existing bookings keep their snapshot; there is no save prompt about upcoming bookings.

Legacy v1 shapes are mapped on read (no data migration): `grace_period` → Flexible, `full_before_checkin(N)` → 100% at N days, `moderate(h,N)` → 100% at N days, `partial_before_checkin(N,p)` → p% at N days, `non_refundable` → Non-refundable, free text → custom with `needsReview` and request mode. A property with no saved policy resolves to **unset** (listing says "Ask the host about cancellation") instead of a silent default.

Page Editor (`embedded`) shows the same controls inline. Closing the Manage sheet with unsaved edits prompts Save / Discard / Keep editing.

## Location

Compact summary on Property Settings: address line (or “No address set”) + icon actions (**Open in Google Maps** / **Copy link**, when pinned) + **Manage**. Opens a `ResponsiveModal` with address search and map pin only (no footer Pinned row). Autocomplete requests `name` and stores **`formatPlaceDisplayAddress`** (`Name, formatted_address`) so development names are kept (not Plus Code / city-only). Session edits stay local until **Save**, which **persists immediately** via `update-property` (location section only — draft + baseline updated; no separate page Save required). Closing without **Save** while dirty prompts **Discard unsaved changes?**. UI: `PropertyLocationSettingsBlock.tsx` + `PropertyLocationPicker.tsx`.

| Field                        | Storage                 |
| ---------------------------- | ----------------------- |
| Address                      | `properties.address`    |
| City, province, country, zip | `properties.settings.*` |
| Lat/lng, place ID, Maps URL  | `properties.settings.*` |

### Multi-tenant / Google Maps

- One **platform** Google Maps API key (`VITE_GOOGLE_MAPS_API_KEY`) is used for all orgs and properties.
- Each property stores its **own** coordinates and address; data is isolated by `property_id` / org ownership.
- Restrict the API key by HTTP referrer in Google Cloud Console for production.

---

## Socials

Social URL fields in `app_settings` (empty = inherit org). Edit in **Property Settings → Socials** only.

| Field         | Column                 | Notes                 |
| ------------- | ---------------------- | --------------------- |
| Facebook page | `facebook_reviews_url` | Optional; inherit org |
| Airbnb        | `airbnb_url`           | Optional; inherit org |
| Instagram     | `instagram_url`        | Optional; inherit org |
| TikTok        | `tiktok_url`           | Optional; inherit org |

**Validation:** at least one effective social URL (property or org).

**Mobile density:** Social rows use `settings-field-label` + `h-8` inputs; **Customize** / **Use org** stay on one row with the field (`settings-action` = visual `h-8`, hit pad ≥44 — never `min-h-[44px]` on the chrome). Same token as other Settings **Manage** actions.

---

## Reviews & vouchers

External reviews and next-stay voucher configuration. Section id `guest-rewards`. RBAC: `settings.socials:edit`.

Summary rows match Amenities / Cancellation: muted compact card (`bg-muted/40`), one-line status, outline **Manage** (modals unchanged).

### External reviews

Hosts can seed up to **5** Airbnb/Facebook reviews (**Reviewer**, **Review**, and **Proof screenshot** required). Empty Manage state: short line — “Add Airbnb or Facebook reviews to show on your public listing.” — above **Add review**. An info callout at the top of Manage explains the purpose (show reviews from other platforms while Kame Space reviews grow), the 5-review limit, the proof screenshot requirement, and that admin approval can take some time. Field hints: Source = where the review was posted; Reviewer = name shown publicly; Review = paste the review text; Review Images = up to 3 stay photos shown with the review; Proof screenshot = private admin proof only. Star rating uses shared `GuestReviewStarRating` (no **What stood out?** feedback pills — those are Kame guest reviews only). Optional **Review Images** (up to 3 stay photos) show on the public property page. Per-review **Save** stays disabled until required fields are valid; field errors show inline in Manage (no card-level or toast validation). Leaving a dirty review (**Add**, switch sidebar item, or close Manage) prompts **Discard unsaved changes?** (“Make sure you fill up all required fields and save your changes.”) — Discard reverts to the last saved version (or drops an unsaved new draft). Saves force `moderationStatus = pending`; only **approved** rows appear on the listing via `get-public-property`. Super-admins moderate on **`/admin/approvals`** (Type = Reviews). Summary line: `{n} of 5 external reviews · {aggregate}`.

### Next-stay vouchers

| Field  | Column                 | Notes                                                                                           |
| ------ | ---------------------- | ----------------------------------------------------------------------------------------------- |
| Enable | `vouchers_enabled`     | Default `false` (opt-in). When off, SD form / guest-review skip the voucher step                |
| Prizes | `voucher_prizes`       | JSONB `[{ code, percentOff, chancePercent }]`. Empty / legacy amount-weight = platform defaults |
| Style  | `voucher_reveal_style` | `reel` (default), `wheel`, or `flip` — guest award animation on SD form / guest-review          |

`chancePercent` is a **relative weight** (roll = weight ÷ sum of weights). Hosts do **not** need weights to sum to 100 — the Manage UI shows computed **Odds** and a distribution bar.

Platform defaults (all presets on): 5%→25, 10%→34, 15%→20, 20%→12, 25%→5, 50%→3, 100% / free stay→1.

Host UI: compact summary (`Next-stay vouchers · {prize summary|Off}` · optional style label when not Reel) + **Manage** modal — an info callout that explains how vouchers work (claim one discount after checkout, host picks prizes/odds/reveal style, codes are applied manually, turning it off skips new stays while claimed codes keep working), enable toggle, and, when off, a one-line note to turn vouchers on to choose prizes. When on: **Style** picker with **animated preview thumbnails** (**Reel** / **Wheel** / **Flip**), full preset catalog (checkbox per discount), **Weight** steppers + live **Odds**, rate select, **Reset defaults**. Previews loop subtly in the modal (static when OS reduce motion is on). Save with page **Save Changes** (header actions when dirty) → `app-settings` PATCH (`vouchersEnabled`, `voucherPrizes`, `voucherRevealStyle`). Style-only edits in this section count as savable changes (not “No changes to save”). Guest `/sd-form` and guest-review animate with the chosen style (reel / wheel / flip). Claim rolls via `claim-sd-voucher`; awarded `next_stay_voucher_amount` stores the **percent** (1–100). Legacy peso `KAME-*` awards still display as ₱.

**Superhost** is not configured per property — hosts earn it automatically org-wide (see [`docs/workflow/planned/superhost-program.md`](../../../../workflow/for-testing/superhost-program.md); progress lives under **Org settings → Trust**).

---

## Payment

Compact card on Property Settings: collapsed rows show each method’s **provider** (+ **Primary** badge) only — no account name, number, or QR. **Manage** sits beside the method list (not in the card header). Opens a `ResponsiveModal` with the full editor (provider, account fields, QR upload, add/remove, set primary). Per-property operational settings in `app_settings` (not `properties.settings`).

**Manage modal (same pattern as External reviews):** opening snapshots payment methods. Footer **Save** is **disabled** until the session is dirty and every method passes required validation (provider, account name, account number; QR optional). **Save** keeps the draft and closes. Closing via **X** / overlay without **Save** while the session is dirty prompts **Discard unsaved changes?** (“Make sure you fill up all required fields and save your changes.”) — **Discard** restores the open-session snapshot (including staged QR URLs on the draft). Unchanged sessions close without a prompt.

| Field           | Column                                                                     | Security notes                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bank / e-wallet | `payment_provider`                                                         | Allow-list only (PH providers)                                                                                                                                                                        |
| Account name    | `gcash_name`                                                               | Full name (first + last, min 2 chars each); max 120                                                                                                                                                   |
| Account number  | `gcash_number`                                                             | Format validated per provider type                                                                                                                                                                    |
| QR image        | `payment_methods[].qrImageUrl` (+ legacy `gcash_qr_image_url` for primary) | **Optional** per method. Stage via `upload-app-settings-asset`; commits on OTP-gated PATCH. Guest form / ready-for-check-in email show QR only when a real upload exists (no platform seed fallback). |

### Save path

**Save Changes** → `app-settings` PATCH (admin JWT + `property_id` scope).

When payment methods change since last save (account fields **or** any method QR), **Save Changes** opens a verification modal (no header close control — use **Discard changes**). OTP is **not** sent automatically: the host taps **Send OTP** first; only then does the 6-digit input and **Verify and save** appear. A code is emailed to the **org owner only** (branded property email shell; subject **`Payment verification code — {listing}`**; OTP digits use the listing brand color darkened as needed for readable contrast on white). Copy differs by actor: owner → “You, **Name** (Owner), are saving **Payment settings**…” with a self-review caution; team member → “Your team member, **Name** (Role), is saving…” with “contact that person before approving.” Any team member with `settings.payment:edit` can enter the code once the owner shares it. The server rejects payment PATCHes without a valid `settingsVerificationToken`. After a successful save, org + property team members receive a deduplicated notice email (listing name, actor name + role, timestamp Asia/Manila). Short liability copy remains in the modal footer.

**Account name** uses the same full-name rules as property contact name (first + last, min 2 characters each). **QR code** is optional on every payment method (each method has its own uploader). When **Payment** is dirty, **Save Changes** stays visible but is **disabled** until required payment fields are valid (provider, account name, account number) — QR absence does not block save. Guest payment step and `{{gcash_payment_section}}` (ready-for-check-in) render account details always and QR images only when uploaded.

Choosing a new QR image **stages** the file in Storage and updates the payment draft only — it does **not** write `app_settings` until OTP succeeds and Save completes. Closing the OTP modal without verifying (or a failed verified save) **reverts** the entire Payment section (methods, fields, and QR preview) to the last saved values. Discarding the Manage session likewise restores the draft to the snapshot from when Manage opened.

Payment details are shown on the guest form and ready-for-check-in email for **this property only**.

---

## Building Forms

Shared GAF + pet PDF owner fields in `app_settings`:

- Unit owner, on-site contact, owner phone, unit owner / SPA signature
- **Tower & unit** — read-only; auto-filled from **Basic Information** (`properties.tower` + `properties.unit_number`)

**Settings card** — compact summary (owner · tower/unit, contact/phone, signature status) with **Manage**. Opens a wide `ResponsiveModal` (bottom sheet below `lg`) with the form + live GAF/pet PDF preview. Modal **Save** closes the session when text fields changed and validate; discard restores text fields to the snapshot from when Manage opened. Setup Guide keeps the editor inline (`embedded`).

**Signature** — one signature slot shared across tabs (upload appears on the Sign canvas; a saved draw appears on Upload). **Sign** tab: canvas draw; **Save signature** shows only while there are unsaved strokes and hides after save. **Upload** tab: PNG/JPEG file with **Replace signature** when one exists. Live GAF/pet PDF preview updates while drawing and after save. **Clear** wipes the pad for a redraw; each save replaces storage and persists a versioned public URL (`?v=…`) on `gaf_unit_owner_signature_url`. Signature upload saves immediately (like payment QR) and does not reset other unsaved building-form text fields. Discarding the Manage session restores text fields only — a signature uploaded during the session stays.

---

## Email automations

Per-property operational settings in `app_settings` (below Building Forms in the UI).

### Recipients

| Field                | Column           | Notes                                                                                             |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| Team email           | `email_reply_to` | Required. New booking alerts and the Reply-To on guest emails. One label on every residence.      |
| Building admin email | `email_to`       | Read-only. Resolved development PMO email for GAF and pet requests. Empty means they cannot send. |

**GAF / pet request `To:`** is **not** edited here. It comes from the property’s development **PMO email** (`developments.settings.pmoEmail` via super-admin `/admin/developments/:slug`), then legacy `app_settings.email_to`, then the Azure North default. The **Building admin email** row shows that resolved address read-only. An empty value is allowed and never blocks Save.

**Azure North Residences** keeps the residence PMO fallback (`propertyEmailAutomationDefaults.ts`): **`stlmonaco.theresortresidences@azurenorth.com.ph`**. Only the field label is unified; the fallback default still applies.

### Check-out email

| Field                      | Column                                 | Notes                                                                                        |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| Send check-out email       | `sd_refund_cron_email_lead_minutes`    | Default **2** h (120 min) before check-out. Gates the check-out + deposit refund email only. |
| Skip if check-out was over | `sd_refund_cron_max_checkout_age_days` | Default **30**; **0** = no cutoff. Does **not** affect review emails.                        |

**Parking rate** is configured on the **Pricing** page only (`default_parking_rate_guest` via `property-pricing`), not in Email automations.

### Automated sends

Compact summary row on the Email automations card (`N of 8 on`) with **Manage**. **Manage** opens a `ResponsiveModal` (bottom sheet below `lg`) with the grouped list (`PropertyEmailAutomationTogglePanel`): **Your team**, **Building admin**, **Guest**, **Guest reviews**. Each row shows the recipient and a one-line **When** trigger, for example "When a guest submits the booking form." Toggles edit the page draft live; the modal footer is **Done**, so the save still happens through the page **Save Changes**. Master switches in `app_settings.automation_toggles` (JSONB). Missing keys default to **enabled**, and a stored retired key (`emailParkingBroadcast`) is ignored. Saved via **`app-settings` PATCH**.

Five rows are plan-gated (`emailGafRequest`, `emailBookingAcknowledgement`, `emailPetRequest`, `emailReadyForCheckin`, `emailSdRefundCheckout`): they show a plan pill and a disabled switch that opens the upgrade modal. **New booking alert**, **Review request**, and **Review reminder** stay free.

---

## Integrations

**Telegram** — status cards link to `/notifications` per module (Marketing, Staff, Operations, Finance, Maintenance, Chat).

**AI services** — read-only platform key status + **Test AI** card (uses property/org context).

Production GAF/pet approvals use **Resend inbound** (`approval-email-webhook`); hosts do not connect Google accounts here.

---

## AI features

**Moved to organization Settings.** Property Settings has no AI section. AI on/off, usage, the dashboard assistant, and the voice receptionist (voice, persona, per-property opt-out) are all configured in [organization Settings → AI features](../settings.md#ai-features).

A property's voice receptionist answers only when org AI is on, org voice is on, the property is not in the org opt-out list, and the property's plan includes `aiReceptionist`. Per-property session limits (`ai_platform_property_settings.feature_configs.voice_receptionist.max_*`) are platform-managed; see [Super Admin AI](../../admin/ai.md).

The retired leaves `settings.voiceReceptionist:edit` and `settings.aiOverrides:edit` are no longer in the catalog; stored custom roles drop them on read (`normalizePermissionIds`). Copy settings no longer has **Voice receptionist** or **AI features** groups.

**Guest-side hardening:** sessions end after 45 seconds without guest or assistant speech. Mic permission is requested before reserving provider capacity, stale sessions are reaped, and failed connections offer Retry or text handoff.

---

## Activity

Read-only. Summary: "Who did what on this property." **Manage** opens a large modal with the full property-scoped activity feed (search, filters, infinite scroll, an in-place sliding detail view with Back / Esc, CSV export for owner / org-admin). Legacy `/org/:orgSlug/property/:propertySlug/activity` redirects to `…/settings?open=activity`. See [activity.md](./activity.md). No save path.

---

## Danger Zone

### Archive

- Confirmation modal → `update-property` with `status: INACTIVE` (`settings.dangerZone:edit`)
- Does **not** delete data

### Restore

- Shown when property is archived (Inactive) **and** the listing is verified with no contract lock
- When it is not allowed, the card shows the reason instead of the button (waiting for approval, or renew the contract)
- Confirmation modal → `update-property` with `status: ACTIVE` (`settings.dangerZone:edit`)
- **409** when the listing authorization is not approved, or `listingAuthorization.lifecycle.accessLockedAt` is set, or another org already has an ACTIVE listing for the same tower+unit — toast shows the server message; property stays Inactive

### Delete

- Confirmation modal with destructive warning
- **DELETE** `delete-property` with `{ propertyId }`
- **Blocked** when `guest_submissions` exist for this property (409)
- On success: removes property row (cascades Telegram/app settings integrations), cleans gallery storage
- Navigates to `/org/:orgSlug/properties`

**Recommendation:** Prefer **Archive** for units with booking history. Use **Delete** only for mistaken/empty properties.

---

## API reference (this page)

| Action                                                            | Endpoint                                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Profile + settings                                                | `PATCH update-property`                                                                       |
| Payment + building forms + email automations + workflow documents | `PATCH app-settings?property_id=` (payment fields require `settingsVerificationToken`)        |
| Payment OTP (org owner)                                           | `POST settings-verification?property_id=` (`send_otp`, `verify_otp`)                          |
| Media upload/delete                                               | `POST` / `DELETE upload-property-media?property_id=`                                          |
| Payment QR / signature                                            | `POST upload-app-settings-asset?property_id=`                                                 |
| Archive                                                           | `PATCH update-property` `{ status: "INACTIVE" }`                                              |
| Restore                                                           | `PATCH update-property` `{ status: "ACTIVE" }` (requires verified listing, unlocked contract) |
| Delete                                                            | `DELETE delete-property` `{ propertyId }`                                                     |

---

## Shared validation modules

| Layer                                 | Path                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------- |
| UI                                    | `ui/src/lib/validation/fieldValidation.ts`                             |
| Edge                                  | `supabase/functions/_shared/fieldValidation.ts`                        |
| Residence defaults (UI)               | `ui/src/features/dashboard/org/lib/propertyResidenceDefaults.ts`       |
| Email automation copy/defaults (UI)   | `ui/src/features/dashboard/org/lib/propertyEmailAutomationDefaults.ts` |
| Residence defaults (edge)             | `supabase/functions/_shared/propertyResidenceDefaults.ts`              |
| Email automation copy/defaults (edge) | `supabase/functions/_shared/propertyEmailAutomationDefaults.ts`        |
| Cleaning buffer constants (UI)        | `ui/src/lib/cleaningBuffer.ts`                                         |
| Cleaning buffer constants (edge)      | `supabase/functions/_shared/cleaningBuffer.ts`                         |

Keep UI and edge copies in sync when changing rules.

---

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, F5 / Cmd+Ctrl+R, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing** only after you change a field on this visit. Load-time sync never prompts or enables **Save Changes**: GAF tower/unit from the profile, unit-type defaults (bedrooms, bathrooms, max adults/children), a stale preferred owner parking healed to the first active listing, and the initial map auto-locate for an address with no pin. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Testing

| Layer | Path / spec                                                                                                                                                                                       | Manual                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Unit  | `propertySettingsSave.test.ts`, `propertySettingsCompletion.test.ts`, `propertyEmailAutomation.test.ts`                                                                                           | —                                           |
| E2E   | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` settings shell (`@ci`); `ui/e2e/features/team/propertySettingsCleanNavigation.spec.ts` clean-load no prompt vs real-edit prompt (`@ci`) | OTP payment method, live Maps, media upload |
| N/A   | —                                                                                                                                                                                                 | —                                           |

---

## Related docs

- [Organization Settings — AI platform](../settings.md) § AI platform
- [Organization Properties — Copy settings](../properties.md) § Copy settings
- [Super Admin AI](../../admin/ai.md)
- [`docs/archive/operations/ai-platform-billing.md`](../../../../archive/operations/ai-platform-billing.md) — billing and quota guidance

---

## Pending / follow-ups

- [ ] Org-level residence catalog (DB-driven instead of code constants)
- [ ] Location: optional per-org Maps API key override
- [ ] Soft-delete flag instead of hard delete for edge cases
- [x] Automated tests for property settings validation (load smoke in `dashboardModulesSmoke.spec.ts`; save paths manual)
- [x] Remove deprecated `voice-receptionist-global-settings` edge function and UI card
- [x] Final-backfill and drop legacy voice settings tables (`20261316122350` then `20261316122400`)

## Setup Guide

The same sections can be completed inside the post-onboarding [Setup Guide](../setup-guide.md) overlay (identical storage and validation).
