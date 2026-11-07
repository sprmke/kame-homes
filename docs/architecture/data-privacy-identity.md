---
title: 'Data privacy — identity verification'
status: active
tags: [architecture, privacy, dpa, identity]
updated: 2026-11-07
kind: reference
---

# Data privacy — identity verification

Privacy impact assessment for [`identity-verification.md`](./identity-verification.md).
Reviewed against the Philippine Data Privacy Act (RA 10173) and the NPC's
[reminder on taking pictures of IDs](https://privacy.gov.ph/wp-content/uploads/2023/08/Reminder_Taking-of-Pictures-of-ID.pdf).

## Lawful basis and consent

- **Basis:** explicit consent for sensitive personal information (DPA §13), captured inside
  the flow before the camera opens. The consent step states the purpose, the retention period
  and who sees the result.
- **Consent is a hard server requirement.** `identity-session-submit` rejects a payload with
  `consentAccepted !== true`, so a modified client cannot skip the step.
- **Scope:** one consent covers the capture, the automated checks, and the host review of the
  verdict. It does not cover marketing use.

## What is stored, and for how long

| Artifact                                                              | Stored                                                  | Retention                                                                              | Rationale                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Capture images (`document_front`, `document_back`, `selfie`)          | Private bucket `identity-captures`                      | 7 days (`IDENTITY_CAPTURE_RETENTION_DAYS`), enforced by `identity-captures-purge-cron` | Long enough for review and a GAF attachment, short enough to matter |
| Liveness video / frames                                               | **Not stored**                                          | never persisted                                                                        | Only pass/fail, challenge names and timing are sent                 |
| Extracted fields (name, DOB, sex, nationality, document type, expiry) | `identity_verifications`                                | Life of the verdict (default 365 days, or the document expiry if sooner)               | Reuse across bookings without re-collecting                         |
| Document number                                                       | **Hash only** (`sha256(normalized                       |                                                                                        | pepper)`)                                                           | Life of the verdict | Duplicate detection without holding a PhilSys PCN or passport number |
| Email address                                                         | **Hash only** on the verdict row (`subject_email_hash`) | Life of the verdict                                                                    | The raw address stays on the booking where it already lives         |
| Verdict + flags                                                       | `identity_verifications`                                | Life of the verdict                                                                    | The host needs to know what was checked                             |
| Reviewer note                                                         | `identity_verifications.review_note`                    | Life of the verdict                                                                    | Appeals trail                                                       |
| Activity log                                                          | `activity_log` (org-scoped)                             | Per the activity-log retention policy                                                  | Actions only; never a name, number or path                          |

Facial landmarks are computed on the device and discarded. The AI model receives the
document image and (when present) a selfie still, and returns structured fields; the images
are not retained by us beyond the bucket retention above.

## Data-subject rights

| Right       | Implementation                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access      | `identity-verification-mine` returns the caller's verdict, masked name, method, expiry and flags                                                                                                        |
| Erasure     | `identity-verification-delete` removes the verdict row and every capture for its session. `guest_submissions.*_identity_verification_id` is `ON DELETE SET NULL`, so a booking keeps its `valid_id_url` |
| Portability | The verdict JSON is returned by the same endpoint; capture images can be supplied on request                                                                                                            |
| Objection   | Not offering a verified path falls back to the existing upload, which the guest can choose at any step                                                                                                  |

Deleting a verification does **not** delete a booking's existing `valid-ids` image, because
that image is part of the booking record the host already relied on. That boundary is
deliberate and documented here rather than left implicit.

## Minimization argument

The NPC's guidance is to verify, not to hoard. The PhilSys QR path verifies authenticity with
**no retained front-of-card photo** on the verdict itself, and the capture bucket expires in
seven days. Document numbers are hashed with a pepper so duplicate detection still works.

Net effect versus the previous behaviour (an ID photo kept indefinitely in `valid-ids`): the
product stores _more structure_ and _less raw imagery_.

## Security controls

| Concern          | Control                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Token leak       | 10-minute HMAC token, purpose-bound to one session, `token_hash` only in the DB, token redacted from error reporting                |
| Session hijack   | Capture paths must sit under the session prefix; submit only from `pending`/`in_progress`/`captured`; single-submit compare-and-set |
| Read access      | Both tables are service-role only with no client RLS policy. Every read is an edge function call                                    |
| Abuse            | `antiSpamGate` on create/upload/submit, durable per-identity rate limits, 12 MB per file                                            |
| Prompt injection | Document text is content, never instruction — carried into `identityExtraction.ts`                                                  |
| Over-claiming    | `liveness_grade` separates `clientside` from `certified` in the DB and in every string                                              |
| Retention drift  | Cron is the only deleter; one `system.cron_run` summary per run, Sentry on failure                                                  |

## Open items

- **PSA National ID eVerify onboarding** would let us check card activation/revocation and do
  a registry face match. Long lead time; no code dependency.
- **Capture retention for GAF properties** is currently the same 7 days as everywhere. If a
  building needs an ID attachment weeks later, the copy in `valid-ids` is the artifact that
  serves it — that bucket is out of scope for this plan and unchanged.
- **Backfilling or deleting existing `valid-ids` objects** is a separate migration with its
  own legal review.
