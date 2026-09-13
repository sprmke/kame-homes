---
title: 'SD Refund Form — operator guide'
status: active
tags: [guides, routes, sd-refund]
updated: 2026-08-17
---

# SD Refund Form — operator guide

Route: `/properties/:propertySlug/sd-form?bookingId=` (legacy `/sd-form?property=<slug>&bookingId=` redirects here)

> **Status:** Documented.

## Progress overview

| Section        | E2E save | Validation | Docs       | Notes                                                                                                                    |
| -------------- | -------- | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Brand shell    | ✅       | —          | Documented | `MainLayout` + `GuestFormBrandHeader` via `get-guest-payment-info`                                                       |
| Step 1 Review  | ✅       | ✅ Zod     | Documented | Shared `GuestReviewStarRating` + `GuestReviewFeedbackPills` via `SdFormReviewSection` → `submit-guest-review`            |
| Step 2 Voucher | ✅       | Server     | Documented | `claim-sd-voucher`; idempotent                                                                                           |
| Step 3 Refund  | ✅       | ✅ Zod     | Documented | `submit-sd-form` → workflow transition                                                                                   |
| Balance gate   | ✅       | Server     | Documented | `awaiting_balance_settlement` polling                                                                                    |
| Airbnb variant | ✅       | —          | Documented | Standalone `/guest-review` route                                                                                         |
| Mobile shell   | —        | —          | Documented | Step 3 Back/Submit floats via `ContextualActionBar`; steps 1–2 keep the `MainLayout` tab bar (no single dominant action) |

---

## Overview

Three-step guest stepper shown once a stay is near or past check-out. Full-page routes render inside **`MainLayout`** (org **brand-color band**, **`GuestOperationalHeader`**, **`GuestFormBrandHeader`** from **`get-guest-payment-info`**). The stepper reads its bootstrap payload from **`get-sd-form`**, which only returns data once the booking is `READY_FOR_CHECKOUT`, or `READY_FOR_CHECKIN` **and** the automated check-out email has already gone out (`sd_refund_form_emailed_at` set) — in the latter case the response flags `awaiting_balance_settlement: true` and the page shows a wait screen instead of the refund form until the stay is actually settled and moved to `READY_FOR_CHECKOUT`.

| Step | Label          | Content                                                                                                                                       |
| ---- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Leave a Review | In-app star rating, feedback tag pills, optional photos/media — `submit-guest-review`                                                         |
| 2    | Claim surprise | Balance-wait sub-phase (if check-out email already sent but balance not settled), then a **slot-machine voucher reveal** — `claim-sd-voucher` |
| 3    | Refund details | Choose GCash (same phone) / another GCash-or-bank / cash pickup → `submit-sd-form`                                                            |

Returning guests who already submitted a review or already have a voucher skip straight to step 2 (or its voucher sub-phase).

---

## Host-facing knowledge

After check-out, guests are guided through three quick steps before their security deposit is refunded: leaving a review, spinning for a surprise next-stay voucher, and choosing how they want the refund paid out (same GCash number, a different GCash/bank account, or cash pickup). The form only unlocks once you've recorded their final balance and moved their stay to check-out. If they open the link too early, they'll see a short wait screen instead.

**Common host questions**

- Q: A guest says the refund form says "almost there" and won't let them continue.
  A: That means their stay hasn't been moved to check-out with a final balance recorded yet. The page updates automatically once that's done, so the guest doesn't need to do anything.
- Q: Can a guest change their review after voting on the surprise voucher?
  A: No. Once they've submitted a review or revealed a voucher, returning to the link skips straight back to where they left off, and the review step won't show again.
- Q: What if a guest wants a cash refund?
  A: They can choose "Cash pickup" in step 3, but they're told to message the host first. Cash refunds need on-site staff, so they can't be sent automatically like GCash or bank transfers.

---

## Step 1 — Review

### Fields

| Field         | Storage                 | Validation            |
| ------------- | ----------------------- | --------------------- |
| Star rating   | Guest review row        | Required              |
| Review text   | Guest review row        | Optional              |
| Feedback tags | Guest review row (JSON) | Optional multi-select |
| Media         | Uploaded to storage     | Optional images       |

### Save path

1. Guest fills star rating (+ optional text / tags / media) → **`submit-guest-review`** (multipart `FormData`).
2. On success, advances to step 2 (voucher sub-phase, or the balance-wait sub-phase if `awaiting_balance_settlement` was already true).

---

## Step 2 — Voucher reveal

Skipped when the property has **`vouchers_enabled = false`** (guest goes review → refund, or guest-review → done). Already-awarded vouchers still show if present.

### Save path

1. Guest taps to reveal → **`claim-sd-voucher`** POST `{ bookingId }`.
2. Server rolls (or returns the already-awarded) voucher from the property’s `voucher_prizes` percent-off pool (or platform defaults in `_shared/voucher.ts`); idempotent — re-claiming returns the same code with `alreadyAwarded: true`. Requires an existing guest review. Disabled properties reject new claims with `not_available`. Awarded amount field stores **percent off** (1–100); free stay uses `FREE-STAY` / 100. Concurrent claims use a conditional write so only one roll wins. Guest UI uses property `voucher_reveal_style` (`reel` \| `wheel` \| `flip`) from bootstrap — `VoucherReveal` dispatches to slot reel, spin wheel, or flip card (server roll first; animation lands on awarded prize). `prefers-reduced-motion` short-circuits to the won card.
3. Client displays via `findVoucher(code, amount)` (catalog + custom amount fallback).
4. **Continue** advances to step 3.

### Behavior / edge cases

- Reveal copy and reel chrome are **property-neutral** (no fixed org nicknames). Reel style: muted frame, single center highlight, flat alternating voucher chips (code + prize label).
- If `awaiting_balance_settlement` is true when this step is reached, the voucher UI is replaced by a spinner/wait card; `get-sd-form` is polled every 8s (`refetchInterval`) until settlement completes and status advances (then voucher or refund per `vouchers_enabled`).

---

## Step 3 — Refund details

**Mobile shell (2026-09-10):** Back / **Submit security deposit refund** (`SdRefundStepTwoActions`) floats via `ContextualActionBar` below `lg`, matching `/form`. Steps 1–2 (review, voucher reveal) have no single dominant action, so the `MainLayout` tab bar stays visible there.

### Fields

| Field          | Storage                                | Validation                                   |
| -------------- | -------------------------------------- | -------------------------------------------- |
| Method         | `same_phone` \| `other_bank` \| `cash` | Required                                     |
| Bank / channel | Refund method payload                  | Required when method = `other_bank`          |
| Account name   | Refund method payload                  | Required when method = `other_bank`          |
| Account number | Refund method payload                  | Required when method = `other_bank`; numeric |

### Save path

1. Guest picks a method (defaults to same GCash number on file) → validates client-side (`refundBodySchema`) → **`submit-sd-form`** POST `{ bookingId, refund }`.
2. Server persists guest refund fields and transitions the booking `READY_FOR_CHECKOUT → PENDING_SD_REFUND` through the workflow orchestrator.
3. On success, shows a thank-you screen; no further action needed from the guest.

### Behavior / edge cases

- **Cash pickup** shows a note that cash refunds require on-site staff and asks the guest to message the host first before leaving.
- This step is blocked (shows the same wait card as step 2) while `awaiting_balance_settlement` is still true.
- **Invisible human check (anti-spam):** each protected action mounts its own invisible Cloudflare Turnstile widget — `submit-guest-review` (Step 1), `claim-sd-voucher` (Step 2 reveal), `submit-sd-form` (Step 3), plus honeypot + timing fields. Tokens are verified server-side (`_shared/antiSpam.ts`); failure surfaces a "Please complete the verification and try again." / "Too many attempts…" toast and the step stays put. Inert without `VITE_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (durable rate limit still applies). See [PROJECT.md → Anti-spam & CAPTCHA](../../PROJECT.md).

---

## Airbnb guest-review variant

A standalone **`/properties/:propertySlug/guest-review?bookingId=`** route (`GuestReviewPage`) reuses the same review + voucher components for the Airbnb post-stay flow (`review_path: 'airbnb_post_stay'` on `get-guest-review`), independent of the full SD-refund stepper — used when the security deposit workflow doesn't apply (e.g. Airbnb-sourced bookings where SD is typically ₱0, per `.cursor/rules/booking-workflow.mdc` § SD refund skip).

---

## API reference

| Action                   | Endpoint                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Load SD-form bootstrap   | `GET get-sd-form`                                                                      |
| Load Airbnb guest-review | `GET get-guest-review`                                                                 |
| Submit review            | `POST submit-guest-review` — FormData includes `access` when stored                    |
| Claim / re-fetch voucher | `POST claim-sd-voucher` — `{ bookingId, access? }` (same token/grace as `get-sd-form`) |
| Submit refund details    | `POST submit-sd-form` — `{ bookingId, access?, refund }`                               |

---

## Implementation map

| Concern              | Path                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Page (SD stepper)    | `ui/src/features/guest/sd-form/pages/SdFormPage.tsx`                                                                   |
| Page (Airbnb review) | `ui/src/features/guest/sd-form/pages/GuestReviewPage.tsx`                                                              |
| Review section       | `ui/src/features/guest/sd-form/components/SdFormReviewSection.tsx`                                                     |
| Shared star rating   | `ui/src/features/guest/sd-form/components/GuestReviewStarRating.tsx`                                                   |
| Feedback pills       | `ui/src/features/guest/sd-form/components/GuestReviewFeedbackPills.tsx`                                                |
| Voucher UI           | `ui/src/features/guest/sd-form/components/VoucherReveal.tsx` + `voucher-reveal/`                                       |
| API client           | `ui/src/features/guest/sd-form/lib/api.ts`                                                                             |
| Schema               | `ui/src/features/guest/sd-form/lib/sdFormSchema.ts`                                                                    |
| Voucher catalog      | `ui/src/features/guest/sd-form/lib/voucher.ts`                                                                         |
| Routes (wired)       | `ui/src/features/guest/property/routes/index.tsx` (`propertyGuestRoutes`, `legacyGuestRedirects`)                      |
| Paths                | `ui/src/features/guest/lib/guestPublicPaths.ts`                                                                        |
| Edge                 | `supabase/functions/get-sd-form/`, `submit-sd-form/`, `claim-sd-voucher/`, `submit-guest-review/`, `get-guest-review/` |
| Shared services      | `supabase/functions/_shared/{guestReviewService,voucher,workflowOrchestrator,statusMachine}.ts`                        |

---

## Testing

| Layer | Path / spec                                                                     | Manual                            |
| ----- | ------------------------------------------------------------------------------- | --------------------------------- |
| Unit  | `ui/src/features/guest/sd-form/lib/voucher*.ts` (existing voucher tests)        | —                                 |
| E2E   | `ui/e2e/features/guest-form/sdFormSubmit.spec.ts` (`@ci`, mocked `get-sd-form`) | PayMongo / live refund settlement |
| N/A   | —                                                                               | CAPTCHA on submit in production   |

---

## Related docs

- [Route index](./README.md)
- [Stays](./account/stays.md) — guest stay messaging hub (distinct from this form)
- [`docs/PROJECT.md`](../PROJECT.md)
- `.cursor/rules/booking-workflow.mdc` — transition graph, SD refund skip when `security_deposit = 0`

---

## Pending / follow-ups

- [ ] `ui/src/features/guest/sd-form/routes/index.tsx` (`sdFormRoutes`) is an **orphaned** route module — not imported by the app router. The route actually served comes from `ui/src/features/guest/property/routes/index.tsx`.
