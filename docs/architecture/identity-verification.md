---
title: 'Identity verification'
status: active
tags: [architecture, identity, verification, privacy, trust-safety]
updated: 2026-11-07
kind: reference
---

# Identity verification

Canonical spec for the live identity capture flow. Plan:
[`../workflow/in-progress/live-identity-verification.md`](../workflow/in-progress/live-identity-verification.md).
Privacy detail: [`data-privacy-identity.md`](./data-privacy-identity.md).

## What it does

A guest (booking form) or a host (Get Verified) proves that a government ID is genuine and
belongs to them, without uploading a gallery photo:

1. Desktop starts a session and shows a QR plus a copyable link.
2. The phone opens `/verify/:token`, captures the document with a frame guide and
   auto-capture, optionally scans the PhilSys QR, and runs an optional on-device liveness
   challenge.
3. The server decodes deterministically where it can, asks an AI model for the rest, and
   writes a structured **verdict** with flags instead of a bare image.
4. The desktop polls the session and advances itself. A host or super admin reads the
   verdict, not a photo.

## One module, four consumers

| Consumer           | Surface                                                         | Subject                    |
| ------------------ | --------------------------------------------------------------- | -------------------------- |
| Guest booking form | `features/guest/form/components/GuestIdentityCapture.tsx`       | `guest` (per booking slot) |
| Host registration  | `HostIdentityVerifyButton` inside onboarding step 3             | `org_owner`, pre-org       |
| Host Get Verified  | `features/verification/components/HostIdentityVerifyButton.tsx` | `org_owner`                |
| Super-admin review | `features/verification/components/IdentityPreScreenBlock.tsx`   | reads `org_owner`          |
| Account profile    | `features/verification/components/GuestIdentityCard.tsx`        | `guest` (account)          |

Shared code lives in `ui/src/features/verification/` — a sibling of `guest/` and
`dashboard/`, because it is imported from both trees.

## Verdict model

`_shared/identityVerification.ts#resolveVerdict` is deterministic and unit-tested. The client
mirror `ui/src/features/verification/lib/identityVerdict.ts` carries only labels and enums, and
`identityVerdict.test.ts` parses the server file and fails on drift.

| Verdict              | Rule                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `verified`           | signature proof **and** liveness passed **and** face match `match`/`likely_match` **and** fields readable **and** no screen-capture suspicion   |
| `partially_verified` | MRZ checksums or a confident extraction **and** liveness passed **and** no signature                                                            |
| `unverified`         | Capture completed, signals weak, absent or contradictory. Default. A host reviews                                                               |
| `rejected`           | A blocking flag fired: expired document, under 18, duplicate document, face mismatch, reviewer rejection, signature actually checked and failed |
| `expired`            | `expires_at` passed. Set by cron only                                                                                                           |

Hard invariants:

- **`liveness_passed = null` is not `false`.** `null` means "could not run"; it caps the
  verdict at `unverified` but never claims the guest failed.
- **A failed signature is only blocking when a key was configured.** `signatureValid = false`
  with no key means "not checked", and `signatureInvalid` is a separate signal.
- **Client-side liveness is never `certified`.** In-house writes `clientside`; only a
  PAD-certified provider may write `certified`.
- **A name/DOB mismatch is a warning, not a block.** OCR is fallible; a human decides.

### Flag catalog

`signature_invalid`, `document_expired`, `name_mismatch`, `dob_mismatch`, `age_under_18`,
`liveness_failed`, `liveness_unavailable`, `face_mismatch`, `duplicate_document`,
`low_quality`, `screen_capture_suspected`, `ai_unavailable`, `extraction_incomplete`,
`no_document_image`, `reviewer_rejected`.

Severity: `blocking` (short-circuits to `rejected`), `warning`, `info`. Stored in
`identity_verifications.flags` as `[{ code, severity, detail? }]`.

## Data flow

```
Desktop                          Edge                                   Phone
───────                          ────                                   ─────
POST identity-session-create ──▶ session row + HMAC token (10 min)
◀── token, verifyUrl, qr URL
poll identity-session-get ────▶ status                          scan ▶ GET identity-session-get?device=mobile
                                                                       POST identity-session-upload  (×N)
                                                                       POST identity-session-submit
                                                                         ├ deterministic QR / MRZ decode
                                                                         ├ AI extraction + face match
                                                                         ├ resolveVerdict
                                                                         └ identity_verifications row
◀── status completed + verdict
```

**Polling is the contract.** Realtime `postgres_changes` honours RLS and these tables have no
anon read policy, so a subscription would silently never fire in production. The desktop polls
every 2s, backing off to 5s after 30s.

**The token is not consumed on read.** iOS Safari reloads a backgrounded tab; burning the
token on the first GET strands the guest. Single-submit is enforced on the session row with a
compare-and-set.

## Subject model

The guest booking form is anonymous, so an identity cannot be keyed on `auth.users` alone.

| Subject     | Linkage                                                                            | Reuse                                                                      |
| ----------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `guest`     | `subject_email_hash` (always), plus `guest_user_id` and/or `booking_id` when known | Only when `guest_user_id` matches. Anonymous verifications are per booking |
| `org_owner` | `owner_user_id` (always), plus `organization_id` once the org exists               | One live verdict per host account                                          |

Reuse-by-email was rejected deliberately: typing someone else's address must not grant their
verification.

### Host verification at registration

A host signs in with Google **before** any organization exists, so an `org_owner` verdict is
keyed to `owner_user_id`, not to an org. `create-organization` attaches it:

1. Host taps **Verify with camera** on the onboarding Valid ID field.
2. The session runs with `subjectKind: 'org_owner'` and no `organizationId`.
3. The verdict is written with `organization_id = null` and `owner_user_id = <auth user>`.
4. `create-organization` finds the newest unlinked active verdict for that owner, sets
   `organization_id`, and logs `identity.verification_linked`.

The attach runs **last** in `create-organization` on purpose: the early rollback path deletes
the organization, which cascades into `identity_verifications` and would throw the host's
check away.

The captured photo still becomes the Valid ID file through the existing
`upload-org-verification-asset` call, so `submit-org-verification`, the review queue and the
badge logic are unchanged.

### Booking integration

`guest_submissions` gains `primary_identity_verification_id` … `guest5_identity_verification_id`
plus `identity_capture_mode`.

At `submit-form`, `DatabaseService.processFormData` loads each referenced verdict, checks it
belongs to the booking's `guest_email` hash and slot, and **copies the captured front image
into the existing `valid-ids` bucket** under the deterministic key. `valid_id_url` is then
written exactly as before, so GAF attachments, admin previews and `GuestAvatar` need no
change.

## Storage and retention

Private bucket `identity-captures`, service-role only, path
`{subject_kind}/{subjectRef}/{sessionId}/{kind}.{ext}`. Kinds: `document_front`,
`document_back`, `selfie`, `liveness_frame`.

- Default retention **7 days** (`IDENTITY_CAPTURE_RETENTION_DAYS`).
- `identity-captures-purge-cron` deletes files for terminal sessions past retention, expires
  stale sessions, and flips expired verdicts to `expired`.
- Liveness **frames are not uploaded**; only the pass/fail, the challenge names and timing
  are sent. Fewer biometric bytes stored for the same signal.

## Edge functions

| Function                       | Wrapper                     | Purpose                                                       |
| ------------------------------ | --------------------------- | ------------------------------------------------------------- |
| `identity-session-create`      | `servePublic` + anti-spam   | Mint a session + token; org sessions require `verifyOrgOwner` |
| `identity-session-get`         | `servePublic` + token       | Phone bootstrap and desktop polling                           |
| `identity-session-upload`      | `servePublic` + token       | Multipart capture → `identity-captures`                       |
| `identity-session-submit`      | `servePublic` + token       | Pipeline → verdict                                            |
| `identity-session-cancel`      | `serveAuthenticated`        | Subject aborts                                                |
| `identity-verification-mine`   | `serveAuthenticated`        | The caller's active verdict (masked)                          |
| `identity-verification-delete` | `serveAuthenticated`        | Data-subject deletion                                         |
| `identity-verification-review` | `serveSuperAdmin` + step-up | Manual override                                               |
| `identity-captures-purge-cron` | `serveCronPost`             | Retention sweep                                               |

## Provider seam

`IdentityVerificationProvider` is not implemented yet (Phase 7 is a funded decision). The
columns that matter are already there: `provider`, `provider_ref`, and `liveness_grade`
(`certified` is reserved for a PAD-certified provider). Adding Didit or PSA eVerify is one
adapter file plus `IDENTITY_PROVIDER`, not a rewrite.

## PhilSys QR

`_shared/philsysQr.ts` decodes v1 JSON (Ed25519 detached signature) and v3 base45 → zlib →
CBOR (which carries the portrait). Honesty rules:

- **No key, no claim.** Without `PHILSYS_PUBLIC_KEY` the result is `checked: false`, and the
  verdict cannot reach `verified` on signature alone.
- **v3 has no published detached-signature scheme.** Its fields are usable; its signature is
  reported as not checked.
- No code was copied from `bettergovph/openverify` (unlicensed). The format is implemented
  from the PSA public advisories with Web Crypto and `DecompressionStream`.
- `mrz-scanner` (AGPL) is rejected; the server MRZ parser is our own ICAO 9303 implementation.

## Env

| Var                               | Purpose                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| `IDENTITY_SESSION_SECRET`         | HMAC for handoff tokens. Required                           |
| `IDENTITY_HASH_PEPPER`            | Pepper for email and document-number hashes. Required       |
| `PHILSYS_PUBLIC_KEY`              | Ed25519 public key (raw 32 bytes or SPKI, base64). Optional |
| `IDENTITY_VERDICT_VALIDITY_DAYS`  | Verdict lifetime, default 365                               |
| `IDENTITY_CAPTURE_RETENTION_DAYS` | Capture retention, default 7                                |
| `IDENTITY_PURGE_CRON_SECRET`      | Purge cron secret (fail-open until set, like siblings)      |
| `IDENTITY_APP_ORIGINS`            | Comma-separated allowlist for the handoff URL origin        |
