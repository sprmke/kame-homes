---
title: 'New Flow'
status: archived
tags: [planning]
updated: 2026-08-02
---

- Let's improve our booking process flow

  **After the guest submits the form**
  - Automatically: generate the PDF (unchanged post-redesign; admin/update flows still respect a **Generate PDF** toggle in **admin-only** dev controls — see [[NEW_FLOW_PLAN|New Booking Flow — Implementation Plan]] §6.1 **Q3.1** / **Q3.2**).
  - Do **not** run automatically: email Azure, create or update the Google Calendar event, save assets to Supabase storage, add or update the Google Sheet row.
  - The unit owner reviews the guest form and moves the booking through the steps below.

  **Booking statuses**
  - **PENDING REVIEW** — Guest finished the form; unit owner or admin must review.
    - Google Calendar: **red** `PENDING REVIEW - 2pax 2nights - Guest Name` (event `summary` — **no `[]` brackets** around the status; test bookings may still prefix `[TEST] ` per env)
    - On this step, add new section from the guest form where we can enter the exact booking rate, down payment, balance (read-only, auto-compute), parking rate (if enabled), pet fee (if enabled).
    - After clicking (Proceed to 'PENDING GAF'), send the GAF request email to Azure for approval (Do **not** CC the guest on this step).
    - Then, update the database, Google Calendar, and Google Sheet with new fields info and new status
    - Send a booking acknowledgement email from Kame Home.
      - Let's create an engaging and good looking email template for booking acknowledgement that contains a summary of booking information
    - After that, let's also send the existing pet request email to Azure if has pets is enabled
      - Please do **not** CC the guest email from this email.
    - After that, let's also do email broadcast emails to our list of parking owners so that they can reply if their parking is available or not
      - I will provide you list of parking owner emails, send emails to them using 'bcc' so that they can only reply to us and will not see other replies
      - Let's make the parking owner list configurable from env variables
    - Please generate an email content that basically says that we are looking for parking for this booking date. Please reply if your parking is available and the lowest price you can give.

  - **PENDING GAF** — GAF request sent; waiting for Azure approval.
    - Google Calendar: **yellow** `PENDING GAF - 2pax 2nights - Guest Name`
    - Email listener/watcher: detect Azure’s GAF approval email; parse the date range to get the booking id / context.
      - Once we receive the approved GAF pdf, let's automatically execute the storage service so that we should save the PDF on Supabase storage which will be sent on 'Ready for check-in' stage
      - Reference Gmail automation: `/Users/michaelmanlulu/Projects/personal-projects/automated-tasks/pay-credit-cards/` — read `docs/SETUP.md` + `src/gmail-auth.ts`, `src/gmail.ts`, `src/gmail-history.ts`, `src/gmail-poll-new-soa.ts` (OAuth + `historyId` incremental poll + attachment download pattern).
    - Then, we should automatically update the status to 'PENDING PARKING REQUEST' (if enabled) or 'PENDING PET REQUEST' (if enabled) otherwise update the status to 'READY FOR CHECK-IN' status on database, Google Calendar and Google Sheet.

  - **PENDING PARKING REQUEST** — Parking is enabled; waiting on parking details.
    - Google Calendar: **yellow** `PENDING PARKING REQUEST - 2pax 2nights - Guest Name`
    - On this step, we will just check the replies from parking owners and choose which is available and has lowest parking rate
    - Reply to the selected parking owner and pay them (**manual** — no auto “winning owner” email in v1; see §6.1 **Q4.2** / **Q4.3** in [[NEW_FLOW_PLAN|New Booking Flow — Implementation Plan]]).
    - **Parking endorsement (v1):** manual screenshot + **manual upload** in admin (no auto-screenshot of email — see [[NEW_FLOW_PLAN|New Booking Flow — Implementation Plan]] §6.1 **Q4.4**). Image is sent to the guest at **Ready for check-in** when provided.
    - Two parking amount fields (DB: `parking_rate_guest`, `parking_rate_paid`); **labels:** **Guest Parking Rate** (charged to guest) and **Owner Parking Rate** (paid out to the selected parking owner) — [[NEW_FLOW_PLAN|New Booking Flow — Implementation Plan]] §6.1 **Q4.5**.
    - After clicking (Proceed to 'PENDING PET REQUEST' (if enabled) or Proceed to 'READY FOR CHECK-IN'), sync database, calendar, and Google Sheet with parking fields

  - **PENDING PET REQUEST** — Guest has pets; pet-form request email sent; waiting on approval.
    - Google Calendar: **yellow** `PENDING PET REQUEST - 2pax 2nights - Guest Name`
    - Email listener: detect Azure pet-request approval email.
      - Email title format: Monaco 2604 - Pet Request (04-14-2026 to 04-15-2026)
      - Check emails with this format, then check the attached PDF title if it's 'APPROVED GAF.pdf', it means that it's approved
      - If approved, automatically fetch and save the approved pet GAF PDF on our Supabase storage which will be send on 'Ready for check-in' stage
      - After that, let's automatically update the booking status to the database, calendar, and Google Sheet

  - **READY FOR CHECK-IN** — Cleared for guest to check-in.
    - Google Calendar: **green** `READY FOR CHECK-IN - 2pax 2nights - Guest Name`
    - Upon transitioning on this stage, we should automatically send one email to guest email that covers:
      - Booking confirmation with attachments: approved GAF, approved pet form (if enabled), parking details (if enabled)
      - Payment breakdown (Down payment, Balance, SD, pet fee, Guest Parking Rate when applicable)
      - Check-in instructions, reminders, house rules, etc (we will provide the content later, let's generate good looking email template for this)

  - **PENDING SD REFUND** — Guest has checked out; security deposit refund pending.
    - Google Calendar: **orange** `PENDING SD REFUND - 2pax 2nights - Guest Name`
    - Cron: email check-out / SD refund details in a configurable window before check-out (Asia/Manila); move status toward **Ready for check-out** in the database, calendar, and sheet when final balance is settled (not on email timing alone).
    - Display new multiple fields: **additional expenses (+)** and **additional profits (+)** as **lists of amounts** (stored as Postgres `NUMERIC[]`), **SD refund receipt** upload (`sd_refund_receipt_url`), and settle **SD refund amount** + payments.
    - After clicking (Proceed to 'BOOKING COMPLETED'), update the booking status to database, calendar, and Google Sheet with parking fields

  - **COMPLETED** — Booking closed.
    - Google Calendar: **blue** `COMPLETED - 2pax 2nights - Guest Name`

  - **CANCELLED** — Booking canceled.
    - Google Calendar: **purple** `CANCELED - 2pax 2nights - Guest Name`
    - Keep existing logic

With this, let's create new routes and dashboard to manage all of this instead of relying to query parameters.

- create simple admin authentication page which only supports google login.
- for now, only allow "kamehome.azurenorth@gmail.com" as the only valid admin user
- let's create a new route called '/bookings'
  - on dashboard page, we will see all the bookings that we have.
  - allow search, filter, sort and pagination
- let's also create 'bookings/<bookingId>'
  - render the guest form with developers control (same behavior with ?dev=true)

Guest form cleanup (shipped):

- **Admin** routes: dev/workflow controls apply when signed in as allow-listed admin (`RequireAdmin`).
- **Public `/form`:** optional `?dev=true` only when you need save/storage/calendar/sheet toggles on a production build; non-production builds show the same toggles without it. **No** `?testing=true`, **no** test-booking column — use **local/staging Supabase** for integration testing.

Let's create a new migration scripts to:

- Backup all database data.
- Update all existing bookings in database
- Update all existing booking events from Google Calendar
- Update all existing booking data from Google Sheet

Update dev controls to add new checkboxes:

- Update 'Send email notification' to 'Send GAF request email'
- Add 'Send Parking broadcast email' (only if parking is enabled)
- Add 'Send Pet request email' (only if has pets is enabled)
- **Dev controls are admin-only** after cleanup — not on public `/form` (`NEW_FLOW_PLAN.md` §6.1 **Q3.2**).

For new fields and info, add new column on database and google sheet

Other todos:

- **Parking non-refundable + no-reschedule** copy on **both** guest form and relevant emails (`NEW_FLOW_PLAN.md` §6.1 **Q7.5**).
- **Surprise setup / decorations** acknowledgment checkbox: **above** “Special Requests”, with an **info label** (“discuss with owner first”). Field semantics still **refined** — `NEW_FLOW_PLAN.md` §6.2 **Q7.4** + §6.1 **Q7.4 (partial)**.
