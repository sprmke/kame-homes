---
title: 'Guest Form — operator guide'
status: active
tags: [guides, routes]
updated: 2026-08-30
---

# Guest Form — operator guide

Route: `/properties/:propertySlug/form` (legacy `/form?property=<slug>` redirects here)

> **Status:** Documented.

## Progress overview

| Section              | E2E save | Validation      | Docs       | Notes                                                       |
| -------------------- | -------- | --------------- | ---------- | ----------------------------------------------------------- |
| Multi-step form      | ✅       | ✅ Zod          | Documented | 5 steps (4 for Airbnb)                                      |
| Auth on entry        | ✅       | —               | Documented | Same as `/messages` — modal + skeleton until signed in      |
| Overlap / lock check | ✅       | Server          | Documented | Booking overlap + `GUEST_FORM_LOCKED`                       |
| Cleaning buffer      | ✅       | Client + Server | Documented | Custom `TimePicker` hard-blocks same-day turnover conflicts |
| Dev controls         | ✅       | —               | Documented | Non-prod only; FormData flags                               |
| Legacy URL strip     | ✅       | —               | Documented | `dev` / `testing` / flags / `from=airbnb`                   |
| Mobile shell         | —        | —               | Documented | Back/Continue/Submit floats via `ContextualActionBar`       |

---

## Overview

**Mobile shell (2026-09-10):** the standalone route's Back/Continue/Submit row (`GuestFormStepNavigation`, `mobileVariant="floating"`) claims the shared bottom band via `ContextualActionBar` below `lg`, auto-hiding the marketing/property `BottomTabBar` while a step is active. The `GuestBookingFormModal`-embedded render (`embed?.onNavChange` set) keeps its plain inline row — a fixed bar would fight the modal's own sheet chrome.

The guest booking form, scoped to **`/properties/:propertySlug/form`**. Full-page renders use **`MainLayout`** (brand-color band + **`GuestOperationalHeader`**, overlapping logo via **`GuestFormBrandHeader`**, and **`GuestStayContextBar`** when `checkInDate` / `checkOutDate` are in the URL). Opening the page while anonymous shows **`GuestAuthModal`** immediately (skeleton until signed in — same pattern as **`/messages`**). The same **`GuestForm`** component also embeds in **`GuestBookingFormModal`** on the property detail page when guests tap **Reserve** (seeded dates via `embed` props — no navigation to `/form`, no shell chrome; auth already ran before the modal opens). Admin **New booking** on the property bookings list links here via `guestFormPath(propertySlug)` or embeds with `skipAuthGate`. Guests can also reopen an existing submission with **`?bookingId=`** (deep links from host emails or booking status flows) to edit it while it's still `PENDING_REVIEW` (still requires a guest session).

Legacy **`/form?property=<slug>`** redirects to the scoped route. Deprecated query keys (`dev`, `testing`, submit-form control flags, `from`) are stripped on load; `from=airbnb` migrates to `?source=airbnb`.

---

## Host-facing knowledge

The booking form walks a guest through their info, stay dates and guest list, an optional paid-parking interest toggle, optional pets, and (for non-Airbnb bookings) a downpayment receipt upload. A guest can reopen their own submission to make changes only while it's still awaiting your review; once you've started processing it, they're told to contact you directly instead of editing it themselves.

**Common host questions**

- Q: A guest says they can no longer edit their booking form.
  A: Guests can only edit their own submission while it's still in the initial "awaiting review" stage. Once you've moved it forward, they're shown a message to contact you on Facebook or Airbnb for changes instead.
- Q: Why doesn't the Airbnb booking form ask for a payment receipt?
  A: Airbnb bookings skip the downpayment step entirely, since Airbnb handles that payment on their platform, not through Kame Homes.
- Q: A guest checked "Yes, reserve paid parking" — where's their vehicle info / parking charge?
  A: As of Phase 7, parking is a pure interest signal here — no vehicle info or charge is collected on this form anymore, and it's not part of the downpayment total. The guest reserves and pays for a specific spot separately through the parking marketplace (`/parkings`), either from a link on their booking-confirmation page/email, or a pre-arrival reminder email if they haven't by ~3 days before check-in. Once they self-serve and pay, it shows up automatically on this booking's detail page (Parking tab) — no manual entry needed from you.
- Q: A guest tried to book dates that are already taken. What do they see?
  A: An "already booked" message telling them those dates aren't available, so they can pick different ones.
- Q: A guest can't pick a check-in/check-out time that should be available. Why?
  A: Your property's **Cleaning Time** (Property Settings → Guest Form, always at least 1 hour) blocks any check-in or check-out time that leaves less than that gap on a same-day turnover with another guest's stay. They just need to pick a time on the other side of the gap.

---

## Steps

| #   | Step    | Content                                                                                                                                                                                                                                                                         | Airbnb     |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Guest   | Facebook/Airbnb name, email, phone, address, nationality, guest list (names/ages/valid ID)                                                                                                                                                                                      | ✅         |
| 2   | Stay    | Check-in/out dates + times (custom `TimePicker`, defaults from property **`checkInTime`/`checkOutTime`** via `get-guest-payment-info`), special requests, how they found us, surprise decor flag, optional **voucher** picker (same-property awards from `list-guest-vouchers`) | ✅         |
| 3   | Parking | Pure interest toggle (`needParking`) — no vehicle/date/pricing fields here anymore (Phase 7). Guests who opt in reserve and pay for a spot separately through the parking marketplace, after this booking is confirmed                                                          | ✅         |
| 4   | Pets    | Optional pet details (name, type, breed, age, vaccination date, vaccination record + pet photo)                                                                                                                                                                                 | ✅         |
| 5   | Payment | Downpayment breakdown + pay-to accounts (QR shown only when the host uploaded one) + receipt upload                                                                                                                                                                             | ❌ skipped |

Airbnb bookings (`?source=airbnb`, or a booking with `booking_source = 'Airbnb'`) get **4 steps** — Payment is omitted entirely and `paymentReceipt` is not required. See `.cursor/rules/booking-workflow.mdc` § Airbnb source behavior for the full list of Airbnb-specific differences downstream of submission.

Each step validates its own fields (via `getFieldsForGuestFormStep`) before **Next** advances; the guest cannot submit until the final step's validation passes.

Stepper labels and in-card section headings share the same **`title`** per step (`guestFormSteps.ts`); a one-line **`hint`** appears under the heading inside the card.

---

## Fields

### Save path

1. Guest opens `/properties/:propertySlug/form` (direct link, calendar **Book Now**, or legacy redirect). If not signed in, **`GuestAuthModal`** opens immediately (same entry gate as **`/messages`**) and the page shows a skeleton until authenticated. OAuth/OTP resume uses a `navigate` intent back to the form URL. Admin **New booking** embed sets `skipAuthGate` and skips this. On the property-detail **Reserve modal**, auth already ran before the modal opened (see [[properties|Property detail]]); submit still re-checks the session if it expired.
2. Guest completes all steps → taps **Submit** on the last step.
3. `GuestForm` builds `FormData` (files kept as files, everything else stringified) and POSTs to **`submit-form`** (property scope via `?property=<slug>` in the query string; side-effect flags via FormData in non-prod only — never in the URL).
4. `submit-form`:
   - Checks for overlapping bookings on the property for the given dates (skipped if the booking is unchanged).
   - Re-checks the property's **cleaning buffer** against same-day adjacent bookings (`DatabaseService.getAdjacentBookings` + `_shared/cleaningBuffer.ts`); rejects with `CLEANING_BUFFER` if the submitted check-in/check-out time no longer clears the gap (mirrors the client-side check — see Cleaning buffer below).
   - If `bookingId` matches an existing row, compares incoming vs stored fields (`compareFormData`); no-op updates short-circuit straight to the success page.
   - Rejects with `GUEST_FORM_LOCKED` if the existing booking's status no longer allows guest self-edit (`canGuestPublicUpdateForm`).
   - Associates the submission with the signed-in guest's account (`guest_user_id`) when a valid session JWT is present.
   - Runs non-blocking AI validation on the downpayment receipt and each valid ID upload (logged, not submit-blocking).
   - Sends the **New Booking Request** notify email (to `EMAIL_REPLY_TO`, not the guest) when enabled and this is a genuine change.
5. On success, guest is redirected to `/properties/:slug/success?bookingId=`.

### Behavior / edge cases

- **Booking overlap:** blocked with a dedicated `BOOKING_OVERLAP` toast telling the guest to screenshot and contact the host.
- **Cleaning buffer:** every property has a required `cleaningBufferMinutes` (Property Settings → Guest Form → Cleaning Time, at least 1 hour, no "off" option), so same-day turnover conflicts are always **hard-blocked**, not just warned. `get-booked-dates` returns each neighboring booking's `checkInTime`/`checkOutTime`; `guestCalendarAvailability.ts` (`minAllowedCheckInTime` / `maxAllowedCheckOutTime`) computes the earliest allowed check-in / latest allowed check-out on the selected date, and the `TimePicker`'s `disabledTime` grays out the disallowed options so the guest structurally can't select them. `guestFormSchema.ts` also enforces the same bound in a `superRefine`, and `submit-form` re-validates it server-side before saving (`_shared/cleaningBuffer.ts`) — errors surface as a `CLEANING_BUFFER` toast. Only applies to same-day turnovers (a booking whose `checkOutDate`/`checkInDate` matches the selected date); non-adjacent stays are unaffected.
- **Time fields use a custom picker, not the native browser control:** both Check-in Time and Check-out Time render the shared `TimePicker` (`ui/src/components/ui/time-picker.tsx`, 30-min increments, 12-hour display) instead of `<input type="time">`, for consistent formatting and to support disabling cleaning-buffer-conflicting times.
- **Locked booking:** once a submission has moved past `PENDING_REVIEW`, guest edits are rejected server-side (`GUEST_FORM_LOCKED`) and the form disables all fields with a banner.
- **No workflow email/PDF here:** `submit-form` never sends GAF/acknowledgement/pet/parking email or generates PDFs — those only happen on admin workflow transitions (see `.cursor/rules/booking-workflow.mdc`). The only email `submit-form` can send is the internal **New Booking Request** notify.
- **Uploads pass through `prepareUpload`:** every picked file is validated against the shared ceiling client-side (`File must be N MB or smaller` — image 10 MB, document 12 MB) before it is attached to the multipart body. Guest booking-form documents (valid IDs, downpayment receipt, pet vaccination) are in the `guest-documents` rollout group, which is a **ceiling-only pass-through by default** — the bytes are uploaded untouched — until the §9.7 OCR-regression gate is signed off and `VITE_IMAGE_OPT_SURFACES` is widened to `all` (then IDs/receipts re-encode via the near-lossless `DOCUMENT` preset, pet photo via `CONTENT`). Undecodable iPhone HEIC always passes through untouched. Architecture: [`storage.md`](../../architecture/storage.md) §7.1; rollout: [`image-upload-optimization-manual.md`](../testing/image-upload-optimization-manual.md).
- **Same-page reopen for edits:** loading `?bookingId=` pre-fills every field (including re-fetching uploaded images as `File` objects for preview) via **`get-form`**.
- **Completion-link mode (`?complete=<token>&property=<slug>`):** calendar-sync Phase 2 (§6.5). The host copies this link from an OTA-ingested booking's action menu ("Copy guest form link") and forwards it to their Airbnb guest. `get-form-completion` resolves the token → the form skips date entry (locked stay shown as a read-only banner — "Your Airbnb stay: …"), is treated as an Airbnb booking (no Payment step / receipt), and submits to **`submit-form-completion`** (UPDATE-only — the server re-reads the locked dates and ignores any in the payload; `status` stays `PENDING_REVIEW`). Bad/rotated token → "Link unavailable"; `410` (stay over / cancelled) → "This link has expired". A completed form stamps `guest_form_completed_at` and notifies the host (`booking_guest_form_completed`).
- **Invisible human check (anti-spam):** the final step mounts a Cloudflare Turnstile widget (`useAntiSpamSubmit`, `action: submit-form` / `submit-form-completion`) plus a hidden honeypot + form-load timestamp. Real guests see nothing; a suspicious session gets an inline challenge before the button proceeds. On submit the token + honeypot + timing fields ride along in the multipart body; `submit-form` verifies them (`_shared/antiSpam.ts`) and, on failure, returns a friendly "Please complete the verification and try again." / "Too many attempts…" toast without saving. Inert when `VITE_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` are unset (heuristics + durable rate limit still apply). See [PROJECT.md → Anti-spam & CAPTCHA](../../PROJECT.md).
- **Booked-dates check:** on mount, fetches the property's occupied date ranges via `get-booked-dates` to disable those days in the date pickers.
- **Property check-in/out times:** on mount, `get-guest-payment-info` returns the property's `checkInTime` / `checkOutTime` (24h `HH:mm` from `properties.settings`; defaults `14:00` / `12:00`). New submissions pre-fill those fields once the fetch completes. Early check-in and late check-out banners compare the guest's selected time against the property values. Reopening `?bookingId=` keeps the stored submission times from `get-form`.
- **Property guest capacity:** same payload includes `maxAdults` / `maxChildren` from the property's unit type. The guest list shows a **Maximum Guests Reminder** when occupancy exceeds those limits (building rule: age 4+ = adult, age 0–3 = child). `submit-form` enforces the same limits server-side.
- **Primary guest name:** pre-fills from the step-1 contact name (Facebook/Airbnb/full name) and stays editable; if the guest changes the primary name separately, later contact-name edits no longer overwrite it.
- **Property branding (header + shell):** eyebrow line = `tower_and_unit · residence` (short residence name); logo = org `emailLogoUrl` with fallback to primary property gallery image; top band = org **brand color** gradient via `MainLayout`; footer = `© {year} {orgName}` via `formatGuestFooterLabel` — host org when set, else platform **Kame Homes**. Legacy single-tenant labels (**Kame Home**, **Kame Home — Azure North**) normalize to **Kame Homes**. Copyright never appends residence. Pet copy uses `petFee` and `residenceName` from the same payload; the parking step's copy references `residenceName` only (no rate — see Phase 7 note above). GAF owner/unit fields pre-fill from `gaf*` columns on load (not hardcoded defaults).

---

## Developer controls (non-production only)

Shown on the last step, never gated by `?dev=true`. Checkboxes (all on by default): save to database, save images to storage, send email (New Booking Request only). Also includes **Paste Booking Info from Clipboard** and **Generate New Data** (new submissions) and **Cancel This Booking** (existing submissions). Production always runs the full happy path regardless of client input.

---

## API reference

| Action                                   | Endpoint                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submit / update booking                  | `POST submit-form`                                                                                                                                                                                                                                                                                                                                              |
| Load existing submission                 | `GET get-form/:bookingId` — optional `?access=<token>` from `submit-form` response (`guestAccessToken`); UI stores in `sessionStorage` via `guestBookingAccess.ts`. Enforcement off until `GUEST_BOOKING_ACCESS_ENFORCE=true`. Asset URL fields in the response are **signed** (30 min) for private guest-doc buckets.                                          |
| Update existing submission               | `POST submit-form` with `bookingId` plus the stored `access` field (same enforce/grace as `get-form`). Bare UUID is rejected when enforcement is on and grace has expired.                                                                                                                                                                                      |
| Load OTA completion link                 | `GET get-form-completion?complete=<token>`                                                                                                                                                                                                                                                                                                                      |
| Submit OTA completion form               | `POST submit-form-completion` (multipart + `complete=<token>`)                                                                                                                                                                                                                                                                                                  |
| Booked date ranges                       | `GET get-booked-dates` — now includes each booking's `checkInTime`/`checkOutTime` (used for cleaning-buffer conflict checks)                                                                                                                                                                                                                                    |
| Payment / branding / guest-form settings | `GET get-guest-payment-info` — includes section toggles, check-in/out times, **`cleaningBufferMinutes`**, guest capacity, **property display** (`propertyName`, `propertyEyebrow`, `propertyCoverImageUrl`, `residenceName`, `organizationName`), pricing hints (`defaultParkingRateGuest`, `petFee`), GAF defaults, org logo (`emailLogoUrl`), and brand color |
| Development unit types (by residence)    | `GET get-residence-unit-types?residenceName=`                                                                                                                                                                                                                                                                                                                   |
| Cancel booking (dev only)                | `POST cancel-booking`                                                                                                                                                                                                                                                                                                                                           |

---

## Implementation map

| Concern                        | Path                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Page                           | `ui/src/features/guest/form/components/GuestForm.tsx`                                             |
| Listing Reserve modal          | `ui/src/features/guest/marketing/properties/components/property-detail/GuestBookingFormModal.tsx` |
| Schema                         | `ui/src/features/guest/form/schemas/guestFormSchema.ts`                                           |
| Steps config                   | `ui/src/features/guest/form/lib/guestFormSteps.ts`                                                |
| Strip legacy URL keys          | `ui/src/features/guest/form/lib/bookingSourceFromSearchParams.ts`                                 |
| Payment info hook              | `ui/src/features/guest/form/hooks/useGuestPaymentInfo.ts`                                         |
| Property time defaults         | `ui/src/features/guest/form/lib/guestFormPropertyDefaults.ts`                                     |
| Guest form settings resolver   | `supabase/functions/_shared/guestFormSettings.ts`                                                 |
| Custom time picker             | `ui/src/components/ui/time-picker.tsx`                                                            |
| Cleaning buffer helpers (UI)   | `ui/src/features/guest/calendar/lib/guestCalendarAvailability.ts`, `ui/src/lib/cleaningBuffer.ts` |
| Cleaning buffer helpers (edge) | `supabase/functions/_shared/cleaningBuffer.ts`                                                    |
| Routes (wired)                 | `ui/src/features/guest/property/routes/index.tsx` (`propertyGuestRoutes`, `legacyGuestRedirects`) |
| Paths                          | `ui/src/features/guest/lib/guestPublicPaths.ts`                                                   |
| Auth-on-submit                 | `ui/src/features/guest/auth/context/GuestAuthContext.tsx`                                         |
| Submit                         | `supabase/functions/submit-form/index.ts`                                                         |
| Form data fetch                | `supabase/functions/get-form/index.ts`                                                            |
| Shared services                | `supabase/functions/_shared/{databaseService,receiptValidationService,statusMachine}.ts`          |

---

## Testing

| Layer | Path / spec                                                                              | Manual                      |
| ----- | ---------------------------------------------------------------------------------------- | --------------------------- |
| Unit  | `guestFormSteps.test.ts`, `guestBookingAccess.test.ts`, form schema validators           | —                           |
| E2E   | `ui/e2e/features/guest-form/guestFormLoad.spec.ts`, `guestFormSubmit.spec.ts` (`@smoke`) | Real OAuth not in CI        |
| N/A   | —                                                                                        | Turnstile live verification |

---

## Related docs

- [Route index](./README.md)
- [Calendar](./calendar.md)
- [Success](./success.md)
- [`docs/PROJECT.md`](../PROJECT.md)
- `.cursor/rules/booking-workflow.mdc` — Airbnb source behavior, guest-field revert rules
- `.cursor/rules/admin-auth.mdc` §4 — guest form dev controls contract

---

## Pending / follow-ups

- [ ] `ui/src/features/guest/form/routes/index.tsx` (`guestFormRoutes`) is an **orphaned** route module — not imported by the app router. The routes actually served come from `ui/src/features/guest/property/routes/index.tsx`.
