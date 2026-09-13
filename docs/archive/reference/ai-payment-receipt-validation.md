---
title: 'AI document validation (payment receipts + valid ID)'
status: active
tags: [reference, payments]
updated: 2026-08-13
---

# AI document validation (payment receipts + valid ID)

Server-side **Gemini Flash vision** checks whether uploaded payment images look like real payment proof (digital receipts, PHP cash photos) and whether guest **valid ID** uploads look like government-issued photo ID. Results are stored on `guest_submissions`, surfaced in admin UI, and included in ops notifications where applicable.

Canonical env var and API mentions also appear in **[`docs/architecture/edge-functions.md`](../architecture/edge-functions.md)** and **[`docs/architecture/validation-and-env.md`](../architecture/validation-and-env.md)**.

---

## 1. Overview

| Item                             | Detail                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider**                     | Google **Gemini 2.5 Flash** (`generativelanguage.googleapis.com`)                                                                                                 |
| **Runtime**                      | Supabase Edge Functions (Deno) — `supabase/functions/_shared/receiptValidationService.ts`                                                                         |
| **Secret**                       | `GEMINI_API_KEY` (Google AI Studio; optional)                                                                                                                     |
| **When key missing / API fails** | Verdict `skipped` for config/storage issues only; **Gemini/network failures are not persisted** — admin sees a toast on `/bookings/:id` and may retry             |
| **Re-runs**                      | On **new upload** (primary path). **One-shot backfill** on `/bookings/:id` when a document URL exists but verdict columns are empty (non-terminal bookings only). |

The AI does **not** verify that the amount matches the booking total. It only judges whether the image appears to be legitimate payment proof (digital transfer screenshot or visible PHP cash).

---

## 2. Receipt types covered

| Receipt                         | Upload path                                              | DB URL column                       | AI verdict column            | AI summary column            |
| ------------------------------- | -------------------------------------------------------- | ----------------------------------- | ---------------------------- | ---------------------------- |
| **Downpayment** (guest form)    | `submit-form` (`paymentReceipt` file)                    | `payment_receipt_url`               | `dp_receipt_ai_verdict`      | `dp_receipt_ai_summary`      |
| **Downpayment** (admin replace) | `upload-booking-asset` → `payment_receipt`               | `payment_receipt_url`               | `dp_receipt_ai_verdict`      | `dp_receipt_ai_summary`      |
| **Guest balance**               | `upload-booking-asset` → `guest_balance_payment_receipt` | `guest_balance_payment_receipt_url` | `balance_receipt_ai_verdict` | `balance_receipt_ai_summary` |
| **Parking** (separate payment)  | `upload-booking-asset` → `parking_payment_receipt`       | `parking_payment_receipt_url`       | `parking_receipt_ai_verdict` | `parking_receipt_ai_summary` |

Parking AI runs only when the admin uploads a **separate** parking receipt (`ParkingRequestForm` with **Included from downpayment receipt** unchecked). When parking is included in the downpayment, no parking receipt URL is stored and parking AI columns are cleared on transition.

**Migrations:** `20260717120000_receipt_ai_validation_columns.sql` (downpayment + balance), `20260718120000_parking_receipt_ai_validation.sql` (parking), `20260719120000_valid_id_ai_validation.sql` (valid ID).

### 2.1 Valid ID (guest document)

| Document                     | Upload path                         | DB URL column  | AI verdict column     | AI summary column     |
| ---------------------------- | ----------------------------------- | -------------- | --------------------- | --------------------- |
| **Valid ID** (guest form)    | `submit-form` (`validId` file)      | `valid_id_url` | `valid_id_ai_verdict` | `valid_id_ai_summary` |
| **Valid ID** (admin replace) | `upload-booking-asset` → `valid_id` | `valid_id_url` | `valid_id_ai_verdict` | `valid_id_ai_summary` |

Accepts **images and PDF** (PhilSys, passport, driver's license, UMID, and similar government photo IDs). **Non-blocking** — invalid verdict is informational only (does not gate workflow). UI: **Guest Information** card `DocPreview` + preview modal compact pill (same as payment receipts).

---

## 3. Verdicts and blocking behavior

| Verdict        | Meaning                                                                    | Guest form submit | Admin workflow                                           |
| -------------- | -------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------- |
| `valid`        | Clear transfer screenshot **or** clear PHP cash payment photo              | Allowed           | Allowed                                                  |
| `likely_valid` | Probably payment proof; some fields blurry or cropped                      | Allowed           | Allowed                                                  |
| `unclear`      | Cannot confidently classify                                                | Allowed           | Allowed (UI warns)                                       |
| `invalid`      | Clearly not payment proof (not a transfer screenshot or cash photo)        | Allowed           | **Blocked** on balance settlement and parking completion |
| `skipped`      | No API key, storage/URL issue, or empty image (not a Gemini model failure) | Allowed           | Allowed (no badge)                                       |

**Blocking rules (admin only):**

- **Balance receipt:** `READY_FOR_CHECKIN` → `READY_FOR_CHECKOUT` is rejected server-side when `balance_receipt_ai_verdict === 'invalid'` and a receipt URL is **required** (total guest balance **> ₱0**). **Airbnb** bookings exclude stay rate / DP / SD from that total — only pet + additional fees count; when the fee total is ₱0, no receipt is required and AI blocking does not apply. `GuestBalanceSettlementForm` mirrors this in the UI.
- **Parking receipt:** Mark complete / forward from `PENDING_PARKING_REQUEST` is rejected when a separate parking receipt is required and `parking_receipt_ai_verdict === 'invalid'`. `ParkingRequestForm` mirrors this in the UI.
- **Booking edit mode** (`editMode` on settlement / parking forms): AI blocking is relaxed so admins can save other fields without being forced through workflow gates.

Guest **`submit-form`** never blocks on AI result — downpayment validation is **informational** for ops.

---

## 4. Flow diagrams

### 4.1 Guest downpayment (public form)

```
Guest uploads paymentReceipt on /form
  → submit-form saves row + storage
  → validateReceiptFile(paymentReceipt)  [non-fatal]
  → PATCH dp_receipt_ai_* on guest_submissions
  → sendNewBookingRequestNotify (email includes AI section)
  → notifyTelegramAdminNewBooking (placeholders if template includes them)
```

### 4.2 Admin balance / parking / downpayment replace

```
Admin uploads via upload-booking-asset
  → Storage upload + column update
  → validateReceiptFile(file) when assetType is a payment receipt type
  → PATCH *_receipt_ai_* columns
  → Response JSON includes receiptValidation for immediate UI badge
  → (balance only) syncPricingReviewBalanceReceipt — merge invalid/unclear flags into AI Summary Pricing
  → (balance only) notifyTelegramAdminBalanceReceiptUploaded
```

### 4.3 Workflow transition guards

```
transition-booking → WorkflowOrchestrator
  → RFCI → RFCO: checkGuestBalanceSettlement + balance_receipt_ai_verdict
  → Parking complete / PENDING_PARKING_REQUEST forward: assertParkingPaymentReceiptIfRequired + parking_receipt_ai_verdict
```

### 4.4 Admin detail page backfill (legacy rows)

```
Admin opens /bookings/:bookingId
  → useReceiptAiBackfill (client) when receipt or valid ID URL exists but `*_ai_verdict` is empty
  → POST validate-booking-receipts { bookingId }  [once per page visit; skips COMPLETED / CANCELLED]
  → download image/PDF from Storage → validateReceiptFromStorageUrl / validateValidIdFromStorageUrl
  → PATCH dp / balance / parking AI columns (only when Gemini returns a real verdict or config `skipped`)
  → On Gemini/network failure: no DB write; one simplified Sonner toast; retry on next page visit
  → Booking detail Pricing card DocPreview shows compact AI pill on receipt label
```

---

## 5. AI response shape

Gemini returns JSON (enforced via `responseMimeType: application/json`):

```json
{
  "verdict": "valid | likely_valid | unclear | invalid",
  "confidence": 0.0,
  "summary": "One short sentence for an admin.",
  "has_amount": true,
  "has_date": true,
  "has_reference": true
}
```

Only `verdict` and `summary` are persisted to Postgres. `confidence` and `has_*` flags are available in the `upload-booking-asset` response for debugging but are not stored on the booking row.

---

## 6. Notifications and UI

### Email

**New Booking Request** (`sendNewBookingRequestNotify` / `new-booking-request.html` body builder) adds a **Downpayment receipt AI check** section when `dp_receipt_ai_verdict` or `dp_receipt_ai_summary` is present — colored verdict badge + summary text.

### Telegram (admin ops)

Placeholders in **`telegram_admin_settings`** templates (via `buildAdminBookingPlaceholders`):

| Placeholder                      | Source                                        |
| -------------------------------- | --------------------------------------------- |
| `{{dp_receipt_ai_verdict}}`      | Human label from `dp_receipt_ai_verdict`      |
| `{{dp_receipt_ai_summary}}`      | `dp_receipt_ai_summary` or `N/A`              |
| `{{balance_receipt_ai_verdict}}` | Human label from `balance_receipt_ai_verdict` |
| `{{balance_receipt_ai_summary}}` | `balance_receipt_ai_summary` or `N/A`         |

Default **new booking** template (migration `20260717120000`) includes downpayment AI lines. **Balance receipt uploaded** uses `balance_receipt_uploaded_template` (instant on admin upload, deduped per receipt URL). **Balance receipt needed** hourly reminders use `balance_receipt_template` without AI placeholders — migration `20260721120000` / `20260721140000` restore the split if `20260717120000` overwrote the hourly copy with "Uploaded".

Parking AI is shown in **`ParkingRequestForm`** on the booking detail workflow panel; there is no separate instant Telegram template for parking receipt upload today.

### Admin UI

| Location                            | Component                                                 | What shows                                                                                               |
| ----------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Booking detail → Pricing card       | `BookingDetailPage` `DocPreview` + `useReceiptAiBackfill` | Compact AI pill on downpayment / balance receipt preview label; auto-backfill when verdict missing       |
| Workflow → Guest balance settlement | `GuestBalanceSettlementForm`                              | Inline badge, toast, blocks proceed if `invalid`. Auto-validates on upload (no separate Validate button) |
| AI Summary → Pricing                | `BookingAiSummaryResults`                                 | Invalid / unclear balance receipt (or missing at check-in) appears as a Pricing finding                  |
| Workflow → Parking request          | `ParkingRequestForm`                                      | Inline badge, toast, blocks complete if `invalid`                                                        |

---

## 7. Environment and setup

### Edge secret

```bash
# supabase/.env.local (local) or Supabase Dashboard → Edge Function secrets (hosted)
GEMINI_API_KEY=your_google_ai_studio_key
```

Get a key from [Google AI Studio](https://aistudio.google.com). Free tier is sufficient for typical booking volume.

### Settings integration check

On **Property → Settings → Integrations → AI services**:

- **`platformSecrets.geminiApiKeyConfigured`** / **`groqApiKeyConfigured`** — whether primary / fallback AI keys are present in the Edge runtime (no values exposed).
- **Test connection** — `POST app-settings` with `{ "action": "verify_ai" }` (legacy alias `verify_gemini`). Pings the configured primary provider with a minimal text request.

After changing secrets locally, restart **`functions serve`**. On hosted Supabase, redeploy is not required for secret-only changes — allow a minute for Dashboard secret propagation.

### Migrations

Apply after deploy:

```bash
supabase db push
```

Required migrations: `20260717120000_receipt_ai_validation_columns.sql`, `20260718120000_parking_receipt_ai_validation.sql`.

### Local testing

1. Set `GEMINI_API_KEY` in `supabase/.env.local`.
2. Run `supabase functions serve` with env file.
3. **Guest path:** submit `/form` with a real receipt image; check Edge logs for `[submit-form] Downpayment receipt AI: …` and the New Booking Request email.
4. **Admin path:** on `/bookings/:id`, upload balance or parking receipt; confirm badge + `receiptValidation` in network response.

---

## 8. Code map

| Concern                            | File                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Gemini API + verdict helpers       | `supabase/functions/_shared/receiptValidationService.ts`                                                                    |
| Guest downpayment validation       | `supabase/functions/submit-form/index.ts`                                                                                   |
| Admin receipt uploads              | `supabase/functions/upload-booking-asset/index.ts`                                                                          |
| Detail-page backfill               | `supabase/functions/validate-booking-receipts/index.ts`, `ui/src/features/dashboard/bookings/hooks/useReceiptAiBackfill.ts` |
| Transition blocking                | `supabase/functions/_shared/workflowOrchestrator.ts`                                                                        |
| New booking email section          | `supabase/functions/_shared/emailService.ts`                                                                                |
| Telegram placeholders              | `supabase/functions/_shared/telegramAdmin.ts`                                                                               |
| Revert-to-review clears parking AI | `supabase/functions/_shared/statusMachine.ts`, `ui/src/features/dashboard/bookings/lib/bookingStatus.ts`                    |
| UI badge component                 | `ui/src/features/dashboard/bookings/components/ReceiptAiVerdictBadge.tsx`                                                   |
| Balance form                       | `ui/src/features/dashboard/bookings/components/GuestBalanceSettlementForm.tsx`                                              |
| Parking form                       | `ui/src/features/dashboard/bookings/components/ParkingRequestForm.tsx`                                                      |

---

## 9. Operational notes

- **Gemini outages (503 / rate limits):** Verdict columns stay empty; booking detail shows a short error toast (never the raw API dump). Refresh the page to retry backfill, or re-upload the receipt.
- **Legacy `skipped` rows from API errors:** If a booking already has `dp_receipt_ai_verdict = 'skipped'` from before this change, clear those columns in SQL once, then reopen the booking or re-upload.
- **Replacing a receipt:** Uploading a new image re-runs validation and overwrites the previous verdict/summary.
- **Included parking:** Checking **Included from downpayment receipt** clears `parking_payment_receipt_url` and parking AI columns on the next parking transition that sets `parking_fee_included_in_downpayment` to true.
- **Guest form updates without new file:** If the guest updates the booking without re-uploading `paymentReceipt`, downpayment AI is **not** re-run (no new file in `FormData`).
- **Costs:** Gemini 2.5 Flash free tier (~1,500 requests/day) is adequate for this app; each receipt image is one API call.

---

## 10. Future extensions (not implemented)

- AI validation for pet documents or SD refund receipts
- Telegram template placeholders for `{{parking_receipt_ai_verdict}}`
- Amount matching against `down_payment` / `parking_rate_guest` / computed guest balance
- Re-run validation from admin “Re-check receipt” button without re-upload
