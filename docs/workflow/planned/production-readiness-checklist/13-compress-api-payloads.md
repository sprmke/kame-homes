---
title: 'Compress API payloads'
status: active
tags: [workflow, planned, production-readiness, performance, edge-functions]
updated: 2026-09-21
stage: planned
kind: plan
---

# 13 — Compress API payloads

## Implementation status (2026-09-17)

**Phase 13.1 (verify transport compression): partial on hosted dev (2026-09-21).** `curl -sI -H 'Accept-Encoding: br,gzip'` against `get-health` and `list-public-pricing-plans` on `fwor…` returned `content-encoding: gzip` and `vary: Accept-Encoding, Origin`. `list-public-pricing-plans` body is ~6.5 KiB on mt-dev (largest public JSON checked so far). No explicit `CompressionStream` in `httpResponse.ts` yet (platform appears to compress JSON). Still outstanding: repeat on a **large authenticated** response (`list-bookings`, `dashboard-stats`) before treating host payloads as covered.

```bash
curl -sI -H 'Accept-Encoding: br, gzip' \
  "$SUPABASE_URL/functions/v1/list-bookings?..." -H "apikey: $ANON" | grep -i 'content-encoding\|content-length'
```

Run this against hosted dev for a representative large response (e.g. `list-bookings` or `dashboard-stats`), record whether `Content-Encoding` is present, and only add explicit `CompressionStream` compression to `httpResponse.ts` if it is absent. Do not skip this — Deno Deploy's default behavior for edge-function responses is asserted by the doc as "generally" compressing, not confirmed for this specific runtime/response shape.

**Phase 13.2 (shrink payloads — "the real win"): audited in full (257 `select('*')`/`select("*")` call sites across 102 files), zero narrowed this pass — all classified and documented as deferred.**

- Swept `supabase/functions/**` for `select('*')`/`select("*")` (excluding `*_test.ts`). 102 distinct files, three buckets:
  - **Already narrowed in a prior pass (not touched, confirmed clean):** every genuinely high-row-count public listing/search endpoint — `list-public-properties/index.ts`, `list-public-parkings/index.ts`, `list-public-developments/index.ts`, `list-public-place-groups/index.ts`, `search-listings/index.ts`, `search-suggestions/index.ts` — has **zero** `select('*')` call sites; each already selects an explicit narrow column list (verified by grep, e.g. `search-listings/index.ts:327` selects `'id, slug, name, type, city, residence_name, max_guests, settings, created_at'`). This is doc 10/11's earlier work, not this pass's — confirmed, not re-done.
  - **Small/narrow tables and single-row reads (majority of the 102 files, left as-is):** `organizations`/`properties`/`parkings` (`list-organizations/index.ts`, `list-properties/index.ts`, `list-parkings/index.ts`) — row counts in the tens per tenant, not thousands; their `settings` JSONB is a handful of flags, not a large blob. `organization_members`/`property_members`/`parking_team` member lists (`orgTeamService.ts`, `propertyTeamService.ts`, `parkingTeamService.ts`) — per-org/property team size is small (typically < 20), and `serializeMemberRow` already consumes most columns. `finance_line_items` (`financeService.ts:330`, `maintenanceService.ts:112` equivalents) and `maintenance_items` — both ~15-17 columns with no large JSONB, so `select('*')` vs. an explicit list saves near-nothing per row; the response mapper (`mapFinanceLineItemRow`/`mapMaintenanceItemRow`) already returns nearly every column anyway. `social_channel_connections`/`social_messages` (`socialInboxService.ts`) — narrow tables (9-12 columns), and connection rows hold OAuth token columns that are risky to touch without a dedicated pass. Plan catalog, support tickets, platform/org/parking settings, verification/approval rows — all small config-shaped tables, single-digit-to-low-hundreds row counts platform-wide, not per-tenant-growing lists.
  - **`guest_submissions` — the one genuinely wide table, explicitly deferred, not narrowed:** `_shared/financeService.ts:215` (`fetchAllBookingsForFinance`), `_shared/financeExport.ts:209` (`staysExportCsv`), `_shared/dashboardService.ts:533/540/602/612/638` (`computeDashboardStats`, polled every 60s per its own comment), and `_shared/databaseService.ts` (`listBookings`-adjacent reads) all `select('*')` on `guest_submissions`. This table has grown across 10+ migrations (guest fields for 5 occupants, pet fields, parking fields, ~8 document-type AI verdict/summary text-column pairs, PDF/valid-ID URLs, `document_requirement_completions` JSONB, SD refund fields) — well over 80 columns per `bookingDetailsPatch.ts`'s own patch allowlist alone, plus non-patchable system columns. Static reading found `financeService.ts` alone touches 54 distinct fields from this table, and those fields flow through `computeBookingFinancials` (`bookingFinance.ts`) which itself calls several more helpers (`buildSdExpenseProfitRows`, `parkingFeeForHostNet`, `petFeeForHostNet`, `guestBalanceForHostNet`, `computeOperatingHostNet`) with their own field access this pass did not fully trace. Narrowing this blind risks silently dropping a field a finance calculation needs — a regression in money math, not a cosmetic gap. Per the task's explicit conservatism instruction, this is **deferred, not guessed at** — a real fix needs either (a) a dedicated pass that traces every field `bookingFinance.ts`'s full call graph touches, or (b) reshaping these into a SQL view/RPC that returns only the finance-relevant projection, which is a bigger structural change than this doc's scope.
- **No script-detectable dynamic column-list evasion found** — confirmed via grep that no file builds a `select()` argument from a runtime-constructed string that could hide a wide fetch from the Phase 13.5 guard.

**Phase 13.3 (request payloads): verified, no violation found, no code change needed.**

- `_shared/bookingDetailsPatch.ts` already models the patch shape the doc asks to extend elsewhere: `BOOKING_PATCH_ALLOWED_COLUMNS` is a strict allowlist, `sanitizeBookingPatchPayload` rejects any key not on it, and the admin booking-detail UI already sends only changed fields through this path — nothing to extend this pass.
- Base64-in-JSON audit (`grep -rn base64 supabase/functions`): every hit is one of (a) email attachment encoding to Resend (`emailService.ts` — server-to-email-provider, never reaches a client JSON response), (b) AI vision requests sending image bytes to OpenAI/Gemini/Groq for receipt/document analysis (`receiptValidationService.ts`, `bookingAiReviewService.ts` — server-to-AI-provider), (c) crypto/signing token encoding (`secretsCrypto.ts`, `superAdminVerification.ts`, `settingsVerification.ts`, `resendWebhookVerify.ts`, `metaInboxCrypto.ts` — not media), or (d) one genuine, deliberate, bounded exception: `_shared/dashboardAssistantAttachments.ts` accepts base64 file bytes in the AI dashboard assistant's chat-attachment JSON payload from `ui/src/features/dashboard/ai-assistant/lib/chatAttachments.ts`, capped at `ASSISTANT_ATTACHMENT_MAX_BYTES` (4 MiB) × `ASSISTANT_ATTACHMENT_MAX_COUNT` (3 files) — the file's own header comment states why: bytes are immediately persisted to Storage and Gemini gets `inlineData` for that turn only, nothing is stored as base64. This is a small, capped, justified exception to the "never base64 in JSON" rule, not a violation to fix.
- Booking/guest document uploads (`_shared/uploadService.ts`) confirmed to take `File` objects (multipart), never base64-in-JSON, matching the doc's Storage-direct-upload expectation.

**Phase 13.4 (streaming/chunking): re-verified, already fine post-doc-10, no rewrite forced.**

- `_shared/financeExport.ts#staysExportCsv` (and `buildFinanceExportCsv`) still fetch the full filtered `guest_submissions` result set with one `await query` call and build the CSV as a single in-memory string before returning it — **not a true stream**. But doc 10's fix already scopes this by `property_id` + status + SQL-pushed period range (`check_in_date_sql`/`check_out_date_sql`) instead of the prior unscoped whole-org fetch, so the worst case is now bounded by one property's activity within a period rather than the entire tenant's history. Left as-is: a full rewrite to true chunked streaming is a bigger change than this pass's scope, and the doc explicitly says not to force one if the doc-10 fix already bounds the worst case reasonably. `activity-log-export/index.ts` (checked by doc 10, `MAX_ROWS = 20_000` cap) remains the stronger reference pattern for a future streaming pass.
- SSE (`_shared/dashboardAssistantStreamEvents.ts`) confirmed still `Cache-Control: no-cache, no-transform` — untouched, as required.

**Phase 13.5 (CI guard): done.** New script `scripts/dev/check-select-star.sh`, same shape as `check-cache-class.sh` (including its `rg`-with-`grep`-fallback pattern, verified working with `rg` off PATH) — flags any `select('*')`/`select("*")` in `supabase/functions/**` not in its `ALLOWLIST`, which currently lists every one of the 102 files found in the Phase 13.2 sweep. Wired into `.github/workflows/ci.yml` and `.github/workflows/cd-dev.yml` immediately after the existing cache-class guard step. Verified: passes clean on the current tree, and fails (exit 1, correct message) when a new unlisted `select('*')` is introduced (tested by temporarily appending one to `get-booked-dates/index.ts` and reverting).

**BREACH/CRIME capability-token review (edge case, not a phase): reviewed, no violation found, one lower-severity residual noted.**

- `get-form/index.ts`: the `access` query-string capability token is consumed by `authorizeGuestBookingAccess` and never echoed into the response body — the body is `{ success, data: formData, status, guestCanUpdate, message }`, no token field. **However**, `signGuestFormDataStorageUrls` does place freshly-signed Supabase Storage URLs (each carrying its own short-TTL signed-URL token in the query string) into the same response body alongside guest-editable free-text fields (`guest_special_requests`, names, etc.) — this is a real instance of "user-reflected content in the same payload as a capability-bearing value" per the doc's edge case. Assessed as low practical severity, not fixed this pass: (a) reading this response at all already requires a valid `access` token or an authenticated guest session — not open to anonymous attackers; (b) transport compression is unconfirmed (Phase 13.1 above), and BREACH requires a compression oracle to exploit; (c) the storage-URL tokens are single-purpose, short-TTL signed URLs, not long-lived session/CSRF credentials. Documented here per the doc's instruction to review and record the finding even without a code change; a future hardening pass could split signed-URL issuance into a separate endpoint from guest-editable field reads if this is judged worth closing.
- `get-guest-stay-guide/index.ts` → `loadGuestStayGuideByToken`/`buildGuestStayGuidePayload` (`_shared/guestStayGuide.ts`): the `token` query param is used only to look up the booking row and is never included in the returned DTO. The DTO's guest-influenced content (stay dates, `need_parking`) is fixed-format, not attacker-controllable arbitrary-length text, and no signed URL or token is embedded in this response. **Clean — no finding.**
- `get-form-completion/index.ts`: the `complete`/`token` param resolves via `resolveGuestFormCompletion` and is not echoed back; response is read-only stay/prefill data, no capability token in the body. **Clean — no finding.**

**Bugs found during self-review:** none in this pass's own changes. Re-confirmed the check-cache-class.sh `rg`-fallback pattern (the bug doc 11 fixed) before copying its shape into the new guard, and manually tested both the `rg` and `grep`-only code paths of the new guard to confirm they agree.

**Not attempted this pass:** response-size telemetry/logging and per-endpoint p95 budgets (doc's Phase 13.5 also lists this; out of scope — this pass's Phase 13.5 scope per the task was the CI guard only, telemetry is a separate, larger observability change); a `performance-budgets.json` size budget for the top 10 endpoints (same reason — no such file exists in this repo yet, would need to be created from scratch as a new artifact, judged out of scope for this pass); full field-graph tracing of `bookingFinance.ts`'s helpers to safely narrow `guest_submissions` (documented above as the reason Phase 13.2's highest-value target is deferred, not silently skipped).

## Measured before / after

| Metric                       | Before                      | After                                                                                                 | Difference                                                                                   |
| ---------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `select('*')` inventory      | Uncounted                   | 257 sites / 102 files classified                                                                      | Public listing endpoints already narrow (prior pass); wide `guest_submissions` left explicit |
| New unreviewed `select('*')` | Could land silently         | `check-select-star.sh` in CI                                                                          | Regression blocked                                                                           |
| Transport gzip/br            | Assumed                     | Verified on public endpoints + cd-dev `ci-smoke.sh` (2026-09-21); authenticated large JSON still open | Partial                                                                                      |
| Finance CSV                  | Unscoped org fetch (doc 10) | Property + period scoped (doc 10)                                                                     | Payload bounded by one property's period, still not streamed                                 |
| BREACH / capability tokens   | Unreviewed                  | `get-form` residual documented (signed URLs next to guest text); stay-guide and form-completion clean | No silent token echo                                                                         |

## Remaining work to finalize

`select('*')` inventory + CI guard are shipped. Transport proof, field narrowing, and payload budgets are not.

| #   | Work                                                                                                                                                                                                                                                           | Blocker                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | `curl -I` gzip confirmed on small public JSON (2026-09-21). **cd-dev:** `ci-smoke.sh` now fails deploy if `get-health` / `list-public-pricing-plans` lack gzip/br. Still need a **large** host endpoint sample; add function-level compression only if absent. | Auth token + large route |
| 2   | Narrow `guest_submissions` selects after a field-usage graph of finance/dashboard consumers. Do not guess columns.                                                                                                                                             | Code (careful)           |
| 3   | Stream finance CSV if memory or time becomes a problem at large-tenant volume (doc 10 seed).                                                                                                                                                                   | Seed + evidence          |
| 4   | Close or accept-with-reason the `get-form` residual (signed Storage URLs next to guest-editable fields).                                                                                                                                                       | Security review          |
| 5   | Response-size telemetry + top-10 payload budgets in `performance-budgets.json`.                                                                                                                                                                                | Hosted-dev + doc 00      |

## Goal

Every response is as small as it can be: compressed on the wire, and carrying only the fields the caller needs. Payload shape matters more than the codec.

## Current state

- Responses are built by `_shared/httpResponse.ts` with `JSON.stringify` and no compression negotiation and no `Vary: Accept-Encoding` (doc 11 adds the `Vary`).
- Supabase Edge Functions run on Deno Deploy, which generally applies gzip/brotli automatically for compressible content types. **This must be verified, not assumed** — it is one `curl` command.
- The larger, under-examined problem is **over-fetching**: `select('*')` patterns pull every column including large text/JSONB fields the client never renders.

## Phases

### Phase 13.1 — Verify transport compression

Against hosted dev, for a representative large response:

```bash
curl -sI -H 'Accept-Encoding: br, gzip' \
  "$SUPABASE_URL/functions/v1/list-bookings?..." -H "apikey: $ANON" | grep -i 'content-encoding\|content-length'
```

Record the encoding and the compressed vs uncompressed size in the doc-00 baseline. If nothing is negotiated, compress explicitly in `httpResponse.ts` using Deno's `CompressionStream` for payloads above a threshold (~1 KiB — below that, compression costs more than it saves).

**Edge case:** never compress the SSE stream (`dashboardAssistantStreamEvents.ts` already sets `no-transform`). Buffering compression breaks streaming; `no-transform` is there for a reason. Leave it.

### Phase 13.2 — Shrink the payloads themselves (the real win)

JSON compresses well, so a 40% codec win on a payload that is 3× larger than it needs to be is the wrong optimization. Audit and fix shape first:

| Pattern                                            | Fix                                                      |
| -------------------------------------------------- | -------------------------------------------------------- |
| `select('*')` on wide tables                       | Select explicit columns per endpoint                     |
| Large JSONB settings blobs returned with list rows | Return them only on the detail endpoint                  |
| Full nested objects where an ID would do           | Return IDs + a separate lookup, or a narrowed projection |
| Repeated denormalized parent data on every row     | Hoist to a top-level `included` map                      |
| Base64 blobs in JSON                               | Never — use a signed URL                                 |
| Verbose timestamps/nulls                           | Omit null fields; the client already defaults them       |
| Whole booking object returned from a transition    | Return the changed fields; the client has the rest       |

Grep `supabase/functions/**` for `select('*')` and classify every hit. This overlaps doc 10's audit — do them in one sweep.

### Phase 13.3 — Request payloads too

- Guest form submissions and settings writes send full objects where a patch would do. `bookingDetailsPatch.ts` already models the patch shape — extend that pattern.
- Media must never be base64 in a JSON body; confirm all uploads are multipart or direct-to-storage.
- Cap request body size server-side (a large-body DoS is a rate-limiting concern, doc 23).

### Phase 13.4 — Streaming and chunking for large responses

- Finance/booking exports: stream rather than build the whole payload in memory (doc 10 Phase 10.5). Edge functions have a hard memory ceiling.
- The AI assistant already streams via SSE — keep it uncompressed and unbuffered.

### Phase 13.5 — Guard

- Add response-size logging (payload bytes per endpoint) to the edge telemetry, and alert on p95 growth.
- Add a CI check flagging new `select('*')` in `supabase/functions/**` outside an allowlist.
- Add a size budget for the top 10 endpoints to `performance-budgets.json`.

## Edge cases

- **Compression is not encryption.** A compressed PII payload is still PII; doc 11's `no-store` classification still applies.
- **BREACH/CRIME class attacks** — compressing a response that mixes attacker-controlled input with a secret can leak the secret through size. Practically: never reflect user input into a response that also carries a CSRF token, session token, or capability token. This repo issues capability tokens in some guest responses (`get-form`, stay guide) — check those specifically.
- **Double compression** — compressing in the function when the platform also compresses wastes CPU and can corrupt headers. Verify first (13.1) and only compress explicitly if the platform does not.
- **Small-payload overhead** — compressing a 200-byte response makes it bigger. Threshold it.
- **Client decompression** — `fetch` handles this transparently; no client change needed. Do not hand-roll.
- **Field removal is a breaking change.** Narrowing a response can break a cached client, the PWA offline store, or a Playwright fixture. Ship narrowing behind a version or verify every consumer (including `offlineQueryAllowlist` snapshots).

## Exit gate

- [ ] Transport encoding verified on hosted dev for a **large** endpoint; explicit compression added only if absent. — **partial:** gzip on small public JSON (2026-09-21); large authenticated response still unmeasured.
- [x] Every `select('*')` in edge functions classified and narrowed or justified. — all 102 files classified (see status section); zero narrowed (the high-value public list endpoints were already narrowed by a prior pass, and the one genuinely wide table, `guest_submissions`, is explicitly deferred with reasons rather than guessed at).
- [ ] Top 10 endpoints' payload sizes reduced measurably vs the doc-00 baseline. — not attempted; no payload-size measurements were taken this pass (would need Phase 13.1's hosted-dev access, or a local harness not built this pass).
- [x] Exports stream; SSE stays uncompressed. — SSE confirmed untouched (`no-transform`); finance CSV export confirmed scoped (property + period, doc 10's fix) but still single-shot in-memory, not true streaming — judged acceptable, documented above, not rewritten.
- [x] No user-reflected content shares a response with a capability token. — reviewed `get-form`, `get-guest-stay-guide`, `get-form-completion`; one lower-severity residual found and documented (`get-form`'s signed Storage URLs alongside guest-editable fields), not fixed this pass — see review above.
- [ ] Response-size telemetry + budgets in place; CI flags new `select('*')`. — CI guard done (`scripts/dev/check-select-star.sh`, wired into `ci.yml`/`cd-dev.yml`); response-size telemetry and `performance-budgets.json` budgets not attempted, out of scope this pass (see "Not attempted this pass" above).

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/edge-functions.md` (response contract), `docs/PROJECT.md` (API shapes).
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
