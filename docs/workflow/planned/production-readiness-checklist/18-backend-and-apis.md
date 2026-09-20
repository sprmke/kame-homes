---
title: 'Backend and APIs'
status: active
tags: [workflow, planned, production-readiness, edge-functions, api]
updated: 2026-09-17
stage: planned
kind: plan
---

# 18 — Backend & APIs

## Goal

All 300 edge functions follow one contract: consistent auth wrapper, validated input, typed and predictable responses, idempotent writes, bounded work, and no inline side effects.

## Remaining work to finalize

**Status: Phase 18.1 tooling + hand-rolled-serve CI allowlist shipped (2026-09-18).** Full per-write validation, idempotency, and outbound circuit breakers remain.

| #   | Work                                                                                                                                                                                                                   | Blocker                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Conformance table for all 300 functions (18.1).                                                                                                                                                                        | **Script shipped** — regenerate with `bun run audit:edge-functions`. Heuristic table, not a hand-audited 300-row baseline.                    |
| 2   | ~~Hand-rolled `serve()` only on a justified allowlist.~~ **Done** — 19 reviewed names in `audit-edge-functions.mjs`; `bun run check:edge-conformance` in CI. Converting them to `serve*` is still a per-function pass. | —                                                                                                                                             |
| 3   | Input validation with unknown-field rejection on every write (18.2).                                                                                                                                                   | Code                                                                                                                                          |
| 4   | Stable error envelope; no internals leaked (18.3).                                                                                                                                                                     | Code — envelope-shape gap on `jsonSuccess`/`jsonError` triaged as mostly false-positive (see doc), real standardization follow-up still open. |
| 5   | Idempotency on retryable writes; webhook providers dedupe by event ID (18.4).                                                                                                                                          | Code                                                                                                                                          |
| 6   | Timeouts + backoff + circuit breakers on every outbound call (18.5).                                                                                                                                                   | Code                                                                                                                                          |
| 7   | `docs/architecture/edge-functions.md` matches reality; CI conformance check with a committed baseline (18.6–18.7).                                                                                                     | Docs + `--check` CI done; a committed JSON snapshot of every function is still optional.                                                      |

## Measured before / after

| Metric                                       | Before               | After                                         | Difference                    |
| -------------------------------------------- | -------------------- | --------------------------------------------- | ----------------------------- |
| Conformance sweep                            | None                 | `audit-edge-functions.mjs` over 296 functions | Repeatable triage list        |
| New hand-rolled `serve()`                    | Could land unnoticed | `--check` + 19-name allowlist in CI           | Convention regression blocked |
| `serve*` conversion of the 19                | Not done             | Still not done                                | Justified; not a bypass       |
| Write validation / idempotency / outbound CB | Partial              | Unchanged this pass                           | Still the bulk of 18.2–18.5   |

## Prior art — strong foundation already

| Shipped                          | Where                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Standard serve wrappers          | `_shared/serveEdge.ts` — `serveAdmin`, `serveSuperAdmin`, `serveAuthenticated`, `servePublic`, `serveCronPost` |
| Standard response envelope       | `_shared/httpResponse.ts` — `jsonSuccess`, `jsonError`, `jsonUpgradeHook`                                      |
| Deno type-check in CI            | `bun run check:edge-types` (launch audit P0-2)                                                                 |
| Rate-limit import coverage check | `scripts/dev/check-serve-public-rate-limit.sh` with an explicit allowlist                                      |
| Side-effect centralization       | `workflowOrchestrator.transition()` — repo rule forbids inline side effects                                    |
| Idempotency helper               | `_shared/idempotency.ts`                                                                                       |
| Host-facing error mapping        | `_shared/hostFacingError.ts`                                                                                   |
| Handler tests                    | `test:edge`, `test:edge:handlers` (no `--no-check`)                                                            |

This item is **partially done to a good standard**. The work is closing coverage gaps across all 300 functions rather than inventing conventions.

## Phases

### Phase 18.1 — Inventory and conformance sweep

Build `scripts/dev/audit-edge-functions.mjs` producing one row per function:

| Column           | Check                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Wrapper          | Uses a `serve*` helper, or hand-rolled `serve()` (repo rule says prefer the helper)                           |
| Auth tier        | admin / super-admin / authenticated / public / cron, and whether it matches the function's actual sensitivity |
| `verify_jwt`     | Matches `supabase/config.toml` for that function                                                              |
| Input validation | Validates and narrows the body/query                                                                          |
| Response shape   | Uses `jsonSuccess`/`jsonError`                                                                                |
| Rate limit       | Gate present or allowlisted                                                                                   |
| Bounded queries  | `.limit()`/`.range()` (doc 10)                                                                                |
| Cache class      | Declared (doc 11)                                                                                             |
| Idempotency      | Present on writes that can be retried                                                                         |
| Activity log     | Emits an event or is justified N/A (repo rule)                                                                |
| Tests            | Has a handler test                                                                                            |
| Callers          | Referenced by UI/cron/webhook, or **dead** (doc 05)                                                           |

This table is the deliverable for the whole doc and drives every other phase.

### Phase 18.2 — Input validation everywhere

Every function must validate and narrow untrusted input before use:

- Type, range, length, and format for each field.
- Reject unknown fields on writes rather than passing them through to the DB (mass-assignment protection — the launch audit's P1-5 allowlist approach on `update-booking-details` is the model).
- Enforce body size limits.
- Validate IDs are UUIDs before they reach a query.

Prefer sharing schemas with the client where practical, but **never** treat client validation as sufficient.

**Edge case:** dates. This repo carries a known `MM-DD-YYYY` vs `YYYY-MM-DD` split with Manila timezone rules. Validation must normalize through `_shared/utils.ts`, not per-function ad hoc parsing.

### Phase 18.3 — Error handling contract

- One error envelope (already `jsonError`) with a stable, machine-readable `code` alongside the human message, so the client can branch without string matching.
- Correct status codes: 400 validation, 401 unauthenticated, 403 unauthorized, 404 not found, 409 conflict, 422 semantic, 429 rate limited, 5xx server. The launch audit noted the "200 + error" shape is already resolved by the `serveEdge` contract — verify it holds across all 300.
- **Never leak internals**: stack traces, SQL errors, or third-party payloads must not reach a client. Map through `hostFacingError.ts`.
- Every 5xx captured to PostHog with correlation context (doc 27).

**Edge case:** a 404 that distinguishes "does not exist" from "exists but you cannot see it" is an enumeration oracle across tenants. Return 404 for both.

### Phase 18.4 — Idempotency and concurrency

- Every mutating endpoint that a client can retry (payment, email send, booking transition, voucher claim) accepts an idempotency key and dedupes.
- Optimistic concurrency (CAS) on edits — already done for `updateBookingStatus` and `update-booking-details`; extend to other multi-editor surfaces (property settings, pricing, team).
- Webhooks (PayMongo, Meta, Resend) must be idempotent by provider event ID: they **will** be redelivered. Verify `processed_emails`-style dedupe exists for each.

### Phase 18.5 — Outbound call discipline

Every call to Resend, Meta, Gemini/Groq, PayMongo, Telegram, Google needs: timeout, bounded retry with jittered backoff, circuit breaker, and a defined failure behavior (doc 17). A hung third party currently consumes the whole function timeout.

### Phase 18.6 — API documentation and versioning

- Keep `docs/architecture/edge-functions.md` authoritative: function → auth tier → inputs → outputs → side effects → rate limit → cache class.
- Define the breaking-change policy: the SPA and functions deploy separately, so a deployed client can be one version behind. Additive changes only, or a deliberate version step.

**Edge case:** a PWA user can run a _very_ old client from cache. Response-shape changes must stay backward compatible or the client must be forced to update (doc 16 Phase 16.6).

### Phase 18.7 — Guard

- Wire `audit-edge-functions.mjs` into CI as a conformance report; fail on regressions against a committed baseline.
- Require a handler test for every new function.

## Edge cases

- **`verify_jwt=false` is the norm here** because Kong's HS256 check rejects modern tokens; the real boundary is `verifyAdminJwt` in the handler (documented repo behavior). This means **a missing auth call is a total bypass with no platform backstop** — the audit table's auth column is the single most important check in this doc.
- **Service-role client reachable from a public handler** bypasses every check. Grep for service-role client creation in `servePublic` functions specifically.
- **Cron endpoints exposed over HTTP** need the shared-secret gate (`cronSecretGate.ts`) — verify every `serveCronPost` uses it.
- **Long-running handlers** hit the platform execution limit and fail midway, leaving partial state. Any multi-step write must be resumable or transactional (doc 15).
- **CORS on an error path** — a handler that throws before CORS headers are applied produces an opaque browser error that hides the real status.
- **Deleting a function is breaking** if a cron, webhook config, or cached client still calls it (doc 05).

## Exit gate

- [ ] Conformance table covering all 300 functions committed.
- [x] Every function uses a `serve*` wrapper with the correct tier; no hand-rolled `serve()` outside a justified allowlist. (19 reviewed exceptions; CI `--check`.)
- [ ] Input validation with unknown-field rejection on every write.
- [ ] Error envelope with stable codes and correct statuses; no internals leaked.
- [ ] Idempotency on all retryable writes; all three webhook providers dedupe by event ID.
- [ ] Timeouts + backoff + circuit breakers on every outbound call.
- [ ] `docs/architecture/edge-functions.md` matches reality.
- [x] Conformance check in CI with a committed baseline. (`--check` allowlist is the baseline; optional JSON dump still open.)

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/edge-functions.md` (mandatory), `.cursor/rules/supabase-edge-functions.mdc`, `docs/PROJECT.md`.
- **Plans / Team RBAC:** invoke `plans-and-permissions` for any endpoint that gains a gated capability.
- **activity-log:** invoke `audit-logging` — the conformance table's activity-log column is exactly this obligation, applied across all 300 functions.
