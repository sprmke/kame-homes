---
title: 'Storage'
status: active
tags: [workflow, planned, production-readiness, storage, privacy]
updated: 2026-09-16
stage: planned
kind: plan
---

# 20 — Storage

## Goal

Every uploaded object is in the right bucket with the right privacy, reachable only by those entitled to it, size- and type-validated, lifecycle-managed, and accounted for in cost.

## Prior art — do not redo

| Shipped                                 | Where                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Guest PII buckets made **private**      | `20261310120100_guest_doc_storage_private_reads.sql` — `payment-receipts`, `valid-ids`, `pet-vaccinations`, `pet-images`, `parking-endorsements` |
| Anonymous writes dropped on PII buckets | Cost-abuse Phase 1 migration                                                                                                                     |
| Short-lived signed-URL reads            | `_shared/storageSignedUrl.ts` (+ test), via `get-form` (guest) and `get-booking-asset-url` (admin)                                               |
| Unified upload ceilings                 | `_shared/uploadLimits.ts` + client mirror + parity test                                                                                          |
| Client-side optimization pipeline       | Doc 09                                                                                                                                           |
| Storage audit tooling                   | `bun run media:storage-audit`                                                                                                                    |

Storage privacy has already had a dedicated hardening pass. Do not re-litigate the bucket privacy model; verify and extend it.

## Phases

### Phase 20.1 — Bucket inventory

One table, committed to `docs/architecture/storage.md`, covering every bucket:

| Column          | Detail                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Bucket          | id                                                                                                  |
| Public/private  | and the migration that set it                                                                       |
| Contents        | what object classes live here                                                                       |
| Sensitivity     | PII / business / public marketing                                                                   |
| Path convention | the tenant-scoping structure                                                                        |
| Who can read    | and through which edge function                                                                     |
| Who can write   | and through which function                                                                          |
| Size limit      | bucket `file_size_limit` vs `uploadLimits.ts` (these must agree, with the bucket ≥ the app ceiling) |
| MIME allowlist  | bucket-level                                                                                        |
| Retention       | doc 19 Phase 19.5                                                                                   |

Any bucket that is public and could contain PII is a launch blocker.

### Phase 20.2 — Path structure and tenant scoping

Object paths must encode tenant scope (`org/<id>/property/<id>/...`) so:

- A signed-URL issuer can verify the requester's access from the path itself.
- A tenant's objects can be enumerated for deletion/export (retention, GDPR-style requests).
- A path-traversal or predictable-path attack cannot reach another tenant's object.

**Edge case:** predictable paths in a **public** bucket are effectively public data even without a link. Guest documents must never rely on an unguessable path — they are already private-bucket + signed URL, which is the correct model. Verify no exception remains.

### Phase 20.3 — Signed URL policy

- Define TTL per class: guest documents short (minutes), admin previews short, public marketing not signed at all.
- Signed URLs must not be embedded in cacheable responses (doc 11) or long-lived caches (doc 16).
- Log signed-URL issuance for sensitive classes (doc 27 / `audit-logging`) — who requested access to which guest document and when. For a system holding government IDs, this trail matters.

### Phase 20.4 — Upload validation defense in depth

Every upload path must enforce, **server-side**:

- Size ceiling (already centralized — verify every `upload-*`/`submit-*` function calls `assertWithinUploadLimit`).
- MIME type allowlist, validated against actual file content (magic bytes), not the client-provided `Content-Type` or extension.
- Filename sanitization — never use a client-supplied filename as a storage path.
- Reject archives and executables everywhere.
- Content scanning consideration for guest-uploaded files: this app accepts uploads from anonymous guests, so it is a malware-distribution vector if any object is ever served back to a host with an executable content type. Force `Content-Disposition: attachment` and a safe content type on document downloads.

**Edge case:** SVG is an XSS vector when served inline from an origin that shares cookies/tokens. Either disallow SVG uploads, serve from a separate origin, or force download. The `NONE` optimization preset passes SVG through untouched, so this needs an explicit decision.

### Phase 20.5 — Orphans, cleanup, and cost

- Orphan detection: objects with no DB row referencing them (failed uploads, deleted bookings). Use `media:storage-audit` and add a scheduled reconcile.
- Deletion propagation: deleting a booking/property/org must delete or archive its objects. Confirm what currently happens — silently orphaned PII after a deletion is a privacy problem, not just a cost one.
- Storage + egress cost tracking, feeding the service-cost matrix ([`super-admin-service-cost-monitoring.md`](../super-admin-service-cost-monitoring.md)).
- The marketing generation sweeper (`marketingGenerationSweeper.ts`) already models scheduled cleanup — reuse the pattern.

### Phase 20.6 — Backup and recovery for objects

Database backups do **not** include Storage objects. A restore that brings back rows pointing at deleted objects is a broken restore. Doc 30 owns the drill; this doc owns the requirement:

- Define whether Storage is backed up, how, and with what RPO.
- At minimum, enable versioning/soft-delete on PII buckets so an accidental delete is recoverable.

## Edge cases

- **Bucket-level limit below the app ceiling** — the platform rejects first with a generic error and the user sees a confusing message. The header comment in `uploadLimits.ts` already warns about this; verify the numbers on the hosted project, not just in `config.toml`.
- **Signed URL in an email** — emails are archived and forwarded; a signed URL to a guest ID document in an email outlives its context. Prefer a link to an authenticated page that issues a fresh URL.
- **Direct-to-storage uploads** bypass edge-function validation entirely. If any path uses them, the bucket policy is the only control.
- **Re-upload with the same path** overwrites, defeating audit and breaking caches (doc 09 Phase 9.4).
- **Storage RLS is separate** from table RLS and is its own policy set. The launch audit's finding that `GRANT ALL ON storage.buckets TO public` exists in an early migration is worth re-verifying against current state.
- **Large video (50 MB ceiling)** through an edge function can exceed memory/time. Confirm videos go direct-to-storage or streamed.

## Exit gate

- [ ] Bucket inventory table committed; no public bucket contains PII.
- [ ] Every object path encodes tenant scope; access verified from the path.
- [ ] Signed-URL TTLs defined per class; issuance logged for sensitive classes.
- [ ] Magic-byte MIME validation + filename sanitization on every upload path.
- [ ] SVG handling decided and enforced; documents served as attachments.
- [ ] Orphan reconcile scheduled; deletion propagation verified for booking/property/org.
- [ ] Storage + egress cost tracked in the service-cost matrix.
- [ ] Bucket versioning/soft-delete enabled on PII buckets; restore requirement stated for doc 30.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/storage.md` (mandatory), `docs/PROJECT.md`, `docs/archive/operations/migration-runbook.md` for bucket migrations.
- **Plans / Team RBAC:** storage quotas are a plausible plan-tier dimension — invoke `plans-and-permissions` if so.
- **activity-log:** invoke `audit-logging` — signed-URL issuance for guest PII, object deletion, and retention purges should emit events.
