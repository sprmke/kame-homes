---
title: 'Add CDN'
status: active
tags: [workflow, planned, production-readiness, cdn, caching, hosting]
updated: 2026-09-17
stage: planned
kind: plan
---

# 16 — Add CDN

## Goal

Every static byte is served from an edge location with correct cache headers; media is not served straight from origin storage; and the CDN layer is a deliberate configuration rather than a platform default nobody has checked.

## Remaining work to finalize

**Status: partial — headers, Storage cacheControl, config CI, and purge docs shipped (2026-09-18).** Deployed-preview `curl` and Manila latency still need hosted access.

| #   | Work                                                                                                                                                                                                                                           | Blocker                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | Deployed-preview header audit for every asset class (16.1). **Partial on dev** — `verify:deployed-preview` covers HTML, hashed JS, favicon, `sw.js`, `manifest.webmanifest` (2026-09-21). Full asset-class matrix + Manila latency still open. | Hosted preview         |
| 2   | ~~Set `index.html` to `must-revalidate`; give `ui/public/**` deliberate policies; keep `immutable` only on hashed files (16.2).~~ **Done** — `/index.html` rule + 8 unhashed-asset rules added to `ui/vercel.json`.                            | —                      |
| 3   | ~~Verify Storage `cacheControl` at upload~~ **Done** — shared helpers plus the remaining handler-level `.upload()` sites. CI: `check-storage-cache-control.mjs`. Private/signed media stays uncacheable.                                       | —                      |
| 4   | ~~Security headers at the edge~~ **Done** — HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Config CI: `check-vercel-headers.sh`. Full CSP still deferred to doc 22.                                                  | Doc 22                 |
| 5   | Measure Manila → Vercel edge and Manila → Supabase region latency; record the regional decision (16.5).                                                                                                                                        | Hosted + display       |
| 6   | Post-deploy stale-tab: old tab → new deploy → update prompt, no blank screen (16.6). Cross-check doc 01.                                                                                                                                       | Two sequential deploys |

## Measured before / after

| Metric                                     | Before                  | After                                                                    | Difference                                      |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| `/index.html` Cache-Control                | Implicit / none         | `public, max-age=0, must-revalidate`                                     | Deploys cannot pin a stale HTML → deleted chunk |
| Unhashed `ui/public` trees                 | No rule                 | Weekly max-age + SWR, not `immutable`                                    | Safe to replace icons/templates                 |
| Security headers                           | Cache directives only   | HSTS + nosniff + referrer + permissions                                  | Config-complete; CSP still doc 22               |
| Handler `.upload()` without `cacheControl` | 9 sites (default 3600s) | 0; CI fails a new miss                                                   | Default TTL cannot land again                   |
| Deployed `curl -I` / Manila latency        | Unmeasured              | `verify:deployed-preview` on dev (2026-09-21); Manila latency still open | Partial on dev                                  |

## Current state

| Asset class                                           | Delivery today                                                        | Status                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| Hashed JS/CSS (`/assets/*`)                           | Vercel CDN, `public, max-age=31536000, immutable` in `ui/vercel.json` | **Correct already**                             |
| `index.html`                                          | Vercel, `public, max-age=0, must-revalidate`                          | **Correct**                                     |
| `sw.js`, manifest, `pwa-version.json`, `offline.html` | Explicit short/no-cache headers                                       | **Correct already**                             |
| `ui/public/**` (icons, templates, og images)          | Weekly max-age + SWR; never `immutable`                               | **Correct**                                     |
| Uploaded media (Supabase Storage)                     | Explicit `cacheControl` at every `.upload()`                          | Config done; live CDN HIT/MISS still unverified |
| Edge function JSON                                    | No cache headers at all                                               | Doc 11                                          |
| Google Fonts                                          | Third party                                                           | Doc 04                                          |

Config is in place. The remaining gap is verification that deployed headers and Storage CDN HIT/MISS match the config.

## Phases

### Phase 16.1 — Verify what is actually served

Do not trust the config file; check the deployed preview:

```bash
for p in /assets/<hashed>.js /index.html /icons/apple-touch-icon.png /favicon/favicon.svg; do
  curl -sI "https://<preview>$p" | grep -iE 'cache-control|age|x-vercel-cache|content-encoding'
done
```

Record `x-vercel-cache` HIT/MISS behavior and the negotiated encoding (feeds doc 02). Commit results to the doc-00 baseline.

### Phase 16.2 — Close the header gaps

Add to `ui/vercel.json`:

- `/index.html` → `public, max-age=0, must-revalidate` (explicit, so a stale HTML never pins users to a deleted chunk — the doc 01 failure mode).
- `/icons/*`, `/favicon/*`, `/templates/*` → long `max-age` with `stale-while-revalidate`, since they are unhashed and change rarely. If any must be updated on demand, keep them short and version by query string instead.
- Confirm the `/ingest/*` PostHog rewrites are not cached.

**Edge case:** an immutable header on an **unhashed** file is a trap — you cannot update it for a year. Only hashed filenames get `immutable`.

### Phase 16.3 — Media delivery

- Confirm public Storage buckets serve via the Storage CDN with a long `cacheControl` set at upload time (`uploadService.ts` should be setting it — verify; the default is often 3600).
- Private buckets use short-lived signed URLs and are **not** CDN-cacheable by design. Do not attempt to cache them; the URL is per-request.
- If doc 09's transform layer ships, its outputs must be cached hard (transforms are billed per request).

**Edge case:** a long `cacheControl` on an object that gets replaced in place (doc 09's backfill) serves the old bytes until expiry. Either use content-addressed paths or plan a purge.

### Phase 16.4 — Security headers at the edge

The header block in `ui/vercel.json` currently contains **only** cache directives. Verified 2026-09-16: no `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`.

Add them here (the CDN/hosting layer is where they belong), with the full policy work owned by doc 22:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` restricting camera/microphone/geolocation to what the app actually uses (note: the AI voice receptionist needs microphone; map views may need geolocation — do not blanket-deny)
- `Content-Security-Policy` — start in `Report-Only`, using doc 04's third-party origin inventory

### Phase 16.5 — Multi-region and origin considerations

- The app's users are Manila-centric. Confirm the Supabase project region is the nearest available and that the Vercel deployment serves static assets from the local edge. A CDN cannot fix an origin round-trip to a distant region, and every edge function call is an origin call.
- Measure real latency from Manila to both the Vercel edge and the Supabase region (doc 00 Phase 0.3).
- If edge-function latency from Manila is the dominant cost, that is a **regional hosting decision** (doc 25), not something a CDN solves.

### Phase 16.6 — Purge and deploy behavior

- Document how to purge (Vercel invalidates on deploy for static assets; Storage objects do not purge automatically).
- Verify that after a deploy, a user with an open tab and a cached `index.html` gets the update — this is the PWA update flow (`PwaProvider.tsx`) plus the chunk-error boundary from doc 01.

## Edge cases

- **Caching HTML too long breaks deploys** — users load an old `index.html` referencing deleted hashed chunks and get a blank screen. The single most common CDN incident.
- **CDN caching an authenticated response** — if edge functions ever move behind the CDN, doc 11's classification becomes load-bearing for security. Never cache a response without `Vary: Origin` and an explicit class.
- **`Vary: Accept-Encoding` missing** can cause a brotli response to be served to a client that did not request it.
- **Cookie-based variance** — this app uses bearer tokens rather than cookies for API auth, which avoids the worst CDN variance bugs. Keep it that way.
- **CORS + CDN** — a cached response carrying `Access-Control-Allow-Origin` for origin A served to origin B breaks. `Vary: Origin` is mandatory (doc 11).
- **Service worker vs CDN** — two caching layers with different TTLs produce confusing staleness. The SW should defer to server headers (doc 11 Phase 11.5).
- **CSP and the PWA** — a strict `script-src` can block the SW registration script or inline theme script in `index.html`. That inline script must be kept (it prevents a theme flash), so it needs a hash or nonce. Report-Only first, always.

## Exit gate

- [ ] Deployed-preview header audit recorded for every asset class. (Blocked — no hosted preview access this session.)
- [x] `index.html` explicitly `must-revalidate`; unhashed public assets have deliberate policies; `immutable` only on hashed files.
- [x] Storage `cacheControl` verified at upload; private/signed media excluded from caching by design.
- [x] Security headers added at the edge (CSP itself deferred to doc 22 — no triage owner assigned yet). Config CI: `check-vercel-headers.sh`.
- [ ] Manila-origin latency measured to both Vercel edge and Supabase region; regional decision documented. (Blocked — no hosted access.)
- [ ] Post-deploy stale-tab behavior verified end to end (old tab → new deploy → update prompt, no blank screen). (Blocked — needs two sequential deploys.)

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/deployment.md` (mandatory), `docs/architecture/storage.md`, `docs/architecture/pwa.md`, `docs/PROJECT.md` (env/hosting).
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
