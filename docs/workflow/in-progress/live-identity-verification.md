---
stage: in-progress
title: 'Live Identity Verification — guided capture, phone handoff, PhilSys QR, liveness'
status: in-progress
tags: [planning, in-progress, identity, verification, guest, host, super-admin, trust-safety]
updated: 2026-11-07
---

# Live Identity Verification

Replace today's "pick a file from your gallery" identity capture — on both the **guest booking form** and the **host/org verification** flow — with one shared **guided live capture** module: desktop starts it, a QR hands it to the phone, the phone auto-captures the document, reads the **PhilSys QR** or passport **MRZ** cryptographically where available, runs an **on-device active liveness** check, and submits a structured verdict instead of a bare image. Hosts and super admins then review a decision, not a photo.

Resolves the intake line in [`../intake/_to-dos.md`](../intake/_to-dos.md): _"Implement quick and live verification to simplify real identity verification for the safety of the clients/bookings."_ Supersedes roadmap items **#3** (ID-photo verification at booking submit), **#17** (org verification pre-check), and **#18** (approvals queue pre-screening) in [`./ai-opportunities-roadmap.md`](./ai-opportunities-roadmap.md).

## Goal

Three problems, one module.

**1. Capture is manual and lossy.** A guest on a laptop has to photograph their ID with a phone, transfer the file, find it in Downloads, and upload it — per adult guest, up to five per booking. A host at onboarding does the same for a Valid ID, a Facebook screenshot, and (Tier 2) a selfie-holding-ID. There is no camera path, no cropping guide, no auto-capture, and no cross-device handoff anywhere in the app.

**2. Verification is eyeball-only.** Nothing proves the document is real or that it belongs to the person booking. Guest IDs get an **advisory** AI verdict (`valid_id_ai_verdict`) that only runs when a host clicks _Run checks_ or replaces the file, is gated behind the `aiValidations` plan key, never blocks a transition, and discards the extracted name/age/nationality instead of persisting them. Host/org documents get **zero** automation — a super admin opens `SuperAdminApprovalReviewDialog`, looks at two images, and clicks Approve. There is no liveness check, no face match, and no document-authenticity signal in the product.

**3. We store sensitive images we often do not need.** Every adult guest's government ID is persisted indefinitely in the private `valid-ids` bucket with no retention or purge routine (see [`../in-progress/production-readiness/checklist/20-storage.md`](../in-progress/production-readiness/checklist/20-storage.md)). The NPC's [reminder on taking pictures of IDs](https://privacy.gov.ph/wp-content/uploads/2023/08/Reminder_Taking-of-Pictures-of-ID.pdf) and [Circular 2022-03](https://privacy.gov.ph/wp-content/uploads/2023/05/NPC-Circular-No.-2022-%E2%80%93-03-Private-Security-Agencies.pdf) both push the opposite way: verify, do not hoard. A cryptographic PhilSys QR read gives us a _stronger_ signal than a photo while letting us keep far less data.

This plan delivers a free, in-house **Track A** that ships end to end, plus a provider-adapter **Track B** so a paid KYC vendor can be switched on later without reworking the UI, DB, or review surfaces.

---

## Status (2026-11-07)

Track A is implemented end to end on `feat/live-identity-verification`.

| Phase                                   | State                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 0 — decisions, licensing, privacy basis | Done — `docs/architecture/identity-verification.md`, `docs/architecture/data-privacy-identity.md` |
| 1 — session core + handoff              | Done — 2 tables, bucket, HMAC token, 9 edge functions, `/verify/:token`, polling                  |
| 2 — live capture + PhilSys QR + MRZ     | Done — frame guide, auto-capture, quality gate, v1 JSON / v3 base45+CBOR, server MRZ parser       |
| 3 — liveness + face match + AI          | Done, degrading — MediaPipe loaded lazily from a pinned CDN; every failure path continues         |
| 4 — guest booking form                  | Done — per-slot identity, capture copied into `valid-ids`, GAF untouched                          |
| 5 — host verification                   | Done — Get Verified camera path + super-admin pre-screen block                                    |
| 6 — retention, account, polish          | Done — purge cron, `/account/profile` card, delete right, duplicate-document flag                 |
| 7 — paid provider                       | Interface only (see §Deferred)                                                                    |

Corrections made during the build, beyond the Revised scope above:

- **Host verification runs at registration.** `org_owner` verdicts are keyed to `owner_user_id` (migration `20261320130000`) so a host can verify before an organization exists. `create-organization` attaches the verdict at the end of the handler; the earlier rollback path would otherwise cascade-delete it. The captured photo still feeds the existing `upload-org-verification-asset` call, so `submit-org-verification` and the review queue are unchanged.
- **Liveness frames are not uploaded.** Only pass/fail, challenge names and timing are sent. The plan assumed frames were stored; storing them added biometric bytes for no additional signal.
- **No "review and correct fields" step.** A guest must not be able to type their own name onto a verification. If extraction is wrong, a human reviews; the guest sees a masked name only.
- **The submit response is the only place the verdict is read on the phone.** No client-side verdict computation, so the server stays authoritative.
- **`identity_capture_mode` is set at submit**, not at capture, so a draft that never submits leaves no stale flag.
- **`identity-verification-review` is API-only for now.** The super-admin dialog reads the pre-screen block; the override control (which needs a step-up OTP token) is a follow-up so a half-built confirm dialog is not shipped.

Verification: `bun run ci:quality` green; 56 Deno tests (verdict model, token, PhilSys QR, MRZ, session service) and 12 Vitest tests (verdict mirror parity, capture quality) added.

---

## Revised execution scope (2026-11-07)

Re-read against the code before starting. Five findings change the shape of the build. They are corrected in place below, and this section is the contract for what ships in this branch.

**1. The guest booking form is anonymous, so "account-level identity" cannot be `auth.users`-only.** `submit-form` is a public endpoint; `guest_user_id` is filled in only when a guest happens to be signed in (`tryGetAuthenticatedUser`). The majority of guests have no `auth.users` row. Any model that requires `guest_user_id` would fail for the primary flow.

**Correction:** an identity subject is a **guest subject keyed by the booking being verified**, with `guest_user_id` and `subject_email_hash` as optional linkage. Reuse across bookings happens **only** when `guest_user_id` matches (signed in). Anonymous verifications are per-booking. This is also the safer rule: an email address alone is not proof of ownership, and letting one guest reuse another person's verification by typing their email would be an identity-theft vector.

**2. Today's GAF pipeline depends on `guest_submissions.valid_id_url` (a public storage URL), not a path column.** There is no `valid_id_path` anywhere in the schema.

**Correction:** the least risky integration is additive, not replacement. When a live verification is attached to a booking slot, `submit-form` **also writes the captured front-of-document image into the existing `valid-ids` bucket** at the same deterministic key the current flow uses, and sets `valid_id_url`. GAF attachments, admin previews, `GuestAvatar`, and `upload-booking-asset` keep working with **zero changes**, and the live capture upgrades the _capture quality_ rather than forking the storage contract.

**3. `guest_submissions` ID columns are `valid_id_url`, `guest2_valid_id_url` … `guest5_valid_id_url`.**

**4. The handoff token must survive a phone reload.** The original "single-use, consumed on the first `identity-session-get`" rule bricks the session whenever iOS Safari reloads the tab or the guest backgrounds the browser. **Correction:** the token stays valid until the session reaches `completed` / `failed` or the 10-minute expiry passes. The _session_ is single-submit; the token is not. Replay after completion is rejected by status, not by token consumption.

**5. Realtime on a service-role-only table cannot be read by an anonymous desktop client.** Supabase Realtime `postgres_changes` honours RLS, and these tables deliberately have no anon read policy.

**Correction:** the desktop uses **polling** (`identity-session-get` with its own authenticated/booking-scoped handle) as the contract. Realtime broadcast is a later optimisation, not a v1 dependency. This removes a whole class of "works in dev, silent in production" failure.

### What ships in this branch

| Phase                                     | Ships now          | Notes                                                                                                                                     |
| ----------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Decisions, licensing, privacy basis   | **Docs only**      | `docs/architecture/identity-verification.md` + `data-privacy-identity.md` written. PSA eVerify paperwork is an org action, not code       |
| 1 — Session core + cross-device handoff   | **Yes**            | Tables, bucket, token, verdict model, 6 edge functions, `/verify/:token` page, handoff panel, polling                                     |
| 2 — Live capture + PhilSys QR + MRZ       | **Yes**            | Camera capture with frame guide + auto-capture, quality gate, QR decode (v1 JSON / v3 base45+zlib+CBOR), MRZ checksum read                |
| 3 — Liveness + face match + AI extraction | **Yes, degrading** | MediaPipe loaded lazily; every failure path continues the flow. AI extraction reuses the existing gateway and is gated by `aiValidations` |
| 4 — Guest booking form                    | **Yes**            | Per-slot identity, reuse for signed-in guests, capture image written to `valid-ids` so GAF is untouched                                   |
| 5 — Host / org verification               | **Yes**            | Live capture produces the Valid ID file for the existing upload path **and** records an `org_owner` verdict for review                    |
| 6 — Retention, account surface, polish    | **Yes**            | Purge cron, expiry, `/account/profile` identity card, duplicate-document flag, PostHog funnel                                             |
| 7 — Paid provider gate                    | **Interface only** | No adapter, no vendor dependency. The seam is a file plus a config key                                                                    |

**Not shipped, deliberately:** NFC/ePassport reading, email-me-the-link handoff, generated verification-summary PDF, PSA eVerify adapter. Each is recorded in §Deferred with the reason, so nobody assumes it is half-built.

**Honesty rules that are not negotiable in the UI.**

- `liveness_grade = 'clientside'` is shown as "device check", never "biometric verification".
- A PhilSys read with no configured public key is `partially_verified` at best and says "QR read", not "cryptographically verified".
- No green "Verified" badge is rendered from a client-supplied signal alone.

---

## Current state (verified against code, 2026-11-07)

Mapped by **Guest verification surfaces** and **Host verification surfaces** below.

### Guest side

| Fact                                                                                                                                                                                        | Where                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| One document only: a "Valid ID" image per guest, up to 5 (`validId`, `guest2ValidId` … `guest5ValidId`), required at age ≥ 18                                                               | `ui/src/features/guest/form/schemas/guestFormSchema.ts`, `lib/guestCounts.ts#requiresValidId`            |
| Upload tile is a hidden `<input type="file">`. **No `capture` attribute**, no camera path, no crop guide                                                                                    | `components/GuestFormValidIdUpload.tsx`                                                                  |
| No selfie, no liveness, no ID number, no date of birth captured anywhere                                                                                                                    | `guestFormSchema.ts`                                                                                     |
| Submit runs **no** AI. `docs/guides/routes/form.md:90` claims it does — the doc is stale                                                                                                    | `supabase/functions/submit-form/index.ts`, `_shared/databaseService.ts#processFormData`                  |
| Files land in private bucket `valid-ids` at `{propertyId}/{fileName}`, 12 MB ceiling, deterministic filename so a re-submit overwrites                                                      | `_shared/uploadService.ts#uploadValidId`, `_shared/bookingStoragePaths.ts`                               |
| Image re-encoding is **off by default** for guest docs (`guest-documents` rollout group held pending an OCR-regression sign-off)                                                            | `ui/src/lib/media/optimizationSurfaces.ts`                                                               |
| AI verdict columns exist per slot (`valid_id_ai_verdict` / `_ai_summary`, `guest2_` … `guest5_`) but are written only by admin-triggered paths                                              | migrations `20260719120000`, `20261011120001`; `_shared/receiptValidationService.ts#validateValidIdFile` |
| `VALID_ID_SYSTEM_PROMPT` classifies "is this a government photo ID". The batched AI Summary pass extracts name/age/nationality and flags mismatches, then **discards** the extracted values | `_shared/ai/prompts/documentValidation.ts`, `_shared/bookingAiReviewService.ts#runGuestsSection`         |
| `assertAiVerdictAllowsProceed` blocks only on `parking_receipt_ai_verdict` and `balance_receipt_ai_verdict`. **An `invalid` ID never blocks anything**                                      | `_shared/aiVerdictOverride.ts`, `_shared/workflowOrchestrator.ts`                                        |
| The only hard gate is `gafRequestSendBlockReason`: the GAF request email cannot send until every named guest has an ID file, because the images are **attached** to it                      | `_shared/workflowEmailSendPrerequisites.ts`, `_shared/emailService.ts#buildGuestValidIdAttachments`      |
| No "verified guest" concept. `guest_profiles` has no identity columns; identity is re-collected per booking                                                                                 | migration `20260920120000`, `_shared/guestProfileService.ts`                                             |
| Guest reputation is email-keyed host reviews, not identity                                                                                                                                  | `host_guest_reviews`, `_shared/guestIdentityKey.ts`, `get-guest-reputation`                              |

### Host / org side

| Fact                                                                                                                                                                          | Where                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Tier 1 ("Verified") = Valid ID + Facebook Page screenshot. Tier 2 ("Recommended") = selfie-with-ID (required) + optional platform-admin proof and business permit/BIR         | `components/verification/GetVerifiedModal.tsx`, `lib/orgVerificationTiers.ts` |
| Uploads write straight into `organizations.settings.verification.assets` **before** submit, so stored assets can diverge from what was submitted. Old files are never deleted | `upload-org-verification-asset`, `_shared/orgVerificationAssetUpload.ts`      |
| Review is 100% manual. No OCR, liveness, face match, or authenticity check exists in any verification edge function                                                           | `approve-org-verification`, `SuperAdminApprovalReviewDialog.tsx`              |
| Reviewer aids are preset reason checklists (`HOST_REQUEST_CHANGES_REASON_OPTIONS`), a "Host will see" preview, succession/unit-conflict badges, and queue sort priority       | `lib/requestChangesMessage.ts`, `lib/rejectReasonOptions.ts`                  |
| `selfie_with_id` is the de-facto liveness substitute: a static photo of a person holding a card, trivially replayed                                                           | `verificationCopy.ts#VERIFICATION_TIER2_DOC_LABELS`                           |
| Buckets `org-verification-assets` and `listing-authorization-assets`, 5 MB, `jpeg/png/webp/pdf`, 1 h signed URLs                                                              | migrations `20260922120000`, `20261011120000`                                 |
| Listing verification functions emit **no** `logActivity` or `logSuperAdminAction`                                                                                             | `submit-listing-authorization`, `approve-listing-authorization`               |
| Approvals are **not** step-up-OTP gated (documented follow-up in `admin-auth.mdc` §8)                                                                                         | `approve-org-verification`                                                    |
| Plan keys `verifiedBadgeEligible` (golden `starter`) and `recommendedBadgeEligible` (golden `growth`); both marked **N/A** for team RBAC — owner-only submission              | `planFeatures.ts`, `planFeaturePermissions.ts`                                |

### What already exists that this plan reuses

- **Supabase Realtime** is in production use (notifications, guest chat, typing, read receipts, activity feed) — `useNotificationsRealtime.ts`, `ui/src/lib/chat/useChatTyping.ts`. This is the phone-to-desktop channel; no new infrastructure.
- **HMAC capability tokens** are an established pattern: `_shared/guestBookingAccessToken.ts` (`v1.{id}.{exp}.{sig}`, base64url, constant-time compare), plus `guestStayGuide.ts`, `parkingDirectLink.ts`, `issue-guest-form-completion-token`.
- **Email OTP step-up** for sensitive writes: `_shared/settingsVerification.ts`, `_shared/superAdminVerification.ts`.
- **Vision AI with provider failover + metering**: `_shared/aiModelRouter.ts` (Gemini 2.5 Flash, Groq Llama-4-Scout fallback), `_shared/ai/llmClient.ts#generateStructured`, prompt registry in `_shared/ai/prompts/`.
- **OCR regression harness**: `supabase/functions/tests/ocrRegression.test.ts`, `tests/evals/runLiveEvals.ts`, `fixtures/ocr/expected.json`.
- **Mobile sheet primitives**: `ResponsiveModal`, `GuestDialogShell`, `ContextualActionBar`, `MobileChoiceSheet`.
- **Offline draft persistence**: `useOfflineFormDraft` (IndexedDB) — note it deliberately never stores `File` values.

---

## Research: what is actually free

### Free and usable today

| Capability                                   | Option                                                                                                                                                                                                                                                                                                                                                                                                                                                        | License / cost                                                                                                                                            | Verdict                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **PhilSys QR verification (PH national ID)** | PhilID v1 QR = JSON + **Ed25519** signature; printed ePhilID v3 QR = prefix + **base45** + zlib inflate + **CBOR**, and carries an **embedded front-facing portrait**. Format is confirmed by PSA ([public advisory](https://philsys.gov.ph/public-advisory-10/), [printed ePhilID](https://philsys.gov.ph/psa-starts-printed-ephilid-implementation/)) and by the open-source [`bettergovph/openverify`](https://github.com/bettergovph/openverify) pipeline | Signature verification is **free and offline**. Primitives available under permissive licenses (`@noble/ed25519` MIT, `cbor-x`/`@std/cbor`, `fflate` MIT) | **Adopt.** Highest-value item in this plan for a PH-first product              |
| **Passport / ICAO 9303 MRZ**                 | `identite-ts` — browser-only, MIT, TD1/TD2/TD3, checksum-validated, deterministic (no LLM)                                                                                                                                                                                                                                                                                                                                                                    | MIT, free                                                                                                                                                 | **Adopt** for passports and non-PH ID cards                                    |
| **Active liveness**                          | **MediaPipe FaceLandmarker** (`@mediapipe/tasks-vision`) — 478 landmarks + 52 blendshapes, on-device WASM/WebGL. Challenge detection from `eyeBlinkLeft/Right`, `jawOpen`, and yaw/pitch off the facial transformation matrix, with EAR/MAR fallback                                                                                                                                                                                                          | **Apache-2.0, no usage limits, no API calls**                                                                                                             | **Adopt**, with the caveat below                                               |
| **QR / barcode decode**                      | Native `BarcodeDetector` where available, `zxing-wasm` or `jsQR` fallback                                                                                                                                                                                                                                                                                                                                                                                     | Apache-2.0 / MIT                                                                                                                                          | **Adopt**                                                                      |
| **Document edge detection + auto-capture**   | `jscanify` (OpenCV.js) or a hand-rolled Sobel/contour pass on a downscaled frame                                                                                                                                                                                                                                                                                                                                                                              | MIT / Apache-2.0                                                                                                                                          | **Adopt** (hand-rolled preferred — OpenCV.js is ~8 MB)                         |
| **Field extraction + face match (advisory)** | Existing `aiModelRouter` → Gemini 2.5 Flash vision, Groq fallback                                                                                                                                                                                                                                                                                                                                                                                             | Already provisioned and metered in this repo                                                                                                              | **Adopt** — extend `receiptValidationService.ts`, do not build a parallel path |
| **Cross-device handoff**                     | Supabase Realtime channel + HMAC capability token                                                                                                                                                                                                                                                                                                                                                                                                             | Already in the stack                                                                                                                                      | **Adopt**                                                                      |

### Hard caveats on the free track

- **MediaPipe's model is ~13 MB** on first use (then cached). The performance audit already flags a single 10.5 MB main JS chunk ([`performance-optimization-production-readiness.md`](../in-progress/production-readiness/audits/performance-optimization-production-readiness.md)). Everything in this module **must** be a lazy route-level chunk loaded only when verification starts, and the model must come from a pinned CDN or our own storage, never the app bundle.
- **Client-side liveness runs on an untrusted device.** It defeats a held-up photo, a static dummy head, and a naive replay. It is **not** iBeta PAD and will not stop a determined attacker with a video injection or virtual camera. Our verdict model must call it `liveness_passed_clientside`, never `liveness_certified`, and a server-side check (Gemini + human) must always own the decision.
- **`verify.philsys.gov.ph/api/verify` is not a published public API.** `openverify` reaches it by replaying browser cookies and a user agent. **Do not do this.** We use the **offline signature check** (fully legitimate: the signature is on the card, the public key is a published verification key) and treat _card activation/revocation status_ as unavailable unless we complete official **National ID eVerify** onboarding (PSA regulatory → DICT API key → 3-year subscription; see [PSA](https://rsso11.psa.gov.ph/content/national-id-everify-new-era-identity-verification)).
- **`openverify` has no license file** (`"license": null` on the GitHub API). We may read it as a **format reference** only. All code must be written from the PSA spec plus permissively-licensed primitives. A Phase 0 task records this decision.
- **`mrz-scanner` (alsenet-labs) is AGPL-3.0 — unusable here.** `identite-ts` (MIT) is the pick. Do not let a well-meaning contributor swap them.
- Face match via Gemini is a **comparison opinion**, not a biometric similarity score. No FAR/FRR, no threshold tuning. Good enough for an advisory flag; not good enough to auto-approve.

### Paid options — evaluated, deferred to a decision gate

| Provider                    | Free allowance (Nov 2026)                                                                                                                                                                        | Unit price                                                                                                            | PH support                                                                                                        | Notes                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Didit**                   | Work-email orgs get **$10/month credit** across modules (the previous 500-free-per-feature model was replaced on 2026-11-01). Free sandbox with forced outcomes, 500 sessions/24 h, never billed | **$0.33** full KYC bundle · $0.15 ID · $0.10 passive liveness · $0.15 active · $0.05 face match 1:1 · $0.03 device/IP | **PhilID + UMID** in one session, cross-checked against the PH residential registry and credit-bureau header data | **Top candidate.** iBeta PAD L1. Public docs, no sales call, SDKs for Web/iOS/Android/RN/Flutter. $10/mo ≈ 30 full KYC or 66 ID-only checks                                            |
| **Stripe Identity**         | Sandbox only                                                                                                                                                                                     | ~$1.50/verification                                                                                                   | Yes                                                                                                               | Self-serve, excellent docs, built-in QR phone handoff. Priciest per check                                                                                                              |
| **Persona**                 | Reported 500 gov-ID verifications/month on Starter; 60-day sandbox                                                                                                                               | Per verification, published only in Startup Program terms                                                             | Yes                                                                                                               | Essential plan carries a **12-month minimum term**. Retention docs contradict themselves ("indefinitely" vs 3 years) — a problem for our own privacy notice                            |
| **Veriff**                  | 15-day trial, ≤ 50 sessions; unlimited sandbox                                                                                                                                                   | $0.80–$1.89 + **$49–$209/mo minimum**                                                                                 | Yes                                                                                                               | Monthly minimum is wrong for our volume. Account owner must pass Veriff's own identity check within 15 days                                                                            |
| **iDenfy**                  | 10 checks / 14 days                                                                                                                                                                              | Monthly minimum; approved-only billing option                                                                         | Yes                                                                                                               | Webhook-only (no polling)                                                                                                                                                              |
| **PSA National ID eVerify** | —                                                                                                                                                                                                | 3-year subscription, price on application                                                                             | PH only, authoritative                                                                                            | The _real_ answer for PH, including face match against the national registry. Requires PSA regulatory + DICT technical onboarding. Start the paperwork in parallel; do not block on it |

**Decision:** build Track A now. Build Track B as a thin `IdentityVerificationProvider` interface in the same phase set so Didit (or eVerify) is a config change plus one adapter file, not a rewrite. Revisit at the Phase 7 gate with real volume numbers.

---

## Competitive UX brief

**Job:** a person proves, in under 60 seconds and without leaving the flow, that a government ID is genuine and belongs to them.
**Roles:** guest (booking) · host (onboarding/verification) · host reviewer (reads a guest verdict) · super admin (reads a host verdict).

### Airbnb (guest)

- Identity verification is a **separate, one-time account-level step**, not a per-booking chore. Once verified, the badge follows the guest to every reservation.
- Flow: choose document type → **live camera capture with an on-screen frame**, not a file picker → selfie → done. Gallery upload is a fallback, not the default.
- Status is a first-class account object ("Identity verified"), surfaced to hosts as a badge and used in Guest Standards/booking requirements.
- **Lesson:** per-booking, per-guest re-upload is the single biggest friction source in our current design. Identity belongs on the guest account, with the booking _referencing_ it.

### Stripe Identity / Persona / Coinbase (cross-device)

- Consistent pattern: desktop detects no usable camera (or the user taps _Continue on your phone_) → shows a **QR plus a copyable short link** → phone opens the same session → phone becomes the active device → **desktop waits and auto-advances** when the phone finishes.
- Desktop never navigates itself; it reacts to a completion event. Checktiv's SDK docs are explicit: "The SDK never writes `window.location`."
- The handoff trigger is **desktop-only** and gated on a fine pointer — offering "continue on your phone" _on_ a phone is circular. `openCrossDevice()` no-ops on a coarse-pointer device.
- Sessions are **short-lived and single-use**; a stale QR forces a restart (Coinbase states this plainly to users).
- Persona pushes users into a native app on iOS/Android. We will not — browser-only, no install, is a real advantage for one-off guests.
- **Lesson:** QR + copy-link + email-link as three ways to reach the phone; desktop polls/subscribes and advances itself; token expiry measured in minutes.

### PhilSys Check (the PH-local benchmark)

- Scan the QR on the back of a PhilID/ePhilID → authenticity message + Last/First/Middle name, suffix, sex, date of birth, place of birth, PCN, date of issuance, best fingerprint; **plus the holder's portrait for ePhilID**.
- Failure states are explicit and user-readable: "Deactivated Card", "QR Code could not be read".
- **Lesson:** Filipino users already know "scan the QR at the back." Leading with the QR is familiar, faster, and more accurate than photographing the front.

### Trust & safety ops tooling (Cinder and industry practice)

- Severity tiers wired to **routing and SLA**, not just labels; dedup/grouping per subject; human-in-the-loop for high-risk and appeals; automation for triage and risk scoring.
- **Lesson:** the super-admin queue should receive a **pre-screened verdict with flags**, so a reviewer confirms rather than discovers. This is roadmap #18, folded in here.

### Adopt / adapt / skip for Kame Space

| Decision  | Detail                                                                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Adopt** | Account-level guest identity (verify once, reuse across bookings) with per-booking reference                                                                                     |
| **Adopt** | QR + copy-link + email-link phone handoff; desktop subscribes and auto-advances; 10-minute single-use token                                                                      |
| **Adopt** | PhilSys QR as the **primary** PH path, document photo as fallback — matches local familiarity and beats OCR on accuracy                                                          |
| **Adopt** | Live camera with frame guide and auto-capture as the default; gallery upload demoted to a visible fallback link                                                                  |
| **Adopt** | Pre-screened verdict + flags in both the host booking view and the super-admin approvals queue                                                                                   |
| **Adapt** | Active liveness challenges, but **two** randomized steps (not the six in the reference implementation) — a one-off guest will abandon a six-step ritual. Target under 10 seconds |
| **Adapt** | Airbnb's badge, scoped to our verdict model: `verified` / `partially_verified` / `unverified`, never a bare green tick on a client-side-only pass                                |
| **Skip**  | Native app install (Persona's model). Browser-only                                                                                                                               |
| **Skip**  | Per-document re-verification once an account-level identity is `verified` and unexpired                                                                                          |
| **Skip**  | Any copy beyond a label and a one-line instruction per step, per `ui-minimal-copy.mdc`                                                                                           |

---

## Architecture

### One module, three entry points

```
ui/src/features/verification/            ← NEW shared feature (not under guest/ or dashboard/)
├── components/
│   ├── IdentityVerificationFlow.tsx         orchestrator: step machine + provider dispatch
│   ├── steps/MethodPickerStep.tsx           PhilSys QR · other document · passport
│   ├── steps/DocumentCaptureStep.tsx        live camera, frame guide, auto-capture
│   ├── steps/PhilSysScanStep.tsx            QR scan + offline signature verify
│   ├── steps/LivenessStep.tsx               MediaPipe challenges (lazy)
│   ├── steps/ReviewStep.tsx                 extracted fields, confirm/correct
│   ├── CrossDeviceHandoffPanel.tsx          QR + copy link + email link + waiting state
│   └── VerificationResultBadge.tsx          shared verdict chip (guest + host + admin)
├── hooks/
│   ├── useIdentitySession.ts                create/read/submit a session
│   ├── useCrossDeviceHandoff.ts             Realtime subscribe + desktop auto-advance
│   ├── useDocumentAutoCapture.ts            getUserMedia + edge detect + capture
│   └── useLivenessChallenges.ts             FaceLandmarker loop + challenge state
├── lib/
│   ├── philsys/qrPayload.ts                 v1 JSON / v3 base45+zlib+CBOR decode
│   ├── philsys/verifySignature.ts           Ed25519 (mirrors the edge verifier)
│   ├── mrz.ts                               identite-ts wrapper
│   ├── identityVerdict.ts                   CLIENT MIRROR of the edge verdict model
│   ├── documentTypes.ts                     accepted PH + international ID catalog
│   └── captureQuality.ts                    blur/glare/edge scoring, capture gate
└── pages/
    └── MobileCaptureHandoffPage.tsx         /verify/:sessionToken — the phone's page
```

**Why a top-level `features/verification/`:** it is used by `features/guest/form/`, `features/dashboard/org/` (onboarding + Get Verified), and read by `features/dashboard/bookings/` and `features/dashboard/super-admin/`. Putting it under either tree would force cross-feature imports, which `architecture.mdc` forbids. This is a sibling of `guest/` and `dashboard/`, same rationale as `components/mobile/`.

### Data model

Two new tables. Identity lives on the **account**, sessions are **ephemeral**.

```sql
-- Durable identity verdict. One row per verification event; the "active" row per subject
-- is resolved by the partial unique indexes below.
create table identity_verifications (
  id uuid primary key default gen_random_uuid(),

  -- subject: guest (booking-scoped, optionally account-linked) or org owner
  subject_kind    text not null check (subject_kind in ('guest','org_owner')),
  guest_user_id   uuid references auth.users(id) on delete set null,
  organization_id uuid references organizations(id) on delete cascade,
  booking_id      uuid references guest_submissions(id) on delete set null,
  guest_slot      smallint check (guest_slot is null or guest_slot between 1 and 5),
  -- sha256(lower(trim(email)) || pepper). Never the raw address. Used for reuse + duplicate signals.
  subject_email_hash text,

  verdict         text not null check (verdict in
                    ('verified','partially_verified','unverified','rejected','expired')),
  method          text not null check (method in
                    ('philsys_qr','mrz','document_ai','provider')),
  provider        text,
  provider_ref    text,

  document_type   text,
  document_number_hash text,
  document_expiry date,
  full_name       text,
  date_of_birth   date,
  sex             text,
  nationality     text,

  signature_valid        boolean not null default false,
  liveness_passed        boolean,
  liveness_grade         text check (liveness_grade in ('clientside','certified')),
  face_match_verdict     text check (face_match_verdict in ('match','likely_match','unclear','mismatch','skipped')),
  face_match_source      text,
  quality_score          numeric(3,2),
  flags                  jsonb not null default '[]'::jsonb,

  -- capture references (bucket identity-captures). Null when the QR-only path was used.
  document_front_path text,
  selfie_path         text,

  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  review_note     text,

  verified_at     timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint identity_subject_shape check (
    case subject_kind
      when 'guest' then organization_id is null
                        and (guest_user_id is not null or booking_id is not null)
                        and subject_email_hash is not null
      when 'org_owner' then organization_id is not null
                            and guest_user_id is null
                            and booking_id is null
      else false
    end
  )
);

-- A guest account may hold at most one live verdict.
create unique index identity_verifications_guest_active
  on identity_verifications (guest_user_id)
  where guest_user_id is not null and verdict in ('verified','partially_verified');

-- An org may hold at most one live verdict.
create unique index identity_verifications_org_active
  on identity_verifications (organization_id)
  where organization_id is not null and verdict in ('verified','partially_verified');

-- One live verdict per booking slot. Re-running a session supersedes the previous row by
-- flipping it to 'expired' first, so this index never blocks a legitimate retry.
create unique index identity_verifications_booking_slot_active
  on identity_verifications (booking_id, coalesce(guest_slot, 1))
  where booking_id is not null and verdict in ('verified','partially_verified');

create index identity_verifications_guest_lookup
  on identity_verifications (subject_email_hash, created_at desc);
create index identity_verifications_document_hash
  on identity_verifications (document_number_hash)
  where document_number_hash is not null;
create index identity_verifications_expiry
  on identity_verifications (expires_at)
  where verdict in ('verified','partially_verified');

-- Short-lived capture session. Purged aggressively.
create table identity_verification_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash      text not null unique,
  subject_kind    text not null check (subject_kind in ('guest','org_owner')),
  guest_user_id   uuid references auth.users(id) on delete set null,
  organization_id uuid references organizations(id) on delete cascade,
  booking_id      uuid references guest_submissions(id) on delete set null,
  guest_slot      smallint check (guest_slot is null or guest_slot between 1 and 5),
  subject_email_hash text,
  /** Set when the session was started inside the guest booking form. */
  property_id     uuid references properties(id) on delete set null,
  status          text not null default 'pending' check (status in
                    ('pending','in_progress','captured','submitted','completed','failed','expired')),
  step            text,
  origin_device   text check (origin_device in ('desktop','mobile')),
  failure_reason  text,
  attempt_count   smallint not null default 0,
  claimed_at      timestamptz,
  result_id       uuid references identity_verifications(id) on delete set null,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index identity_verification_sessions_expiry
  on identity_verification_sessions (expires_at);
```

**Columns added to existing tables** (new migration, never edit a shipped one):

| Table                                 | Column                                                           | Why                                                                  |
| ------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| `guest_submissions`                   | `primary_identity_verification_id uuid`                          | Booking slot → verdict reference                                     |
| `guest_submissions`                   | `guest2_identity_verification_id` … `guest5_`                    | Per-slot reference                                                   |
| `guest_submissions`                   | `identity_capture_mode text`                                     | `'live' \| 'upload' \| 'legacy'` — tells the host how the ID arrived |
| `guest_profiles`                      | `identity_verified_at timestamptz`                               | Denormalized badge read, avoids a join on every profile load         |
| `organizations.settings.verification` | `identityVerificationId`, `livenessPassedAt`, `faceMatchVerdict` | Keeps the JSONB shape, matching `orgVerificationTiers.ts`            |

**Storage.** New private bucket `identity-captures`, service-role writes only, path `{subjectKind}/{subjectId}/{sessionId}/{kind}.{ext}` where `kind` ∈ `document_front`, `document_back`, `selfie`, `liveness_frame_N`. **Default retention 7 days**, then a cron purges. Images are kept only when (a) a human review is pending, or (b) the property's GAF workflow needs the ID as an email attachment — and in case (b) only until the GAF comes back. `valid-ids` stays as-is for legacy rows; no backfill, no deletion of existing data in this plan.

RLS: both new tables `enable row level security` with a `service_role`-only grant, matching `booking_ai_reviews` (migration `20261011120001`). All reads go through edge functions — consistent with `security.mdc` ("RLS is not the access-control layer today").

### Edge functions

| Function                       | Serve wrapper                                 | Purpose                                                                         |
| ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------- |
| `identity-session-create`      | `serveAuthenticated` (guest or org)           | Mint session + handoff token, return QR payload and short link                  |
| `identity-session-get`         | `servePublic` + token                         | The phone's bootstrap: what to capture, for whom, branding                      |
| `identity-session-upload`      | `servePublic` + token                         | Multipart capture frames → `identity-captures`; `assertWithinUploadLimit`       |
| `identity-session-submit`      | `servePublic` + token                         | Run verification pipeline, write `identity_verifications`, broadcast completion |
| `identity-session-cancel`      | `serveAuthenticated`                          | Desktop abort; marks session `failed`                                           |
| `identity-verification-review` | `serveSuperAdmin` + `requireSuperAdminStepUp` | Manual override of a verdict                                                    |
| `identity-captures-purge-cron` | `serveCronPost`                               | Retention sweep; one `system.cron_run` summary row                              |

Shared services:

| File                                       | Role                                                                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_shared/identityVerification.ts`          | Verdict model, flag catalog, `resolveVerdict(signals)`; **canonical**, mirrored by `ui/.../lib/identityVerdict.ts` under the same lockstep rule as `statusMachine.ts`                                                    |
| `_shared/identitySessionToken.ts`          | HMAC token, copied shape from `guestBookingAccessToken.ts` but **10-minute TTL, single-use, purpose-bound** — the audit note in that file (180-day TTL, no purpose binding, no revocation) is exactly what not to repeat |
| `_shared/philsysQr.ts`                     | v1 JSON + Ed25519; v3 prefix strip → base45 → inflate → CBOR → portrait extract. Written from the PSA spec                                                                                                               |
| `_shared/identityProvider.ts`              | `IdentityVerificationProvider` interface + `InHouseProvider`; the Track B seam                                                                                                                                           |
| `_shared/identityProviders/didit.ts`       | Phase 7 only, behind `IDENTITY_PROVIDER=didit`                                                                                                                                                                           |
| `_shared/ai/prompts/identityExtraction.ts` | New versioned prompt: structured field extraction + ID↔selfie comparison. Registry entry, same shape as `documentValidation.ts`                                                                                          |

### Verdict model

`resolveVerdict` is deterministic and testable. No AI call decides a verdict on its own.

| Verdict              | Requires                                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verified`           | `signature_valid = true` (PhilSys QR or provider-grade proof) **and** `liveness_passed` **and** `face_match_verdict ∈ {match, likely_match}` **and** no blocking flag              |
| `partially_verified` | Document read with validated checksums (MRZ) or a confident AI extraction, **and** liveness passed, **but** no cryptographic signature — i.e. an authenticity _opinion_, not proof |
| `unverified`         | Capture completed, signals weak or contradictory. Host/admin review required. This is the default, not a failure                                                                   |
| `rejected`           | A human reviewer declined, or a hard flag fired (expired document, name mismatch beyond tolerance, duplicate `document_number_hash` on a different subject)                        |
| `expired`            | `expires_at` passed. Set by cron, not by a request                                                                                                                                 |

Flag catalog (stored in `flags` jsonb, each `{ code, severity, detail }`): `signature_invalid`, `document_expired`, `name_mismatch`, `dob_mismatch`, `age_under_18`, `liveness_failed`, `face_mismatch`, `duplicate_document`, `low_quality`, `screen_capture_suspected`, `ai_unavailable`.

**`liveness_grade` is load-bearing.** In-house always writes `'clientside'`. Only a PAD-certified provider writes `'certified'`. A `verified` verdict reached with `liveness_grade = 'clientside'` renders as "Verified" with a tooltip stating the check was device-side — we do not overclaim in the UI, and we do not overclaim in the DB.

### Cross-device handoff

```
Desktop                                  Phone
───────                                  ─────
POST identity-session-create
  → { sessionId, token, qrPayload, shortLink }
show QR + copy link + "email me the link"
subscribe: realtime channel `identity:{sessionId}`
                                         scan QR → /verify/{token}
                                         GET identity-session-get  (status → in_progress)
                                         capture: document → liveness
                                         POST identity-session-upload  (×N)
                                         POST identity-session-submit
                                           → pipeline → identity_verifications
                                           → broadcast { status: 'completed', verdict }
receive broadcast → invalidate query     show result, "you can close this"
  → advance the form step itself
```

Rules, straight from the competitive brief:

- The handoff panel renders **only** on a fine-pointer device (`matchMedia('(pointer: fine)')`). On a phone the flow goes inline; a QR you scan with the device showing it is circular.
- The desktop **never** calls `navigate()` off a broadcast — it invalidates the session query and lets the step machine advance, same discipline as the Checktiv SDK note.
- Token: 10-minute TTL, purpose-bound to one session id, and **not** consumed on read (see Revised scope §4). The session is single-submit; `identity-session-submit` rejects anything not in `in_progress`/`captured`, and `completed`/`failed`/`expired` reject the token outright.
- Desktop polling is the contract (`identity-session-get` with the session handle), every 2s while waiting, backing off to 5s after 30s. Realtime is a later optimisation.
- `antiSpamGate` on every `servePublic` endpoint here (scope `identity-session`), plus `publicGetRateLimitGate` on the GET per `check-serve-public-rate-limit.sh`.

---

## Phases

Each phase is independently shippable and leaves the app working. Phases 0–4 are the free Track A. Phase 7 is the paid gate.

### Phase 0 — Decisions, licensing, and the privacy basis

No product code. This phase exists because three of the biggest risks in this plan are legal and licensing, not technical.

1. **Write `docs/architecture/identity-verification.md`** — the architecture doc this plan will keep pointing at: verdict model, flag catalog, data flow, retention table, provider seam.
2. **Licensing decision record** in that doc:
   - `openverify` is **unlicensed** → format reference only, zero code copied. Name the primitives we will actually depend on and their licenses (`@noble/ed25519` MIT, `fflate` MIT, CBOR decoder, `identite-ts` MIT, `@mediapipe/tasks-vision` Apache-2.0, `zxing-wasm`/`jsQR`).
   - `mrz-scanner` (alsenet-labs) is **AGPL-3.0 → rejected**. Record it so nobody swaps it in later.
3. **Confirm the PhilSys verification key** — identify the published Ed25519 verification key for PhilID v1, decide how it is supplied (`PHILSYS_PUBLIC_KEY` edge secret, not hardcoded) and how it rotates. If the key cannot be sourced from an authoritative PSA channel, **PhilSys v1 signature verification drops out of Phase 2** and only ePhilID v3 CBOR decode + AI extraction ship. Do not guess a key.
4. **Privacy impact assessment** → `docs/architecture/data-privacy-identity.md`:
   - Lawful basis: **explicit consent** for sensitive personal information under DPA §13, captured as an in-flow consent step with the purpose, retention period, and security measures stated before the camera opens (NPC reminder, bullet 2).
   - Retention schedule per artifact (session frames 7 days · extracted fields for the identity lifetime · document number **hashed only** · images deleted once GAF returns).
   - Data-subject rights: how a guest requests deletion, and what survives (the verdict row, so a deletion does not silently un-verify a stay in progress).
   - Minimization argument: the PhilSys QR path lets us verify **without retaining an ID image**, which is the NPC's stated preference. Make this the default for PH documents.
5. **Plans + Team RBAC decision** (mandatory per `plans-and-permissions.mdc`) — see the dedicated section below.
6. **Start PSA National ID eVerify onboarding paperwork** in parallel. Long lead time, no code dependency.
7. **Fix the stale doc** flagged during discovery: `docs/guides/routes/form.md:90` claims submit-time AI validation that does not exist. Correct it now so Phase 3 is a real change, not a doc reconciliation.

**Done when:** both architecture docs exist, the licensing table is written, the PhilSys key question is answered yes or no, and the Plans/RBAC rows are decided.

### Phase 1 — Session core and cross-device handoff

The plumbing, proven with the _existing_ upload as the payload. Nothing about capture changes yet, so this ships safely.

1. Migration: `identity_verifications`, `identity_verification_sessions`, `identity-captures` bucket, RLS service-role-only grants.
2. `_shared/identitySessionToken.ts` + unit tests (sign/verify, expiry, single-use, tamper, constant-time compare). Mirror the test shape of `guestBookingAccessToken_test.ts`.
3. `_shared/identityVerification.ts` — verdict model and flag catalog, with `resolveVerdict` unit tests covering every row of the verdict table. Client mirror `ui/.../lib/identityVerdict.ts` + a parity test (same pattern as the `statusMachine.ts` ↔ `workflow.ts` mirror tests).
4. Edge functions `identity-session-create` / `-get` / `-upload` / `-submit` / `-cancel`, with `antiSpamGate`, rate limits, and `assertWithinUploadLimit`.
5. `CrossDeviceHandoffPanel.tsx` — QR, copy link, "email me the link", live status, expiry restart. Fine-pointer gate. `ResponsiveModal` + `sheetLayout="split"`.
6. `useCrossDeviceHandoff.ts` — Realtime subscribe with polling fallback.
7. Route `/verify/:sessionToken` → `MobileCaptureHandoffPage.tsx`. Outside both `MainLayout` and `MarketingLayoutShell`: single-purpose page, **no bottom tab bar** (same call as `PayParkingPage`). `usePageTitle('Verify your ID')`.
8. Phase-1 payload is the plain file input, so the handoff is end-to-end testable before any camera code exists.
9. `logActivity`: new action keys `identity.session_started`, `identity.session_completed`, `identity.session_failed` in `ACTIVITY_ACTION_CATALOG` (+ client mirror `activityCatalog.ts` if a new category is needed).
10. `capturePostHogEvent`: `identity_session_started`, `identity_handoff_scanned`, `identity_session_completed`, `identity_session_abandoned` — add to `posthogCatalog.ts`. These are the funnel we will tune Phase 5 against.

**Done when:** a desktop user starts a session, scans the QR, uploads a file on the phone, and the desktop advances on its own. Playwright `@ci` covers the happy path with a mocked session.

### Phase 2 — Live capture, PhilSys QR, and MRZ

The accuracy and speed payload.

1. `useDocumentAutoCapture.ts` — `getUserMedia` with `facingMode: 'environment'`, frame guide overlay, edge detection on a downscaled frame, `captureQuality.ts` gating on blur (Laplacian variance), glare (clipped-highlight ratio), and edge coverage. Auto-capture when three consecutive frames pass. Manual shutter always available.
2. `DocumentCaptureStep.tsx` — front, then back when the document type needs it. Retake. **Visible** "Upload a photo instead" fallback for a blocked camera or a desktop with no handoff.
3. `lib/philsys/qrPayload.ts` + `_shared/philsysQr.ts`:
   - **v1 (PhilID card):** JSON payload → normalize → Ed25519 verify → fields.
   - **v3 (printed ePhilID):** strip prefix → base45 decode → zlib inflate → CBOR decode → validate country code → extract fields **and the embedded portrait**.
   - The embedded portrait is the face-match reference. This is strictly better than cropping a face out of a photo of a card.
   - Written from the PSA spec with permissive primitives. Unit tests against synthetic payloads we generate ourselves — **never commit a real person's PhilID payload to the repo**, not even in a fixture.
4. `PhilSysScanStep.tsx` — `BarcodeDetector` with `zxing-wasm`/`jsQR` fallback, continuous scan, haptic + visual confirm. Failure copy mirrors PhilSys Check's explicit states ("QR code could not be read").
5. `lib/mrz.ts` — `identite-ts` wrapper for TD1/TD2/TD3. Checksum-validated reads only; a failed checksum falls through to AI extraction rather than returning bad fields.
6. `documentTypes.ts` — the accepted catalog, seeded from `VALID_ID_SYSTEM_PROMPT`'s existing list: PhilSys/PhilID, ePhilID, passport, driver's license, UMID, SSS, PhilHealth, postal, voter's, PRC.
7. `MethodPickerStep.tsx` — **PhilSys QR first** (fastest, most accurate, the familiar local path), then "Other government ID", then "Passport". `MobileChoiceSheet`, not a dropdown.
8. **Bundle discipline:** every module in this phase is dynamically imported from `IdentityVerificationFlow`; the MediaPipe model and WASM load from a pinned CDN. Add a build assertion so the verification chunk cannot enter the main chunk — the perf audit's 10.5 MB finding is the reason this is a hard gate, not a guideline.

**Done when:** a phone scans a PhilSys QR and the app shows cryptographically verified fields with zero AI involvement, and a passport MRZ reads with valid checksums.

### Phase 3 — Liveness, face match, and AI extraction

1. `useLivenessChallenges.ts` + `LivenessStep.tsx`:
   - Lazy `@mediapipe/tasks-vision` `FaceLandmarker` (`runningMode: 'VIDEO'`, `numFaces: 1`, `outputFacialTransformationMatrixes: true`).
   - **Two randomized challenges** from {blink, turn left, turn right, open mouth}. Blink and jaw from blendshapes (`eyeBlinkLeft/Right`, `jawOpen`) with EAR/MAR fallback; yaw from the transformation matrix, negated when the preview is mirrored.
   - Thresholds in **one** module shared by the on-screen guidance and the server scorer, so guidance never drifts from scoring.
   - Captures a straight-on frame plus one per challenge. `prefers-reduced-motion` and a "I can't do this" escape hatch → `unverified` + review, never a dead end.
   - Hard accessibility requirement: a user who cannot complete a visual challenge must still be able to finish the flow. This is an accommodation path, not an optional nicety.
2. `_shared/ai/prompts/identityExtraction.ts` — versioned prompt (`identity_extraction`, `2026-11-02.1`) returning `{ document_type, full_name, date_of_birth, sex, nationality, document_number, expiry, is_genuine_document_opinion, screen_or_photocopy_suspected, confidence }` plus an ID↔selfie `face_comparison` verdict. Carries the same prompt-injection guard as `documentValidation.ts` (text inside the document is content, never instruction).
3. Extend `_shared/receiptValidationService.ts` rather than forking it: `validateIdentityDocument(...)` beside `validateValidIdFile`. Same `aiModelRouter` feature key, same non-throwing contract, same `skipped` on no provider.
4. **Persist what we extract.** The current batched pass throws away `extracted_name` / `extracted_age` / `extracted_nationality` after generating flags. Write them to `identity_verifications` so the second host to see this guest does not pay for the same inference.
5. `resolveVerdict` wired end to end in `identity-session-submit`.
6. Server-side sanity on the liveness timeline (challenge ordering, plausible transition timing, frame-to-frame face continuity) so a replayed set of stills fails. Record `liveness_grade = 'clientside'` regardless — see the verdict model note.
7. HEIC/PDF guard: Groq's fallback accepts only jpeg/png/gif/webp, so a HEIC capture cannot fail over. Normalize every capture to JPEG **on-device** before upload, which also fixes the existing `normalizeVisionMimeType` default-to-jpeg quirk.

**Done when:** a complete session produces a persisted verdict with populated fields, flags, and liveness/face-match signals, and the Deno test suite covers each verdict branch.

### Phase 4 — Guest booking form integration

1. `guestFormSchema.ts`: per-guest `validId` File becomes `identityVerificationId | File` — an account-level verified identity **or** a legacy upload. `superRefine` accepts either. Age ≥ 18 still triggers the requirement.
2. `GuestFormValidIdUpload.tsx` → `GuestIdentityCapture.tsx`: a verified identity renders as a confirmation row (name, document type, verified date, badge) with a "Use a different ID" action; an unverified one renders _Verify now_ → `IdentityVerificationFlow`, with upload as the fallback.
3. **Fix the long-standing server/UI mismatch:** `processFormData` requires the primary ID unconditionally while the UI only asks once an adult age is entered. Align both on `age >= 18`. Same pass aligns the two other inconsistencies discovery surfaced:
   - `validateImageFile` allows jpeg/png/heic while the input `accept` also lists webp/heif → one list, one constant.
   - `requiresValidId` keys off **age ≥ 18** but `gafRequestSendBlockReason` keys off **having a name** → one predicate, used by both.
4. **Reuse across bookings** (the Airbnb lesson): a signed-in guest with a current `identity_verifications` row skips capture entirely. Track `identity_capture_mode` so a host can tell a live verification from a legacy upload.
5. `useOfflineFormDraft` stores the `identityVerificationId` (a uuid, safe to persist) where it cannot store a `File`. A restored draft keeps its verification instead of asking for the ID again — a real improvement over today.
6. Additional guests: each slot gets its own session and its own handoff QR. A primary guest can send a slot's link to that guest by email, so a travelling companion verifies themselves rather than handing over their ID.
7. **GAF compatibility is non-negotiable.** `buildGuestValidIdAttachments` must keep producing attachments for properties whose document requirements include a `gaf` template. This is achieved **without touching the email pipeline**: at `submit-form` time the captured front-of-document image is copied into the existing `valid-ids` bucket under the same deterministic key and written to `valid_id_url` / `guestN_valid_id_url`. A QR-only session therefore still stores the document photo it captured; if a session produced no front image at all (pure QR scan), the flow falls back to the upload step so a photo always exists. `gafRequestSendBlockReason` and `buildGuestValidIdAttachments` are unchanged.
8. Host-facing read: `GuestsPanel.tsx`, `DocumentsPanel.tsx`, `GuestIdentityTab.tsx`, and `GuestAvatar.tsx` render `VerificationResultBadge` with flags. `GuestAvatar` currently uses the ID photo as the avatar — with PhilSys sessions it should prefer the QR-embedded portrait, and must degrade to initials when no image exists at all.
9. **Decide and document the blocking question:** should an `invalid`/`rejected` identity block `PENDING_REVIEW → PENDING_DOCUMENTS` the way an invalid receipt already blocks via `assertAiVerdictAllowsProceed`? Recommendation: **yes, with override** — extend the existing `ai_verdict_blocked` 409 and _Proceed anyway_ affordance rather than inventing a second mechanism. Record the decision in `booking-workflow.mdc`, which is canonical for this.
10. Route guide updates: `docs/guides/routes/form.md` (+ its Host-facing knowledge Q&A), `org/property/bookings-detail.md`.

**Done when:** a guest verifies once and books twice without re-submitting an ID, and GAF properties still receive everything they need.

### Phase 5 — Host and org verification

1. Onboarding Step 3 (`OnboardingHostVerificationSection`): Valid ID dropzone → `IdentityVerificationFlow`. The Facebook Page screenshot stays a plain upload (it is social proof, not identity).
2. `GetVerifiedModal.tsx` Tier 1: same substitution. Keep `useGuardedClose` + `UnsavedChangesDialog`; a half-finished session must prompt before close.
3. **Tier 2's `selfie_with_id` is replaced by the liveness + face-match result.** A static photo of someone holding a card is strictly weaker than a liveness pass against the card's own portrait, and it is one fewer thing to ask for. Keep reading the legacy `selfieWithIdPath` for rows already submitted.
4. Super-admin review (`SuperAdminApprovalReviewDialog.tsx`): a **pre-screen block** at the top — verdict, extracted fields, flags, signature status, liveness grade, face-match verdict — above the existing document cards. This is roadmap #18, and it means a reviewer confirms rather than discovers.
5. Guest-side host badge: `verifiedBadge` remains driven by `enhancedStatus === 'approved'`. Where the approval rests on a cryptographic PhilSys read, surface that in the badge tooltip; where it rests on client-side liveness, say so. No overclaiming.
6. **Close three gaps discovery found in this area, since we are already in the code:**
   - Listing verification functions emit no `logActivity` / `logSuperAdminAction` → add them (`audit-logging.mdc` requires it for any new or changed mutating capability, and these are being changed).
   - `approve-org-verification` / `approve-listing-authorization` are not step-up-OTP gated (`admin-auth.mdc` §8 follow-up) → gate them, since approving an identity is now a higher-consequence action.
   - Host/org uploads write into `settings.verification.assets` **before** submit, so stored assets can diverge from submitted ones → stage captures against the session and commit on submit.
7. Route guides: `docs/guides/routes/onboarding.md`, `admin/approvals.md`, `org/plans.md` if a plan row changes.

**Done when:** a host completes Tier 1 with a live PhilSys scan, and a super admin sees a verdict with flags before opening a single image.

### Phase 6 — Retention, trust surfaces, and polish

1. `identity-captures-purge-cron` — hosted `pg_cron` + `pg_net` per `scheduled-jobs-and-testing.md` (never `config.toml` `schedule`). Deletes session frames past retention, expires stale `identity_verifications`, emits one `system.cron_run` summary row.
2. `/account/profile` — an Identity section: status, verified date, expiry, re-verify, and **delete my verification** (the DPA data-subject right from Phase 0, actually wired).
3. Expiry notices: an in-app notification and email when a verified identity is within 30 days of `expires_at`. Reuse `notificationService.ts`; no new fan-out path.
4. `duplicate_document` detection: the same `document_number_hash` on a different `guest_user_id` raises a flag for review. The hash exists precisely so this is possible without storing a PCN.
5. Guest-facing trust copy on the property page: "This host's identity is verified." One line, per `human-copy.mdc`. No badge wall.
6. AI assistant parity (`ai-assistant-parity.mdc`, enforced by `assistantParityManifest.test.ts`): every new edge function needs an entry in `_shared/dashboardAssistantParity.ts`. Recommendation: **read tools** for verification status; `handoff` for starting a session (a capture flow is inherently interactive and does not belong in chat); `excluded` with a rationale for the review override.
7. Tune the funnel against the Phase 1 PostHog events: abandonment by step, time to complete, retake rate, handoff scan rate. The brief's "under 60 seconds" target is a measurement, not a hope.

### Phase 7 — Paid provider gate (decision point, not a commitment)

Reach this phase only with real numbers from Phase 6.

1. **Evaluate against measured data:** monthly verification volume, in-house `unverified` rate (how often a human still has to look), fraud incidents caught and missed, and the real cost of reviewer time.
2. Implement `_shared/identityProviders/didit.ts` against the `IdentityVerificationProvider` interface, behind `IDENTITY_PROVIDER` (default `inhouse`). Didit is the candidate: iBeta PAD L1, $0.33 full KYC, PhilID + UMID in one session with PH residential-registry cross-check, public docs, sandbox with forced outcomes and no billing.
3. The sandbox is where this gets validated. Didit sandbox mocks every provider, never bills, allows 500 session creates per 24 h, and tags webhooks `"environment": "sandbox"` — so the adapter can be fully tested before any money moves.
4. A provider verdict is the only thing that may write `liveness_grade = 'certified'`. That column is the whole point of the seam.
5. Per-property or per-plan provider selection: a Pro+ property could route to a paid provider while Free stays in-house. Needs a plan-key decision at that time, not now.
6. If PSA **National ID eVerify** onboarding (started in Phase 0) has landed by this point, it becomes a second adapter and the preferred PH path — authoritative registry face match beats any commercial vendor for Filipino nationals.

---

## Plans and permissions

Mandatory decision per `plans-and-permissions.mdc`. Both tracks answered here, not deferred.

### Plans

| Capability                                                           | Decision                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Guest identity verification (live capture, PhilSys QR, liveness)** | **Not plan-gated.** This is guest safety and the core booking loop. Gating it would mean Free-tier properties accept unverified guests, which inverts the point of the feature. Same reasoning that kept `emailNewBookingRequest` and web chat free.                                                                                                                                                 |
| **Host Tier 1 identity verification**                                | **Not plan-gated** — matches the existing decision to ungate `submit-org-verification` base (Free hosts could not otherwise finish setup).                                                                                                                                                                                                                                                           |
| **Host Tier 2 / Recommended**                                        | **Unchanged**: stays behind `recommendedBadgeEligible` (golden `growth`), including the host-reward campaign bypass in `_shared/hostVerificationReward.ts`.                                                                                                                                                                                                                                          |
| **AI field extraction + face match**                                 | **Reuses `aiValidations`** (golden `growth`). On Free/Starter the deterministic paths still run — PhilSys signature verification and MRZ checksums cost nothing and need no model — so a Free host gets _cryptographic_ verification for PH IDs and a review prompt for everything else. This is the right shape: the free tier gets the better signal where it exists, and pays only for inference. |
| **New plan key?**                                                    | **No.** Adding `identityVerification` would force a gate on a safety feature. Record this as an explicit N/A in `plans-feature-matrix.md` with the reasoning, per the rule's "note N/A and why" branch.                                                                                                                                                                                              |

Because `aiValidations` gains coverage rather than changing tier, update `ui/src/features/dashboard/plans/lib/planTierGolden.ts`, `planTierExpectations.ts`, the `GATE_COVERAGE` map in `planGateCoverage.test.ts`, and `PLAN_FEATURE_PERMISSION_COVERAGE` in `planFeaturePermissions.ts` only if a literal card bullet or Compare row changes. Run `bun run check:plan-catalog` against a fresh local DB either way.

### Team permissions

| Surface                                                  | Decision                                                                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Submitting** a host identity verification              | **N/A** — owner-only, unchanged. `verifyOrgOwner` already gates it and `planFeaturePermissions.ts` records "Owner-only submission, not delegated."                           |
| **Viewing** a guest's identity verdict on a booking      | **Existing leaf**, no new one: `bookings.detail.guests:view`. A verdict is strictly less sensitive than the ID image that leaf already reveals.                              |
| **Overriding** a guest identity verdict (Proceed anyway) | **Existing**: `bookings.detail.guests:edit` plus the `aiVerdictOverride` actor allow-list (`org_owner`, `team_member`, `super_admin`; never cron, webhook, or AI assistant). |
| **Reviewing** a host identity verification               | Super admin + `requireSuperAdminStepUp` (added in Phase 5).                                                                                                                  |
| **New leaf?**                                            | **No.** Every action maps to an existing leaf. Adding `identity:view` would split a permission users already understand as "can see guest details."                          |

---

## Audit logging

Required by `audit-logging.mdc`. New entries in `ACTIVITY_ACTION_CATALOG` (`_shared/activityLog.ts`), category `verification` (already exists, so no client-mirror category addition needed):

| Action                           | Severity    | Emitted from                                                                |
| -------------------------------- | ----------- | --------------------------------------------------------------------------- |
| `identity.session_started`       | info        | `identity-session-create`                                                   |
| `identity.session_completed`     | notice      | `identity-session-submit` (after the write)                                 |
| `identity.session_failed`        | info        | `identity-session-submit` / `-cancel`                                       |
| `identity.verdict_overridden`    | destructive | `transition-booking` when `override_ai_verdict` applies to an identity flag |
| `identity.verification_reviewed` | notice      | `identity-verification-review`                                              |
| `identity.verification_deleted`  | destructive | the Phase 6 data-subject deletion path                                      |

Plus `logSuperAdminAction` on `identity-verification-review`, and the backfilled `logActivity` / `logSuperAdminAction` calls on the listing verification functions (Phase 5.6). `system.cron_run` for the purge cron — one summary row per run, never one per deleted object. Every writer is fire-and-forget, after the write, never in a `catch`.

`diffRecord` must **never** carry a document number, a raw name from an ID, or a capture path. Log the verdict, the method, the flag codes, and the subject id.

---

## Security and privacy

| Concern                            | Control                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Handoff token leak                 | 10-min TTL, single-use, purpose-bound to one session, HMAC with a dedicated secret. Deliberately tighter than `guestBookingAccessToken`'s documented 180-day, non-purpose-bound shape                         |
| Session hijack                     | `token_hash` only in the DB; the raw token never persisted or logged. `handleEdgeError` already redacts query-param values; add `sessionToken` to `posthogSanitize.ts`'s drop list alongside `access`/`token` |
| Capture image exposure             | Private bucket, service-role writes, short signed URLs via `storageSignedUrl.ts`, 7-day default retention with an enforced purge                                                                              |
| Document number                    | **Hashed with a pepper, never stored raw.** Enables duplicate detection without holding a PCN                                                                                                                 |
| Biometric data                     | Liveness landmarks are computed on-device and discarded. Only selected JPEG frames upload, and only until the verdict is final or review completes                                                            |
| Prompt injection via document text | Existing guard pattern from `documentValidation.ts` carried into `identityExtraction.ts`                                                                                                                      |
| Abuse / cost                       | `antiSpamGate` + durable rate limits per IP and per subject; `attempt_count` cap with a cooldown; AI calls metered through `generateStructured`                                                               |
| Consent                            | Explicit consent step before the camera opens, with purpose, retention, and security measures stated — DPA §13 and the NPC reminder                                                                           |
| Over-claiming                      | `liveness_grade` separates `clientside` from `certified` in the DB **and** in every UI string                                                                                                                 |

---

## Testing

Per `testing.mdc`; same-change requirement applies to each phase.

| Layer                                                          | Coverage                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (UI)                                                      | `identityVerdict.ts` mirror parity · `captureQuality.ts` scoring · `philsys/qrPayload.ts` decode (synthetic payloads only) · `mrz.ts` checksum cases · liveness threshold math                                                                                                        |
| Unit (edge)                                                    | `identitySessionToken` sign/verify/expiry/single-use/tamper · `identityVerification#resolveVerdict` every branch · `philsysQr` v1 + v3 decode · flag catalog completeness                                                                                                             |
| Handler (Deno)                                                 | `identity-session-*` auth, rate limit, upload limits, state machine (`pending → in_progress → captured → submitted → completed`), expiry rejection, replay rejection                                                                                                                  |
| E2E mocked (Playwright)                                        | `@smoke`: guest form with an already-verified identity (booking path must not regress). `@ci`: full handoff with mocked session and Realtime; expired-token restart; camera-denied fallback to upload; host Tier 1 capture                                                            |
| OCR / extraction regression                                    | Extend `supabase/functions/tests/ocrRegression.test.ts` and `fixtures/ocr/expected.json` with synthetic ID documents via `generateSyntheticDocuments.ts`. **This also unblocks the `guest-documents` image-optimization rollout group**, which has been held on exactly this sign-off |
| Plans                                                          | `bun run check:plan-catalog` + `planGateCoverage.test.ts` for the widened `aiValidations` coverage                                                                                                                                                                                    |
| Assistant parity                                               | `assistantParityManifest.test.ts` must pass with the new functions registered                                                                                                                                                                                                         |
| Manual (`docs/guides/testing/identity-verification-manual.md`) | Real PhilID and ePhilID scans · real passport MRZ · liveness on low-end Android, iOS Safari, and in poor light · camera-denied · desktop-without-camera · cross-browser QR scan · Didit sandbox (Phase 7)                                                                             |

**No real identity document may enter the repo as a fixture.** Synthetic only, generated by our own script. This is a hard review gate.

---

## Documentation

| Doc                                                                                                                  | Change                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture/identity-verification.md`                                                                         | **New** — canonical: verdict model, flags, data flow, provider seam, retention                                                                                                                                                                                                  |
| `docs/architecture/data-privacy-identity.md`                                                                         | **New** — privacy impact assessment, lawful basis, retention schedule, data-subject rights                                                                                                                                                                                      |
| `docs/architecture/overview.md` · `docs/PROJECT.md`                                                                  | New routes, edge functions, env vars, tables                                                                                                                                                                                                                                    |
| `docs/architecture/data-model.md`                                                                                    | New tables + added columns                                                                                                                                                                                                                                                      |
| `docs/architecture/edge-functions.md`                                                                                | New function rows + anti-spam wiring                                                                                                                                                                                                                                            |
| `docs/architecture/storage.md`                                                                                       | `identity-captures` bucket + retention                                                                                                                                                                                                                                          |
| `docs/architecture/validation-and-env.md`                                                                            | `IDENTITY_SESSION_SECRET`, `PHILSYS_PUBLIC_KEY`, `IDENTITY_DOCUMENT_HASH_PEPPER`, `IDENTITY_PROVIDER`, `IDENTITY_CAPTURE_RETENTION_DAYS`, `DIDIT_API_KEY` (Phase 7)                                                                                                             |
| `docs/architecture/plans-feature-matrix.md`                                                                          | Widened `aiValidations` coverage + the explicit "no new plan key" N/A                                                                                                                                                                                                           |
| `.cursor/rules/booking-workflow.mdc`                                                                                 | §2.3 revert rules for identity, §3 side-effect matrix, §6 invariants, and the Phase 4.9 blocking decision. **Also fix two stale lines found during discovery:** §2.3 and §6 say `upload-booking-asset` reverts for `valid_id` only; the code also reverts for `guest2`–`guest5` |
| `.cursor/rules/admin-auth.mdc`                                                                                       | §7 new env vars, §8 the now-closed step-up gap on approvals                                                                                                                                                                                                                     |
| `docs/guides/routes/form.md`                                                                                         | New capture UX, Host-facing knowledge Q&A, **and the stale submit-time-AI claim at line 90**                                                                                                                                                                                    |
| `docs/guides/routes/onboarding.md` · `admin/approvals.md` · `org/property/bookings-detail.md` · `account/profile.md` | Per-route behavior, permissions, Testing row                                                                                                                                                                                                                                    |
| `docs/guides/routes/README.md`                                                                                       | Row for `/verify/:sessionToken`                                                                                                                                                                                                                                                 |
| `docs/guides/testing/identity-verification-manual.md`                                                                | **New** manual guide                                                                                                                                                                                                                                                            |
| `docs/archive/operations/scheduled-jobs-and-testing.md`                                                              | Purge cron registration                                                                                                                                                                                                                                                         |

---

## Risks

| Risk                                                                                      | Severity                                                      | Mitigation                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PhilSys v1 verification key cannot be sourced authoritatively                             | **High** — removes the strongest free signal for PhilID cards | Phase 0 gate answers this before any Phase 2 work. Fallback: ePhilID v3 CBOR decode (self-contained, includes the portrait) + AI extraction. Plan degrades, it does not collapse           |
| MediaPipe's 13 MB model hurts an already-heavy bundle                                     | **High**                                                      | Lazy route chunk, pinned CDN, build assertion that the verification chunk stays out of the main chunk                                                                                      |
| Client-side liveness is not PAD-grade                                                     | **High** (if misrepresented)                                  | `liveness_grade = 'clientside'` in the DB and in the UI copy; server-side timeline sanity; Track B seam for a certified provider                                                           |
| Camera access denied or unavailable                                                       | **Medium**                                                    | Visible upload fallback at every capture step; cross-device handoff; the legacy path is never removed, only demoted                                                                        |
| Low-end Android performance on the landmark loop                                          | **Medium**                                                    | Frame-rate cap, downscaled inference, a time-boxed challenge with a graceful `unverified` exit rather than a hang                                                                          |
| GAF workflow regression (building stops receiving ID attachments)                         | **High** — breaks a live operational dependency               | Phase 4.7 is explicit: generated verification-summary PDF when no card photo exists; `gafRequestSendBlockReason` learns the new shape; covered by handler tests                            |
| Scope creep into general trust & safety                                                   | **Medium**                                                    | Reporting, enforcement, and appeals stay in [`./guest-trust-safety-reporting.md`](./guest-trust-safety-reporting.md). This plan verifies identity and stops there                          |
| Guest abandons a longer flow and bookings drop                                            | **Medium**                                                    | Two challenges not six; PhilSys QR path is faster than today's upload; Phase 1 PostHog funnel measures it from day one; the upload fallback stays                                          |
| Didit's free allowance shrank on 2026-11-01 ($10/mo credit replaced 500-free-per-feature) | **Low** — Track A does not depend on it                       | Phase 7 is a measured gate, and the provider interface keeps Stripe Identity, Persona, and PSA eVerify as alternates                                                                       |
| Storing more biometric data increases DPA exposure                                        | **Medium**                                                    | Phase 0 PIA, 7-day capture retention, hashed document numbers, on-device-only landmarks, wired deletion right. Net exposure should **fall** versus today's indefinitely-retained ID images |

---

## Deferred (recorded so nobody assumes it is half-built)

| Item                                                 | Why deferred                                                                                                                                               | What exists                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Paid KYC provider adapter (Didit / PSA eVerify)      | No vendor account, no sandbox credentials, and an untested adapter would be dead code. The interface seam is the whole deliverable until Phase 7 is funded | `_shared/identityProvider.ts` interface + `IDENTITY_PROVIDER` config, default `inhouse` |
| "Email me the link" handoff                          | Needs a new Resend template and an abuse throttle; QR + copy link covers the same job for a guest sitting at the same desk                                 | Copy-link + QR                                                                          |
| Generated verification-summary PDF                   | Superseded: the front-of-document capture is retained and written to `valid-ids`, so GAF keeps receiving a real image                                      | —                                                                                       |
| NFC / ePassport chip read                            | Requires native code; Web NFC cannot reach the secure element                                                                                              | —                                                                                       |
| Realtime broadcast                                   | Polling is the contract; a service-role-only table cannot be read by an anonymous desktop client without weakening RLS                                     | Polling                                                                                 |
| Backfilling or deleting existing `valid-ids` objects | Separate data-migration plan with its own legal review                                                                                                     | —                                                                                       |
| Trust & safety reporting / enforcement               | [`./guest-trust-safety-reporting.md`](./guest-trust-safety-reporting.md)                                                                                   | —                                                                                       |

---

## Explicitly out of scope

- Reporting, enforcement ladder, and appeals — [`./guest-trust-safety-reporting.md`](./guest-trust-safety-reporting.md)
- Host payout KYC for PayMongo — separate compliance track in [`./property-management-feature-roadmap.md`](./property-management-feature-roadmap.md)
- AML / PEP / sanctions screening — not applicable; we are not a financial institution
- NFC chip reading (ePassport BAC/PACE) — needs native, and Web NFC does not reach the chip
- Backfilling or deleting existing `valid-ids` objects — a separate data-migration plan with its own legal review
- Fraud scoring and device fingerprinting beyond the flags listed above

---

## Dependencies

- [`../in-progress/production-readiness/audits/performance-optimization-production-readiness.md`](../in-progress/production-readiness/audits/performance-optimization-production-readiness.md) — route-level code splitting lands first, or the verification chunk has nowhere clean to go
- [`../done/image-video-upload-optimization.md`](../done/image-video-upload-optimization.md) — the Phase 3 OCR regression suite is the sign-off that unblocks the held `guest-documents` optimization group
- [`../for-testing/host-verification-tiers.md`](../for-testing/host-verification-tiers.md) · [`../for-testing/onboarding-verification-simplify.md`](../for-testing/onboarding-verification-simplify.md) · [`../for-testing/verification-scope-split.md`](../for-testing/verification-scope-split.md) — all three have unchecked manual QA. Finish that QA before Phase 5 edits the same surfaces
- `.cursor/rules/booking-workflow.mdc` — canonical for the Phase 4.9 blocking decision
- Kame Space launch series (`kamespace-01` … `05`) — do not interleave; this plan touches onboarding, which the rebrand also touches

Back to [planned work index](./README.md).
