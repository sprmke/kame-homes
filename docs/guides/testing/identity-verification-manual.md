---
title: 'Identity verification — manual test guide'
status: active
tags: [guides, testing, identity, manual]
updated: 2026-11-07
---

# Identity verification — manual test guide

Automated coverage lives in the unit and Deno suites (see
[`verify.md`](../routes/verify.md)). This guide covers what only a real device and a real
document can prove.

**Rules:** never commit a real ID, a real PhilSys payload, or a real person's photo to the
repo. Use your own document, and delete any capture you take during testing from Supabase
Storage afterwards.

## Prerequisites

- Local stack running (`./dev.sh`) with `IDENTITY_SESSION_SECRET` and `IDENTITY_HASH_PEPPER` in
  `supabase/.env.local`.
- A phone on the same network as the laptop, or a tunnel URL.
- `IDENTITY_APP_ORIGINS` unset locally (the browser `Origin` is trusted).

## 1. Desktop → phone handoff

1. Open a property booking form on the laptop and tap **Verify your ID** on a guest slot.
2. Choose **Verify on your phone**. A QR and a copy link appear with a countdown.
3. Scan with the phone camera.
4. Expect: the phone opens `/verify/:token`, the laptop stays on the waiting state, and the
   laptop advances by itself when the phone finishes. No scroll jump, no navigation.

- [ ] QR scans on iOS Safari and Android Chrome
- [ ] Reloading the phone page keeps the session usable
- [ ] Letting the countdown hit zero shows "This link expired" with a restart
- [ ] Copy link pasted into a phone browser works

## 2. Document capture

1. Point at a PhilID, UMID, driver's licence, and a passport in turn.
2. Check the frame guide, the guidance text ("Hold steady", "Reduce glare", "Fit the ID in
   the frame"), and auto-capture after a steady frame.
3. Tap **Take photo** manually in poor light.

- [ ] Auto-capture fires within a few seconds on a steady, well-lit document
- [ ] Glare on a laminated card shows the glare hint
- [ ] Back camera is used by default on a phone
- [ ] Denying camera permission shows the upload fallback, not a spinner

## 3. PhilSys QR

1. Choose **Scan the PhilSys QR** and scan the QR on a real PhilID / ePhilID.
2. Expect the flow to continue to the document photo, then the result.

- [ ] v1 JSON payload decodes and, with `PHILSYS_PUBLIC_KEY` set, reports signature verified
- [ ] Without the key, the result is `partially_verified` at best and never says "signature"
- [ ] v3 (printed ePhilID) decodes base45 → CBOR and shows the portrait when present
- [ ] A photo of a screen showing the QR is flagged `screen_capture_suspected`

## 4. Liveness

1. Complete the two challenges: blink, then turn your head (or open your mouth).
2. Retry in poor light, with glasses, and on a low-end Android.

- [ ] Both challenges complete in under 15 seconds on a mid-range phone
- [ ] `I can't do this` skips and the flow still submits
- [ ] Blocking the CDN (`cdn.jsdelivr.net`) makes the step unavailable, and the flow proceeds

## 5. Verdict outcomes

| Setup                                | Expected                                              |
| ------------------------------------ | ----------------------------------------------------- |
| PhilSys QR + key + liveness + selfie | `verified`                                            |
| ID photo + liveness, no key          | `partially_verified`                                  |
| ID photo, liveness skipped           | `unverified`                                          |
| Expired passport                     | `rejected` with "Document expired"                    |
| Guest under 18                       | `rejected` with "Guest is under 18"                   |
| Same document on a second email      | `rejected` with "Same document used by another guest" |

## 6. Booking integration

1. Verify the primary guest, then complete and submit the booking.
2. Open the booking in the dashboard.

- [ ] `valid_id_url` is populated and the ID renders in the guest panel
- [ ] The verdict badge shows on the guest row
- [ ] Sending the GAF request still attaches the ID
- [ ] `identity_capture_mode` is `live`

## 7. Account profile

1. Open `/account/profile`.
2. Verify, then tap **Delete verification**.

- [ ] The badge, masked name and expiry render
- [ ] Deleting removes the verdict and the captures, and the booking keeps its uploaded ID
- [ ] The activity log records `identity.verification_deleted`

## 8. Retention

1. Create a session, complete it, then manually age `created_at` past the retention window.
2. Invoke `identity-captures-purge-cron` locally with the cron secret.

- [ ] Capture files are deleted
- [ ] Expired verdicts flip to `expired`
- [ ] The run returns counts and records one heartbeat
