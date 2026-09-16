---
title: 'Defer non-critical scripts'
status: active
tags: [workflow, planned, production-readiness, performance, third-party]
updated: 2026-09-16
stage: planned
kind: plan
---

# 04 — Defer non-critical scripts

## Goal

Nothing that is not required to render the first screen may block it. Third-party code (analytics, maps, fonts, chat) loads after the app is interactive, and failure of any third party cannot break or delay the app.

## Current state — a real finding

`ui/index.html` loads **15 Google Font families** in a single render-blocking stylesheet:

```
Plus Jakarta Sans, Playfair Display, Cormorant Garamond, Fraunces, Instrument Serif,
Lora, Inter Tight, Space Grotesk, DM Sans, Outfit, Manrope, Sora, Jost, Figtree, Nunito Sans
```

Most are variable fonts with full weight ranges and italics. This is a `<link rel="stylesheet">` in `<head>` — **render-blocking**, on a third-party origin, on every single page load including the guest booking form.

Why it is there: the app offers host-selectable brand typography (public pages / marketing / email branding), so the font set is a _feature_, not an accident. That makes the fix "load the right one" rather than "delete 14".

`preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com` is already present and correct, and `display=swap` is already set — so the worst case is FOUT, not invisible text. The cost is the blocking CSS round-trip plus up to 15 font-file fetches.

Other head content: an inline theme-detection script (correct — it must be blocking to avoid a flash) and favicon links (harmless).

## Prior art

PostHog is already loaded through a first-party `/ingest` rewrite (`ui/vercel.json`) rather than a third-party script tag, which avoids blockers and most ad-block breakage. That is the pattern to follow for anything else added later.

## Phases

### Phase 4.1 — Font strategy (highest impact)

Decide one of three, in preference order:

| Option                                                                              | Win                                                                                                                      | Cost                                                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **A. Self-host only the fonts actually used per brand, subset to Latin**            | Eliminates the third-party round-trip entirely; `font-display: swap`; served from the same origin with immutable caching | Build step to fetch/subset; brand font switching must map to self-hosted files |
| **B. Keep Google Fonts but load only the default UI font blocking, the rest async** | Small change                                                                                                             | Still third-party dependent                                                    |
| **C. Keep as is**                                                                   | Zero work                                                                                                                | Blocking third-party CSS on every load                                         |

Recommended: **A for the default UI font** (`Plus Jakarta Sans`) + **B for the brand-selectable set**, loaded only on routes that actually render host-branded typography (public property pages, marketing previews).

Async pattern for the non-default set:

```html
<link rel="preload" as="style" href="<url>" onload="this.rel='stylesheet'" />
<noscript><link rel="stylesheet" href="<url>" /></noscript>
```

**Edge case:** brand fonts are also used in **emails** and **PDF generation** (server-side). Those paths do not read `index.html` — changing the web font loading must not silently change `_shared/email-templates/**` or `pdfService.ts` output. Verify rendered email + PDF after the change.

**Edge case:** subsetting to Latin breaks any non-Latin guest name in a rendered document. Guest names are free text from real users. Keep a Latin-Extended subset at minimum and confirm PDF/email paths use a font with the needed coverage.

### Phase 4.2 — Audit every third-party origin

Produce the full list of origins the app contacts at runtime: Google Fonts, Google Maps, Supabase, PostHog (`/ingest`), Meta Graph, PayMongo, Jamendo, Resend (server-side only). For each, record: loaded when, blocking or not, failure behavior, and whether a Content-Security-Policy `connect-src`/`script-src` entry will be needed (doc 22).

### Phase 4.3 — Defer what remains

- Any `<script>` added to `index.html` must be `defer` or `type="module"` (module is deferred by default) — add a lint/CI grep asserting no plain blocking `<script src>` appears in `index.html`.
- Maps loader: on demand only (doc 03).
- PostHog: already async via the SDK; confirm it is initialized after first paint and that a blocked `/ingest` cannot throw into the render path.

### Phase 4.4 — Resource hints

- `preconnect` for origins hit on the critical path only (already correct for fonts). More than ~4 preconnects is counterproductive.
- `preload` the LCP image and the default font file.
- `dns-prefetch` for on-demand origins (Maps, PayMongo).

### Phase 4.5 — Third-party failure isolation

For every third party, verify the app still renders when it is blocked (simulate with Playwright request interception returning a failure for that origin):

| Third party  | Must degrade to                                          |
| ------------ | -------------------------------------------------------- |
| Google Fonts | System font stack, no layout break                       |
| Google Maps  | "Map unavailable" placeholder, address still shown       |
| PostHog      | Silent no-op (already the E2E behavior)                  |
| PayMongo     | Clear error, no stuck spinner, booking not marked paid   |
| Meta Graph   | Inbox shows a connection error, other modules unaffected |

Add these as Playwright specs — this is the class of failure that only appears in production, on someone's corporate network.

## Edge cases

- **`onload="this.rel='stylesheet'"` and CSP** — inline event handlers are blocked by a strict CSP. Coordinate with doc 22: either a nonce, or move the swap to the deferred entry JS.
- **FOUT with brand fonts** — a host's brand font swapping in late looks broken on a public listing page. Use `size-adjust`/`ascent-override` on the fallback to minimize the reflow.
- **Ad blockers** already break many third parties; the `/ingest` rewrite handles PostHog. Do not add new third-party script tags that the app depends on functionally.
- **Fonts in the service worker precache** — self-hosted fonts are precache candidates and will grow the precache budget. Runtime-cache them instead with a long-lived `CacheFirst`.

## Exit gate

- [ ] Default UI font self-hosted, preloaded, immutable-cached; `index.html` has no render-blocking third-party stylesheet on the critical path.
- [ ] Brand font set loads only on routes that use it.
- [ ] Email + PDF rendering verified unchanged after the font change.
- [ ] Third-party origin inventory documented and feeding doc 22's CSP.
- [ ] Playwright specs prove graceful degradation for all five third parties above.
- [ ] CI grep blocks a new blocking `<script src>` in `index.html`.

## Docs / Plans / activity-log

- **Docs:** `docs/PROJECT.md` (third-party integrations), `docs/architecture/integrations.md`, `DESIGN.md` if the font stack changes.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
