---
title: 'Integrations'
status: active
tags: [architecture, integrations]
updated: 2026-09-01
---

# Integrations

Part of the [`docs/PROJECT.md`](../PROJECT.md) architecture split. Cross-links: [`docs/archive/reference/telegram-marketing-reminders.md`](../archive/reference/telegram-marketing-reminders.md), [`docs/archive/reference/ai-payment-receipt-validation.md`](../archive/reference/ai-payment-receipt-validation.md).

**Browser third-party origins (CSP):** [`third-party-origins.md`](./third-party-origins.md). Server-only processors (Resend, PayMongo redirects, Meta OAuth) stay in the sections below.

---

## 9. Integrations detail

### 9.1 Email (Resend)

- **New Booking Request** (`new-booking-request.html`, `sendNewBookingRequestNotify`): **internal** mail on successful **`submit-form`** DB save when **`sendEmail` ≠ `false`** (guest dev panel **Send email** checkbox). **To:** **`EMAIL_REPLY_TO`** only (unit owners / ops inbox). **Reply-To:** guest’s **`guest_email`**. Body sections: **Stay details** (check-in, check-out, nights, pax), **Guest details** (Facebook name, primary name, address, phone, email, **Facebook \| Airbnb** source), **Notable information** (pay parking, pet approval, surprise decor), **Downpayment receipt AI check** (verdict + summary when Gemini validation ran). Includes **View booking details** CTA to **`/bookings/{id}`**. Same-day check-in uses the same **urgent** subject prefix and body callout as other ops-facing templates. Requires **`RESEND_API_KEY`** + **`EMAIL_REPLY_TO`** (does not require **`EMAIL_TO`**).
- **GAF** mail: HTML body, filled GAF PDF attachment, **plus each guest valid ID image on file** (primary + guests 2–4, downloaded from Storage), subject includes date range, **urgent** styling for same-day check-in (Philippines timezone), **update** copy when `isUpdate`. Guest-facing dates in templates/subjects are formatted as **`MMM D, YYYY`** (e.g. `Jun 13, 2026`). Sent only on transition **`PENDING_REVIEW → PENDING_DOCUMENTS`**; the orchestrator generates a fresh GAF PDF (`pdfService.generatePDF`) during that transition and attaches it to the outgoing Azure request email.
- **Pet** mail: separate flow when pet fields complete; attachments/links for pet PDF and images. Sent only on transition **`PENDING_REVIEW → PENDING_DOCUMENTS`** when `has_pets = true`.
- **Booking acknowledgement** (guest) and **Parking broadcast** (owners) are also sent only on **`PENDING_REVIEW → PENDING_DOCUMENTS`**.
- **SD refund / check-out email** (`sd-refund-form-request.html`, `sendSdRefundFormRequest`): sent from **`sd-refund-cron`** when the pre-check-out lead window opens (independent of balance settlement, idempotent via `sd_refund_form_emailed_at`), and on **`READY_FOR_CHECKIN` → `READY_FOR_CHECKOUT`** when `sendSdRefundFormEmail` is on and the guest was not already emailed. Subject is **`{tower_and_unit_number} - Check-out & SD Refund Details ({dates})`** (fallback label **`Monaco 2604`** if the column is empty). Body matches the booking-ack-style shell: **Kame Space** + unit line, **check-out checklist** table (house-rules-style two-column rows), then **Refund details** copy and CTA to **`/sd-form`**. No Facebook review / voucher messaging.
- **Same-day check-in (Asia/Manila):** when check-in equals “today”, `emailService.ts` prepends **`🚨 URGENT - `** to **subject lines** for **GAF Request**, **Pet Request**, **Parking Request** (Azure / owners), and **New Booking Request** (notify to **`EMAIL_REPLY_TO`**). **`{{urgent_notice}}`** in the configurable template body is filled for those four templates only (empty when not same-day). **Booking acknowledgement**, **ready-for-check-in**, and **SD refund form request** do not use the urgent callout. **`buildUrgentSameDayCallout`** outputs the lines **Urgent! Same-day check-in!** / **This request requires immediate attention and approval.** with **inlined** table cell styles (not only `<head>` classes) so the red callout stays visible in clients that strip stylesheets (e.g. Gmail). GAF/pet/parking **resubmit** copy uses **`{{update_notice}}`** (empty on first send). Legacy static HTML under `email-templates/*.html` still references `{{urgentBlock}}`; live sends use property templates + `configurable-template-send.html`.
- From address uses **kamehomes.space** domain (see `emailService.ts`).
- **HTML bodies** live under `supabase/functions/_shared/email-templates/`. **Workflow / legacy full-document** `.html` files use `{{placeholder}}` tokens with inlined shell styles (`withEmailShellStyleVars`). **Standalone transactional** mail (guest chat reply, contract lifecycle, org verification rejected, subscription billing, support ticket notify/reply) uses **body-only** HTML (or inline body builders) wrapped by **`renderBrandedEmailShell`** (`_shared/brandedEmailShell.ts` → **`fragments/configurable-template-send.html`**) — same accent bar, logo, brand micro, card, CTA, and legal footer as property template sends. For Gmail reliability, critical shell/table/callout typography and spacing are inlined (`style=""`) via `withEmailShellStyleVars(..., brandColorHex)` plus template-level inline styles on `td` cells, not class-only styling. Accent bar, CTA buttons, step numbers, and attachment callout borders use the org **`brandColor`** (default `#24a88e`). `renderEmailHtml.ts` loads templates (`Deno.readTextFile`, cached) and `replacePlaceholders` merges values; use `escapeHtml()` for guest-supplied text. **Header logo:** shells include `{{emailHeaderLogo}}` (from `fragments/email-header-logo.html`) and use org `emailLogoUrl` or the default `the public app origin + `/images/logo.png``. Logos render in a fixed **80×80px square** (`object-fit: cover`, centered crop); Outlook uses a background-image fallback. **Ready-for-check-in** (`ready-for-checkin.html`): uses an `800px` wrapper (others remain `600px`) for long payment tables; below the \*_Payment breakdown_
- **Property Templates admin** (`/org/.../property/.../templates`): editable copy is stored in **`property_template_contents`** and previewed via **`property-templates-preview`** (same **`renderPropertyTemplateSendEmail`** + **`fragments/configurable-template-send.html`** as live sends). **Live workflow sends** for the seven **email** keys resolve body HTML from the DB (fallback: shipped defaults in `propertyTemplates.ts`) via **`propertyTemplateEmail.ts#renderPropertyTemplateSendEmail`**. Dynamic blocks (detail tables, payment breakdown, GCash QR, check-out checklist, CTAs) are **`{{placeholders}}` in template body**, filled at send/preview by **`propertyTemplateEmailSections.ts`**. **Standard** templates (house rules, check-in/out, parking reminders) render on the token-gated guest **stay guide** page (`/properties/:slug/stay-guide?token=`). See **[[templates|Property templates]]** and **[[stay-guide|Guest stay guide (token-gated brochure)]]**. Legacy full-document files under **`email-templates/*.html`** remain for reference.
- **Parking broadcast** (`parking-broadcast.html`): a **selectable copy block** (unit, guest name, check-in/out dates, vehicle, plate) built by `buildParkingBroadcastCopyText()` in `renderEmailHtml.ts`. Check-in/out use **`parking_check_in_date` / `parking_check_out_date`** when set, else booking stay dates (dates only, no times in the copy block). Recipients select the text and copy manually — webmail clients strip JavaScript, so one-click copy buttons do not work in email.
- **Placeholder HTML** (layout only; `{{placeholders}}` stay literal): `npm run preview:emails:serve` then open **`http://localhost:3334/`** or e.g. **`http://localhost:3334/gaf-request.html`**. The **`.html`** suffix is required (`…/gaf-request` without it returns **404**). The server root is `email-templates/`, so paths like `/email-templates/…` also **404**.
- **Filled HTML** (real copy + one `guest_submissions` row): `npm run preview:emails:db` reads `SUPABASE_URL` and **`SUPABASE_SERVICE_ROLE_KEY`** from `supabase/.env.local` (or the environment), prefers a **non-test, non-cancelled** row with **`has_pets` and `need_parking`**, then writes `email-templates/_preview/*.html` plus `_preview/preview-meta.json` (source row id + query label). If the DB is empty or credentials are wrong, a **built-in demo** row is used. **`npm run preview:emails`** runs the DB step then starts the static server; use **`preview:emails:serve`** to serve only without regenerating.

### 9.2 Approval email inbound (Resend Receiving)

- Production GAF/pet approvals: Azure replies to **`approvals+{propertySlug}@{RESEND_APPROVAL_INBOUND_DOMAIN}`** (set as **Reply-To** on outbound GAF/pet request emails; ops **`emailReplyTo`** is CC’d).
- Webhook: **`approval-email-webhook`** verifies Svix signature (`RESEND_INBOUND_WEBHOOK_SECRET`), matches via **`approvalEmailMatcher.ts`**, uploads PDF, transitions through **`WorkflowOrchestrator`**, dedupes with **`processed_emails`**.
- Admin recovery: **Mark as Complete** (manual PDF upload if the inbound approval never arrived).
- Runbook: **[[approval-email-inbound|Approval email inbound]]**.
- Connect Google / Gmail OAuth removed — hosts do not connect Google for production approval intake.
- **Bounce/complaint suppression:** the same webhook also receives **`email.bounced`** / **`email.complained`** events (already Svix-verified) and upserts every recipient into **`email_suppressions`** (`_shared/emailSuppression.ts`). Guest-lifecycle sends (**booking acknowledgement**, **ready-for-check-in**, **SD refund form request**) call `isEmailSuppressed(booking.guest_email)` first and skip (fail-open on lookup error) rather than repeatedly mailing a dead/complaining address — a spike of those harms Resend domain reputation for every subsequent send. Ops-facing sends (GAF/pet/parking/new-booking-notify) and support-ticket mail are not gated.

### 9.3 PayMongo (org subscription billing)

Host → platform recurring plan payments via **Payment Links** (QRPH, Maya, online banking — whatever rails are enabled on the GFM PayMongo merchant account). Billing is org-level only — one subscription per org, priced per enrolled property.

- **Checkout:** **`create-org-subscription-checkout`** creates a link + **`org_payment_transactions`** row (`pending`); host pays on PayMongo-hosted checkout. Handles first purchase, tier switch, and property add/remove in one function.
- **Webhook:** **`paymongo-webhook`** verifies **`Paymongo-Signature`** (`paymongoWebhookVerify.ts`), dedupes **`processed_paymongo_events`**, delegates fulfillment to **`subscriptionOrchestrator.ts`** (`link.payment.paid` / `payment.paid`, `payment.failed` for ledger only).
- **Renewal / dunning:** **`platform-billing-cron`** (daily, `sync_platform_billing_cron_job()`) creates renewal links **`renewal_link_lead_days`** before **`current_period_end`**, marks **`past_due`** at period end, **`suspended`** after **`grace_period_days`** (clawing back pooled team seats on suspension), sends Resend billing emails. Free/default plans excluded.
- **Access:** **`RequirePropertySubscriptionAccess`** — a **`suspended`** org's properties can only open **Plans & Billing** + **Help & Support** in the dashboard; guest booking flows are not blocked.
- **Secrets:** **`PAYMONGO_SECRET_KEY`**, **`PAYMONGO_WEBHOOK_SECRET`**, optional **`PLATFORM_BILLING_CRON_SECRET`**. Setup: **`docs/archive/operations/paymongo-billing-setup.md`**.

### 9.4 PDF

- `_shared/pdfService.ts` generates the filled main guest GAF PDF and optional pet request PDF; invoked from **`workflowOrchestrator`** when admins transition **`PENDING_REVIEW` → initial documents** (dev control `generatePdf`), gated by the property's resolved **`documentRequirements[]`** list (`documentRequirements.ts` — only requirements with a matching `pdfTemplateId` run). Properties with an **empty** requirements override skip `PENDING_DOCUMENTS` and go straight to **`READY_FOR_CHECKIN`** (D2). PDFs attach to GAF/pet request emails and optionally upload to Storage (`gaf_request_pdf_url`, `pet_request_pdf_url` on `guest_submissions`). **`generatePDF` / `generatePetPDF`** re-apply **`applyGafDefaultsToFormData`** at generation time so owner/unit fields and the uploaded signature always reflect current **Settings → GAF Details** / **Pet Details** (shared `app_settings` keys — not a stale booking-row snapshot). Guest names on the GAF PDF append **`(N years old)`** when age is **≤ 3** (`gafGuestDisplay.ts`). The GAF template is **`guest-form-template.pdf`**; the pet template is **`pet-form-template.pdf`** — both in Storage bucket **`templates`** (service role read at runtime). **Admin PDF previews** load **`ui/public/templates/guest-form-template.pdf`** and **`ui/public/templates/pet-form-template.pdf`** — after editing a template in Acrobat, copy/upload the same file to Storage so workflow-generated PDFs match. GAF AcroForm fields filled by code include **`unitOwnerSignatureName`**, **`unitOwnerSignature_es_:signer:signature`** (uploaded signature image drawn into the widget), and **`carparkSlotNumber`** (optional on `GuestFormData`; empty until a slot is assigned). Pet form fields include **`unitOwner`**, **`unitTower`**, **`unitNumber`**, **`unitOwnerSignatureName`**, **`unitOwnerSignature`** (signature image), plus guest booking fields **`petName`**, **`petType`**, **`petAge`**, **`petBreed`**, **`petVaccinationDate`**, **`checkInDate`**.

### 9.5 Observability — PostHog (product analytics only)

Sentry owns faults, PostHog owns outcomes. Contract: [`observability.md`](./observability.md).

- **Client** (`ui/src/lib/posthog/`): `posthog-js` singleton in `client.ts` with
  `capture_exceptions: false` and `capture_performance: false` — errors and web vitals belong
  to Sentry. `person_profiles: 'identified_only'`, replay off in production unless
  `VITE_POSTHOG_SESSION_REPLAY=true`, first-party `/ingest` in production via
  `VITE_POSTHOG_INGEST_PATH` (`ui/vercel.json` rewrites). Unset `VITE_POSTHOG_KEY` → no-op.
- **`before_send`** (`beforeSend.ts`): strips `?access=` / `?complete=` / `?token=` from
  `$current_url`, `$referrer` and both `$initial_*` variants, **drops `$web_vitals` events**
  (the project setting overrides the client flag, so the guarantee lives here), and drops the
  whole event if scrubbing throws.
- **Events**: typed catalog (`catalog.ts`) + `captureAppEvent` (`capture.ts`), PII denylist
  from `lib/telemetry/scrub.ts`, shared props from `context.ts` (`environment`, `app_track`,
  `app_release`, `persona`, `surface`, org/property/parking ids). `analytics_mode` is
  `full` | `sampled` | `off` (a stored `errors_only` reads as `off`).
- **Identity + groups**: `PostHogIdentitySync.tsx` sends `auth_signed_in` / `auth_signed_out`,
  sets `is_internal: true` for `VITE_SUPER_ADMIN_EMAILS` accounts, and omits guest email.
  `PostHogAdminScopeSync` registers the `organization` / `property` / `parking` groups.
- **Server conversions**: `capturePostHogEvent` in `_shared/posthog.ts`, after the write
  succeeds, off the response path (`runAfterResponse`), with `app_release` and optional
  `$groups`. Client fires funnel **steps**, edge fires **completed** actions.
- **Edge choke points**: `handleEdgeError` and `serveCronPost`. PostHog capture happens only
  for product events — the exception channel was removed in phase P1.
- **Guard**: `scripts/dev/check-posthog-analytics-only.sh` fails CI if `captureException`,
  `$exception`, `PostHogErrorBoundary` or `captureAppException` reappear.

### 9.6 Observability — Sentry (errors)

- **Browser**: `@sentry/react` initialised once in `lib/sentry/init.ts` — release from
  `VITE_APP_VERSION` (git SHA), `environment` from the same resolver as PostHog, route-aware
  tracing, extension frames denied, no replay, no feedback widget. All SDK calls go through
  `lib/sentry/capture.ts`; `scripts/dev/check-sentry-imports.sh` keeps the import inside
  `lib/sentry/**`.
- **Choke points**: React 19 root hooks and both error boundaries, TanStack `QueryCache` /
  `MutationCache` (`reportQueryError`, skips abort / offline / 401 / all 4xx), and the edge
  fetch wrappers (`adminEdgeFetch`, `callEdgeFunction`, `publicEdgeFetch`) which send
  `x-request-id` and report 5xx / network faults.
- **Edge**: lightweight envelope client `_shared/sentry.ts` (no Deno SDK — cold start),
  capturing at `handleEdgeError`, `serveCronPost` and `withEdgeErrorCapture`, with release
  from `APP_RELEASE`, `user.id`, trace context from the browser, per-isolate dedupe and a
  30/min cap. `captureSideEffectFailure` covers email / PDF / calendar / Telegram side effects
  that fail after the request succeeded.
- **Crons**: one monitor on the free tier, `sd-refund-cron` (`_shared/sentryCron.ts`);
  `cronMonitorConfig_test.ts` fails if a second starts sending check-ins.
- **Source maps**: `@sentry/vite-plugin` uploads hidden maps when `SENTRY_AUTH_TOKEN`,
  `SENTRY_ORG` and `SENTRY_PROJECT` are set, then a `closeBundle` hook deletes any surviving
  `.map` so a failed upload can never ship source.
- **Privacy**: `sendDefaultPii` does not exist in SDK 11 — no email, no IP, `user.id` only;
  requests run through `_shared/telemetryScrub.ts` / `lib/telemetry/scrub.ts`.
- **Docs**: [`observability.md`](./observability.md) · runbook
  [`sentry-runbook.md`](../archive/operations/sentry-runbook.md) · drill
  [`observability-manual.md`](../guides/testing/observability-manual.md).
