---
title: 'Cache API responses'
status: active
tags: [workflow, planned, production-readiness, caching, edge-functions]
updated: 2026-09-17
stage: planned
kind: plan
---

# 11 — Cache API responses

## Implementation status (2026-09-17)

**Phases 11.1–11.3, 11.5, 11.7: done, scoped precisely. Phase 11.4: documentation only, as specified. Phase 11.6: a small, targeted pass, not a full audit.**

- **Phase 11.1 (classify every endpoint) — done at the infrastructure level, and deliberately done at the call-site level only for the genuinely public surface.**
  - `supabase/functions/_shared/httpResponse.ts` now exports a `CacheClass` union (`publicStatic` / `publicDynamic` / `publicAvailability` / `private` / `guestToken` / `mutation`) and a `CACHE_CONTROL` map matching the doc's table exactly. `jsonResponse(req, body, status, cacheClass)` and `jsonSuccess(req, data, extra, cacheClass)` both default `cacheClass` to `'private'` (`private, no-store`) when the caller omits it — **fail closed**, per the doc's own requirement. `jsonError` always responds `private`.
  - This was implemented as a new **trailing optional parameter**, not a required one, so all ~448 existing `jsonSuccess`/`jsonResponse` call sites across ~264 files stay source- and type-compatible with zero edits — they now get an explicit, correct `private, no-store` instead of no header at all, which closes the doc's stated security gap (nothing was previously marked private) without a 264-file mechanical sweep. A **required** parameter was considered and rejected: `jsonSuccess`'s existing 3rd positional argument (`extra`, an object merged into the envelope — used at 6 call sites in `finance-line-items`/`maintenance-items`) means a required 3rd param would have silently changed the meaning of `extra` at those sites in a way `tsc` would not catch (both are optional objects).
  - **13 functions explicitly annotated** with a `public*` class after individually verifying (a) the handler is genuinely public (`servePublic`, no auth), (b) the payload carries no per-viewer variation, and (c) — for the two given ETag — no embedded timestamp or signed URL:
    - `publicStatic` + ETag: `list-public-pricing-plans` (plan catalog), `get-residence-unit-types` (unit-type vocabulary).
    - `publicDynamic`: `get-public-property`, `get-public-parking`, `get-public-host`, `get-public-showcase` (published branch only — see below), `list-public-properties`, `list-public-parkings`, `list-public-developments`, `list-public-place-groups`, `search-listings`, `search-suggestions`.
    - `publicAvailability`: `get-booked-dates` (booked/blocked date ranges — short TTL, no `stale-while-revalidate`, since stale availability here means a guest sees a booked night as free).
  - **Deliberately NOT given a `public*` class, with a reason each:**
    - `get-public-platform-status` — this is the exact "maintenance mode" edge case the doc calls out by name. It's an anon-safe read, but per doc 11's edge cases, `maintenanceMode` must never be cached beyond the existing 60s in-memory `platformSettingsCache` path — a CDN/browser `public` directive would let users stay in maintenance (or miss it) for far longer than 60s. Stays at the safe default (`private, no-store`); the response itself is not sensitive, the directive is about staleness, not confidentiality.
    - `get-public-showcase`'s `?preview=1`/`?embed=1` branch — renders host-dashboard-only state (can include an unpublished draft). Explicitly forced to `'private'` even though the published branch of the same function is `publicDynamic`, so a preview URL is never eligible for shared-cache storage.
    - The 10 guest-PII/token-scoped functions the doc names (`get-form`, `get-form-completion`, `get-guest-booking-document`, `get-guest-payment-info`, `get-guest-review`, `get-guest-stay-guide`, `get-parking-booking-status`, `get-pay-parking`, `get-sd-form`, `get-team-invite-preview`) were **not** individually touched — they were already getting `private, no-store` from the new default before this change (they call `jsonSuccess`/`jsonResponse` with no class argument), so hand-annotating them with the doc's `guestToken` class would have been cosmetic (`guestToken` and the default `private` resolve to the same `no-store` semantics for a shared cache — the meaningful distinction the doc draws is "does a `public` directive ever apply here," and for all 10 the answer is no). Documented here rather than silently skipped.
    - All other ~250 edge functions (admin/org/property/parking/webhook/mutation surfaces) — left at the implicit `private` default per the task's own explicit scoping guidance ("you don't need to hand-annotate all 300 individually if the default is safe"). This is the one place this pass did **not** attempt a hand-verified sweep of every remaining function; see "Not attempted" below.
    - No standalone amenity/house-rule-vocabulary endpoint exists in this codebase (the doc's Public-static row lists one as an example) — that data is embedded inside `get-guest-payment-info` (guest-PII-scoped, stays private) and `get-public-property` (already `publicDynamic`). Noted here so a future pass doesn't go looking for a function that was never split out.
  - **Not audited for embedded Storage signed URLs**: `get-public-property`, `get-public-parking`, and `get-public-host` were checked at the handler layer (no signed-URL calls visible) but their backing services (`publicPropertyService.ts`, `parkingScope.ts#loadPublicParkingBySlug`, `publicHostService.ts`) were not traced end-to-end for every media field. Grepping the `_shared` tree confirms `createSignedUrl` is used only by `bookingDocumentShareToken.ts`, `listingAuthorizationAssetUpload.ts`, `orgVerificationAssetUpload.ts`, and `storageSignedUrl.ts` (none of which the public listing/detail/search services import), which is reassuring but not a substitute for tracing every field. Because of that residual uncertainty, these three responses were given a `Cache-Control` but **not** an ETag (`jsonSuccess(..., 'publicDynamic')`, not `jsonSuccessWithETag`) — a mismatched or stale ETag on a signed-URL payload is worse than no ETag at all (doc's own Phase 11.3 edge case). The list/search endpoints (`list-public-properties` etc.) use `getPublicUrl`-style permanent bucket URLs per their own serialization code, not signed URLs, so this risk doesn't apply to them, but they weren't given ETag either — see the deferred item below.

- **Phase 11.2 (`Vary`) — done as part of the same header plumbing.** `cacheHeaders()` in `httpResponse.ts` adds `Vary: Origin, Accept-Encoding` to every response using a `public*` class (never to `private`/`guestToken`/`mutation` responses — a `no-store` response is never stored by anything that needs to disambiguate variants, so a `Vary` header there is inert at best). A `varyAuthorization` parameter exists on the internal `cacheHeaders()` helper for a future endpoint that's cacheable but has an authenticated variant; none of the 13 annotated endpoints need it (all are anon-only, no auth-varying response shape), so it isn't wired to the public `jsonSuccess`/`jsonSuccessWithETag` signature yet — see deferred items.

- **Phase 11.3 (ETag / `If-None-Match` → 304) — done via a new `jsonSuccessWithETag` helper**, added alongside `jsonSuccess` rather than folded into it (keeping ETag opt-in per call site, since — per the doc's own edge case — it's actively wrong for a payload with a timestamp or signed URL). Uses FNV-1a (not a cryptographic hash — documented inline as such) over the serialized JSON body; a matching `If-None-Match` returns a bodyless `304` with the same `Cache-Control`/`Vary`/`ETag` headers. Wired into the two `publicStatic` endpoints (`list-public-pricing-plans`, `get-residence-unit-types`) where the "no timestamp, no signed URL" precondition was verifiable by reading the full handler. The `publicDynamic`/`publicAvailability` endpoints were left on plain `Cache-Control` (no ETag) — see deferred items; this is the doc's "cheapest win after 11.1," not claimed as fully executed for every eligible endpoint.
  - **Correction to the doc's own edge-case list**: `handleOptions`'s `OPTIONS` response already carries `Access-Control-Max-Age: 7200` — see `_shared/cors.ts:72` (`'Access-Control-Max-Age': '7200', // 2 hours - Chrome's maximum limit'`). The doc states this header is "currently missing"; it is not. No code change was needed for this edge case; noting the correction here so the exit-gate checklist isn't chasing a already-closed item.

- **Phase 11.4 (invalidation) — documentation only, as the doc itself specifies** ("do not build a complex purge system first"). Time-based expiry via the TTLs in `CACHE_CONTROL` is the whole mechanism: `publicStatic` (5min browser / 1h CDN / 1-day SWR), `publicDynamic` (1min / 5min / 10min SWR), `publicAvailability` (30s / 60s, deliberately no SWR). No purge/invalidation code was added. If a specific listing-publish latency complaint surfaces in practice, the concrete follow-up is a purge call from the property/parking settings-save path — not attempted here, no evidence yet that it's needed.

- **Phase 11.5 follow-up (2026-09-17 review):** Workbox `CacheableResponsePlugin` only checks status 200, so a `private, no-store` 200 (showcase `?preview=1`/`?embed=1`, or any future mis-classified public name) could still be written to Cache Storage. The SW now (a) does not match showcase preview/embed URLs and (b) drops any response whose `Cache-Control` contains `private` or `no-store`.

- **Phase 11.5 (reconcile the service worker) — done, and this is the fix for the doc's own "most serious single issue."**
  - `ui/src/pwa/sw.ts`'s `READONLY_FUNCTION_RE` (a `get-|list-|<explicit admin/tenant function names>` prefix regex, 3-day `maxAgeSeconds`) is removed. In its place: `SW_CACHEABLE_FUNCTIONS`, a new explicit `ReadonlySet<string>` in `ui/src/pwa/shared.ts` (imported by both the worker and, potentially, app code — mirroring how `offlineQueryAllowlist.ts#OFFLINE_PERSIST_KEY_ROOTS` is structured, per the task's explicit instruction to mirror that file's shape), containing **only** the 13 function names given a `public*` class in Phase 11.1 (13 in the classification, 13 in the SW allowlist — deliberately the same set; `get-public-platform-status` is excluded from both for the maintenance-mode reason above).
  - **This is a real, verified security fix, not just a refactor.** The old regex's explicit admin/tenant name list (`dashboard-stats`, `finance-summary`, `finance-bookings`, `finance-line-items`, `maintenance-items`, `maintenance-summary`, `notifications-list`, `social-inbox-threads`, `social-inbox-messages`, `org-settings`, `property-templates-settings`, `parking-settings`, `guest-trips`, `guest-messages`, `guest-profile`) — every one of them now server-classified `private, no-store` — was being runtime-cached by the SW for up to 3 days. On a shared/kiosk device (the PWA's own docs describe Tier A as installable admin dashboard usage), that's a multi-day-stale copy of another operator's booking/finance/guest data sitting in Cache Storage after logout, since Cache Storage (unlike the query persister) isn't automatically scoped per signed-in identity the way `queryPersister.ts` is. The fix removes every one of those 15 names from what the SW can runtime-cache; only the 13 genuinely public function names remain reachable.
  - The general allowlist's max-age also dropped from 3 days to 10 minutes (matching the booking-status route's own existing 10-minute fallback window) — even the newly-allowlisted public data has no reason to serve a multi-day-stale copy; NetworkFirst with a 6s timeout means this only ever activates as an offline/flaky-network fallback, not a substitute for a live fetch.
  - `get-booking`/`list-bookings` keep their pre-existing separate `BOOKING_STATUS_FUNCTION_RE` route (registered first, 10-minute max-age, its own cache name) — unchanged by this pass; it was already correctly scoped and excluded from the broad regex before this change.
  - Verified via `bun run type-check` (runs the dedicated `ui/src/pwa/tsconfig.json` project — `WebWorker` lib, no DOM — confirming the worker-only import boundary documented in `sw.ts`'s own header comment still holds) and manual review of every remaining `registerRoute` call in the file. **Not verified**: an actual browser/Playwright assertion that a `no-store` response never lands in the SW's Cache Storage (the doc's exit-gate line "verified by test") — no such test existed before this pass and writing one (mocking `caches`/`fetch` inside a Playwright service-worker context) was judged out of scope for this session; flagged as the concrete next step.

- **Phase 11.6 (client `staleTime` tuning) — a small, targeted pass, explicitly not a full audit** (matches the doc's own "lowest priority, don't do a deep audit" framing). Checked the `staleTime` on all 12 hooks consuming the 13 newly-classified public endpoints; 10 already had a reasonable value (30s–5min, roughly matching their server `max-age`). Two gaps fixed: `usePublicParkingDetail.ts` had no `staleTime` at all (fell to the 15s global default, shorter than the server's own 60s `publicDynamic` max-age — pointless extra refetching) and `useResidenceUnitTypes.ts` had none either (development unit-type vocabulary, `publicStatic`, should be long-lived). Both now set an explicit `staleTime` matching their server class.

- **Phase 11.7 (CI guard) — done.** New `scripts/dev/check-cache-class.sh` (same ripgrep/grep-fallback + explicit-allowlist shape as `check-serve-public-rate-limit.sh` and `check-unbounded-select.sh`), wired into `.github/workflows/ci.yml` and `cd-dev.yml` in the same step list as the other two guards. It is a **two-way** check, not just "flag a missing class": (1) every function in its `PUBLIC_CACHE_FILES` allowlist must actually contain a `'publicStatic'`/`'publicDynamic'`/`'publicAvailability'` string (catches a future edit silently regressing a public endpoint back to the private default), and (2) no function file **outside** that allowlist may contain one of those three strings (catches a `public*` class being pasted onto — or copy-pasted into — the wrong, tenant-scoped endpoint, which the doc calls out as a cross-tenant leak). It does not attempt to verify per-call-site correctness inside a file with multiple `jsonSuccess` calls at different classes (e.g. `get-public-showcase`'s private-preview vs. public-published branches) — that granularity needs code review, not a line-scan; documented as a limitation in the script's own header comment, matching how `check-unbounded-select.sh` documents its own heuristic limits.
  - **Bug found and fixed during self-review**: the script's first version called `rg` unconditionally with no fallback. This environment's `rg` binary is not on `PATH` for non-interactive `bash -c` invocations (confirmed: `command -v rg` fails, even though an interactive shell can resolve it via a wrapper) — meaning the script as first written would have failed in exactly the CI environment it's meant to run in. Rewritten with the same `command -v rg >/dev/null 2>&1` → `grep -RIlE`/`grep -Eq` fallback pattern the two existing guard scripts already use. Re-tested after the fix: `bash scripts/dev/check-cache-class.sh` exits 0 locally.

**Not attempted this pass (deferred, with reasons):**

- **A hand-verified `public*`/`private` classification of the remaining ~250 non-public edge functions.** The default (`private, no-store`) is safe for all of them today because it's what they were already effectively getting (no header at all, which this change replaces with an explicit deny-cache directive) — but the doc's Phase 11.1 exit gate technically asks for "all 300 functions classified... committed as a table." No such table exists. Building one honestly (reading all ~250 files rather than assuming) is a full-day-scale audit on its own; the task's own scoping note explicitly allows deferring this as long as the default is safe and the genuinely-public surface is deliberately annotated, which is what this pass did.
- **ETag on the 11 `publicDynamic`/`publicAvailability` endpoints** (only the 2 `publicStatic` ones got it). These payloads are larger and their "no timestamp, no signed URL" precondition was only verified at the top-level handler, not traced through every nested service function — adding ETag to a payload that turns out to embed something request-varying would produce a permanently-non-matching (i.e. useless) ETag, silently wasting the hashing cost with zero 304s. Worth doing once each backing service is confirmed clean; not done blind.
- **A Playwright/curl assertion against a deployed preview** (the doc's own exit-gate line: "no endpoint in a `no-store` class ever returns a `public` directive," and "verified on a deployed preview with `curl -I`"). This pass verified the logic locally (type-check, Deno unit tests, the new CI guard) but did not deploy and curl a live preview — no preview environment was available in this session.
- **`Vary: Authorization`** is plumbed as an internal parameter (`cacheHeaders(cacheClass, varyAuthorization)`) but not exposed on the public `jsonSuccess`/`jsonSuccessWithETag` signatures, since none of the 13 annotated endpoints currently have an authenticated variant. Add the parameter to the public signature if/when a `public*`-classified endpoint gains one (e.g. a "signed-in guests see extra fields" variant).

## Measured before / after

| Metric                   | Before                                                                      | After                                                                                                               | Difference                                                        |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| JSON `Cache-Control`     | **None** on ~448 `jsonSuccess`/`jsonResponse` call sites                    | Default `private, no-store` (fail closed)                                                                           | Tenant/guest PII is explicitly uncacheable                        |
| Public reads             | Re-executed on every hit                                                    | 13 functions classified (`publicStatic` / `publicDynamic` / `publicAvailability`) + `Vary: Origin, Accept-Encoding` | Listing/search/catalog can be cached                              |
| ETag / 304               | None                                                                        | `list-public-pricing-plans`, `get-residence-unit-types`                                                             | Repeat catalog hits can be bodyless                               |
| Service worker API cache | Broad `get-*`/`list-*` regex, **3-day** TTL, included 15 admin/tenant names | Explicit 13-name allowlist, **10-minute** TTL                                                                       | Shared/kiosk device no longer keeps 3-day finance/inbox/guest PII |
| Showcase preview         | Same function name as the public page                                       | URL excluded (`?preview=1`/`?embed=1`); `private`/`no-store` responses are not written to Cache Storage             | Unpublished drafts cannot land in the SW                          |
| Client `staleTime`       | 2 public hooks used the 15s global default                                  | Parking detail + unit types match server class                                                                      | Fewer pointless refetches                                         |
| CI                       | None                                                                        | Two-way `check-cache-class.sh`                                                                                      | A `public*` class on the wrong file fails CI                      |

## Remaining work to finalize

Fail-closed `Cache-Control`, 13 public classifications, 2 ETags, SW allowlist, and the CI guard are shipped. Full inventory and deployed proof are not.

| #   | Work                                                                                                               | Blocker        |
| --- | ------------------------------------------------------------------------------------------------------------------ | -------------- |
| 1   | Classify all ~300 functions into the cache-class table (not only the 13 public reads).                             | Code audit     |
| 2   | Add ETag / 304 to the remaining public endpoints that are `publicStatic` or `publicDynamic`.                       | Code           |
| 3   | On a deployed preview, `curl -I` each class and record the live `Cache-Control` / `Vary` / `ETag`.                 | Hosted preview |
| 4   | Playwright (or equivalent) asserting tenant/guest JSON is `private, no-store` and is not written to Cache Storage. | Playwright     |

## Goal

Every read endpoint declares an explicit, correct caching policy. Public, non-personalized data is cached at the edge and in the browser; anything tenant- or guest-scoped is explicitly marked uncacheable so no intermediary ever stores it.

## Current state — a real, verified gap

`_shared/httpResponse.ts` builds **every** JSON response with exactly two headers: CORS + `Content-Type`. There is **no `Cache-Control` header on any JSON endpoint** across all 300 edge functions. The only `Cache-Control` in the entire `_shared` tree is `no-cache, no-transform` on the assistant SSE stream (`dashboardAssistantStreamEvents.ts:72`).

Two consequences, and the second is the dangerous one:

1. **No public read is cached**, so every guest hitting a listing page re-executes the full query. Pure waste.
2. **Nothing is explicitly marked private.** Absent `Cache-Control`, intermediaries apply heuristic caching. Responses carrying guest PII and booking data have no directive telling a proxy, browser, or CDN not to store them. This is a **security finding**, not only a performance one — it belongs to doc 22 as well.

Existing caching that does work, and should be the model:

| Layer                       | Where                              | Shape                                                                          |
| --------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| In-memory platform settings | `_shared/platformSettingsCache.ts` | 60s TTL, module-scope                                                          |
| AI response cache           | `_shared/aiQuotaCache.ts`          | DB-backed, 1h TTL, SHA-256 prompt fingerprint                                  |
| Client query cache          | `App.tsx` QueryClient              | `staleTime: 15_000` global default                                             |
| Service worker              | `ui/src/pwa/sw.ts`                 | Runtime caching with a known over-broad regex (filed in the perf sibling plan) |

## Phases

### Phase 11.1 — Classify every endpoint

Each of the 300 functions gets exactly one cache class. This classification is the deliverable; the header is the easy part.

| Class                            | `Cache-Control`                                                    | Applies to                                                                            |
| -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **Public static**                | `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400` | Plan catalog, platform brand, public app config, amenity/house-rule vocabularies      |
| **Public dynamic**               | `public, max-age=60, s-maxage=300, stale-while-revalidate=600`     | Property/parking listings, search results, public host profiles, public pages         |
| **Public + availability**        | `public, max-age=30, s-maxage=60`                                  | Calendar availability, pricing — short TTL; stale availability causes double bookings |
| **Authenticated, tenant-scoped** | `private, no-store`                                                | Every admin/host/org/property/parking read                                            |
| **Guest PII / token-scoped**     | `no-store`                                                         | `get-form`, stay guide, signed-URL issuers, anything with a capability token          |
| **Mutations**                    | `no-store`                                                         | All POST/PATCH/DELETE                                                                 |

Implement as an explicit argument to `jsonSuccess`/`jsonResponse` so the choice is visible at each call site, with the **safe default being `private, no-store`**. A function that forgets to declare must fall closed, never open.

### Phase 11.2 — Add `Vary` correctly

Any cacheable response must set `Vary: Origin, Accept-Encoding` — and `Vary: Authorization` if a shared cache could ever see an authenticated variant. Getting `Vary` wrong on a CORS + auth surface is the classic way one tenant's response is served to another. Since CORS headers already vary by `Origin` (`_shared/cors.ts`), `Vary: Origin` is mandatory on every cacheable response.

### Phase 11.3 — Conditional requests

For public dynamic reads, add `ETag` (hash of the serialized payload) and honor `If-None-Match` with a `304`. This turns a repeated listing fetch into a header-sized response without any TTL-staleness tradeoff. Cheapest real win after Phase 11.1.

**Edge case:** an ETag computed over a payload that embeds a timestamp or a freshly signed URL changes every request and is useless. Compute it over the stable data, or omit ETag on those endpoints.

### Phase 11.4 — Invalidation

A cache without invalidation is a correctness bug waiting for a support ticket.

| Cached thing         | Invalidated when                                             |
| -------------------- | ------------------------------------------------------------ |
| Public listing       | Property settings, media, or publish state changes           |
| Availability/pricing | Booking transition, blocked dates, pricing calendar edit     |
| Plan catalog         | Super-admin plan edit                                        |
| Platform settings    | Super-admin settings write (the 60s TTL already bounds this) |

Since TTLs are short, **time-based expiry is the primary mechanism** and explicit purge is the optimization. Do not build a complex purge system first — pick TTLs the product can tolerate, then add purge only where the staleness is user-visible (listing publish is the obvious one: a host who publishes and does not see it live within seconds will file a bug).

### Phase 11.5 — Reconcile with the service worker

`ui/src/pwa/sw.ts` `READONLY_FUNCTION_RE` broadly matches `get-*`/`list-*` with a 3-day `maxAgeSeconds`, so booking status can be served up to 3 days stale (already filed in the perf sibling plan). Fix it here in the same pass as the server headers so the two layers agree:

- Replace the prefix regex with an explicit allowlist mirroring `offlineQueryAllowlist.ts`.
- Never runtime-cache anything in the `no-store` classes.
- Let the SW respect the server's `Cache-Control` rather than override it.

**Edge case:** a `no-store` response cached by the SW is a **persistent PII leak on a shared device**. This is the most serious single issue in this doc.

### Phase 11.6 — Client cache tuning

Complete the `staleTime` work already specified in the perf sibling plan (org, org settings, team lists). Align tiers with the server classes: reference data long, tenant data short, availability shortest.

### Phase 11.7 — Guard

- CI check: every `jsonSuccess`/`jsonResponse` call site passes an explicit cache class (same enforcement shape as `check-serve-public-rate-limit.sh`).
- Playwright/curl assertion on a deployed preview: no endpoint in a `no-store` class ever returns a `public` directive.

## Edge cases

- **Caching an authenticated response publicly is a cross-tenant data leak.** Treat every `public` directive as a security-reviewed decision, not a performance tweak.
- **`s-maxage` vs `max-age`** — `s-maxage` targets shared caches (CDN) and lets you keep a long edge TTL with a short browser TTL. Preferred shape for public dynamic reads.
- **`stale-while-revalidate`** keeps the site fast during origin slowness but serves stale data during an incident, which can hide an outage from users while alerting fires. Acceptable for listings, not for availability.
- **Maintenance mode** — `platform_settings.maintenanceMode` must not be served from a long-lived cache, or users stay in maintenance after it is lifted. Keep it on the 60s in-memory path only.
- **Signed URLs in cached payloads** — a cached listing embedding a 60-minute signed media URL serves expired URLs to later visitors. Either exclude signed URLs from cacheable payloads or set the TTL below the signature lifetime.
- **CORS preflight** — `OPTIONS` responses should carry `Access-Control-Max-Age` to cut preflight volume; currently `handleOptions` sets none.
- **Edge function cold start** — module-scope in-memory caches (like `platformSettingsCache`) are per-instance and vanish on cold start. They reduce load but guarantee nothing. Do not rely on them for correctness or for rate limiting (doc 23 already uses a durable limiter — good).

## Exit gate

- [ ] All 300 functions classified; classification committed as a table in `docs/architecture/edge-functions.md`.
- [ ] `jsonSuccess`/`jsonResponse` require an explicit cache class, defaulting to `private, no-store`.
- [ ] `Vary: Origin` on every cacheable response.
- [ ] ETag + `304` on public dynamic reads.
- [ ] SW allowlist replaces the broad regex; no `no-store` response is ever SW-cached (verified by test).
- [ ] Verified on a deployed preview with `curl -I` across one endpoint per class.
- [ ] CI check blocks a call site with no declared cache class.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/edge-functions.md` (mandatory — new response contract), `docs/architecture/pwa.md` (SW caching), `.cursor/rules/supabase-edge-functions.mdc`.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A — read paths.
