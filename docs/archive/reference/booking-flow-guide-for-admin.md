---
title: 'Kame Home — Booking Flow Guide for Admin'
status: active
tags: [reference, booking-workflow]
updated: 2026-08-02
---

# Kame Home — Booking Flow Guide for Admin

A friendly walkthrough of how a booking moves from "guest just submitted the form" all the way to "completed, refund sent." This is the **non-technical** companion to the full plan in [[NEW_FLOW_PLAN|New Booking Flow — Implementation Plan]].

> **Who this is for:** the Airbnb admin / unit owner managing day-to-day bookings.
> **What you'll learn:** every booking status, what you need to do at each one, what happens **automatically** (so you don't have to babysit), what each email is, and what each Google Calendar color means.

---

## 1. The big idea (read this first)

Old way: guest submitted the form → the system did **everything** in one shot (emailed Azure, made the calendar event, updated the sheet, generated PDFs). You had little control.

New way: the guest submission is **just step one**. From that point onward, the booking moves through a clear pipeline of stages that **you control** from the new admin dashboard at **`/bookings`**. The system fires emails, paints the calendar a color, and updates the Google Sheet at each step — **but only when you say so**.

A few automations still run quietly in the background:

- A **Gmail watcher** reads the inbox every few minutes and auto-moves the booking forward when Azure sends back an approved GAF or pet form.
- A **check-out reminder job** emails the guest a few hours before check-out asking for any unpaid balance and SD refund info, then nudges the booking forward when the balance is settled.

That's it. Everything else is a button you click on the booking detail page.

---

## 2. The 8 booking statuses at a glance

Think of these like the lanes on a highway. Most bookings travel left → right. **Cancel** is an exit you can take from any stage.

| #   | Status                      | Plain-English meaning                                                       | Calendar color | What you need to do                                                                                           |
| --- | --------------------------- | --------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | **PENDING REVIEW**          | Guest just submitted the form. You need to look it over and price it.       | Red            | Open the booking → check details → fill in rate / down payment / fees → click **Proceed**.                    |
| 2   | **PENDING GAF**             | We emailed Azure the GAF (guest approval form). Waiting on them.            | Yellow         | Usually nothing — the Gmail watcher will auto-advance when Azure replies with the approved PDF.               |
| 3   | **PENDING PARKING REQUEST** | The guest wants parking. We're picking which parking owner to rent it from. | Yellow         | Check replies from parking owners, pick the cheapest one, pay them, upload the screenshot, click **Proceed**. |
| 4   | **PENDING PET REQUEST**     | Guest has a pet. We emailed Azure the pet form. Waiting on them.            | Yellow         | Usually nothing — the Gmail watcher auto-advances when Azure approves it.                                     |
| 5   | **READY FOR CHECK-IN**      | All paperwork done. Guest got the check-in email with everything attached.  | Green          | Nothing right away. The check-out reminder job will email the guest before their check-out.                   |
| 6   | **READY FOR CHECK-OUT**     | Guest paid the final balance and check-out time is near. Stay is ending.    | Orange         | Nothing required — wait for the guest to submit the SD refund form (`/sd-form`).                              |
| 7   | **PENDING SD REFUND**       | Guest filled out the refund form. You need to settle the deposit.           | Orange         | Add any extra expenses / profits → upload the refund receipt → click **Proceed to Completed**.                |
| 8   | **COMPLETED**               | Everything done. Booking closed.                                            | Blue           | Nothing. This is the finish line.                                                                             |
| —   | **CANCELLED**               | Booking was canceled at some point.                                         | Purple         | Nothing. Dates are now free again on the public calendar.                                                     |

> **Note:** "PENDING DOCUMENTS" is an internal umbrella status the system uses while it's waiting on **multiple** sub-steps (GAF + parking + pet). On the calendar you'll see a more specific title like `PENDING GAF PARKING PET DOCS`. As each sub-step completes, the title gets shorter (e.g. `PENDING PET DOCS`). Once all sub-steps are done, the system auto-advances to **READY FOR CHECK-IN** — no extra click needed.

---

## 3. The full booking journey, step by step

Here is what a typical booking looks like from start to finish. We'll cover both the "simple" case (no parking, no pets) and the "full" case (with parking + pets).

### Step 0 — Guest submits the form on `/form`

**What the guest does:** fills out the booking form on the website, uploads their valid ID, payment receipt, and (if they have a pet) the pet vaccination card and a photo of the pet.

**What the system does automatically:**

- Saves all the guest data to the database.
- Uploads the photos / PDFs to storage.
- Creates a booking row with status **PENDING REVIEW**.
- Sends a **"New Booking Request"** email notification to the operations inbox (so you know a new booking just came in).

**What the system does NOT do automatically (this is new):**

- It does **not** generate the GAF or pet request PDF yet.
- It does **not** email Azure yet.
- It does **not** create a Google Calendar event yet.
- It does **not** add a row to the Google Sheet yet.

> Everything above happens later, when **you** move the booking out of PENDING REVIEW.

---

### Step 1 — PENDING REVIEW (you take action)

**Calendar color:** Red. **Calendar title:** `PENDING REVIEW - 2pax 2nights - Guest Name`.

**Your job:** open the new booking at `/bookings/<booking-id>` and review everything.

You'll see:

- All the guest's info (name, contact, dates, ID, receipt).
- A **pricing panel** where you enter:
  - **Booking Rate** (the total stay price you agreed on)
  - **Down Payment** (what they've already paid)
  - **Security Deposit** (usually ₱1,500)
  - **Pet Fee** (only if they have a pet)
  - **Guest Parking Rate** (only if they want parking — this is what you charge them)
- A read-only **Total Guest Balance** that the system computes for you:

  > **Total Guest Balance = Booking Rate − Down Payment + Security Deposit + Pet Fee + Guest Parking Rate**

  This is the amount the guest pays on or before check-in.

When you're done reviewing, click **Proceed**. The system asks you to confirm because this is the moment a **lot** of things happen automatically:

**Side effects when you click Proceed from PENDING REVIEW:**

1. Generates the filled GAF request PDF (and pet request PDF, if pet).
2. Emails Azure the GAF request **with the filled PDF attached**.
3. (If pets) emails Azure the pet request **with the pet PDF attached**.
4. (If parking) sends the **parking broadcast email** to all parking owner emails as a BCC, asking who has parking available and at what rate.
5. Sends the guest a friendly **Booking Acknowledgement** email letting them know we're processing their booking.
6. Creates the Google Calendar event (yellow, with the new title format).
7. Adds the row to the Google Sheet.

> **Important:** Azure is **never** CC'd with the guest's email, and the guest is **never** CC'd on the emails we send to Azure. Those are kept private.

The booking now moves to either **PENDING DOCUMENTS** (waiting on multiple items) or **PENDING GAF** (only GAF pending) — whichever applies.

---

### Step 2 — Waiting on Azure (PENDING GAF / PENDING DOCUMENTS)

**Calendar color:** Yellow.

This is the **hands-off** stage. You generally do nothing here. The Gmail watcher takes care of it.

**What the Gmail watcher does (every ~5 minutes):**

- Logs in to the `kamehome.azurenorth@gmail.com` Gmail inbox.
- Reads only the **new** emails since the last check (incremental, fast).
- Looks for replies to our `Monaco 2604 - GAF Request (…)` and `Monaco 2604 - Pet Request (…)` subjects.
- If it finds one with an attached **APPROVED GAF.pdf** (or `APPROVED PET.pdf`), it:
  1. Downloads the PDF.
  2. Saves it to our Supabase storage so we can attach it to the guest later.
  3. Looks up which booking it belongs to (based on the date range in the email subject).
  4. Marks that sub-step done on the booking.
  5. If all sub-steps are done, auto-advances the booking to **READY FOR CHECK-IN** and sends the guest the check-in email.

**Edge case to know about:** If Azure replies on an email subject that matches **two** bookings with the same dates (rare), the watcher **will not guess**. It logs the ambiguity and you'll see a "needs attention" indicator on the booking. Go in and attach the PDF manually.

**If the watcher seems stuck:** there's a manual **Run Gmail poll now** button on the booking detail page. It does the same thing the cron does but immediately.

---

### Step 3 — PENDING PARKING REQUEST (you take action)

This step only happens if the guest wants parking.

**Calendar color:** Yellow. **Calendar title:** `PENDING PARKING REQUEST - 2pax 2nights - Guest Name`.

**Your job:**

1. Check your inbox for replies from parking owners (these came from the broadcast email sent in Step 1).
2. Pick whichever parking owner replied with the **lowest available rate**.
3. **Reply to that one parking owner** to confirm + pay them via your preferred method.
4. **Take a screenshot** of their parking endorsement / chat reply (so we have proof of parking).
5. On the booking page, fill out the **Parking Request Form**:
   - **Parking Owner** (display name of the owner you chose)
   - **Owner Parking Rate** (what you paid out)
   - **Upload the screenshot** of the endorsement
6. Click **Proceed**.

> **Important rule:** the **Guest Parking Rate** (what the guest pays you) is **non-refundable** and **cannot be rescheduled**. This is mentioned on the guest form and in the check-in email so the guest sees it twice.
>
> **Note on automation in v1:** we do **not** auto-email "you won" to the selected parking owner. After you pay them, the conversation stays a manual reply in your inbox. We may add this later.

---

### Step 4 — PENDING PET REQUEST (mostly automatic)

This only happens if the guest has a pet.

**Calendar color:** Yellow.

Same as Step 2 — the Gmail watcher handles it when Azure replies with the approved pet PDF.

---

### Step 5 — READY FOR CHECK-IN (system sends the guest everything)

**Calendar color:** Green. **Calendar title:** `READY FOR CHECK-IN - 2pax 2nights - Guest Name`.

The moment the booking enters this state, the system sends the guest a **Ready-for-Check-in email** with:

- The approved GAF PDF (attached).
- The approved pet form PDF (attached, if pet).
- The parking endorsement screenshot (attached, if parking).
- A full payment breakdown — booking rate, down payment, total guest balance, security deposit, pet fee, guest parking rate.
- Check-in instructions, reminders, and house rules.

**Your job here:** nothing. Just sit back. The next automation is the check-out reminder, which fires close to the check-out date.

---

### Step 6 — READY FOR CHECK-OUT (mostly automatic, with one settlement check)

**Calendar color:** Orange.

This stage is driven by the **SD Refund Cron** job (runs every ~5 minutes, all in Asia/Manila time).

**What the cron does, in two passes:**

**Pass A — Send the check-out email (a few hours before check-out).**

- Looks at every booking in **READY FOR CHECK-IN**.
- If check-out is coming up within the **lead window** (default: 2 hours before check-out time), it emails the guest with:
  - A link to the **Security Deposit Refund Form** at `/sd-form`.
  - A reminder to pay any remaining balance.
- Marks the booking so it doesn't send this email twice.

> **Note:** this email is sent based on **timing**, not on whether the guest has paid. So even if the guest still owes you the balance, they will get the SD refund link.

**Pass B — Transition the booking forward (when balance is paid).**

- Once you (or the guest) records that the full guest balance has been paid (e.g. via an admin save with the receipt), the cron auto-transitions **READY FOR CHECK-IN → READY FOR CHECK-OUT**.
- Calendar turns orange, Sheet updates, no email is re-sent (since the guest already got the SD form link).

**If a booking is very old (e.g. check-out was more than 21 days ago):** the cron suppresses both the email and the transition. This protects against accidentally spamming guests for stale rows. (You can still advance it manually.)

**Manual button:** if the cron didn't fire for some reason, you can click **Run SD refund cron now** on the booking detail page to re-evaluate just that one booking.

---

### Step 7 — Guest fills the SD refund form at `/sd-form`

After getting the SD refund email, the guest opens `/sd-form?bookingId=…` and:

1. Sees a button to leave a **Facebook review** (optional — guests can spin for **₱100–₱1,000 off** or a rare **free staycation** on their next booking).
2. May see a "still waiting for your balance to be settled" message if you haven't recorded their final payment yet.
3. Picks a **refund method** (e.g. GCash, bank transfer) and provides the details.
4. Submits the form.

When they submit, the booking moves to **PENDING SD REFUND**.

---

### Step 8 — PENDING SD REFUND (you take action — final settlement)

**Calendar color:** Orange.

**Your job:** finish settling the deposit.

On the booking detail page you'll see the **SD Refund Form** with:

- **Additional Expenses** — any damage / extra cleaning / lost items the guest is liable for. Each line has a label + amount. Increases the deduction.
- **Additional Profits** — any extras the guest paid for. Each line has a label + amount. Decreases the deduction.
- **Actual Refund Amount** (read-only) — auto-computed:

  > **Actual Refund = Security Deposit + Σ Additional Expenses − Σ Additional Profits**

  > Wait, that's not how a refund works in plain English. Let me restate that in a way an admin can sanity-check:
  >
  > - You start with the **Security Deposit** the guest paid.
  > - You **subtract** any damage / expenses (because that money goes to fix things).
  > - You **add back** any profits owed (rare — e.g. they overpaid for something).
  >
  > The number you see is what to refund to the guest. **If the result is negative, the guest actually owes you more money.**

- **Upload the SD Refund Receipt** — a screenshot of you actually sending the refund (GCash receipt, bank transfer confirmation, etc.).

Once that's filled out and the receipt is uploaded, click **Proceed to Completed**.

---

### Step 9 — COMPLETED

**Calendar color:** Blue. **Calendar title:** `COMPLETED - 2pax 2nights - Guest Name`.

You're done. The booking is closed.

> **Important:** "completed" bookings **still block dates on the calendar**. Only `CANCELLED` frees the dates. (This matches today's behavior.)

By default, the `/bookings` list hides completed bookings whose check-in date is already in the past, so your list stays clean.

---

### The escape hatch — CANCELLED (from any stage)

You can cancel a booking at any point in the pipeline (except after it's already completed). Just click **Cancel Booking** on the detail page.

When you cancel:

- The booking row is kept (data is preserved).
- The calendar event turns **purple** with title `CANCELED - 2pax 2nights - Guest Name`.
- The dates become **available again** on the public guest calendar.
- The Google Sheet row updates with the new status.

---

## 4. Special situations and "what if" questions

### "What if I need to edit the guest's info after they're already at READY FOR CHECK-IN?"

If you edit a **workflow-sensitive field** (name, email, phone, check-in/check-out date or time, parking, pet info, valid ID, payment receipt, pet vaccination, pet photo, or surprise decor request), the booking is automatically pushed **back to PENDING REVIEW**.

This is intentional: changing those fields means the GAF and pet forms need to be re-issued, so we send you back to review the new info, then go through the pipeline again.

If you only edit non-sensitive fields (like notes), the status stays where it was.

### "What if the Gmail watcher misses an Azure email?"

Two options:

1. Click **Run Gmail poll now** on the booking detail page.
2. Manually upload the approved PDF using the upload button, then advance the status yourself.

### "What if I need to go backwards a step?"

On the booking detail page you'll see a **← Back to {previous step}** button next to **Proceed**. It safely steps you back one stage. Going backwards **never** re-sends emails — that's protected automatically.

### "What if I see a 'needs attention' indicator on a booking?"

This usually means the Gmail watcher detected an ambiguous Azure reply (two bookings with the same dates). Open the booking, double-check the email Azure sent, then attach the right PDF and advance manually.

### "What if it's a same-day urgent check-in?"

The GAF / pet / parking request emails will have a `🚨 URGENT -` prefix. The flow is the same, you just need to move faster.

### "Can I still test things without affecting real guests?"

Yes — but **not** via a "test booking" toggle. Use a **local or staging Supabase project** for safe trials. There's no more `?testing=true`, no `[TEST]` prefix in production. (This is the new policy as of mid-2026.)

---

## 5. The "robots" — your two background automations

You'll mostly forget these exist. They just work. But it helps to know what they do.

### 5.1 The Gmail Watcher

**Where it lives:** Supabase scheduled job called `gmail-listener`.
**How often:** every **5 minutes**.
**What it watches:** the inbox `kamehome.azurenorth@gmail.com`.
**What it looks for:** replies to our `Monaco 2604 - GAF Request (…)` and `Monaco 2604 - Pet Request (…)` emails that have an attached **APPROVED GAF.pdf** (the filename matching is forgiving with spaces / underscores / hyphens).
**What it does:**

- Downloads the PDF, saves it to storage.
- Finds the matching booking (via the date range in the subject line).
- Marks the GAF or pet sub-step as **done**.
- If everything is now complete, auto-advances to **READY FOR CHECK-IN** and sends the guest the check-in email.

**Safety net:** every email it processes is logged so it never processes the same email twice, even if Gmail re-delivers it. Ambiguous matches are skipped (never guessed).

### 5.2 The Check-out & SD Refund Cron

**Where it lives:** Supabase scheduled job called `sd-refund-cron`.
**How often:** every **5 minutes**.
**Timezone:** Asia/Manila (matches our guest-facing time).
**What it does (two jobs in one):**

1. **Email reminder:** for every booking in **READY FOR CHECK-IN**, if check-out is coming up within the lead window (default **2 hours**), send the guest the SD refund form link + a reminder to pay the balance. Marks the booking so it doesn't double-send.
2. **Auto-transition:** once the final balance is recorded as paid (admin save with receipt), move the booking **READY FOR CHECK-IN → READY FOR CHECK-OUT** so the calendar turns orange.

**Stale guard:** bookings where check-out is more than **21 days** in the past are skipped (no spam emails). You can override manually.

**Manual trigger:** on the booking detail page, click **Run SD refund cron now** to evaluate just that booking.

### 5.3 The Telegram marketing reminders (bonus background job)

You'll also see Telegram messages appear in your marketing group **3 times a day** (10:00, 15:00, 21:00 Manila time) reminding people about available dates. This is separate from the booking workflow — it's just a marketing helper. See [[telegram-marketing-reminders|Telegram marketing reminders]] for full details.

---

## 6. Email cheat sheet — who gets what, and when

| Email                              | Sent to                             | Trigger                                                     | Includes                                                                                                   |
| ---------------------------------- | ----------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **New Booking Request**            | Operations inbox (`EMAIL_REPLY_TO`) | Guest submits the form on `/form`                           | Summary of booking, so you know to log in and review                                                       |
| **Booking Acknowledgement**        | Guest                               | You click Proceed from **PENDING REVIEW**                   | Friendly "we got your booking, processing now" message                                                     |
| **GAF Request**                    | Azure (no guest CC)                 | You click Proceed from **PENDING REVIEW**                   | Filled GAF PDF attached, asking for their approval                                                         |
| **Pet Request**                    | Azure (no guest CC)                 | You click Proceed from **PENDING REVIEW** (only if pet)     | Filled pet form PDF attached, asking for their approval                                                    |
| **Parking Broadcast**              | All parking owners (BCC)            | You click Proceed from **PENDING REVIEW** (only if parking) | "Looking for parking on these dates, reply with your rate"                                                 |
| **Ready for Check-in**             | Guest                               | Booking enters **READY FOR CHECK-IN**                       | Approved GAF + pet PDF + parking screenshot + full payment breakdown + check-in instructions + house rules |
| **Check-out & SD Refund Reminder** | Guest                               | SD Refund Cron, ~2 hours before check-out                   | Link to `/sd-form`, reminder to settle the balance                                                         |

> **Backwards transitions never re-send emails.** If you step back from READY FOR CHECK-IN → PENDING REVIEW and then forward again, the system is smart about not double-sending. The Ready-for-Check-in email only fires on **forward** transitions from the pending stages.

---

## 7. Google Calendar color cheat sheet

Glance at your Google Calendar and the color tells you everything.

| Color      | Status                                  | What you'd do                                                                                |
| ---------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Red**    | PENDING REVIEW                          | Open the booking, review, and price it                                                       |
| **Yellow** | PENDING GAF / PARKING / PET / DOCUMENTS | Either wait on Azure (GAF/pet) or you need to handle parking. Calendar title tells you which |
| **Green**  | READY FOR CHECK-IN                      | Guest cleared. Nothing to do until check-out time                                            |
| **Orange** | READY FOR CHECK-OUT / PENDING SD REFUND | Stay ending. Settle the SD refund when the guest fills the form                              |
| **Blue**   | COMPLETED                               | Done. Nothing to do                                                                          |
| **Purple** | CANCELED                                | Free dates. Nothing to do                                                                    |

**Calendar event title format** (no square brackets in production):

```
{STATUS} - {pax}pax {nights}night(s) - {Guest Facebook Name}
```

Example: `READY FOR CHECK-IN - 2pax 3nights - Maria Santos`

**Extra emoji prefixes** in the title (each appears only when relevant):

- 🎉 — guest requested **surprise decor setup**
- 🐶 — booking has **pets**
- 🚗 — booking needs **parking**

So a full title might read:

```
🎉 🐶 🚗 PENDING REVIEW - 2pax 2nights - Maria Santos
```

That single line tells you the booking is in review **and** the guest has a pet, wants parking, and wants surprise decor.

---

## 8. Finance (`/finance`)

Use **Finance** in the admin sidebar when you need totals across many stays or property costs that are not tied to one booking.

| Tab              | What it shows                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Overview**     | KPI cards: grand net (completed stays + transactions), guest collected, parking margin, outstanding balances, pipeline estimates |
| **Stays**        | One row per booking with collected amount, parking margin, and net (realized when **Completed**, projected otherwise)            |
| **Transactions** | Rent, utilities, supplies, marketing, etc. — add **expense** or **income** lines with a date and optional category               |

**Period basis** (toolbar): filter by **check-in**, **check-out**, or **completed** date. Presets: This month, Last month, YTD, All time.

**Per-booking SD lines** (damage, extra cleaning, etc.) stay on the booking detail **Pricing** card and **Pending SD Refund** workflow — Finance **Stays** reads those totals but does not replace that form.

**Export** (top right): **Export report** opens a menu — full report (all sections), overview summary, stays ledger, or transactions only.

---

## 9. Your daily checklist (the "what should I be doing?" answer)

Every morning, when you open `/bookings`, here's a sensible routine:

1. **Scan for red (PENDING REVIEW)** rows. These are new and need your attention. Open each one, review, fill in pricing, click **Proceed**.
2. **Scan for yellow PENDING PARKING REQUEST** rows. Check your inbox for parking-owner replies, pick the cheapest, pay them, upload the screenshot, click **Proceed**.
3. **Scan for orange (PENDING SD REFUND)** rows. The guest has submitted their refund details. Fill in the additional expenses / profits, upload the refund receipt, click **Proceed to Completed**.
4. **Scan for "needs attention"** indicators (rare). Manually attach a PDF or advance the booking if the Gmail watcher couldn't.

Everything else — yellow PENDING GAF / PET, green READY FOR CHECK-IN, orange READY FOR CHECK-OUT — is on autopilot.

---

## 10. Rules you should not break

A few simple rules that keep the system trustworthy:

1. **Never CC the guest** on the GAF or pet request emails to Azure. The system enforces this — but if you ever manually forward, don't add the guest.
2. **Parking is non-refundable.** Once a guest pays the parking rate, no refund, no reschedule. This is shown on the guest form and the check-in email.
3. **Completed bookings still block calendar dates.** Don't worry about double-bookings — only **CANCELLED** frees the dates.
4. **Don't bulk-jump statuses.** Use the **Proceed** and **Back** buttons. They run all the right side effects (emails, calendar updates, sheet updates). Editing the status directly in the database bypasses everything.
5. **For testing, use staging or local Supabase.** There's no more "test booking" mode. Don't try to create test bookings on production.

---

## 11. Glossary (terms you'll see)

| Term                         | Plain-English meaning                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Status** / **State**       | Where the booking is in the pipeline (e.g. "PENDING REVIEW")                                                          |
| **GAF**                      | Guest Approval Form — the document Azure approves before a guest can check in                                         |
| **Azure**                    | The condo / unit owner who approves guests                                                                            |
| **Pet Form / Pet Request**   | The pet equivalent of the GAF — Azure also has to approve pets                                                        |
| **Parking Endorsement**      | The screenshot proving you've secured parking from one of the parking owners                                          |
| **SD / Security Deposit**    | The deposit the guest pays (default ₱1,500); refunded after check-out minus any damages                               |
| **SD Refund**                | The amount of the security deposit returned to the guest at the end of their stay                                     |
| **Cron / Cron Job**          | A scheduled background task that runs on a timer (e.g. "every 5 minutes")                                             |
| **Gmail Listener**           | Our background task that reads Azure's reply emails and auto-advances bookings                                        |
| **Side effect**              | Anything the system does in response to a click — sending an email, updating the calendar, etc.                       |
| **Backward override**        | The "Back to ..." button on the booking page. Lets you safely step back without re-sending emails                     |
| **Allow list**               | The list of email addresses allowed to sign in to the admin dashboard                                                 |
| **Workflow-sensitive field** | A field that, when changed, kicks the booking back to PENDING REVIEW (name, dates, parking, pet, IDs, receipts, etc.) |

---

## 12. Quick links

- **Admin dashboard:** `/bookings`
- **Finance reports:** `/finance`
- **Single booking:** `/bookings/<booking-id>`
- **Admin settings (Gmail integration):** `/settings`
- **Marketing (Telegram reminders):** `/marketing`
- **Public guest form:** `/form`
- **Public calendar:** `/` or `/calendar`
- **SD refund form (guest):** `/sd-form?bookingId=…`

---

## 13. A note from the team

This new flow was designed so you spend less time **doing manual work** (sending emails, copy-pasting to the sheet, painting the calendar) and more time **deciding things** (which parking is cheapest, is this guest worth the deposit refund, etc.).

If something feels wrong — an email didn't fire, the calendar color is stale, a booking is stuck on a stage — open the booking detail page and try:

1. **Run Gmail poll now** (top of the detail page).
2. **Run SD refund cron now** (top of the detail page).
3. **Back to {previous step}** then **Proceed** again (safely re-runs side effects).

If it's still stuck, ping the dev team. There are very detailed logs of every transition in the Supabase dashboard.

Welcome to the new flow. It should make your day easier.
