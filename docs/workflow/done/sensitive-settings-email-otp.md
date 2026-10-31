---
title: 'Sensitive settings — org-owner email OTP + team notice'
status: done
tags: [workflow, done, security, settings]
updated: 2026-08-26
stage: done
kind: plan
source: docs/workflow/intake/_to-prompt.md
---

# Sensitive settings — org-owner email OTP + team notice

## Goal

When a host saves **financially sensitive** operator configuration (starting with **payment settings** on property and parking), require a **6-digit email OTP** sent **only to the org owner** before the server accepts the write. After a successful save, email a **deduplicated notice** to all org-level and property/parking-level team members that `<setting>` on `<listing>` was updated by `<user>`.

Replaces the current payment-only **legal disclaimer** modal (`PaymentSettingsSaveConfirmDialog`) with a stronger, server-enforced gate. The disclaimer copy can stay as a short line inside the OTP step — not a separate dialog.

## Scope

### In (v1)

| Surface                         | Sensitive keys                                                                                    | Save path                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Property **Settings → Payment** | `paymentMethods`, `paymentProvider`, `gcashName`, `gcashNumber`, QR clear (`gcashQrImageUrl: ''`) | `PATCH app-settings?property_id=`                                                                                                |
| Property payment QR upload      | Primary QR asset change                                                                           | `POST upload-app-settings-asset` (`gcash_qr`) stages Storage only; DB write on OTP-gated PATCH; cancel OTP reverts Payment draft |
| Parking **Settings → Payment**  | Same payment columns on `parking_settings`                                                        | `PATCH parking-settings?parking_id=`                                                                                             |

### Out (later registry entries)

- Org-level sensitive settings (billing payout accounts, org secrets)
- GAF signature, email routing, integrations, org settings
- Extending OTP to **org settings** saves without a property/parking anchor

### Non-goals

- Supabase Auth email OTP (`signInWithOtp`) — that is login identity, not an action-scoped challenge
- SMS OTP
- Storing plaintext OTP in DB

## Approach

### 1. Challenge + token (server)

**Migration:** `settings_verification_challenges` (service-role only; no RLS reads from client)

| Column                       | Purpose                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `id`                         | UUID PK                                                   |
| `organization_id`            | Org scope                                                 |
| `property_id` / `parking_id` | Nullable; exactly one listing anchor for v1               |
| `action`                     | `'payment_settings'` (extensible text)                    |
| `patch_fingerprint`          | SHA-256 of canonical JSON of sensitive fields being saved |
| `code_hash`                  | bcrypt/SHA-256 of 6-digit code                            |
| `requested_by`               | Auth user id who opened the modal                         |
| `expires_at`                 | Default +10 min                                           |
| `consumed_at`                | Set on successful verify                                  |

**Edge function:** `settings-verification` (`serveAuthenticated`)

| Action       | Body                                                      | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `send_otp`   | `{ action, propertyId? \| parkingId?, patchFingerprint }` | Resolve org + owner email via `organizations.owner_id` → `loadAuthUserProfile`. Rate-limit (e.g. 3 / 15 min / user+scope). Invalidate prior open challenges for same fingerprint. Email 6-digit code via Resend (`settingsVerificationOtpEmail.ts`, branded shell; subject **`Payment verification code — {listing}`**; OTP uses readable-on-white brand color; body copy differs for owner vs team-member actor). Return `{ challengeId, ownerEmailMasked, expiresAt }`. |
| `verify_otp` | `{ challengeId, code }`                                   | Constant-time compare hash; mark consumed. Return short-lived **`verificationToken`** (signed JWT or HMAC blob, ~5 min TTL) embedding `challengeId`, `action`, listing id, `patchFingerprint`.                                                                                                                                                                                                                                                                            |

**Enforcement on save:**

- `app-settings` PATCH: if patch touches payment keys (same set as today’s “payment changed” UI logic), require `settingsVerificationToken` in body. Verify token, fingerprint match, listing id, not expired/consumed mismatch.
- `parking-settings` PATCH: same for parking payment keys.
- `upload-app-settings-asset` when `assetType === 'gcash_qr'` and property has existing QR or is replacing: require token (fingerprint = hash of `{ propertyId, assetType, contentLength }` or post-upload confirm flow — see open question below).

Shared module: `supabase/functions/_shared/settingsVerification.ts` (constants, fingerprint helpers, token sign/verify, `requireSettingsVerificationForPatch`).

### 2. Team notification email (after successful save)

**Trigger:** only after payment patch commits successfully (not on OTP send).

**Recipients:** unique emails from:

1. Org owner + active `organization_members` (org team API shape)
2. Active `property_members` for that property **or** parking team for that parking

Exclude duplicates (same person on org + property). Use `normalizeInviteEmail`.

**Sender module:** `_shared/settingsChangeNotifyEmail.ts` + template `settings-change-notice.html` — placeholders: `propertyName` / `parkingName`, `settingLabel` (“Payment settings”), `actorName`, `actorEmail`, `updatedAt` (Asia/Manila).

Fire-and-forget after DB update; log failures, do not fail the PATCH.

### 3. UI

**Component:** `SensitiveSettingsOtpDialog.tsx` (ResponsiveModal on mobile)

Flow when save plan includes dirty payment section **and** payment fingerprint changed:

1. Compute client-side `patchFingerprint` (same canonical JSON as server — shared util in `ui/.../lib/settingsVerificationFingerprint.ts` mirroring edge).
2. Open OTP dialog; host taps **Send OTP** (no auto-send on open); then enter code and **Verify and save**.
3. Show masked owner email (`o***@domain.com`).
4. 6-digit input + Resend (disabled 60s) + Verify & save.
5. On verify success, call existing save with `settingsVerificationToken` on operational patch / parking patch / QR upload.

**Who can complete:** any user with `settings:edit` may initiate; only someone with access to the **org owner inbox** can finish. Non-owner team members see the same modal — product intent is owner approval, not blocking the role.

Remove separate `PaymentSettingsSaveConfirmDialog` (merge one line of liability copy into OTP dialog footer if legal still wants it).

**Parking:** mirror hook in `ParkingSettingsPage` save path.

### 4. Extensibility

Registry in `_shared/settingsVerification.ts`:

```ts
export const SENSITIVE_SETTINGS_ACTIONS = {
  payment_settings: {
    label: 'Payment settings',
    propertyPatchKeys: [...],
    parkingPatchKeys: [...],
  },
} as const;
```

Future actions add a row + UI gate + PATCH guard without new tables.

## Implementation tasks

- [x] **Migration** — `supabase/migrations/20261126120000_settings_verification_challenges.sql`
- [x] **`_shared/settingsVerification.ts`** — fingerprint, OTP generate/hash, JWT/HMAC token, rate limit helper
- [x] **`settings-verification/index.ts`** — `send_otp`, `verify_otp`
- [x] **`_shared/settingsChangeNotifyEmail.ts`** + OTP / notice send helpers + Resend templates
- [x] **Gate** — `app-settings/index.ts`, `parking-settings/index.ts` (upload asset deferred v1)
- [x] **Team recipient collector** — `_shared/settingsChangeNotifyRecipients.ts`
- [x] **UI** — `SensitiveSettingsOtpDialog.tsx`, `PropertySettingsCard.tsx`, `ParkingSettingsCard.tsx`
- [x] **Client fingerprint util** — `settingsVerificationFingerprint.ts`, `useSettingsVerification.ts`
- [x] **Delete** — `PaymentSettingsSaveConfirmDialog.tsx`
- [x] **Docs** — route guides, edge-functions, PROJECT, data-model, validation-and-env

## Docs to update

| Doc                                           | Change                                                                     | Status |
| --------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| `docs/guides/routes/org/property/settings.md` | Payment § — OTP to org owner, team notice email                            | Done   |
| `docs/guides/routes/org/parking/settings.md`  | Same for parking payment                                                   | Done   |
| `docs/architecture/edge-functions.md`         | `settings-verification` row; PATCH bodies gain `settingsVerificationToken` | Done   |
| `docs/PROJECT.md`                             | API table + `settings_verification_challenges` mention                     | Done   |
| `docs/architecture/data-model.md`             | New table                                                                  | Done   |
| `docs/architecture/validation-and-env.md`     | `SETTINGS_VERIFICATION_SECRET`                                             | Done   |
| `docs/workflow/intake/_to-prompt.md`          | Item marked ✅ → Done link                                                 | Done   |

## Open questions

1. **QR upload timing** — **Shipped:** QR upload stages Storage (unique path, no settings row write); draft holds URL until OTP-gated PATCH. Cancel OTP / failed save reverts Payment draft.
2. **Org owner saving** — same flow (code to their email). No bypass.
3. **Failed OTP lockout** — 5 wrong attempts per challenge → invalidate challenge (force resend).

## Test plan (manual)

- Org owner changes GCash number → receives OTP → save succeeds → team inbox receives notice (owner not duplicated if also on property team).
- Property manager with `settings:edit` triggers OTP → cannot save without code → with code from owner → save succeeds → notice lists manager as actor.
- Expired / wrong code / tampered token rejected with 403.
- Parking payment save parity.
- Save non-payment sections only → no OTP modal.
