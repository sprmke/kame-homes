---
title: 'Verify your ID (phone handoff) — operator guide'
status: active
tags: [guides, routes, identity, verification]
updated: 2026-11-07
---

# Verify your ID (phone handoff) — operator guide

Route: `/verify/:sessionToken`

> **Status:** Documented.

## Progress overview

| Section          | E2E save | Validation      | Docs       | Notes                                                    |
| ---------------- | -------- | --------------- | ---------- | -------------------------------------------------------- |
| Token bootstrap  | —        | Server          | Documented | 10-minute HMAC token; not consumed on reload             |
| Consent          | —        | Client + server | Documented | `consentAccepted` is rejected server-side when missing   |
| Method picker    | —        | —               | Documented | PhilSys QR · ID photo · passport                         |
| Document capture | —        | Client          | Documented | Frame guide, auto-capture, quality gate, upload fallback |
| QR scan          | —        | Client + server | Documented | `jsQR` (Safari/Firefox) or `BarcodeDetector`             |
| Liveness         | —        | Client + server | Documented | Two challenges, hard timeout, skippable                  |
| Submit + result  | —        | Server          | Documented | Verdict written, masked name returned                    |

---

## Overview

The phone side of the identity handoff. A desktop (or a phone rendering the flow inline)
mints a capture session through `identity-session-create`, then shows a QR plus a copyable
link. Scanning the QR opens this route.

It is deliberately **standalone**: outside `MainLayout` and `MarketingLayoutShell`, no bottom
tab bar, no install prompt (`identity-handoff` capability in `routeCapabilities.ts`). One job,
one screen, "you can close this page" when done.

The page holds no personal data in the URL. The token is an HMAC capability string; the raw
value is never persisted server-side, only its SHA-256.

---

## Host-facing knowledge

When a guest verifies their ID, the photo is taken with the phone camera rather than picked
from the gallery, and the app checks the ID looks genuine and belongs to the guest. You see a
result badge and any warnings on the booking, not the ID number.

**Common host questions**

- Q: What does the guest actually do?
  A: They scan a QR code on their computer with their phone, point the camera at their ID, and
  follow two short prompts. It usually takes under a minute.
- Q: What do the badges mean?
  A: Verified means the document was proven genuine and matched to the person. Partially
  verified means it was readable and the person was checked on the device. Needs review means
  it was captured but not confirmed, so it is on you to look. Not accepted means it failed a
  hard check (expired, under 18, or a duplicate document).
- Q: Do I still receive the ID photo with the GAF request?
  A: Yes. The captured photo is copied into the same place the uploaded ID used to go, so the
  building receives it exactly as before.
- Q: What if the guest cannot use the camera?
  A: There is an upload fallback at every capture step, and the liveness check can be skipped.
  The result is then reviewed by a person.
- Q: How long do you keep the photos?
  A: Seven days by default. Only the result and the guest's name stay with the booking.

---

## Data and side effects

| Item                             | Where                                               |
| -------------------------------- | --------------------------------------------------- |
| Capture files                    | private bucket `identity-captures`, 7-day retention |
| Verdict, flags, extracted fields | `identity_verifications`                            |
| Session state                    | `identity_verification_sessions`                    |
| Token                            | HMAC, `token_hash` only in the DB                   |

## Implementation map

| Layer | File                                                                     |
| ----- | ------------------------------------------------------------------------ |
| Page  | `ui/src/features/verification/pages/MobileCaptureHandoffPage.tsx`        |
| Flow  | `ui/src/features/verification/components/IdentityCaptureFlow.tsx`        |
| Steps | `ui/src/features/verification/components/steps/*`                        |
| Hooks | `ui/src/features/verification/hooks/*`                                   |
| Edge  | `supabase/functions/identity-session-{create,get,upload,submit,cancel}/` |
| Model | `supabase/functions/_shared/identityVerification.ts`                     |
| Spec  | `docs/architecture/identity-verification.md`                             |

## Testing

| Layer  | Coverage                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Unit   | `captureQuality.test.ts`, `identityVerdict.test.ts`                                                                                  |
| Deno   | `identitySessionToken_test.ts`, `identityVerification_test.ts`, `identitySessionService_test.ts`, `philsysQr_test.ts`, `mrz_test.ts` |
| Manual | `docs/guides/testing/identity-verification-manual.md`                                                                                |

## Edge cases

- **Token expired** → "This link expired. Start again on your computer", with no capture UI.
- **Page reloaded** → the token still works; it is not consumed on read.
- **Camera denied** → visible upload fallback; the flow never dead-ends.
- **Liveness unavailable** → `Continue` appears; the verdict caps at `unverified`.
- **Already completed** → "Already done. You can close this page."
- **Submit raced** → the second request gets 409 and the phone shows the first result.
