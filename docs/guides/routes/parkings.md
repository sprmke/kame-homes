---
title: 'Parkings (guest marketing) — operator guide'
status: active
tags: [guides, routes, parking]
updated: 2026-08-27
---

# Parkings (guest marketing) — operator guide

Routes:

- `/parkings` — list (location-grouped carousels)
- `/parkings/in/:location` — flat grid for one place (city slug, e.g. `san-fernando-city`, `tagaytay`)
- `/parkings/:parkingSlug` — slot detail (live API)
- `/parkings/:parkingSlug/form` — guest parking request submit
- `/parkings/requests/:bookingId` — guest parking request status

> **Status:** Documented — list + filters live via `list-public-parkings` (URL facets/sort, chips, mobile sheet sort). Location browse uses `locationSlug`.

## Progress overview

| Section         | E2E save | Validation | Docs       | Notes                                                                                                   |
| --------------- | -------- | ---------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| List + filters  | —        | —          | Documented | Live `list-public-parkings`; URL-driven filters + facets                                                |
| Location browse | —        | —          | Documented | `/parkings/in/:location`                                                                                |
| Detail page     | —        | —          | Documented | `get-public-parking` + pricing; **Contact Host** web chat; **ACTIVE** only                              |
| Reserve slot    | —        | —          | Documented | **`useParkingReserve`** → in-place **`ParkingBookingFormModal`** (guest-auth gated)                     |
| Parking form    | Done     | Done       | Documented | Guest-authenticated submit (`submit-parking-booking-request`); zero-candidate 422                       |
| Request status  | —        | —          | Documented | Polling status page (`get-parking-booking-status`, 4s interval); ranked batched search + pay-to-confirm |
| Mobile shell    | —        | —          | Documented | `MarketingLayoutShell` bottom tabs; Reserve/chat → `ContextualActionBar`/`ResponsiveModal`              |

---

## Overview

Browse parking slots across developments. **`ParkingsListPage`** uses **`list-public-parkings`** (live DB). Location browse (`/parkings/in/:location`) uses the same API with **`locationSlug`**.

**Unknown location slug:** redirects to **`/parkings`**.

Main nav: **Parkings** → `/parkings` (replaces legacy **About** link).

---

## Host-facing knowledge

Guests browse standalone parking slots by city or building, open a slot detail page, and can reserve through the same date-picker pattern as home listings. Host cards link to the public host profile when the slot is live.

**Common host questions**

- Q: Is parking booking fully self-serve for guests today?
  A: Yes — a guest can browse, request, get matched, and pay online without anyone doing manual work. They must be signed in to submit a request.
- Q: Where does my parking slot show up besides the public Parkings browse pages?
  A: On your development's parking list, your public host page, and cross-links from related property listings when configured.
- Q: What happens when a guest taps Reserve on a parking slot?
  A: The parking request form opens in a modal right on the slot page (dates carried over from the picker when present) instead of navigating to a separate page — same pattern as the property Reserve flow. Guests without a session are prompted to sign in first and land back in the open modal afterward — signing in is required, not just a courtesy prompt. Submitting it creates a real parking request, not a mock lead form.
- Q: Does every eligible host get notified about a new request at once?
  A: No — only if the guest requested one specific listing directly. For an org-wide search, the request goes first to the cheapest few eligible hosts. If none of them respond in time, it automatically moves on to the next few, and so on, until it's matched or every eligible host has had a turn.
- Q: How does the guest know if a host accepted the request?
  A: After submit, the guest is sent to a request-status page that shows whether the request is still waiting, awaiting the guest's payment, already confirmed, cancelled, or ended with no host available. Once a host accepts, the guest sees a "Pay Now" button and has a time window to pay — the booking is only truly confirmed (and the host's access note shown) once payment succeeds.
- Q: Can a guest change their mind?
  A: Yes, any time before they pay — while still searching or while their payment window is open. Once paid, the reservation is final and not self-service cancellable.

---

## List (`/parkings`)

**`ParkingsListPage`** — hero search, collapsible **`ParkingFilters`** sidebar (location type, tower, price; **closed by default** on desktop — use **Show Filters** in the toolbar), **`ParkingToolbar`** sort (sticky from `lg` up; on mobile it scrolls with the page so it never collides with the sticky **Filters & Sort** bar), location-grouped carousels via **`ParkingsByLocation`**. Filters/sort from URL; tower options from API facets. When Tower is shown but has no options, the section shows **None**.

- **Mobile filters:** the **`ParkingFilters`** sheet opens as a bottom sheet (flex column, `z-[100]`/`z-[101]` so it clears the scroll-morph search bar). Header and the **Show results** / **Clear all** footer are pinned; only the option list scrolls; the footer carries a safe-area inset.

- **Scale behavior:** `list-public-parkings` reads lean candidates in deterministic 1,000-row ranges, computes availability/Nearby/totals/facets before page slicing, and fails closed above 20,000 rows instead of silently truncating totals. Default unfiltered `/parkings` additionally uses `list-public-place-groups?family=parkings` for six city rows with eight previews each; **Show more places** appends later groups. Filtered browse stays on `list-public-parkings`. When map bbox params are present (e.g. `/search` parkings map tab), facets are computed from the **visible map pool** before location/tower/price filters.
- Each row title: **Parking in {city}** → **View all** → `/parkings/in/:location`
- Cards: **`ParkingSlotCard`** carousel variant — **Parking in {city}** title + **development name** subtext (matches property carousel pattern); **Reserve** via card link to development form
- On scroll, **`ListingHeroSearch`** morphs into the fixed header center (same as `/properties`).

**Where field:** empty on `/parkings` (category index — do not prefill the nav label); city name on `/parkings/in/:location` (`listingSearchDefaultLocation.ts`). Placeholder: **Search parkings** (`listingSearchFields.ts`).

---

## Location browse (`/parkings/in/:location`)

**`ParkingsLocationPage`** — live parking slots in one city.

- **`:location`** — slugified city via shared **`normalizeCityPlace`** + **`toLocationSlug`** (matches place-groups).
- Loads **`list-public-parkings?locationSlug=…`** (paged).
- Page title: **Parking in {city}**
- Flat **`ParkingsEntriesGrid`** (responsive card grid)
- Same filters + sort chrome as list page (client filter on the loaded page window)
- Unknown / empty location → redirect to **`/parkings`**. Error: **Try again**.

Route is registered at the marketing shell level (no dynamic slug conflict).

---

## Detail (`/parkings/:parkingSlug`)

**`ParkingDetailPage`** — same shell as **`PropertyDetailPage`**: full-width **`ListingGallery`** (Share; single-photo uses the same tall panoramic layout), then **`lg:grid-cols-3`** with overview + amenities left and **`BookingCard`** sticky right.

- Gallery: **`ListingGallery`** (shared with property via **`PropertyGallery`** wrapper)
- Overview: **`ParkingOverview`** — parking type badge, title, **`ListingPlaceMeta`** (development · tower · level), inline dimension + check-in/out row (length / width / clearance · in/out times), **`ListingHostCard`** (**Contact Host** opens guest web chat sheet), description (**About this parking**). Brand color tints accents via **`ParkingPublicBrandShell`**. Pricing lives in **`BookingCard`** only.
- Features: **`PropertyAmenities`** when `features[]` is non-empty
- Location: **`PropertyLocation`** when `parkings.settings` has address or map pin (`get-public-parking` returns `address`, `city`, `province`, `country`, `latitude`, `longitude`, `placeId`)
- Mobile: floating **Reserve** bar (`ContextualActionBar`, claims the shared bottom band from the marketing tab bar while open) opens calendar modal when dates missing; **Continue** in the calendar proceeds to the booking form modal when dates are complete

### Reserve (in-place modal)

Tapping **Reserve** with dates selected — desktop **`BookingCard`** or the mobile floating bar — no longer navigates to `/parkings/:parkingSlug/form`. Instead **`useParkingReserve`**'s `onOpenForm` callback (wired from `ParkingDetailPage`) opens **`ParkingBookingFormModal`** right on the detail page, mirroring **`GuestBookingFormModal`** on the property flow. The booking calendar modal's **Continue** action closes the calendar and opens the same form modal (auth/resume identical to **Reserve**):

- Guest-auth gated via `requireGuestAuth` with a `parking_booking_form_modal` resume entry (`guestAuthResume.ts`) — an unauthenticated guest is sent through sign-in and returned to `/parkings/:parkingSlug?reserveForm=open[&checkInDate=&checkOutDate=]`, which `ParkingDetailPage` reads once authenticated to reopen the modal (same `reserveForm=open` param convention as `guestPropertyReserveFormOpenPath`, via the parking-specific `guestParkingReserveFormOpenPath`)
- Renders the same **`ParkingRegistrationForm`** wizard as the standalone form page, inside **`GuestDialogShell`** (title **Request parking**)
- On successful submit, closes the modal and navigates to `/parkings/requests/:bookingId` (same destination as the standalone form page)
- The direct URL `/parkings/:parkingSlug/form` still exists as a standalone fallback (e.g. shared links) and uses the same **entry auth gate** as property `/form` and `/messages`

---

## Parking form (`/parkings/:parkingSlug/form`)

**`ParkingFormPage`** — guest parking-request form, still reachable directly (shared links, no-JS-modal fallback) even though the Reserve button on the detail page now opens the same form in a modal (see **Reserve (in-place modal)** above). Anonymous guests hitting this URL get **`GuestAuthModal`** immediately (skeleton until signed in), matching property `/form` and `/messages`. Loads live parking detail via **`get-public-parking`**, then renders a dedicated **`ParkingRegistrationForm`** inside the same **`MainLayout`** + **`GuestOperationalHeader`** + **`GuestFormBrandHeader`** shell as property `/properties/:slug/form` (page title **`{Slot name} - Request parking`**, org favicon from cover image).

`ParkingRegistrationForm` (`ui/src/features/guest/marketing/parkings/components/ParkingRegistrationForm.tsx`) is a 3-step wizard modeled on the main guest form (**`GuestForm`**) — same `Form`/`FormField` primitives, the real **`DatePicker`** popover (not a raw `<input type="date">`), and the shared **`GuestFormStepper`** / **`GuestFormStepNavigation`** components. Stepper labels and in-card section titles share one **`title`** per step (`parkingRegistrationSteps.ts`):

1. **Guest** — guest name, email, phone (required)
2. **Booking** — read-only **Tower** (when known), unit number, check-in/check-out dates
3. **Vehicle** — vehicle type (car/motorcycle), plate number, brand/model, color, notes

Validated with a dedicated Zod schema (`parkingRegistrationSchema.ts`), not RHF `register()` with no rules like the generic form-builder fields. Placeholders reuse the shared **`FORM_PLACEHOLDERS`** constants (`ui/src/lib/constants/formPlaceholders.ts`) for parity with the main guest form.

**Mobile step nav (2026-09-10)** — `ParkingRegistrationForm` takes a `mobileVariant: 'modal' | 'page'` prop. This standalone page passes `'page'`, so `GuestFormStepNavigation` floats the Back/Continue/Submit row via `ContextualActionBar` on phone/tablet (matching property `/form`). `ParkingBookingFormModal`'s in-page-modal render keeps `'modal'` (default) — a plain inline row, since a fixed page-level bar would fight the modal's own bottom-sheet chrome.

**Auth gate:** `/parkings/:slug/form` and Reserve require guest sign-in before the request UI is usable (`requireGuestAuth` — same pattern as property guest form).

**Self-serve property-stay linking (Phase 7 + pay-parking connect + owner-owned default):** after sign-in, if the guest has confirmed property stays that signaled `need_parking` and aren't already linked (`useLinkableParkingBookings` → `list-linkable-property-bookings`), the first screen is a **Which stay?** chooser — unless the URL/session carries `linkStay=<propertyBookingId>` (host-shared find or own-default form link), in which case that stay is auto-selected when it appears in the linkable list. When the property org owns an available parking for the stay dates, host/legacy redirects and **booking acknowledgement / parking-reminder emails** prefer `/parkings/:slug/form?linkStay=…&checkInDate=…&checkOutDate=…` (`resolveGuestParkingCtaAbsoluteUrl`). A same-org pinned submit with a linked property stay **auto-claims to `PENDING_PAYMENT`** (skips host Accept notify). If the property has **Complimentary own parking** enabled, that claim skips the awaiting-payment email and immediately fulfills as ₱0 (`provider: complimentary`) → confirmed + endorsement without PayMongo.

- **Pick a stay** → **Confirm request** summary (`ParkingLinkedStayConfirm`) with guest/contact/unit/vehicle/parking dates prefilled from the booking (vehicle type defaults to car when plate/brand exists). Primary action **Submit request** — no Guest → Booking → Vehicle stepper. **Edit** opens the full stepper with values kept; **Back** returns to the chooser. Does **not** jump to Pay: status flow remains Match → Pay → Done after submit.
- **Different booking — enter details** → full three-step stepper with empty guest/vehicle fields.
- No linkable stays → stepper only (no chooser flash while the list is loading).

Parking check-in/out come from Reserve / query params, not overwritten by the linked stay’s dates. On submit, `linkedPropertyBookingId` is sent; the server re-verifies ownership. Once paid, the linked property booking’s parking sub-step auto-completes — see `.cursor/rules/parking-workflow.mdc` § Property-booking migration.

Save flow:

1. Guest opens `/parkings/:parkingSlug/form` (or arrives from **Reserve** with dates). If not signed in, **`GuestAuthModal`** opens on entry; OAuth/OTP resumes to the form URL. Reserve modal path already gated via **`useParkingReserve`**.
2. Form submits through **`useSubmitParkingBookingRequest`** → **`submit-parking-booking-request`**
3. Server validates org + optional pinned slot, checks candidate availability, and returns **422 `no_parking_available`** with no insert when no eligible parking can take the request
4. Success **navigates** to **`/parkings/requests/:bookingId`** (same as the Reserve modal) — no intermediate "All done" screen. The status page is the source of truth for matching, payment, and confirmation.

Validation / behavior highlights:

- `vehicleType` is required (`car` or `motorcycle`)
- `phone` is required — 11-digit Philippine mobile starting with `09` (same rules as the main guest form via `requiredPhilippineMobilePhoneZodSchema`)
- `checkOutDate` must be after `checkInDate` (schema-level `.refine`)
- Reserve dates from the query string (`?checkInDate=&checkOutDate=`) prefill the check-in/check-out date pickers and also appear in a **`ParkingStaySummary`** card above the form when present
- Guest-facing error mapping turns internal edge errors into short copy such as **No parking slots are available for these dates**

Distinct from:

- Operational stay booking: `/properties/:slug/form` — see [form.md](./form.md)
- Paid parking vehicle details for an existing stay: `/properties/:slug/parking/:bookingId` — see [bookings/parking.md](./bookings/parking.md)

---

## Request status (`/parkings/requests/:bookingId`)

**`ParkingRequestStatusPage`** — public guest status page for a submitted parking request.

- Focused flow: marketing nav/footer hidden (same as property forms); uses **`MainLayout`** + **`GuestOperationalHeader`** shell. Same card rhythm as **`/parkings/:slug/form`**: **`GuestFormBrandHeader`** (circular cover, location eyebrow, status headline as title) → **`ParkingStaySummary`** → **`ParkingFlowStepper`** (Match · Pay · Done) + status body — no nested bordered status card.
- Page title: **`{Parking or org name} - Parking Request`**; favicon uses org logo or slot cover when available
- Initial load + refresh path: **`get-parking-booking-status?bookingId=`** (also returns `parkingName`, `coverImage`, `brandColor`, `logoUrl`, `residenceName` for the guest shell)
- Returned fields: status, stay dates, expiry time, organization label, slot label after claim, optional host endorsement note, the active dispatch batch number, and (Phase 5) endorsement send status, an in-app copy of the sent endorsement email, host contact (once endorsement is sent), and the platform support/escalation phone
- Polls every 4 seconds until a terminal or claimed status is reached
- Stay dates: compact readable range (**Sep 24-28, 2026**) via `formatStayDateRange` / **`ParkingStaySummary`** (same component as the request form)
- Shared guest/host/property status copy: **`ui/src/lib/parking/parkingFlowCopy.ts`** — brand header title uses `headline` per status so form → status feels like the next step
- Shared motion: **`parkingFlowMotion.ts`**
- Shared stepper (form + status + host detail): **`ParkingFlowStepper`** — uppercase label trail (**Guest · Booking · Vehicle** / **Match · Pay · Done**), active step emphasized, `n/total` fraction, segmented primary bars — never a centered icon rail or single-title-only mode
- **Registration form:** auth required; **Which stay?** chooser when linkable stays exist → confirm & submit for linked stays, or **Different booking — enter details** → `ParkingFlowStepper` (Guest · Booking · Vehicle); no chooser when none
- **Waiting UX:** animated **`ParkingHostSearchVisual`** (radar pulse) while finding a host; compact countdown row (“Updates within · MM:SS”) + thin drain bar — not a giant timer
- While finding a host: **Cancel request** only; browse appears on terminal / paid
- **Pay to confirm:** **Pay now** + cancel; short non-refundable note
- Paid: slot + access; host/endorsement under fold; support phone after pay / terminal
- `NO_HOST_AVAILABLE` / `CANCELLED`: short detail + **Browse parking**
- Host booking detail uses the same **Match · Pay · Done** stepper for pending/payment/review

Security / access notes:

- The page reads by booking UUID only; there is no list endpoint
- Missing and non-parking rows both return the same not-found behavior, so guests cannot enumerate other bookings

---

## Implementation map

| Concern                 | Path                                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| List page               | `ui/src/features/guest/marketing/pages/ParkingsListPage.tsx`                                                                                                                                                                                     |
| Detail page             | `ui/src/features/guest/marketing/pages/ParkingDetailPage.tsx`                                                                                                                                                                                    |
| Overview                | `ui/src/features/guest/marketing/parkings/components/ParkingOverview.tsx`                                                                                                                                                                        |
| Gallery                 | `ui/src/features/guest/marketing/shared/components/ListingGallery.tsx`                                                                                                                                                                           |
| Host card               | `ui/src/features/guest/marketing/shared/components/ListingHostCard.tsx`                                                                                                                                                                          |
| Place meta              | `ui/src/features/guest/marketing/shared/components/ListingPlaceMeta.tsx`                                                                                                                                                                         |
| Public host             | `ui/src/features/guest/marketing/properties/hooks/usePublicHost.ts` + `HostPublicPage` (`parkings` from `get-public-host`; `HostPublicListingsTabs` when both types; **4 rows**/page via `useHostListingPageSize`; inline pagination on tab row) |
| Public hook             | `ui/src/features/guest/marketing/parkings/hooks/usePublicParkingDetail.ts`                                                                                                                                                                       |
| Reserve modal           | `ui/src/features/guest/marketing/parkings/components/ParkingBookingFormModal.tsx`                                                                                                                                                                |
| Reserve hook            | `ui/src/features/guest/marketing/parkings/hooks/useParkingReserve.ts`                                                                                                                                                                            |
| Parking form            | `ui/src/features/guest/marketing/pages/ParkingFormPage.tsx`                                                                                                                                                                                      |
| Form component          | `ui/src/features/guest/marketing/parkings/components/ParkingRegistrationForm.tsx`                                                                                                                                                                |
| Form schema             | `ui/src/features/guest/marketing/parkings/lib/parkingRegistrationSchema.ts`                                                                                                                                                                      |
| Form steps              | `ui/src/features/guest/marketing/parkings/lib/parkingRegistrationSteps.ts`                                                                                                                                                                       |
| Request status          | `ui/src/features/guest/marketing/parkings/pages/ParkingRequestStatusPage.tsx`                                                                                                                                                                    |
| Submit hook             | `ui/src/features/guest/marketing/parkings/hooks/useSubmitParkingBookingRequest.ts`                                                                                                                                                               |
| Status hook             | `ui/src/features/guest/marketing/parkings/hooks/useParkingBookingStatus.ts`                                                                                                                                                                      |
| Pay-now hook            | `ui/src/features/guest/marketing/parkings/hooks/useCreateParkingPaymentCheckout.ts`                                                                                                                                                              |
| Cancel hook             | `ui/src/features/guest/marketing/parkings/hooks/useCancelParkingBooking.ts`                                                                                                                                                                      |
| Endorsement resend hook | `ui/src/features/guest/marketing/parkings/hooks/useRequestParkingEndorsement.ts`                                                                                                                                                                 |
| Shared flow copy        | `ui/src/lib/parking/parkingFlowCopy.ts`                                                                                                                                                                                                          |
| Shared motion           | `ui/src/lib/parking/parkingFlowMotion.ts`, `ui/src/components/parking/ParkingFlowStatusIcon.tsx`                                                                                                                                                 |
| Shared stepper          | `ui/src/components/parking/ParkingFlowStepper.tsx`                                                                                                                                                                                               |
| Host search visual      | `ui/src/components/parking/ParkingHostSearchVisual.tsx`                                                                                                                                                                                          |
| Stay chooser / confirm  | `ParkingStayChooser.tsx`, `ParkingLinkedStayConfirm.tsx`, `parkingRequestEntryCopy.ts`                                                                                                                                                           |
| Chat sheet              | `ui/src/features/guest/marketing/parkings/components/ParkingChatSheet.tsx` — on `ResponsiveModal`/`GuestDialogShell`-style primitives as of 2026-09-10 (was raw `Dialog` despite the "Sheet" name; same fix as `ContactHostSheet`)               |
| Linkable-stays lookup   | `ui/src/features/guest/marketing/parkings/hooks/useLinkableParkingBookings.ts`, `supabase/functions/list-linkable-property-bookings/index.ts`, `supabase/functions/_shared/parkingPropertyLink.ts`                                               |
| Endorsement send        | `supabase/functions/_shared/parkingEndorsementEmail.ts`, `supabase/functions/request-parking-endorsement/index.ts`                                                                                                                               |
| Public detail           | `supabase/functions/get-public-parking/index.ts`                                                                                                                                                                                                 |
| Submit edge             | `supabase/functions/submit-parking-booking-request/index.ts` (guest-authenticated)                                                                                                                                                               |
| Status edge             | `supabase/functions/get-parking-booking-status/index.ts`                                                                                                                                                                                         |
| Pay-now edge            | `supabase/functions/create-parking-payment-checkout/index.ts`                                                                                                                                                                                    |
| Cancel edge             | `supabase/functions/cancel-parking-booking/index.ts`                                                                                                                                                                                             |
| Payment orchestration   | `supabase/functions/_shared/parkingPaymentOrchestrator.ts`, `supabase/functions/_shared/parkingCancellation.ts`                                                                                                                                  |
| Location page           | `ui/src/features/guest/marketing/pages/ParkingsLocationPage.tsx`                                                                                                                                                                                 |
| Grouping                | `ui/src/features/guest/marketing/parkings/lib/groupParkingsByLocation.ts`                                                                                                                                                                        |
| Place groups            | `ui/src/features/guest/marketing/shared/hooks/usePublicPlaceGroups.ts` + `list-public-place-groups`                                                                                                                                              |
| Entry builder           | `ui/src/features/guest/marketing/parkings/lib/parkingListEntries.ts`                                                                                                                                                                             |
| UI components           | `ui/src/features/guest/marketing/parkings/components/*`                                                                                                                                                                                          |
| Slot cards              | `ui/src/features/guest/marketing/developments/components/ParkingSlotCard.tsx`                                                                                                                                                                    |
| Filters / sort          | `ui/src/features/guest/marketing/developments/lib/parkingSlotFilters.ts`                                                                                                                                                                         |
| Routes                  | `ui/src/features/guest/marketing/routes/index.tsx`                                                                                                                                                                                               |
| Nav link                | `ui/src/features/guest/marketing/shared/components/MarketingNav.tsx`                                                                                                                                                                             |
| Scroll search           | `ui/src/features/guest/marketing/shared/lib/listingScrollSearchPaths.ts`                                                                                                                                                                         |
| Search default          | `ui/src/features/guest/marketing/shared/lib/listingSearchDefaultLocation.ts`                                                                                                                                                                     |
| Parking spec            | `.cursor/rules/parking-workflow.mdc`                                                                                                                                                                                                             |
| Per-dev list            | `/developments/:slug/parking` — see [developments.md](./developments.md)                                                                                                                                                                         |

---

## Testing

| Layer | Path / spec                                                 | Manual           |
| ----- | ----------------------------------------------------------- | ---------------- |
| Unit  | `parkingStatusMachine_test.ts`                              | —                |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) | PayMongo `@live` |

---

## Related

- [properties.md](./properties.md) — homes list pattern this mirrors
- [developments.md](./developments.md) — development-scoped parking browse
- [form.md](./form.md) — property guest form's parking interest toggle, the other half of the Phase 7 link
- [org/property/bookings-detail.md](./org/property/bookings-detail.md) — where a linked, paid parking booking shows up for the host
