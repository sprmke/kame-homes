---
title: 'Unfiled draft backlog'
status: archived
tags: [todos]
updated: 2026-08-02
---

# Unfiled draft backlog

> **Not GitHub Issues.** This file holds legacy roadmap items migrated from the former `docs/TODOS.md`. Filing into [GitHub Issues](https://github.com/sprmke/kame-homes/issues) is a separate future action — see [`README.md`](./README.md) for the live backlog workflow.
>
> **Excluded:** The shipped booking-flow phase tracker (lines 1–43 of the old file) lives in [`shipped/booking-flow-phases.md`](./shipped/booking-flow-phases.md).

---

Todos

- ✅ In dev env, if we enable google calendar & sheets, let's add [TEST] on title to easily determine that it's a test booking
- ✅ I noticed that on prod, we have a lot of booked dates, we should filter it to not include past dates from today because all past dates are automatically disabled from the calendar. We should only get future book dates from today. It's better if we implement this filter from the API & DB call for faster performance instead of UI filtering
- ✅ Add a "Same as Facebook/Airbnb Name" checkbox beside Primary Guest - Name, and when they check it, we should get and pre-populate the same value of facebook name field to primary guest name and then we should disable the field
- ✅ When user try to submit or update the form. We should do a form data difference checking. And only proceed on updating the db, sending email, updating calendar, etc ONLY if we detect that there's a data changed from the form. If there's no difference, just redirect to success page
- ✅ Handle and send different email when we updated the form details. The email content would be something like this: "The GAF details has been updated. Please disregard the previous GAF Request email for the same dates for our unit". Please improve our text message
- ✅ On the success page, let's add a info box that has the "Next steps" text. We should say that "We now send your Guest Advise Form (GAF) to Azure and we just need to wait for the approved form. Please check your email about this after a day or two. If there's still no reply on approved GAF, please reach out to our Facebook page so that we can manually follow up and call Azure for it. Thank you chuchuchu.."
- ✅ In dev env ONLY, instead of relying on query parameter on what action should be done on API, can we display a card with multiple checkboxes if we will save the data on the db, save image assets on supabase storage, generate pdf, send email, update calendar or update google sheet. By the default, all of these are uncheck on DEV env
- ✅ In prod, let's add 'testing=true' query parameter to determine that this is a TEST booking submission
- ✅ When booking is more than 1 night, we should update the title of the email title to <CheckIn Date> - <CheckOut Date>
- ✅ On checkout date calendar, we don't have the highlight for multiple nights
- Update guest form to a stepper? And add preview for final booking screen.
- ✅ When we are on dev mode and testing=true is enabled, let's modify our content
  - Save to db: primary_guest_name. Prefix '[TEST]' ex. '[TEST] Rene Anne Tolentino'
  - Save images to supabase storage. Prefix '[TEST]' to our images
  - Generate PDF: Prefix '[TEST]' to primary guest name
  - Send email notification: Prefix '[TEST]' to email subject title. ex. '[TEST] Monaco 2604 - GAF Request (11-28-2025)'.
    - Let's also modify the email content to add: "This is just a test email, please ignore.' Please improve our message content
  - Update google calendar: Prefix '[TEST]' to calendar event title. ex. '[TEST] 2pax 2nights - Kyle Soriano'
  - Update google sheets: Prefix '[TEST]' to sheet 'Primary Guest Name' column. ex. '[TEST] Rene Anne Tolentino'
- ✅ Let's update the email title and content to use book range like <CheckIn Date> to <CheckOut Date> instead of just CheckInDate
- ✅ Let's use sprmkedev for google sheet and google calendar updates on dev env
- ✅ When we visit an existing booking and we are on dev/test mode, let's add a new button to cancel a booking which will cleanup and remove our data to different services
  - Update db status to 'canceled'
  - Update the google calendar event as canceled
  - Update google sheet entry to canceled
- ✅ Add URGENT label and icon on email for same day booking
- ✅ When guest encounter an error and the guest form failed to submit. It's very hassle if user will fill up the form again. I want us to implement a copy button on toast message when we encounter an error and display the toast message. When we click this button, the guest can copy all information so that they can paste it on our Facebook messenger.
  - ✅ Then, on our dev controls, there should be a button there called "Paste booking information from clipboard", and when we click it, it will autopopulate our form based on the booking information the guest copy pasted. And with this, we can easily resubmit the guest form without typing all information again.
  - ✅ Please think or plan or generate the best booking information structure that is user friendly but still be able to easily imported from our system
- ✅ Disable Send email notification on production even when testing=true is enabled
- ✅ Move generate new data to dev controls section above clean up button
- ✅ Add please check your email message under email address input
- ✅ Add &admin=true or &testing=true on View/Update Guest Form on Google calendar
- ✅ Use kamehome.spaces on calendar summary link
- ✅ Add "Cancel Booking" action on dev tools. When user clicks this, we should remove all information from database, assets from supabase storage, google calendars & sheets. Basically, cleanup all booking data that's related to it.
- ✅ We have this weird issue where if I select Jan 20 as check-in date, the Jan14, 15 and 17 which are already booked enabled which is very incorrect!
- ✅ Instead of doing all the data cleanup when we cancel a booking, is it possible keep all the data information from database, assets, google calendars and sheets, etc. Basically, keep all our data when canceling a booking, just open the booked dates from our booking calendar so that it will be selectable again to book, then update the google calendar to display "Canceled" (if you can make it red color for calendar event much better), also add a new column in google sheets for status "Booked" | "Canceled"
- ✅ Create separate email for pet information
- ✅ Add a new field for 'Has paid surprise setup/decorations' checkbox and create a new reminder for this (email or calendar?). Add a label note on this field — refine scope in [[NEW_FLOW_PLAN|New Booking Flow — Implementation Plan]] §6.2 **Q7.4** (placement/copy partial lock in §6.1).
- ✅ Create separate email for parking information
  - add a admin fields & button to trigger email sending of parking information
  - we should have dropdown of email so we can easily send the parking information to parking owner & azure
- ✅ Lets update the / root route to render the calendar page and create a new route called "/form" to render the guest form page. So that when user visit our sites, they are required to select dates first
- ✅ Cleanup test-booking pipeline (`?testing=true`, `is_test_booking`, admin test filters, `[TEST]` prefixes, `cleanup-test-data`) — use local/staging Supabase instead
- ✅ Improve the overall UI of our email templates which the same and consistent theme, font, shadows, spacing and colors. Make a research on popular and modern/stunning email templates to use as reference. Make it a very elegant, stunning, modern and eye-catching email templates that supports different browser/email platforms. Make sure we don't break anything and dynamic values should still populate. Just improve the overall email templates UI.
- ✅ Guest SD refund route **`/sd-form`** (UI stepper: Facebook review step → refund method: GCash same as on-file phone (number shown on the option card), other bank dropdown + name + account number, cash pickup with static policy copy only). Honesty-store purchase step skipped by design. **`READY_FOR_CHECKOUT`** status, cron → details, guest **`submit-sd-form`** → **`PENDING_SD_REFUND`** via orchestrator (no DB triggers).
- ✅ Improve and finalize update guest form flow
  - Only revert booking status to `PENDING_REVIEW` when updates come from:
    - Guest update from the public `/form` flow
    - Admin update from the `/bookings/:bookingId` detail form
  - AND ONLY IF one or more of the following fields changed:
    - Facebook / Airbnb Name
    - Primary Guest name
    - Email
    - Phone Number
    - Additional Guest Names
    - Check-in and Check-out Date
    - Check-in and Check-out Time
    - Parking Details
    - Pet Details
    - Downpayment receipt
    - Valid ID
    - Pet vaccination and pet photo
  - If updates do not include the listed fields, do **not** reset status to `PENDING_REVIEW`
  - Revert applies only while status is **pending documents** (`PENDING_DOCUMENTS` / `PENDING_GAF` / `PENDING_PARKING_REQUEST` / `PENDING_PET_REQUEST`) or **`READY_FOR_CHECKIN`** — not when already `PENDING_REVIEW`, in SD refund stages, `COMPLETED`, or `CANCELLED`
- ✅ Remove PDF generation process when guest submits the guest form: 2026-04-29T20:21:44.178173637Z [Info] Generate PDF: ✅
- ✅ Improve the mobile responsiveness and look of email templates on mobile
- ✅ Support 'Mark as incomplete' to sub booking status?
- ✅ Update SD refund form UI (stepper, no feedback field, Facebook-first then Continue, optional `guestFeedback` on API)
- ✅ **Next-stay Facebook-review voucher** — after the guest taps "Review us on Facebook" on `/sd-form`, swap the greeting for a slot-machine voucher reveal (`VoucherReveal`). New `claim-sd-voucher` edge function idempotently rolls a code from `VOUCHER_WIN_WEIGHTS` (`KAME-100`/`150`/`200` **2%**; `KAME-250`/`300`/`350` **~28%**; `KAME-400`/`450` **3%**; `KAME-500` **2%**; `KAME-1000` **1%**; **`KAME-STAY` free staycation** **0.5%**) and persists `next_stay_voucher_code` / `_amount` / `_awarded_at` on `guest_submissions`. Admin Pricing card surfaces the voucher when status = `COMPLETED`. Migration: `20260606120000_next_stay_voucher.sql`.
- ✅ Display QR or gcash link (gcash://send?mobile=09625412941&amount=500&note=test) on Pending SD Refund step for admin to easily do the SD payment
- ✅ Update ready for check-in email to add generated Gcash QR or link for the total balance payment upon check-in
- ✅ Update booking flow when guest is coming from Airbnb.
  - ✅ Public guest form: `?source=airbnb` switches all "Facebook" labels/text to "Airbnb". Source saved to DB (`booking_source` column), Google Calendar description, and Google Sheets (new AL/BA column).
  - ✅ Booking Detail page: `booking_source` shown in Other Information card with color-coded badge (blue=Facebook, orange=Airbnb). Airbnb bookings default Down Payment = 0, Security Deposit = 0 in the Review Pricing form.
- ✅ **Surprise decor** — `guest_requests_surprise_decor` + `surprise_decor_staff_acknowledged` (migration **`20260610120000_surprise_decor.sql`**). Public form: checkbox + Airbnb/Facebook info (above special requests). Other Information card + Review pricing staff confirmation below total balance; **Proceed to Pending Documents** disabled until confirmed when decor is requested. Admin edit form + workflow-sensitive revert parity.
- ✅ **Guest account + host public profile** — explore nav avatar → **`/account/*`** (profile, stays, wishlist, messages); edge **`guest-profile`**, **`guest-trips`**, **`guest-messages`**, **`upload-guest-profile-asset`**; **`guest_profiles`** + **`guest_submissions.guest_user_id`** migration; **`/hosts/:orgSlug`** uses team owner OAuth profile + org team display name. Guide: **[[profile|Guest account — operator guide]]**.
- Rethink and plan how to mange parking request
- ✅ Add total profits and expenses on booking detail pricing section
- ✅ **Property Pricing page (`/pricing`) E2E** — migration `20260910130000_property_pricing.sql` (`app_settings` rate/fee columns + `property_pricing_date_overrides`); edge function **`property-pricing`**; UI save/load; **`ReviewPricingForm`** + booking edit use saved defaults + date overrides (Fri–Sun weekend rule). Guide: **[[guides/routes/org/property/pricing|Pricing — legacy route]]**.
- ✅ **Finance dashboard (`/finance`)** — Overview KPIs, Stays ledger (period basis check-in / check-out / completed), **Transactions** CRUD (`finance_line_items`), PDF export (client-side; `finance-export` CSV edge function retained for scripts). Shared formulas in `bookingFinance.ts` (UI + edge). Admin nav **Finance** replaces Reports placeholder.
- ✅ **Maintenance dashboard (`/maintenance`)** — Overview KPIs, **Reminders** CRUD (`maintenance_items`), Telegram settings for **Kame Home - Maintenance** group, PDF export. No income/expense/stays.
- Only mark sub booking status to incomplete, when specific edited fields needs approval for specific document
- ✅ Automatic run cron job functions (specify here) after page refresh
- ✅ If booking date is already past on the date today and the booking status is still either PENDING_REVIEW, PENDING_DOCS and READY_FOR_CHECKIN, display a modal warning that says that the booking date is already passed every time we click the "Proceed to.." button. If they confirm, proceed to next step, if cancel, do not proceed.
- ✅ Automate booking flow for cleaners/staff as well
  - ✅ Telegram notification to staff/cleaner group — daily booking summary at configurable time (default 8:00 AM Manila) via `telegram-staff-cron` + `pg_cron`
  - ✅ Each booking contains check-in/out dates+times, pax, primary guest name+phone, decor/pet status, special requests, total guest balance, booking link
  - ✅ Includes next 3 days booking summary
  - ✅ Configurable template with `{{placeholder}}` tokens on `/staff` admin page (`TelegramStaffSettingsCard`)
  - ✅ Enable/disable toggle + time picker + test sends
  - ✅ Instant same-day check-in alert to staff group when guest submits at or after the daily summary time (one-time per booking)
  - Notification for guest check-out
    ✅ IMPROVED PAY PARKING FLOW
- ✅ Public **`/bookings/:bookingId/parking`** (`PayParkingPage`) — booking summary + vehicle fields; **`get-pay-parking`** / **`submit-pay-parking`**
- ✅ **`/bookings/:bookingId`** header **Add pay parking** / **View pay parking** + **`PayParkingModal`** (rate, copy URL, enter details)
- # ✅ Submit runs **`sendParkingBroadcast`** (same as workflow parking broadcast)

PAY PARKING -> PARKING OWNERS -> OUR GUESTS

- Improve public guest form
- ✅ **`app_settings` + Admin → Settings** — email routing, automation knobs, guest URLs (DB per property; platform secrets stay in Supabase Edge env). **Parking rate default** is edited on **Pricing** only (`property-pricing` → `default_parking_rate_guest`).
- Add ability to multi-select when doing broadcast email on update and add? parking
- Notification for guest check-out

- Display carousel on the top background that auto slides to show different unit pictures/amenities
- ✅ **AI payment receipt validation** — Gemini Flash vision on downpayment receipt (`submit-form`), balance receipt (`upload-booking-asset`), and parking payment receipt (`ParkingRequestForm` / `parking_payment_receipt`); results in New Booking Request email, admin Telegram templates, and admin UI. Invalid balance and parking receipts block workflow transitions.
- Use AI to analyze and validate other guest uploaded assets (valid ID, pet docs, etc.)
- Persist dev query parameters on booking summary and booking detail pages on route change (optional polish)
- Combine GAF request and pet request in one email when sending to Azure
- Optimize and reduce size of image before uploading to supabase storage
- Improve email template house rules
- ✅ **Property Templates → workflow sends:** `emailService.ts` reads **`property_template_contents`** for the seven **email** keys via **`propertyTemplateEmail.ts`** (WYSIWYG body + send shell). Dynamic sections (tables, payment, CTAs) use **`{{placeholders}}`** filled by **`propertyTemplateEmailSections.ts`**; preview uses the same renderer as send.
- **Property Templates → standard sections (pending):** Use **`house-rules`**, **`check-in-instructions`**, **`check-out-instructions`**, **`parking-reminders`** in guest-facing emails or links (e.g. inject house rules into ready-for-check-in when Gmail size allows). Standard keys are editable in admin today but not consumed at send time.
- **Property Templates → custom templates (pending):** Define send targets or guest-facing use for `custom-{uuid}` rows.
- Review edit booking info form
- [x] **Remove legacy booking statuses from Bookings.** Dropped **`booked`** and **`canceled`** from list/filters/kanban/sort/Telegram/calendar paths; removed `LEGACY_BOOKING_STATUSES` / `AnyBookingStatus`. Migration `20260714120000_backfill_legacy_booking_statuses.sql` backfills any stragglers.

- ✅ **Auto-advance PENDING_DOCUMENTS → READY_FOR_CHECKIN** when all required sub-steps (GAF, parking if needed, pet if needed) are complete — `workflowOrchestrator.ts` recursive transition on `document_completion_target` (gmail-listener, parking form, reconciliation).
- Update google calendar summary info with new guest form and processes
- Review and improve form UI validation on workflow status forms
- Review bucket policy to check public buckets and convert them to private?
- On Booking detail page, we need to reuse our check-in and check-out date calendar components to see which dates are booked and available
- ✅ Add additional rate on Pending Review form (early check-in, late check-out, surprise decor, etc)
- [x] Remove the ability for guest to update the guest form AFTER booking is reviewed by admin and not on PENDING_REVIEW status anymore
- ✅ Remove `dev=true` / legacy control query params from guest URLs, calendar links, and `submit-form` (FormData flags; production forces full path)
- ? Only display Sensitive edit warning on edit booking detail page
- We should add label for additional fee and update the ready for check-in email what's the additional fee is about
- Update Review process to deduct P50-P100 pesos on SD?
- Add settings page on dashboard to customized form values: Discount vouchers, etc → see **Platform & guest experience roadmap → Vouchers**
- Update Check-in Details email to add check-in instructions
- ✅ Add Gcash number and name to Check-in email
- Update public guest form to allow selection of date without check-out date for day tour bookings and minimum of 12pm as check-in time and subject for approval message
- ✅ Cleanup isDevMode / `?dev=true` — non-prod panel only; strip legacy URL keys app-wide
- Update booking confirmed UI and display the complete booking details
- Improve Other information section UI / cols
- Update saved reply or auto-reply form link to include the full name of recipient to query parameter of our guest form link, then parse it and pre-populate facebook name if we get a valid FB name
- Update additional guests and ask if adult or child (below 3 years old) per field
- ✅ Support slack and telegram notifications for important booking events
- New booking requests — instant on submit + hourly while Pending Review (Operations Telegram)
- ✅ If we received a same day booking, notify on Staff telegram group — instant alert at/after daily summary time on guest submit (`notifyTelegramStaffSameDayCheckIn`)
- ✅ Make the QR code image configurable via settings using image uploader. Update public guest form and check-in email to use this uploaded QR image
- ✅ Improve SD form to include chance to win free staycation if you leave a review (`KAME-STAY` at **0.5%** via `VOUCHER_WIN_WEIGHTS`; `VoucherReveal` copy + slot reel)
- Support same-day check-in
- Add password or faceid when accessing settings page? → see **Platform & guest experience roadmap → Settings security**
- ✅ Update GAF details to be configurable via settings — **Admin → Settings → GAF Details** with live PDF preview; guest submit + `submit-form` use resolved values
- Improve light theme colors
  Multi-tenancy — phase tracker (see [[PROJECT|Guest Form Management — Project Documentation]] multi-tenancy section):

- ✅ **Phase 1a — DB + org/property CRUD.** Migration `20260629180000_multi_tenancy_foundation.sql`; `organizations` / `properties`; `property_id` on bookings + settings tables; RLS owner-only; edge functions `create/list/update-organization`, `create/list/update-property`; `orgAuth.ts` + `verifyAdminJwt` org-owner path.
- ✅ **Phase 1b — Routing + UI shell.** Nested admin routes `/org/:orgSlug/property/:propertySlug/...`; org switchers; onboarding; legacy flat-route redirects; `RequireOrgContext` / `PropertyAdminShell`.
- ✅ **Phase 1c — Property scoping.** `resolveAdminPropertyId` / `resolvePublicPropertyId`; admin list/dashboard/finance/maintenance/app-settings/telegram endpoints + UI hooks send `property_id`; `transition-booking` verifies booking property; public `get-booked-dates` + `submit-form` accept `?property=` slug (default Monaco 2604).
- ✅ **Phase 1d — Remaining admin + guest scoping.** `cancel-booking`, `sync-booking-integrations`, `upload-booking-asset`, `upload-app-settings-asset`, `finance-export`, `validate-booking-receipts`, `send-sd-refund-form-email`; per-property Gmail OAuth (`20260629210000_gmail_oauth_per_property.sql`); guest calendar/form pass `?property=` to `get-booked-dates` + `submit-form`; admin UI hooks send `property_id` on manual triggers and uploads.
- ✅ **Phase 1e — Cron + listener per property.** `gmail-listener` per-property OAuth + history cursor; `sd-refund-cron` per-booking settings; telegram crons iterate properties with scoped bookings/line items; booking asset storage paths prefixed with `property_id`.
- ✅ **Phase 1f — Property-scoped integrations (shipped).** Per-property encrypted Telegram bot token + chat id on each `telegram_*_settings` row (**DB-only** — no env fallback); `google_calendar_id` / `google_spreadsheet_id` on `app_settings`; operator settings in `app_settings` resolve from DB only; legacy `GMAIL_OAUTH_TOKEN_JSON` env path removed; **`emailService.ts`** resolves routing/GCash/branding from `booking.property_id`; `create-property` seeds all settings rows; marketing/staff crons use 5-min dispatch + per-property Manila schedule matching (migration `20260629160000_property_scoped_integration_credentials.sql`); Calendar/Sheets/Gmail/Telegram resolve from property DB. Admin UI: all five Telegram pages expose bot token + chat id fields; Settings → Integrations shows **per-property** status (Property / Missing) + **Platform (shared env)** section (Resend, service account, Gmail OAuth app, Gemini/Groq). Migration `20260702190000_service_role_grants_gmail_maintenance_finance.sql` fixes Edge `service_role` grants.
- ✅ **Phase 2g — Connect Google (shipped).** Single OAuth flow requests Gmail + Calendar + Sheets scopes (`GOOGLE_CONNECT_OAUTH_SCOPES` in `gmailMailOAuthAccess.ts`). On connect, **`propertyGoogleOAuthProvision.ts`** auto-creates calendar (`Kame Home — {property}`) + spreadsheet (Bookings tab + header row A–BA) when IDs are missing; persists to `app_settings`. **`propertyGoogleApiAuth.ts`** uses per-property user OAuth for Calendar/Sheets API calls when connected; service account remains legacy fallback. Settings → Integrations: **Connect Google** only (no manual Calendar/Sheet ID fields). **`propertyGoogleIntegrationSeed.ts`** (2g.4): when **`create-property`** adds a property to an org that already has Google connected on a sibling, copies the encrypted refresh token and auto-provisions calendar + sheet for the new property.
- ✅ **Phase 2h — Multi-tenant operator UX (shipped).** Property dashboard **Needs attention** strip includes **Connect Google** when Gmail/Calendar/Sheet are not ready (links to Settings). Org **Properties** list exposes per-property **Guest calendar** link + copy (`PropertyGuestLinkButton` + `guestPublicPaths.ts`). Onboarding and **Add property** land on **Settings** (not dashboard) so Connect Google is the next step.

**Multi-tenancy — team module (shipped — property scope v1):**

- [x] Property team UI shell (`/org/.../property/.../team`) — mock data, PMA port
- [x] Property role model finalized — `MANAGER` \| `STAFF` \| `VIEWER` (see team route guide)
- [x] RBAC contract + `propertyTeamPermissions.ts` + team route guide
- [x] DB migration — `property_members`, `property_custom_roles`, `property_invitations`
- [x] `verifyPropertyAccess` in `orgAuth.ts` (owner / platform admin / active member)
- [x] Team edge functions (`property-team-members`, `property-team-invitations`, `property-team-custom-roles`, `accept-property-invite`)
- [x] Wire Team UI to API (`usePropertyTeam`)
- [x] Property team invite email (Resend) + `/accept-invite` page
- [x] Enforce permissions on property-scoped admin edge functions + sidebar/route guards
- [x] Org-level team UI + API (`/org/:orgSlug/team`, `organization_members`, `organization_invitations`)

**Property team module (v1) is shipped.** **Org team v1** is shipped (Owner + Admin; org settings PATCH remains owner-only). Pre-ship hardening (accept-invite compile fix, invite email rollback, resend rollback, orgId fallback, reactivate preset, last-manager guard, self-action blocks) applied.

**Still out of scope (org-level team follow-ups):**

- Per-org permission matrix beyond **Owner + Admin** (no granular org roles yet)
- Org settings / danger zone for org ADMIN (server still owner-only for PATCH)
- [x] Org + property route guards + sidebar nav filtered by **`org-access`** / **`property-access`**

**Multi-tenancy — optional hardening (real backlog when prioritized):**

- Tighten Postgres RLS on `guest_submissions` / settings tables beyond edge-function ownership checks (today: broad public read/write on guest rows from legacy migration; admin scoping is server-side)
- Require `?property=` on all public guest URLs (remove Monaco 2604 default in `propertyScope.ts` when every property has a slug link)
- Google Cloud: Calendar + Sheets APIs enabled on OAuth consent screen for the Web client
- Optional: calendar/spreadsheet picker instead of auto-create on Connect Google

---

- ✅ Fix issue where google calendar is taking up more than 1 date for multiple nights booking. Meaning, if we have 2nights, it should only take 2 calendar dates instead of 3
- Add quick edit on bookings page
- Support free booking (payment related steps/action not required, etc)
- Triple check security measures on our app
- ✅ **AI validation multi-provider fallback** — multi-key Gemini rotation (`GEMINI_API_KEYS`, comma-separated from different Google Cloud projects) + Groq Llama 4 Scout fallback (`GROQ_API_KEY`). Round-robin across Gemini keys; 429/5xx on one key skips to next; when all Gemini keys exhausted, falls back to Groq free tier. Same prompts + JSON schema across both providers.
- ✅ Implement AI validations to valid id
- ✅ When the booking is from Airbnb, we need to hide the payment step and review other flows
  - ✅ Guest form: Payment step (step 5) hidden for Airbnb — form is 4 steps. `paymentReceipt` optional in schema, `findUs` auto-defaults to "Airbnb".
  - ✅ Server `submit-form`: allows missing payment receipt for Airbnb, skips downpayment receipt AI validation.
  - ✅ Admin `BookingEditForm`: Downpayment receipt row hidden in Documents section for Airbnb bookings.
  - ✅ Ready-for-check-in email: Payment breakdown + GCash QR section hidden when total balance due is 0 (source-agnostic).
  - ✅ SD refund flow: skipped entirely when `security_deposit=0` — `READY_FOR_CHECKOUT` goes directly to `COMPLETED` (no SD form email, no guest SD form step). `sd-refund-cron` also skips SD=0 bookings for check-out email.
  - ✅ Guest balance settlement: Airbnb excludes booking rate / DP / SD from total guest balance (pet + additional fees only); receipt not required when total is ₱0; AI validation only when fee total > ₱0.
- Validate the receipt amount based on the type. Meaning, validate down payment receipt and it should match the 1500 min amount. Apply for others.
- Improve valid id validation to match the primary guest name, facebook name or additional guest names.
- ✅ When we encounter any issues related to gmail needs to reconnect, automatically display a modal with reconnect Gmail button (`GmailReconnectProvider` + `GmailReconnectModal`; status probe via `google-mail-oauth-status`; Gmail poll/backfill/transition errors open the modal).
- Instead of having 2 separate sections for GAF and Pet Details, we can use tab for the preview and use one form
- For Airbnb bookings, we can still ask for reviews without SD refund → see **Platform & guest experience roadmap → Guest reviews**

Multi-users/multi-tenant todos:

- ✅ **Guest Inbox (org-level) — Phase 0–5 shipped.** Route `/org/:orgSlug/inbox`; Meta OAuth (Facebook Messenger DMs); quick replies; AI suggest + optional auto-send. TikTok/Airbnb inbox channels **cancelled** (API limits). **Full roadmap:** [[guides/routes/org/inbox]] § Roadmap.
- [x] Guest Inbox — DM thread ID canonicalization + legacy migration on sync/webhook
- [x] Guest Inbox — thread list + message history pagination (infinite scroll / load earlier)
- [x] Guest Inbox — Meta backfill Graph pagination + `meta_backfill_*` state columns
- [x] Guest Inbox — incremental scroll sync (`meta-inbox-backfill` light + DB-only `social-inbox-threads`)
- [x] Guest Inbox — server-side search (loaded DB rows only) + empty state when `metaHasMore`
- [x] Guest Inbox — webhook preserves `participant_name`; Graph profile lookup for new threads
- [x] Guest Inbox — webhook subscribe failure surfaced on Channels row
- [x] Guest Inbox — attachment preview (inline) + friendly Meta send errors
- [x] Guest Inbox — automation platform toggles limited to Facebook + Instagram
- [x] Guest Inbox — Realtime RLS scoped to org owner / org ADMIN (`20260912120000_inbox_rls_permissions.sql`)
- [ ] **Operator E2E** — follow [[inbox-e2e-runbook|Guest Inbox — E2E runbook (local + staging)]] (Channels **Setup URLs**, Connect, Sync, webhook, reply) — manual Meta app + tunnel setup
- [x] Guest Inbox — Facebook Page picker when OAuth returns multiple Pages
- [x] Guest Inbox — Channels setup panel (webhook/OAuth URLs, sync backfill, OAuth error messages)
- [ ] Guest Inbox — Meta App Review submission (production Advanced Access)

**Guest Inbox v2 — see [[guides/routes/org/inbox]] § Roadmap for detail**

- [ ] Guest Inbox — **Instagram DMs** — blocked on Meta App Review / Advanced Access (skip until verified)
- [ ] Guest Inbox — **background full sync** — persist all conversations to DB (cron/chunked backfill); refresh = DB only
- [ ] Guest Inbox — **full search** — after full sync, search entire inbox (remove scroll-only limitation)
- [x] Guest Inbox — **fix Pending filter infinite loader** when few filtered rows + `metaHasMore`
- [ ] Guest Inbox — **connect/disconnect audit** — no hangs, races, or partial cleanup (partial: OAuth state cleared on reconnect)
- [ ] Guest Inbox — **outbound media** — send photos/videos (Meta limits)
- [x] Guest Inbox — **media lightbox** — image/video preview modal in conversation
- [x] Guest Inbox — remove FB + IG comment support from inbox implementation and docs; keep Meta scope messages-only
- [x] Guest Inbox — **default 10 quick replies** — Airbnb/booking FAQ seed templates
- [ ] Guest Inbox — **quick reply attachments** — images/videos per template
- [x] Guest Inbox — **automation suggest-first** — AI fills composer; auto-send opt-in only
- [x] Guest Inbox — **AI booking/property context** — scoped facts injection + output guard (`inboxAiGuestContext.ts`, `inboxAiSafetyGuard.ts`); blocks finance/guest PII leaks
- [ ] Guest Inbox — **AI property showcase images** in suggestions
- [ ] Guest Inbox — **booking ↔ thread link** — booking detail open chat; inbox link/view booking; badges
- [ ] Guest Inbox — **conversation intelligence** — summary, high-potential / follow-up flags + actions
- [ ] Guest Inbox — **scheduled broadcast** — weekly/scheduled Meta messages
- [x] Guest Inbox — **desktop notifications** — browser notify when tab hidden (system sound where supported)
- [ ] Guest Inbox — property-level channel overrides
- ~~Guest Inbox — Airbnb Homes API partnership~~ **Cancelled** — no public Homes messaging API partnership; Channels is Meta-only.

**Marketing Content Studio — see [[marketing|Marketing — operator guide]]**

- [x] Backend — `marketing_templates` + `marketing_publications` (migration `20260917120000_marketing_studio.sql`)
- [x] Edge — `marketing-templates` CRUD + `publish-to-meta` (FB photo, IG post/story/reel video) + `generate-marketing-caption`
- [x] Meta OAuth — all inbox + publishing scopes on connect; setup guide in **[[meta-app-review|Meta app setup — Guest Inbox + Marketing Content Studio]]**
- [x] Content Studio UI — Calendar builder, Polotno design editor, **Remotion scene-based video editor** (multi-scene, transitions, 9:16/1:1/16:9), publish dialog + history on `/org/.../property/.../marketing`
- [x] Video editor — **saved templates** sidebar (dedicated Saved section, load `designJson.project`, **Update** on saved row)
- [x] Video editor — **drag text slots** on preview (fixed slots per scene layout; `%` positions in `textLayout`)
- [x] Video editor — **background music** (preset tracks + URL + volume; Remotion `Audio`; export includes audio when set)
- [ ] IG scheduled publish cron (rows stuck `pending` with future `scheduled_at`)
- ~~Guest Inbox — TikTok Business Messaging API~~ **Cancelled** — requires TikTok Business Messaging API approval; not feasible for v1.

---

## Platform & guest experience roadmap

### Guest reviews (SD refund + public property page)

- [x] **SD refund review step — in-app instead of Facebook redirect.** `/sd-form` step 1: star rating, Airbnb-style feedback pills (positive/constructive by score), optional text, photo upload (up to 3 images). `submit-guest-review` + `guest_reviews.feedback_tags`; public property page shows tags on Kame reviews.
- [x] **Airbnb bookings — reviews without SD refund.** `/properties/:slug/guest-review?bookingId=` — same in-app review + voucher flow when `security_deposit = 0` (after check-out, Manila). `get-guest-review` + extended `submit-guest-review` / `claim-sd-voucher` eligibility.

### External reviews and moderation

- [x] **Property settings — external review proof.** **Reviews & vouchers** → external reviews (up to 5; Facebook/Airbnb; screenshot + proof URL). Saved via `app-settings` PATCH; screenshots via `upload-app-settings-asset`.
- [x] **Public Superhost badge (display).** `isSuperhost` on public property UI when org has earned Superhost (`organizations.settings.superhost.earned`). _(Earned engine not shipped — badge off until assessment cron lands; see [`docs/workflow/planned/superhost-program.md`](../workflow/planned/superhost-program.md).)_
- [x] **Removed imported Airbnb Superhost proof** (2026-08-31). Dropped `app_settings.superhost_*` columns and property settings UI — earned-only going forward.
- [ ] **Super admin — external review moderation.** Approve/reject pending external reviews on `/admin/approvals` (Type = Reviews). _(Shipped for reviews; Superhost import moderation removed with earned-only pivot.)_

### Super admin & platform governance

- [ ] **Super admin role.** New platform role to manage **developments** and **organizations**; **approve/reject** new org and property listing requests before they go live.

### Settings security

- [ ] **Org/property PIN or password.** Optional PIN/password per org or property to gate sensitive settings areas — e.g. **payment**, **team management**, **templates**, and similar high-risk sections (extends existing “password on settings page” idea).

### Vouchers

- [x] **Property settings — voucher configuration.** Admin UI on **Reviews & vouchers** (`vouchers_enabled` + `voucher_prizes`); guest SD / guest-review respect enable; claim rolls property prizes.

### Property & org settings

- [x] **Contact info → team management (property + org).** Removed **Contact info** from property settings **Basic** and org settings **Basic**. **Team → Contact** on members (`display_name`, `contact_phone` on `property_members` / `organization_members`; owner self-edit on org team). `guestContactInfo` + public property host name resolve from team MANAGER → org owner (legacy settings fallback).
- [x] **Multiple payment methods.** Property settings **Payment**: add/edit/remove methods with one **primary**; `app_settings.payment_methods` JSONB + legacy column sync. Guest form payment step lists all methods; `get-guest-payment-info` returns `paymentMethods`.
- [x] **Parking rate source of truth.** Removed **default parking rate** from property settings → **Email automations**; **Pricing** page (`property-pricing`) is the sole admin editor for `default_parking_rate_guest`. Reads unchanged (`app_settings`, pay-parking, Review pricing, emails).
- [x] **Building forms defaults from team.** Property settings → **Building forms**: default **unit owner**, **on-site contact person**, and **contact no** from team MANAGER or org owner when GAF fields are not yet saved to DB (editable override after prefill).
- [ ] **Photos & videos — limits + room tags.** Property media: allow up to **10 images** and **1 video**. Support **tags** or **place/location** labels per asset (e.g. kitchen, living room, bathroom) for gallery filtering on public property pages.

### Onboarding

- [x] **Host onboarding + verification.** 3-step `/onboarding`: Organization → Hosting (property/parking/both + details) → Verify (valid ID + property/parking proof). Private bucket `org-verification-assets`; `upload-org-verification-asset` + `submit-org-verification`. Parking **Renting** / **Sublessee** capture **`parkingContractEndDate`**. Sidebar **Get Verified** for enhanced tier → public **Verified** badge. Super-admin approve/reject UI still open.
- [ ] **Parking lease reverification.** When **`organizations.settings.verification.parkingContractEndDate`** (Asia/Manila) is past, require hosts to re-submit parking proof and pass admin review again (cron or scheduled job + dashboard banner; listing visibility rules TBD). Onboarding + submit API store the date today; automation and super-admin workflow to finalize later.

### Guest ↔ host communication

- [x] **Public property page — guest chat (backend + inbox).** Web threads via **`platform=web`**; org Guest Inbox **Web** tab. Guide: **[[chat]]**.
- [x] **Contact host UX — Phase 0 + Phase 1.** Sheet-first on listing (Airbnb-style); auth on Contact host; **`/messages`** for return visits only. Guide: **[[chat]]**.
- [x] **Guest Messages hub (Phase 2).** Cross-property thread list + inline chat on `/account/messages` for signed-in guests.
- [ ] **Booking bridge in thread (Phase 3).** Host booking link / reserve CTA inside pre-booking chat.

### Help & support (per org)

- [ ] **Org help & support hub.** Per-org area for documentation/FAQs, feedback and bug reports, and email support contact — surfaced to org members from the dashboard.

### Notifications & observability

- [ ] **Real-time in-app notifications.** Push/toast/badge updates for key actions (bookings, inbox, team invites, review submissions, listing approvals, etc.) — beyond today’s Guest Inbox desktop notifications.
- [ ] **Sentry.** Integrate Sentry for client and edge/server error logging in production.

---

## Project improvements (tooling & DX)

**Status: shipped** (Jul 2026). Full audit + rename log: **[[naming-audit|UI filename audit]]**. Verify: `bun run check:filenames`.

Backlog for codebase quality, agent tooling, and local dev speed.

### A. Cursor / AI agent tooling (lean, token-aware)

**Goal:** Match useful patterns from **property-management-app** (PMA) without importing Next.js / tRPC / Drizzle rules.

- [x] **Index** — `.cursor/rules/README.md` (always-on vs conditional rules, skills, hooks, token budget)
- [x] **`docs-first` skill** — `.cursor/skills/docs-first/SKILL.md` (GFM doc paths)
- [x] **Stack terminology hook** — `.cursor/hooks/check-stack-terminology.sh` + wired in `hooks.json`
- [x] **Naming rule** — `.cursor/rules/naming-conventions.mdc` ([bulletproof-react](https://github.com/alan2207/bulletproof-react) aligned)
- [x] **PMA parity audit** — ported GFM-relevant rules/skills (see `.cursor/rules/README.md` § PMA parity map):
  - [x] Rules: `tech-stack`, `components`, `state-management`, `forms`, `security`, `public-ui`, `supabase-platform`, `accessibility`
  - [x] Skills: `supabase-stack`, `supabase-auth`, `tanstack-query`, `forms`, `emails`, `tanstack-table`, `multi-tenancy`, `integrations`, `component-generator`, `performance`
  - [x] Agent: `test-runner`
  - [x] Ensure `.claude/skills/` mirrors `.cursor/skills/` (see `.claude/skills/README.md` sync command)
  - [x] **Skipped:** `thinking-framework`, Drizzle, tRPC, Next.js, React Email monorepo, AWS S3, Zustand
- [x] **Agent onboarding** — [[PROJECT|Guest Form Management — Project Documentation]] §2 points agents at `.cursor/rules/README.md`

**Explicitly skip for GFM:** Next App Router, Drizzle, tRPC, React 19 RSC, Bun monorepo turbo patterns from PMA.

### B. File & directory naming consistency

**Standard (canonical):** `.cursor/rules/naming-conventions.mdc`

| Kind                          | Convention                        | Notes                                      |
| ----------------------------- | --------------------------------- | ------------------------------------------ |
| React components / pages      | `PascalCase.tsx`                  | e.g. `BookingTable.tsx`, `FinancePage.tsx` |
| Hooks                         | `usePascalCase.ts`                | e.g. `useBookings.ts`                      |
| lib / utils / schemas / types | `camelCase.ts`                    | e.g. `bookingStatus.ts`                    |
| Feature folders               | `kebab-case` if multi-word        | `guest-form`, `pay-parking`                |
| shadcn UI                     | keep `kebab-case.tsx`             | `dropdown-menu.tsx` — do not rename        |
| Edge functions                | `kebab-case/` folder + `index.ts` | existing pattern                           |

**Current drift (fix incrementally when touching files):**

- [x] Renamed **`bookingEditLayout.tsx`** → `BookingEditLayout.tsx`, **`telegramTemplateDialogContext.tsx`** → `TelegramTemplateDialogContext.tsx`
- [x] Renamed **`utils/booking-display.ts`** → `bookingDisplay.ts` (21 importers)
- [x] **Filename audit** — [[naming-audit|UI filename audit]] + `scripts/dev/check-ui-filename-conventions.sh` (`bun run check:filenames`, CI)
- [x] Align **`.claude/skills/`** mirror — synced from `.cursor/skills/`
- [x] ESLint **`unicorn/filename-case`** (warn) for `features/**/components`, `hooks`, `lib`
- [x] Document intentional exceptions in `naming-conventions.mdc`

**Do not** mass-rename without updating imports and logging in **[[naming-audit|UI filename audit]]**.

### C. Bun package manager + local dev without Docker (optional)

**Goal:** Faster installs and scripts; reduce RAM use when full local Supabase is not needed.

- [x] **`bunfig.toml`** + root scripts use `bun` / `bunx` (Supabase CLI still via `bunx supabase@latest`)
- [x] **`./dev.sh --ui-only`** / `SKIP_SUPABASE=1` — Vite only against remote Supabase (`ui/.env.development`)
- [x] **`bun install`** at root — **`bun.lock`** at repo root (remove **`package-lock.json`** / duplicate **`ui/bun.lock`** when committing)
- [x] Update **`docs/archive/operations/`** runbooks: `npm run` → `bun run` where applicable
- [x] **CI** — `.github/workflows/ci.yml` (Bun: type-check, lint, build)
- [x] **Docker / RAM** — documented in [[PROJECT|Guest Form Management — Project Documentation]] §2 (ui-only, stop stack, Docker resources)

**Acceptance:** `bun run type-check`, `bun run lint`, `bun run build`, and `./dev.sh` (full) still work; `./dev.sh --ui-only` works with remote env.

### D. Docs & scripts organization

- [x] **[[README|Documentation index]]** — master doc index
- [x] **`docs/archive/operations/`** — migration, deployment, cron, inbox E2E, Meta App Review runbooks
- [x] **`docs/planning/`** — `NEW_FLOW_PLAN.md`, `NEW_FLOW.md` (renamed from `NEW FLOW.md`)
- [x] **`scripts/README.md`** — script index by category
- [x] **Scripts subfolders** — `dev/`, `data/`, `deploy/`, `integrations/`, `preview/`
- [x] **Root `README.md`** — quick start + links
- [x] **Removed stale root backups** — `supabase_backup_*.sql` / `*.dump` (May 2025; use `~/Backups/` per runbooks)
- [x] **Cleaned `supabase/snippets/`** — removed one-off booking SQL; renamed local cron helpers
- [x] Finish **`npm run` → `bun run`** wording in [[migration-runbook|Migration Runbook — New Booking Flow]] (partial)

### E. Feature folder architecture (guest vs dashboard)

**Goal:** [bulletproof-react](https://github.com/alan2207/bulletproof-react) + PMA-style context split. Map: **[[project-structure|UI project structure]]**.

- [x] **`features/guest/`** — `calendar/`, `form/`, `sd-form/`, `pay-parking/` + `guest/routes`
- [x] **`features/guest/marketing/`** — PMA public UI port Phase 1 (pages + routes + mock data; see **[[guides/routes/properties|Properties (guest marketing) — operator guide]]**)
- [x] **`features/dashboard/`** — `bookings/`, `org/`, `property/`, `finance/`, `maintenance/`, `inbox/`, `pricing/`, `team/` + `dashboard/routes`
- [x] **Shared `components/`** — `branding/`, `navigation/` (moved loose root components)
- [x] **Import migration** — all `ui/src` + docs + rules + supabase mirror comments updated
- [x] **`.cursor/rules/architecture.mdc`** + **[[project-structure|UI project structure]]**
- [x] **Shared `lib/` + `utils/`** — categorized subfolders; domain files moved to features
- [ ] **Split `dashboard/bookings/`** — extract `auth/`, `notifications/`, `templates/`, `settings/` from bookings hub (incremental)

### F. PMA guest marketing UI (public site)

**Goal:** Match **property-management-app** guest marketing UX in GFM (Vite + React Router). Skill: **`.cursor/skills/public-ui/SKILL.md`**.

**Phase 1 — shipped (Jul 2026):**

- [x] Port `features/marketing/**` components into `ui/src/features/guest/marketing/`
- [x] Vite adapters: `MarketingImage`, `MarketingThemeToggle`, mode-transition CSS, `Link to=`
- [x] Marketing pages + routes (`/`, `/for-hosts`, `/properties/*`, `/developments/*`, `/terms`, `/privacy`)
- [x] Move operational calendar to **`/calendar`**; `/?property=` → `/calendar?property=`
- [x] Route guides: `index-landing`, `properties`, `developments`, `for-hosts`, `legal`; update `calendar.md`
- [x] `bun run build` passes

**Phase 2 — backlog:**

- [ ] Public catalog API (properties, developments, media from DB)
- [x] Public property **detail** API — `get-public-property` + `usePublicPropertyDetail` (mock fallback; see **[[public-property-catalog|Public property catalog — reference]]**)
- [x] Guest **stay guide** — token-gated `/properties/:slug/stay-guide` from standard property templates + RFCI email CTA; link auto-issued on **READY_FOR_CHECKIN** transition, admin copy on booking detail; date-change window refresh (`get-guest-stay-guide`, `issue-guest-stay-guide-token`, migration `20260916120000_guest_stay_guide_token.sql`). Guide: **[[stay-guide|Guest stay guide (token-gated brochure)]]**.
- [ ] Wire `BookingCard` Reserve → operational `/form`
- [ ] Property marketing calendar → `get-booked-dates`
- [x] ~~`PublicFormRenderer` → real submission endpoint~~ — **Retired:** mock form routes removed; operational booking uses `/properties/:slug/form` (`submit-form`); parking uses `/parkings/:slug/form` (`submit-parking-booking-request`)
- [x] Guest auth routes — host Google OAuth + onboarding routing; `/sign-in` legacy redirect
- [x] Removed legacy **`SignInPage`**
- [ ] Wire guest email/password + Facebook (guest audience only)
- [ ] `/about`, `/contact` pages (footer stubs today)
- [ ] Optional: `scripts/dev/port-pma-public-ui.sh` re-sync helper from PMA repo

Mind map todos:

Things to plan

- Parking booking process
- Legit check, Proof submission
- Plan a way for agent to use and make a profit on using our platform
- Provider service module where guest/user can avail cleaning, maintenance, breakfast services, etc
- Payment process
- Subscription process
- Refund/scam protection

Big modules:

- Refined onboarding flow/process for adding new properties & parking
- [WIP] Create new super admin module for managing developments, approvals, etc
  - New host listings
  - Approve external reviews
- Provide help and support
- Create stunning and animated customizable or templated landing/showcase page
- [WIP] Chat app between guest and host
  - Support for AI to analyze attachments
- Improve app responsiveness & skeleton loaders
- Add info modal for some module or sections
  - Telegram notifications setup

Random:

- ✅ Add confirmation modal when adding new payment modals that all information are correct
  ✅ Apply the same slide-in animation we have from PMA when switching between host & explore mode
- Improve /for-hosts landing page
- ✅ Improve external reviews modal UI/UX
- Remove parking request from email templates? And should we support Templates module on parking?
- Improve property and org level dashboard to provide more important info
- Update our booking calendar to support multi nights booking in single badge instead of separate badge which looks like a different guest booking
- Update property settings -> basic info -> add "Level" field to be consitent with parking
- Parking display name and code should be in one row on parking basic info settings
- Add copy or open buttons beside URL slug field
- ✅ Set default Azure north google map location/address
- Set atleast 3 parking amenities (same validation with property amenities)
- Save updated base rates pricing should only be applicable for all future unbooked dates
- ✅ Let's support up to 9 images in property photos
- [ ] **Earned Superhost program** — metrics, quarterly assessment cron, org Trust progress UI ([`superhost-program.md`](../workflow/planned/superhost-program.md))
- Able to block dates without booking?

- UI to make consistent/improve:
  - Modal
  - Image uploader
  - Improve calendar date ranger to have seamless UI (without spacing between arrows and button date)

- Things to refine:
  - Improve UI/UX and process and support more functionality on edit booking detail page
  - Provide better templates on marketing calendar, design and video builders
  - Improve UI/UX when transition bookings
  - Property/Parking default amenities lists
  - Refine public filters, search functionality
  - Quick replies list
  - Standard and email templates
  - Refine footer links and info
  - Finance transaction categories
  - Legal: Privacy policy, terms of service, cookie policy
  - PDF Reporting

Needs to finalize:

### Guest + host chat UX roadmap

**Phase 1 — bubble presentation (shipped Jul 2026)**

- [x] Per-message timestamp under bubbles (Asia/Manila)
- [x] Date group headers (Today / Yesterday / …)
- [x] Shared `ChatMessageBubble`, `ChatMessageList`, `chatMessageFormat`
- [x] Guest optimistic send + failed state + Retry
- [x] Sent indicator (✓) on own messages; sending spinner while posting
- [x] “Automated” badge on AI-generated replies (guest + inbox)

**Phase 2 — read & delivery**

- [x] Per-message read receipts (seen ✓✓) for guest and host
- [x] Mark-read on thread view (`guest_last_read_at` / `host_last_read_at`)
- [x] Delivery lifecycle: `sent` → `read` on web (Meta `delivered` unchanged)
- [x] Realtime `UPDATE` on `social_messages` (guest + inbox)
- [x] Guest unread badge on `/account/messages`

**Phase 3 — edit & unsend**

- [x] Edit own message until host read or reply (`edited_at`, PATCH endpoint)
- [x] “Edited” label on modified bubbles
- [x] Optional unsend before read (soft delete)

**Phase 4 — reply threading**

- [x] Reply-to-message with quoted preview (`reply_to_message_id`)
- [x] Message actions → Reply in composer (guest + inbox)
- [x] Persist Meta `reply_to.mid` for FB/IG DMs

**Phase 5 — rich compose & realtime**

- [x] Typing indicator (Broadcast or ephemeral row)
- [x] Guest image/file attachments
- [x] In-conversation search
- [x] Guest push/email when host replies offline

**Phase 6 — trust & inbox parity**

- [ ] Guest “Awaiting reply” when `reply_status=pending`
- [ ] Quick replies on Web tab
- [ ] Report / block (public guest chat)

See **[[chat]]** § UX roadmap and **[[guides/routes/org/inbox]]** § Chat UX roadmap.
