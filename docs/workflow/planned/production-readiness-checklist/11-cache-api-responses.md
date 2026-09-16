---
title: 'Cache API responses'
status: active
tags: [workflow, planned, production-readiness, caching, edge-functions]
updated: 2026-09-16
stage: planned
kind: plan
---

# 11 — Cache API responses

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
