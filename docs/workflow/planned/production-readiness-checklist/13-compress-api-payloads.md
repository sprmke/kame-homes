---
title: 'Compress API payloads'
status: active
tags: [workflow, planned, production-readiness, performance, edge-functions]
updated: 2026-09-16
stage: planned
kind: plan
---

# 13 — Compress API payloads

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

- [ ] Transport encoding verified on hosted dev for a large endpoint; explicit compression added only if absent.
- [ ] Every `select('*')` in edge functions classified and narrowed or justified.
- [ ] Top 10 endpoints' payload sizes reduced measurably vs the doc-00 baseline.
- [ ] Exports stream; SSE stays uncompressed.
- [ ] No user-reflected content shares a response with a capability token.
- [ ] Response-size telemetry + budgets in place; CI flags new `select('*')`.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/edge-functions.md` (response contract), `docs/PROJECT.md` (API shapes).
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
